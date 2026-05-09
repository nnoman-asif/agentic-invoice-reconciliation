"""LangGraph state machine for the invoice reconciliation pipeline."""

from __future__ import annotations

import logging

from langgraph.graph import END, StateGraph
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.anomaly_agent import detect_anomalies
from app.agents.matcher_agent import match_records
from app.agents.parser_agent import parse_invoice
from app.agents.resolution_agent import _build_summary, resolve
from app.agents.state import ReconciliationState
from app.rag.retriever import find_similar_cases

logger = logging.getLogger(__name__)


async def rag_retrieve(state: ReconciliationState) -> dict:
    """Pull similar past reconciliation cases from pgvector for the resolver.

    On any retrieval failure (Ollama down, embedding column drift, dead
    connection, etc.) we degrade gracefully to an empty list so the rest
    of the pipeline can still run.
    """
    invoice_id = state.get("invoice_id")
    db: AsyncSession = state["db_session"]
    try:
        summary = _build_summary(dict(state))
        similar_cases = await find_similar_cases(db, summary, top_k=3)
        return {"similar_cases": similar_cases}
    except Exception as e:
        logger.warning(f"[RAG] Retrieval failed for invoice {invoice_id}: {e}")
        # The connection may be in an aborted state after the failure;
        # rollback so subsequent statements in this transaction succeed.
        try:
            await db.rollback()
        except Exception:
            pass
        return {"similar_cases": []}


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
                                       -> rag_retrieve
                                       -> resolve
                                       -> END
    """
    graph = StateGraph(ReconciliationState)

    # Add nodes
    graph.add_node("parse_invoice", parse_invoice)
    graph.add_node("match_records", match_records)
    graph.add_node("detect_anomalies", detect_anomalies)
    graph.add_node("rag_retrieve", rag_retrieve)
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
    graph.add_edge("detect_anomalies", "rag_retrieve")
    graph.add_edge("rag_retrieve", "resolve")
    graph.add_edge("resolve", END)
    graph.add_edge("error_handler", END)

    return graph


# Pre-compiled graph instance
reconciliation_graph = build_reconciliation_graph().compile()
