import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.database import HumanReview, Invoice, Reconciliation
from app.models.schemas import (
    InvoiceListResponse,
    ReconciliationResponse,
    ReviewRequest,
    HumanReviewResponse,
)

router = APIRouter()


@router.get("/exceptions", response_model=list[InvoiceListResponse])
async def list_exceptions(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Invoice)
        .where(Invoice.business_status == "pending_review")
        .order_by(Invoice.updated_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/exceptions/{reconciliation_id}/approve", response_model=HumanReviewResponse)
async def approve_exception(
    reconciliation_id: uuid.UUID,
    body: ReviewRequest,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Reconciliation)
        .where(Reconciliation.id == reconciliation_id)
    )
    result = await db.execute(stmt)
    recon = result.scalar_one_or_none()
    if not recon:
        raise HTTPException(status_code=404, detail="Reconciliation not found")
    if recon.overall_status != "pending_review":
        raise HTTPException(status_code=400, detail="Reconciliation is not pending review")

    review = HumanReview(
        reconciliation_id=reconciliation_id,
        decision="approved",
        reviewer_notes=body.reviewer_notes,
        decided_by=body.decided_by,
    )
    db.add(review)

    recon.overall_status = "approved"
    recon.updated_at = datetime.now(timezone.utc)

    inv_stmt = select(Invoice).where(Invoice.id == recon.invoice_id)
    inv_result = await db.execute(inv_stmt)
    invoice = inv_result.scalar_one()
    invoice.business_status = "approved"
    invoice.updated_at = datetime.now(timezone.utc)

    await db.flush()
    return review


@router.post("/exceptions/{reconciliation_id}/reject", response_model=HumanReviewResponse)
async def reject_exception(
    reconciliation_id: uuid.UUID,
    body: ReviewRequest,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Reconciliation).where(Reconciliation.id == reconciliation_id)
    result = await db.execute(stmt)
    recon = result.scalar_one_or_none()
    if not recon:
        raise HTTPException(status_code=404, detail="Reconciliation not found")
    if recon.overall_status != "pending_review":
        raise HTTPException(status_code=400, detail="Reconciliation is not pending review")

    review = HumanReview(
        reconciliation_id=reconciliation_id,
        decision="rejected",
        reviewer_notes=body.reviewer_notes,
        decided_by=body.decided_by,
    )
    db.add(review)

    recon.overall_status = "rejected"
    recon.updated_at = datetime.now(timezone.utc)

    inv_stmt = select(Invoice).where(Invoice.id == recon.invoice_id)
    inv_result = await db.execute(inv_stmt)
    invoice = inv_result.scalar_one()
    invoice.business_status = "rejected"
    invoice.updated_at = datetime.now(timezone.utc)

    await db.flush()
    return review
