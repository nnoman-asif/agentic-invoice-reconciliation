"""Index reconciliation outcomes into pgvector for RAG retrieval."""

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import (
    Discrepancy,
    HumanReview,
    Reconciliation,
    ReconciliationEmbedding,
)
from app.rag.embeddings import get_embedding

logger = logging.getLogger(__name__)


def _build_content_summary(
    reconciliation: Reconciliation,
    discrepancies: list[Discrepancy],
    review: HumanReview | None,
) -> str:
    """Build a text summary of a reconciliation case for embedding."""
    parts = [
        f"Match type: {reconciliation.match_type}",
        f"Status: {reconciliation.overall_status}",
        f"Confidence: {reconciliation.confidence_score}",
    ]

    if reconciliation.agent_recommendation:
        parts.append(f"Agent recommendation: {reconciliation.agent_recommendation}")

    if discrepancies:
        parts.append(f"Discrepancies ({len(discrepancies)}):")
        for d in discrepancies:
            parts.append(f"  - [{d.severity}] {d.type}: {d.description}")

    if review:
        parts.append(f"Human decision: {review.decision}")
        if review.reviewer_notes:
            parts.append(f"Reviewer notes: {review.reviewer_notes}")

    return "\n".join(parts)


async def index_reconciliation(
    db: AsyncSession,
    reconciliation_id: uuid.UUID,
) -> None:
    """Generate embedding for a reconciliation and store in pgvector."""
    logger.info(f"[Indexer] Indexing reconciliation {reconciliation_id}")

    recon_stmt = select(Reconciliation).where(Reconciliation.id == reconciliation_id)
    recon_result = await db.execute(recon_stmt)
    reconciliation = recon_result.scalar_one_or_none()
    if not reconciliation:
        logger.warning(f"[Indexer] Reconciliation {reconciliation_id} not found")
        return

    disc_stmt = select(Discrepancy).where(Discrepancy.reconciliation_id == reconciliation_id)
    disc_result = await db.execute(disc_stmt)
    discrepancies = list(disc_result.scalars().all())

    review_stmt = (
        select(HumanReview)
        .where(HumanReview.reconciliation_id == reconciliation_id)
        .order_by(HumanReview.decided_at.desc())
        .limit(1)
    )
    review_result = await db.execute(review_stmt)
    review = review_result.scalar_one_or_none()

    content_summary = _build_content_summary(reconciliation, discrepancies, review)
    embedding = get_embedding(content_summary)

    rec_embedding = ReconciliationEmbedding(
        reconciliation_id=reconciliation_id,
        embedding=embedding,
        content_summary=content_summary,
    )
    db.add(rec_embedding)
    await db.flush()

    logger.info(f"[Indexer] Successfully indexed reconciliation {reconciliation_id}")
