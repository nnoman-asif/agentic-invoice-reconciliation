"""Reconciliation service -- handles human reviews and detail queries."""

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.database import HumanReview, Invoice, Reconciliation
from app.rag.indexer import index_reconciliation

logger = logging.getLogger(__name__)


async def get_reconciliation_detail(
    db: AsyncSession,
    invoice_id: uuid.UUID,
) -> Reconciliation | None:
    """Get full reconciliation details with all related data."""
    stmt = (
        select(Reconciliation)
        .options(
            selectinload(Reconciliation.line_item_matches),
            selectinload(Reconciliation.discrepancies),
            selectinload(Reconciliation.human_reviews),
        )
        .where(Reconciliation.invoice_id == invoice_id)
        .order_by(Reconciliation.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def approve_exception(
    db: AsyncSession,
    reconciliation_id: uuid.UUID,
    reviewer_notes: str | None = None,
    decided_by: str | None = None,
) -> HumanReview:
    """Approve an exception and trigger RAG indexing."""
    recon = await _get_reconciliation(db, reconciliation_id)

    review = HumanReview(
        reconciliation_id=reconciliation_id,
        decision="approved",
        reviewer_notes=reviewer_notes,
        decided_by=decided_by,
    )
    db.add(review)

    recon.overall_status = "approved"
    recon.updated_at = datetime.now(timezone.utc)

    invoice = await _get_invoice(db, recon.invoice_id)
    invoice.business_status = "approved"
    invoice.updated_at = datetime.now(timezone.utc)

    await db.flush()

    # Index for RAG (so future cases can learn from this decision)
    try:
        await index_reconciliation(db, reconciliation_id)
    except Exception as e:
        logger.warning(f"[ReconciliationService] RAG indexing failed: {e}")

    return review


async def reject_exception(
    db: AsyncSession,
    reconciliation_id: uuid.UUID,
    reviewer_notes: str | None = None,
    decided_by: str | None = None,
) -> HumanReview:
    """Reject an exception and trigger RAG indexing."""
    recon = await _get_reconciliation(db, reconciliation_id)

    review = HumanReview(
        reconciliation_id=reconciliation_id,
        decision="rejected",
        reviewer_notes=reviewer_notes,
        decided_by=decided_by,
    )
    db.add(review)

    recon.overall_status = "rejected"
    recon.updated_at = datetime.now(timezone.utc)

    invoice = await _get_invoice(db, recon.invoice_id)
    invoice.business_status = "rejected"
    invoice.updated_at = datetime.now(timezone.utc)

    await db.flush()

    try:
        await index_reconciliation(db, reconciliation_id)
    except Exception as e:
        logger.warning(f"[ReconciliationService] RAG indexing failed: {e}")

    return review


async def _get_reconciliation(db: AsyncSession, recon_id: uuid.UUID) -> Reconciliation:
    stmt = select(Reconciliation).where(Reconciliation.id == recon_id)
    result = await db.execute(stmt)
    recon = result.scalar_one_or_none()
    if not recon:
        raise ValueError(f"Reconciliation {recon_id} not found")
    return recon


async def _get_invoice(db: AsyncSession, invoice_id: uuid.UUID) -> Invoice:
    stmt = select(Invoice).where(Invoice.id == invoice_id)
    result = await db.execute(stmt)
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise ValueError(f"Invoice {invoice_id} not found")
    return invoice
