"""Invoice processing service -- drives the LangGraph reconciliation pipeline."""

import logging
import re
import time
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.graph import reconciliation_graph
from app.models.database import (
    Discrepancy,
    Invoice,
    InvoiceLineItem,
    LineItemMatch,
    Reconciliation,
)
from app.observability.tracing import create_trace, end_trace, trace_agent_step, flush as flush_traces
from app.tools.db_queries import check_duplicate_invoice

logger = logging.getLogger(__name__)


# Outcome constants returned by `process_invoice` so the worker can
# distinguish transient races (retry) from real failures (drop).
OUTCOME_SUCCEEDED = "succeeded"
OUTCOME_SKIPPED_NOT_FOUND = "skipped_not_found"
OUTCOME_FAILED = "failed"


# After each named graph node finishes, set the invoice to this status
# so the live pipeline visualizer can reflect progress one stage at a
# time. "detecting" exists purely so the anomaly node has a status to
# light up under -- it would otherwise be invisible since the matcher
# would flip straight to "resolving".
_NODE_TO_STATUS_AFTER: dict[str, str] = {
    "parse_invoice": "matching",
    "match_records": "detecting",
    "detect_anomalies": "resolving",
}


def _sanitize_error(raw: str | None, max_len: int = 200) -> str:
    """Strip SQLAlchemy/asyncpg/stack noise from an exception message and truncate.

    Raw asyncpg errors include `[SQL: ...]`, `[parameters: (...)]`, and class
    prefixes like `(sqlalchemy.dialects.postgresql.asyncpg.IntegrityError)`.
    Surfacing those verbatim in the UI is ugly and leaks internals; this
    keeps just the first useful line, capped at `max_len` chars.
    """
    if not raw:
        return "Unknown error"
    first_line = raw.split("\n", 1)[0].strip()
    clean = re.sub(r"\s*\[SQL:.*", "", first_line)
    clean = re.sub(r"\s*\[parameters:.*", "", clean)
    clean = re.sub(r"^\([\w.]+\.\w+(?:Error|Exception)\)\s*", "", clean)
    clean = re.sub(r"<class '[^']+'>:\s*", "", clean)
    clean = clean.strip()
    return (clean[:max_len] if clean else "Unknown error")


