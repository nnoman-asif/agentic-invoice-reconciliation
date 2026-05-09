"""Invoice processing service -- orchestrates the LangGraph pipeline."""

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
from app.rag.retriever import find_similar_cases
from app.tools.db_queries import check_duplicate_invoice

logger = logging.getLogger(__name__)


# Outcome constants returned by `process_invoice` so the worker can
# distinguish transient races (retry) from real failures (drop).
OUTCOME_SUCCEEDED = "succeeded"
OUTCOME_SKIPPED_NOT_FOUND = "skipped_not_found"
OUTCOME_FAILED = "failed"


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
        "db_session": db,
        "raw_file_path": invoice.raw_file_path or "",
        "file_content_type": invoice.file_content_type,
        "processing_start_ms": start_time * 1000,
    }

    try:
        from app.agents.parser_agent import parse_invoice
        from app.agents.matcher_agent import match_records
        from app.agents.anomaly_agent import detect_anomalies
        from app.agents.resolution_agent import resolve

        # Step 1: Parse
        invoice.processing_status = "parsing"
        await db.flush()
        step_start = time.time()
        state = parse_invoice(initial_state)
        trace_agent_step(trace, "parser_agent", {"file": invoice.raw_file_path}, {
            "invoice_number": state.get("invoice_number"),
            "vendor_name": state.get("vendor_name"),
            "line_items_count": len(state.get("line_items", [])),
            "error": state.get("error"),
        }, (time.time() - step_start) * 1000)

        if state.get("error"):
            await _handle_failure(invoice, state["error"], db)
            flush_traces()
            return OUTCOME_FAILED

        # Duplicate check BEFORE we write `invoice_number` to the DB.
        # Without this, the unique-constraint violation surfaces as a
        # raw SQL error in the UI (bug H1).
        parsed_number = state.get("invoice_number")
        if parsed_number:
            is_duplicate = await check_duplicate_invoice(db, parsed_number, invoice_id)
            if is_duplicate:
                await _handle_failure(
                    invoice,
                    f"Duplicate invoice: '{parsed_number}' already exists in the system",
                    db,
                )
                flush_traces()
                return OUTCOME_FAILED

        invoice.invoice_number = parsed_number
        invoice.po_reference = state.get("po_reference")
        invoice.invoice_date = _parse_date(state.get("invoice_date"))
        invoice.due_date = _parse_date(state.get("due_date"))
        invoice.total_amount = state.get("total_amount")
        invoice.tax_amount = state.get("tax_amount")
        invoice.parsed_data = state.get("parsed_data")
        invoice.processing_status = "matching"
        invoice.updated_at = datetime.now(timezone.utc)
        await db.flush()

        # Step 2: Match
        step_start = time.time()
        state = await match_records(state)
        trace_agent_step(trace, "matcher_agent", {
            "vendor_name": state.get("vendor_name"),
            "po_reference": state.get("po_reference"),
        }, {
            "vendor_found": state.get("vendor_found"),
            "matched_po": state.get("matched_po", {}).get("po_number") if state.get("matched_po") else None,
            "line_matches_count": len(state.get("line_item_matches", [])),
        }, (time.time() - step_start) * 1000)

        if state.get("vendor_id"):
            invoice.vendor_id = uuid.UUID(state["vendor_id"])
            await db.flush()

        # Step 3: Detect anomalies
        invoice.processing_status = "resolving"
        await db.flush()
        step_start = time.time()
        state = await detect_anomalies(state)
        trace_agent_step(trace, "anomaly_agent", {
            "line_matches_count": len(state.get("line_item_matches", [])),
        }, {
            "discrepancies_count": len(state.get("discrepancies", [])),
            "discrepancies": state.get("discrepancies", []),
            "is_duplicate": state.get("is_duplicate"),
        }, (time.time() - step_start) * 1000)

        # Step 4: RAG similar cases
        step_start = time.time()
        try:
            from app.agents.resolution_agent import _build_summary
            summary = _build_summary(state)
            similar_cases = await find_similar_cases(db, summary, top_k=3)
            state["similar_cases"] = similar_cases
        except Exception as e:
            logger.warning(f"[InvoiceService] RAG retrieval failed: {e}")
            state["similar_cases"] = []
            await db.rollback()
            stmt = select(Invoice).where(Invoice.id == invoice_id)
            result = await db.execute(stmt)
            invoice = result.scalar_one()
        trace_agent_step(trace, "rag_retrieval", {
            "query": "similar reconciliation cases",
        }, {
            "similar_cases_found": len(state.get("similar_cases", [])),
        }, (time.time() - step_start) * 1000)

        # Step 5: Resolve
        step_start = time.time()
        state = resolve(state)
        trace_agent_step(trace, "resolution_agent", {
            "discrepancies_count": len(state.get("discrepancies", [])),
            "similar_cases_count": len(state.get("similar_cases", [])),
        }, {
            "match_type": state.get("match_type"),
            "overall_status": state.get("overall_status"),
            "confidence_score": state.get("confidence_score"),
            "recommendation": state.get("agent_recommendation"),
        }, (time.time() - step_start) * 1000)

        # Persist results
        processing_time_ms = int((time.time() - start_time) * 1000)
        try:
            state["trace_id"] = trace.id if trace else None
        except Exception:
            state["trace_id"] = None
        await _persist_results(invoice, state, processing_time_ms, db)

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
