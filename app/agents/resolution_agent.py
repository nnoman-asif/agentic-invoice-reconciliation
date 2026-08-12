"""Resolution Agent: decides whether to auto-approve or route to human review."""

from __future__ import annotations

import json
import logging

from app.tools.llm import get_chat_model

logger = logging.getLogger(__name__)

RESOLUTION_SYSTEM_PROMPT = """You are a financial reconciliation expert. Given an invoice reconciliation summary, provide a clear recommendation.

You MUST respond with valid JSON only:
{
  "recommendation": "approve" or "reject" or "review",
  "confidence": 0.0 to 1.0,
  "reasoning": "Brief explanation of your recommendation"
}

Guidelines:
- "approve": No significant issues, safe to pay
- "review": Has issues that need human judgment
- "reject": Clear violations (duplicates, unauthorized vendors, major discrepancies)
- Higher confidence = more certain about the recommendation"""


def resolve(state: dict) -> dict:
    """Decide on approval, rejection, or human review based on anomalies."""
    invoice_id = state["invoice_id"]
    discrepancies = state.get("discrepancies", [])
    logger.info(f"[ResolutionAgent] Resolving invoice {invoice_id}")

    # Fast path: no discrepancies = auto-approve
    if not discrepancies:
        line_matches = state.get("line_item_matches", [])
        all_matched = all(m.get("status") == "matched" for m in line_matches)
        confidence = 0.98 if all_matched else 0.85

        return {
            **state,
            "match_type": "full_match" if all_matched else "partial_match",
            "overall_status": "auto_approved",
            "confidence_score": confidence,
            "agent_recommendation": "Auto-approved: no discrepancies detected",
            "recommendation_reasoning": "All line items matched within acceptable tolerances with no anomalies.",
        }

    # Has discrepancies -- check if all are info-level
    critical_count = sum(1 for d in discrepancies if d["severity"] == "critical")
    warning_count = sum(1 for d in discrepancies if d["severity"] == "warning")

    if critical_count == 0 and warning_count == 0:
        return {
            **state,
            "match_type": "partial_match",
            "overall_status": "auto_approved",
            "confidence_score": 0.90,
            "agent_recommendation": "Auto-approved: only informational discrepancies",
            "recommendation_reasoning": "All discrepancies are informational and do not require human review.",
        }

    # Serious discrepancies -- use LLM for recommendation
    summary = _build_summary(state)

    llm = get_chat_model(json_mode=True)

    messages = [
        ("system", RESOLUTION_SYSTEM_PROMPT),
        ("human", f"Reconciliation summary:\n{summary}"),
    ]

    try:
        response = llm.invoke(messages)
        result = json.loads(response.content)
    except Exception as e:
        logger.error(f"[ResolutionAgent] LLM error: {e}")
        result = {
            "recommendation": "review",
            "confidence": 0.5,
            "reasoning": f"LLM unavailable, defaulting to human review. Error: {e}",
        }

    recommendation = result.get("recommendation", "review")
    confidence = result.get("confidence", 0.5)
    reasoning = result.get("reasoning", "")

    # LLM path never auto-approves: uncalibrated model confidence must
    # not gate an irreversible payment decision. Deterministic fast paths
    # above remain the only auto-approve routes.
    overall_status = "pending_review"

    # Determine match type
    line_matches = state.get("line_item_matches", [])
    matched_count = sum(1 for m in line_matches if m.get("status") == "matched")
    if matched_count == len(line_matches) and line_matches:
        match_type = "full_match"
    elif matched_count > 0:
        match_type = "partial_match"
    else:
        match_type = "no_match"

    return {
        **state,
        "match_type": match_type,
        "overall_status": overall_status,
        "confidence_score": confidence,
        # Just the bare verdict word (approve / review / reject). The UI
        # adds its own label (e.g. "Agent recommendation: <verdict>"),
        # so the previous "Recommendation: review" prefix produced
        # redundant text like "Recommendation: Recommendation: review".
        "agent_recommendation": recommendation,
        "recommendation_reasoning": reasoning,
    }


def _build_summary(state: dict) -> str:
    """Build a text summary of the reconciliation for the LLM."""
    parts = []
    parts.append(f"Invoice: {state.get('invoice_number', 'N/A')}")
    parts.append(f"Vendor: {state.get('vendor_name', 'N/A')}")
    parts.append(f"Total: {state.get('total_amount', 'N/A')}")

    po = state.get("matched_po")
    if po:
        parts.append(f"Matched PO: {po.get('po_number', 'N/A')} (total: {po.get('total_amount', 'N/A')})")
    else:
        parts.append("Matched PO: None")

    parts.append(f"\nLine item matches: {len(state.get('line_item_matches', []))}")
    for m in state.get("line_item_matches", []):
        parts.append(f"  - Status: {m.get('status')}, "
                     f"Qty inv/ord/del: {m.get('quantity_invoiced')}/{m.get('quantity_ordered')}/{m.get('quantity_delivered')}, "
                     f"Price dev: {m.get('price_deviation_pct', 0):.1f}%")

    parts.append(f"\nDiscrepancies ({len(state.get('discrepancies', []))}):")
    for d in state.get("discrepancies", []):
        parts.append(f"  - [{d['severity'].upper()}] {d['type']}: {d['description']}")

    return "\n".join(parts)