async def process_invoice(invoice_id: uuid.UUID, db: AsyncSession) -> str:
    """Run the full reconciliation pipeline for an invoice.

    Returns one of:
      - ``OUTCOME_SUCCEEDED`` -- pipeline completed (status=completed)
      - ``OUTCOME_SKIPPED_NOT_FOUND`` -- invoice row not visible yet
        (worker should retry; this can happen if a job was enqueued
        before the upload's transaction committed in another connection)
      - ``OUTCOME_FAILED`` -- a fatal error was caught and recorded
    """
    logger.info(f"[InvoiceService] Processing invoice {invoice_id}")
    start_time = time.time()

    trace = create_trace(str(invoice_id))

    stmt = select(Invoice).where(Invoice.id == invoice_id)
    result = await db.execute(stmt)
    invoice = result.scalar_one_or_none()
    if not invoice:
        logger.warning(
            f"[InvoiceService] Invoice {invoice_id} not found in DB "
            "(possible upload-vs-worker race; will retry)"
        )
        return OUTCOME_SKIPPED_NOT_FOUND

    invoice.processing_status = "parsing"
    invoice.updated_at = datetime.now(timezone.utc)
    await db.flush()

    initial_state = {
        "invoice_id": str(invoice_id),
        "owner_id": str(invoice.owner_id),
        "db_session": db,
        "raw_file_path": invoice.raw_file_path or "",
        "file_content_type": invoice.file_content_type,
        "raw_text": invoice.raw_text or "",
        "processing_start_ms": start_time * 1000,
    }

    # Accumulated state across nodes. LangGraph's stream_mode="updates"
    # yields per-node deltas; we merge them so the pipeline's final
    # output is available for persistence and tracing.
    final_state: dict = dict(initial_state)
    duplicate_short_circuit = False
    node_timings: dict[str, float] = {}

    try:
        node_start = time.time()
        async for chunk in reconciliation_graph.astream(
            initial_state,
            stream_mode="updates",
        ):
            for node_name, delta in chunk.items():
                elapsed_ms = (time.time() - node_start) * 1000
                node_timings[node_name] = elapsed_ms
                node_start = time.time()

                if delta:
                    final_state.update(delta)

                _record_node_trace(trace, node_name, final_state, elapsed_ms)

                # Drive the live pipeline visualizer by advancing
                # processing_status as each stage finishes.
                next_status = _NODE_TO_STATUS_AFTER.get(node_name)
                if next_status and invoice.processing_status != next_status:
                    invoice.processing_status = next_status
                    invoice.updated_at = datetime.now(timezone.utc)
                    await db.flush()

                # After parsing succeeds, run the duplicate-invoice
                # check BEFORE we write invoice_number to the DB. This
                # avoids a unique-constraint violation surfacing as a
                # raw SQL error to the user.
                if node_name == "parse_invoice":
                    if final_state.get("error"):
                        await _handle_failure(invoice, final_state["error"], db)
                        flush_traces()
                        return OUTCOME_FAILED

                    parsed_number = final_state.get("invoice_number")
                    if parsed_number:
                        is_duplicate = await check_duplicate_invoice(
                            db, invoice.owner_id, parsed_number, invoice_id
                        )
                        if is_duplicate:
                            await _handle_failure(
                                invoice,
                                f"Duplicate invoice: '{parsed_number}' already exists in the system",
                                db,
                            )
                            flush_traces()
                            duplicate_short_circuit = True
                            break

                # After matcher finishes, persist the resolved vendor_id
                # so the UI can show the link even if a later step fails.
                if node_name == "match_records" and final_state.get("vendor_id"):
                    invoice.vendor_id = uuid.UUID(final_state["vendor_id"])
                    await db.flush()

            if duplicate_short_circuit:
                break

        if duplicate_short_circuit:
            return OUTCOME_FAILED

        # Pull parser-derived fields onto the row.
        invoice.invoice_number = final_state.get("invoice_number")
        invoice.po_reference = final_state.get("po_reference")
        invoice.invoice_date = _parse_date(final_state.get("invoice_date"))
        invoice.due_date = _parse_date(final_state.get("due_date"))
        invoice.total_amount = final_state.get("total_amount")
        invoice.tax_amount = final_state.get("tax_amount")
        invoice.parsed_data = final_state.get("parsed_data")
        await db.flush()

        # Persist reconciliation, line matches, discrepancies, and the
        # final invoice status.
        processing_time_ms = int((time.time() - start_time) * 1000)
        try:
            final_state["trace_id"] = trace.id if trace else None
        except Exception:
            final_state["trace_id"] = None
        await _persist_results(invoice, final_state, processing_time_ms, db)

        end_trace(trace)
        flush_traces()
        return OUTCOME_SUCCEEDED

    except Exception as e:
        logger.exception(f"[InvoiceService] Pipeline failed for invoice {invoice_id}")
        if trace:
            trace_agent_step(trace, "pipeline_error", {}, {"error": str(e)}, 0)
            end_trace(trace)
            flush_traces()
        try:
            await db.rollback()
            stmt = select(Invoice).where(Invoice.id == invoice_id)
            result = await db.execute(stmt)
            invoice = result.scalar_one()
            await _handle_failure(invoice, str(e), db)
        except Exception as inner_e:
            logger.error(f"[InvoiceService] Could not record failure for {invoice_id}: {inner_e}")
        return OUTCOME_FAILED


def _record_node_trace(trace, node_name: str, state: dict, elapsed_ms: float) -> None:
    """Emit a per-node Langfuse span with the most useful slice of state."""
    if node_name == "parse_invoice":
        out = {
            "invoice_number": state.get("invoice_number"),
            "vendor_name": state.get("vendor_name"),
            "line_items_count": len(state.get("line_items", [])),
            "error": state.get("error"),
        }
        inp = {"file": state.get("raw_file_path")}
    elif node_name == "match_records":
        matched_po = state.get("matched_po")
        out = {
            "vendor_found": state.get("vendor_found"),
            "matched_po": matched_po.get("po_number") if matched_po else None,
            "line_matches_count": len(state.get("line_item_matches", [])),
        }
        inp = {
            "vendor_name": state.get("vendor_name"),
            "po_reference": state.get("po_reference"),
        }
    elif node_name == "detect_anomalies":
        out = {
            "discrepancies_count": len(state.get("discrepancies", [])),
            "discrepancies": state.get("discrepancies", []),
            "is_duplicate": state.get("is_duplicate"),
        }
        inp = {"line_matches_count": len(state.get("line_item_matches", []))}
    elif node_name == "resolve":
        out = {
            "match_type": state.get("match_type"),
            "overall_status": state.get("overall_status"),
            "confidence_score": state.get("confidence_score"),
            "recommendation": state.get("agent_recommendation"),
        }
        inp = {
            "discrepancies_count": len(state.get("discrepancies", [])),
        }
    else:
        # error_handler and any future nodes
        out = {k: state.get(k) for k in ("match_type", "overall_status", "error")}
        inp = {}
    trace_agent_step(trace, node_name, inp, out, elapsed_ms)


