"""
Backfill description_embedding for PO line items that are still NULL
or stamped for a different embedding model/dim.

Convenience only — the matcher self-heals on first match without this.
Does not depend on seed.py.

Usage:
    python -m app.db.backfill_po_embeddings
"""

from __future__ import annotations

import asyncio
import logging

from sqlalchemy import or_, select

from app.db.session import async_session_factory
from app.models.database import POLineItem
from app.tools.embeddings import (
    active_embedding_dim,
    active_embedding_model,
    get_embeddings_batch,
)

logger = logging.getLogger(__name__)


async def backfill() -> int:
    model = active_embedding_model()
    dim = active_embedding_dim()
    async with async_session_factory() as session:
        result = await session.execute(
            select(POLineItem).where(
                or_(
                    POLineItem.description_embedding.is_(None),
                    POLineItem.embedding_model.is_distinct_from(model),
                    POLineItem.embedding_dim.is_distinct_from(dim),
                )
            )
        )
        rows = list(result.scalars().all())
        if not rows:
            print("[backfill] No PO line items need embeddings.")
            return 0

        texts = [r.item_description for r in rows]
        print(f"[backfill] Embedding {len(texts)} PO line item(s) via {model}...")
        vectors = get_embeddings_batch(texts)
        for row, vec in zip(rows, vectors, strict=True):
            row.description_embedding = vec
            row.embedding_model = model
            row.embedding_dim = dim
        await session.commit()
        print(f"[backfill] Wrote {len(rows)} embedding(s).")
        return len(rows)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(backfill())
