"""LangGraph state definition for the reconciliation pipeline."""

from __future__ import annotations

from typing import Any, TypedDict


class ReconciliationState(TypedDict, total=False):
    # Input -- populated when the graph is invoked
    invoice_id: str
    db_session: Any
    raw_file_path: str
    file_content_type: str | None

    # Parser output
    raw_text: str
    parsed_data: dict
    invoice_number: str | None
    vendor_name: str | None
    vendor_tax_id: str | None
    po_reference: str | None
    invoice_date: str | None
    due_date: str | None
    total_amount: float | None
    tax_amount: float | None
    line_items: list[dict]

    # Matcher output
    vendor_id: str | None
    vendor_found: bool
    matched_po: dict | None
    po_line_items: list[dict]
    delivery_receipts: list[dict]
    delivery_line_items: list[dict]
    line_item_matches: list[dict]

    # Anomaly output
    is_duplicate: bool
    discrepancies: list[dict]

    # Resolution output
    match_type: str
    overall_status: str
    confidence_score: float
    agent_recommendation: str
    recommendation_reasoning: str
    similar_cases: list[dict]

    # Metadata
    trace_id: str | None
    error: str | None
    processing_start_ms: float