async def _persist_results(
    invoice: Invoice,
    state: dict,
    processing_time_ms: int,
    db: AsyncSession,
) -> None:
    """Persist the pipeline results to the database in one transaction."""
    # Create invoice line items from parsed data
    for line in state.get("line_items", []):
        inv_line = InvoiceLineItem(
            invoice_id=invoice.id,
            line_number=line.get("line_number", 1),
            item_code=line.get("item_code"),
            item_description=line.get("item_description", ""),
            quantity=line.get("quantity", 0),
            unit_price=line.get("unit_price", 0),
            total_price=line.get("total_price", 0),
            unit_of_measure=line.get("unit_of_measure"),
        )
        db.add(inv_line)
    await db.flush()

    # Reload line items to get DB-generated IDs
    line_items_stmt = (
        select(InvoiceLineItem)
        .where(InvoiceLineItem.invoice_id == invoice.id)
        .order_by(InvoiceLineItem.line_number)
    )
    line_items_result = await db.execute(line_items_stmt)
    db_line_items = list(line_items_result.scalars().all())

    # Map line numbers to DB IDs
    line_id_map = {li.line_number: li.id for li in db_line_items}

    # Create reconciliation
    matched_po = state.get("matched_po")
    reconciliation = Reconciliation(
        invoice_id=invoice.id,
        po_id=uuid.UUID(matched_po["id"]) if matched_po else None,
        match_type=state.get("match_type", "no_match"),
        overall_status=state.get("overall_status", "pending_review"),
        confidence_score=state.get("confidence_score", 0.0),
        agent_recommendation=state.get("agent_recommendation"),
        recommendation_reasoning=state.get("recommendation_reasoning"),
        trace_id=state.get("trace_id"),
        processing_time_ms=processing_time_ms,
    )
    db.add(reconciliation)
    await db.flush()

    # Create line item matches
    lim_id_map = {}
    for i, match in enumerate(state.get("line_item_matches", [])):
        inv_line_idx = i + 1
        inv_line_id = line_id_map.get(inv_line_idx)
        if not inv_line_id and db_line_items:
            inv_line_id = db_line_items[min(i, len(db_line_items) - 1)].id

        # If we still have no real invoice_line_item to associate with,
        # skip the match rather than insert a row with a dangling FK.
        # (The original code used `or db_line_items[0].id if db_line_items
        # else uuid.uuid4()`, which due to operator precedence could
        # produce a random UUID -> guaranteed FK violation. Bug L9.)
        if not inv_line_id:
            logger.warning(
                f"[InvoiceService] Skipping line_item_match #{i + 1} for invoice "
                f"{invoice.id}: no invoice_line_item available"
            )
            continue

        lim = LineItemMatch(
            reconciliation_id=reconciliation.id,
            invoice_line_item_id=inv_line_id,
            po_line_item_id=uuid.UUID(match["po_line_item_id"]) if match.get("po_line_item_id") else None,
            delivery_line_item_id=uuid.UUID(match["delivery_line_item_id"]) if match.get("delivery_line_item_id") else None,
            status=match.get("status", "unmatched"),
            description_similarity=match.get("description_similarity"),
            quantity_invoiced=match.get("quantity_invoiced"),
            quantity_ordered=match.get("quantity_ordered"),
            quantity_delivered=match.get("quantity_delivered"),
            price_invoiced=match.get("price_invoiced"),
            price_ordered=match.get("price_ordered"),
            price_deviation_pct=match.get("price_deviation_pct"),
        )
        db.add(lim)
        await db.flush()
        lim_id_map[i] = lim.id

    # Create discrepancies
    for disc in state.get("discrepancies", []):
        discrepancy = Discrepancy(
            reconciliation_id=reconciliation.id,
            line_item_match_id=None,
            type=disc["type"],
            severity=disc["severity"],
            description=disc["description"],
            expected_value=disc.get("expected_value"),
            actual_value=disc.get("actual_value"),
            deviation_pct=disc.get("deviation_pct"),
        )
        db.add(discrepancy)

    # Update invoice status
    invoice.processing_status = "completed"
    if state.get("overall_status") == "auto_approved":
        invoice.business_status = "approved"
    elif state.get("discrepancies"):
        invoice.business_status = "pending_review"
    else:
        invoice.business_status = "approved"
    invoice.updated_at = datetime.now(timezone.utc)

    await db.flush()
    logger.info(f"[InvoiceService] Results persisted for invoice {invoice.id} "
                f"(status: {invoice.business_status}, time: {processing_time_ms}ms)")


async def _handle_failure(invoice: Invoice, error: str, db: AsyncSession) -> None:
    """Mark invoice as failed with a sanitized, UI-safe error message.

    Note: We intentionally KEEP the raw_file_path on failure so the user
    can inspect what was uploaded. A periodic janitor process can sweep
    old failed uploads if disk pressure becomes an issue.
    """
    clean = _sanitize_error(error)
    invoice.processing_status = "failed"
    invoice.error_message = clean
    invoice.updated_at = datetime.now(timezone.utc)
    await db.flush()
    logger.error(f"[InvoiceService] Invoice {invoice.id} failed: {clean}")


def _parse_date(date_str: str | None) -> date | None:
    if not date_str:
        return None
    try:
        return date.fromisoformat(date_str)
    except (ValueError, TypeError):
        return None
