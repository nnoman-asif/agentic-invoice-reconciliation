"""Anomaly Agent: detects discrepancies in matching results."""

from __future__ import annotations

import logging
import uuid
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.tools.anomaly_checks import run_all_checks
from app.tools.db_queries import check_duplicate_invoice

logger = logging.getLogger(__name__)


def _parse_date(date_str: str | None) -> date | None:
    if not date_str:
        return None
    try:
        return date.fromisoformat(date_str)
    except (ValueError, TypeError):
        return None


async def detect_anomalies(state: dict) -> dict:
    """Run all anomaly checks on the matching results."""
    invoice_id = state["invoice_id"]
    owner_id = uuid.UUID(str(state["owner_id"]))
    db: AsyncSession = state["db_session"]
    logger.info(f"[AnomalyAgent] Checking anomalies for invoice {invoice_id}")

    # Duplicate check
    invoice_number = state.get("invoice_number")
    is_duplicate = False
    if invoice_number:
        is_duplicate = await check_duplicate_invoice(
            db, owner_id, invoice_number, invoice_id
        )

    matched_po = state.get("matched_po")
    po_found = matched_po is not None
    vendor_found = state.get("vendor_found", False)

    anomalies = run_all_checks(
        line_matches=state.get("line_item_matches", []),
        po_found=po_found,
        vendor_found=vendor_found,
        is_duplicate=is_duplicate,
        invoice_date=_parse_date(state.get("invoice_date")),
        po_issue_date=_parse_date(matched_po.get("issue_date")) if matched_po else None,
        invoice_total=state.get("total_amount"),
        po_total=matched_po.get("total_amount") if matched_po else None,
    )

    discrepancies = [
        {
            "type": a.type,
            "severity": a.severity,
            "description": a.description,
            "expected_value": a.expected_value,
            "actual_value": a.actual_value,
            "deviation_pct": a.deviation_pct,
            "line_item_match_id": a.line_item_match_id,
        }
        for a in anomalies
    ]

    logger.info(f"[AnomalyAgent] Found {len(discrepancies)} discrepancies for invoice {invoice_id}")

    return {
        **state,
        "is_duplicate": is_duplicate,
        "discrepancies": discrepancies,
    }
