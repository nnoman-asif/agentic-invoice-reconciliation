"""LangGraph state machine for the invoice reconciliation pipeline."""

from __future__ import annotations

import logging

from langgraph.graph import END, StateGraph

from app.agents.anomaly_agent import detect_anomalies
from app.agents.matcher_agent import match_records
from app.agents.parser_agent import parse_invoice
from app.agents.resolution_agent import resolve
from app.agents.state import ReconciliationState

logger = logging.getLogger(__name__)


def _check_parse_result(state: ReconciliationState) -> str:
    """Route after parsing: continue if successful, go to error handler if failed."""
    if state.get("error"):
        return "error_handler"
    return "match_records"


def _handle_error(state: dict) -> dict:
    """Handle pipeline errors gracefully."""
    logger.error(f"[Pipeline] Error for invoice {state.get('invoice_id')}: {state.get('error')}")
    return {
        "match_type": "no_match",
        "overall_status": "pending_review",
        "confidence_score": 0.0,
        "agent_recommendation": f"Processing error: {state.get('error')}",
        "recommendation_reasoning": "The pipeline encountered an error and could not complete processing.",
    }


def build_reconciliation_graph() -> StateGraph:
    """
    Build the LangGraph state machine:

    parse_invoice -> (error_handler | match_records)
                                       -> detect_anomalies
                                       -> resolve
                                       -> END
    """
    graph = StateGraph(ReconciliationState)

    # Add nodes
    graph.add_node("parse_invoice", parse_invoice)
    graph.add_node("match_records", match_records)
    graph.add_node("detect_anomalies", detect_anomalies)
    graph.add_node("resolve", resolve)
    graph.add_node("error_handler", _handle_error)

    # Set entry point
    graph.set_entry_point("parse_invoice")

    # Conditional edge after parsing
    graph.add_conditional_edges(
        "parse_invoice",
        _check_parse_result,
        {
            "match_records": "match_records",
            "error_handler": "error_handler",
        },
    )

    # Linear flow for the rest
    graph.add_edge("match_records", "detect_anomalies")
    graph.add_edge("detect_anomalies", "resolve")
    graph.add_edge("resolve", END)
    graph.add_edge("error_handler", END)

    return graph


# Pre-compiled graph instance
reconciliation_graph = build_reconciliation_graph().compile()
