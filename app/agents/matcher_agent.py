"""Matcher Agent: finds matching PO and delivery receipts, runs 3-way line matching."""

from __future__ import annotations

import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.tools.db_queries import (
    find_delivery_receipts_for_po,
    find_purchase_order_by_number,
    find_purchase_orders_by_vendor,
    find_vendor_by_name_or_tax_id,
)
from app.tools.embeddings import (
    active_embedding_dim,
    active_embedding_model,
    embedding_cache_usable,
    get_embeddings_batch,
)
from app.tools.matching_logic import match_line_items

logger = logging.getLogger(__name__)


async def match_records(state: dict) -> dict:
    """Find matching PO and delivery receipts, then perform 3-way line matching."""
    invoice_id = state["invoice_id"]
    owner_id = uuid.UUID(str(state["owner_id"]))
    db: AsyncSession = state["db_session"]
    logger.info(f"[MatcherAgent] Matching records for invoice {invoice_id}")

    # Step 1: Resolve vendor
    vendor = await find_vendor_by_name_or_tax_id(
        db,
        owner_id,
        name=state.get("vendor_name"),
        tax_id=state.get("vendor_tax_id"),
    )

    vendor_id = str(vendor.id) if vendor else None
    vendor_found = vendor is not None

    if not vendor_found:
        logger.warning(f"[MatcherAgent] Vendor not found for invoice {invoice_id}")
        return {
            **state,
            "vendor_id": None,
            "vendor_found": False,
            "matched_po": None,
            "po_line_items": [],
            "delivery_receipts": [],
            "delivery_line_items": [],
            "line_item_matches": [],
        }

    # Step 2: Find PO -- try po_reference first (deterministic), then fuzzy
    matched_po = None
    po_reference = state.get("po_reference")

    if po_reference:
        matched_po = await find_purchase_order_by_number(
            db, owner_id, po_reference, vendor_id=uuid.UUID(vendor_id)
        )

    if not matched_po:
        candidates = await find_purchase_orders_by_vendor(
            db,
            owner_id,
            vendor_id=uuid.UUID(vendor_id),
            amount=state.get("total_amount"),
        )
        if candidates:
            matched_po = candidates[0]

    if not matched_po:
        logger.warning(f"[MatcherAgent] No PO match for invoice {invoice_id}")
        return {
            **state,
            "vendor_id": vendor_id,
            "vendor_found": True,
            "matched_po": None,
            "po_line_items": [],
            "delivery_receipts": [],
            "delivery_line_items": [],
            "line_item_matches": [],
        }

    # Serialize PO data
    po_data = {
        "id": str(matched_po.id),
        "po_number": matched_po.po_number,
        "total_amount": float(matched_po.total_amount),
        "issue_date": str(matched_po.issue_date),
    }

    # Cache missing / stale PO description embeddings in one batch.
    # Model or dim mismatch is a cache miss so Ollama and Gemini vectors
    # are never compared in the same space.
    missing = [
        li
        for li in matched_po.line_items
        if not embedding_cache_usable(
            li.embedding_model,
            li.embedding_dim,
            li.description_embedding,
        )
    ]
    if missing:
        try:
            vectors = get_embeddings_batch([li.item_description for li in missing])
            model = active_embedding_model()
            dim = active_embedding_dim()
            for li, vec in zip(missing, vectors):
                li.description_embedding = vec
                li.embedding_model = model
                li.embedding_dim = dim
            await db.flush()
        except Exception as e:
            logger.warning(
                "[MatcherAgent] Failed to cache PO embeddings for invoice %s: %s",
                invoice_id,
                e,
            )

    po_lines = [
        {
            "id": str(li.id),
            "line_number": li.line_number,
            "item_code": li.item_code,
            "item_description": li.item_description,
            "quantity": float(li.quantity),
            "unit_price": float(li.unit_price),
            "total_price": float(li.total_price),
            "description_embedding": (
                list(li.description_embedding)
                if embedding_cache_usable(
                    li.embedding_model,
                    li.embedding_dim,
                    li.description_embedding,
                )
                else None
            ),
            "embedding_model": li.embedding_model,
            "embedding_dim": li.embedding_dim,
        }
        for li in matched_po.line_items
    ]

    # Step 3: Find delivery receipts
    receipts = await find_delivery_receipts_for_po(db, owner_id, matched_po.id)
    all_delivery_lines = []
    for receipt in receipts:
        for dl in receipt.line_items:
            all_delivery_lines.append({
                "id": str(dl.id),
                "receipt_id": str(dl.receipt_id),
                "po_line_item_id": str(dl.po_line_item_id) if dl.po_line_item_id else None,
                "item_description": dl.item_description,
                "quantity_received": float(dl.quantity_received),
                "quantity_accepted": float(dl.quantity_accepted),
            })

    # Step 4: Prepare invoice lines with generated UUIDs for unstructured lines
    inv_lines = []
    for i, line in enumerate(state.get("line_items", [])):
        inv_lines.append({
            "id": line.get("id", str(uuid.uuid4())),
            "line_number": line.get("line_number", i + 1),
            "item_code": line.get("item_code"),
            "item_description": line.get("item_description", ""),
            "quantity": line.get("quantity", 0),
            "unit_price": line.get("unit_price", 0),
            "total_price": line.get("total_price", 0),
        })

    # Step 5: 3-way line matching
    match_results = match_line_items(inv_lines, po_lines, all_delivery_lines)
    line_matches_data = [
        {
            "invoice_line_item_id": m.invoice_line_item_id,
            "po_line_item_id": m.po_line_item_id,
            "delivery_line_item_id": m.delivery_line_item_id,
            "status": m.status,
            "description_similarity": m.description_similarity,
            "quantity_invoiced": m.quantity_invoiced,
            "quantity_ordered": m.quantity_ordered,
            "quantity_delivered": m.quantity_delivered,
            "price_invoiced": m.price_invoiced,
            "price_ordered": m.price_ordered,
            "price_deviation_pct": m.price_deviation_pct,
        }
        for m in match_results
    ]

    return {
        **state,
        "vendor_id": vendor_id,
        "vendor_found": True,
        "matched_po": po_data,
        "po_line_items": po_lines,
        "delivery_receipts": [{"id": str(r.id)} for r in receipts],
        "delivery_line_items": all_delivery_lines,
        "line_item_matches": line_matches_data,
    }
