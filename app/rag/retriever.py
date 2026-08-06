"""Retrieve similar past reconciliation cases from pgvector."""

import logging

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import ReconciliationEmbedding, HumanReview
from app.tools.embeddings import get_embedding

logger = logging.getLogger(__name__)


async def find_similar_cases(
    db: AsyncSession,
    query_text: str,
    top_k: int = 3,
) -> list[dict]:
    """
    Embed the query text and find the most similar past reconciliation cases
    using pgvector cosine similarity search.
    """
    query_embedding = get_embedding(query_text)

    embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"

    stmt = text("""
        SELECT
            re.reconciliation_id,
            re.content_summary,
            1 - (re.embedding <=> cast(:embed as vector)) AS similarity
        FROM reconciliation_embeddings re
        ORDER BY re.embedding <=> cast(:embed as vector)
        LIMIT :top_k
    """)

    result = await db.execute(
        stmt,
        {"embed": embedding_str, "top_k": top_k},
    )
    rows = result.fetchall()

    cases = []
    for row in rows:
        recon_id = row[0]
        content_summary = row[1]
        similarity = row[2]

        review_stmt = (
            select(HumanReview)
            .where(HumanReview.reconciliation_id == recon_id)
            .order_by(HumanReview.decided_at.desc())
            .limit(1)
        )
        review_result = await db.execute(review_stmt)
        review = review_result.scalar_one_or_none()

        cases.append({
            "reconciliation_id": str(recon_id),
            "content_summary": content_summary,
            "similarity": float(similarity),
            "decision": review.decision if review else None,
            "reviewer_notes": review.reviewer_notes if review else None,
        })

    logger.info(f"[Retriever] Found {len(cases)} similar cases")
    return cases
