import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import OwnerContext, get_current_owner
from app.db.session import get_db
from app.models.database import HumanReview, Invoice, Reconciliation
from app.models.schemas import (
    InvoiceListResponse,
    OverrideRequest,
    ReviewRequest,
    HumanReviewResponse,
)

router = APIRouter()


async def _owned_reconciliation(
    db: AsyncSession,
    reconciliation_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> Reconciliation:
    stmt = (
        select(Reconciliation)
        .join(Invoice, Invoice.id == Reconciliation.invoice_id)
        .where(
            Reconciliation.id == reconciliation_id,
            Invoice.owner_id == owner_id,
        )
    )
    recon = (await db.execute(stmt)).scalar_one_or_none()
    if not recon:
        raise HTTPException(status_code=404, detail="Reconciliation not found")
    return recon


@router.get("/exceptions", response_model=list[InvoiceListResponse])
async def list_exceptions(
    db: AsyncSession = Depends(get_db),
    owner: OwnerContext = Depends(get_current_owner),
):
    stmt = (
        select(Invoice)
        .where(
            Invoice.owner_id == owner.user_id,
            Invoice.business_status == "pending_review",
        )
        .order_by(Invoice.updated_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/exceptions/{reconciliation_id}/approve", response_model=HumanReviewResponse)
async def approve_exception(
    reconciliation_id: uuid.UUID,
    body: ReviewRequest,
    db: AsyncSession = Depends(get_db),
    owner: OwnerContext = Depends(get_current_owner),
):
    recon = await _owned_reconciliation(db, reconciliation_id, owner.user_id)
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

    inv_stmt = select(Invoice).where(
        Invoice.id == recon.invoice_id,
        Invoice.owner_id == owner.user_id,
    )
    invoice = (await db.execute(inv_stmt)).scalar_one()
    invoice.business_status = "approved"
    invoice.updated_at = datetime.now(timezone.utc)

    await db.flush()
    # Refresh so `decided_at` (server-populated TIMESTAMPTZ) comes back
    # as a TZ-aware datetime rather than the Python-side naive default,
    # ensuring the POST response matches what GET returns later.
    await db.refresh(review)

    return review


@router.post("/exceptions/{reconciliation_id}/reject", response_model=HumanReviewResponse)
async def reject_exception(
    reconciliation_id: uuid.UUID,
    body: ReviewRequest,
    db: AsyncSession = Depends(get_db),
    owner: OwnerContext = Depends(get_current_owner),
):
    recon = await _owned_reconciliation(db, reconciliation_id, owner.user_id)
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

    inv_stmt = select(Invoice).where(
        Invoice.id == recon.invoice_id,
        Invoice.owner_id == owner.user_id,
    )
    invoice = (await db.execute(inv_stmt)).scalar_one()
    invoice.business_status = "rejected"
    invoice.updated_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(review)
    return review


@router.post(
    "/exceptions/{reconciliation_id}/override",
    response_model=HumanReviewResponse,
)
async def override_exception(
    reconciliation_id: uuid.UUID,
    body: OverrideRequest,
    db: AsyncSession = Depends(get_db),
    owner: OwnerContext = Depends(get_current_owner),
):
    """Flip a previously auto-approved reconciliation to approved or
    rejected, with a mandatory reason. Use this when the agent
    auto-approved an invoice that on second look needs human
    intervention. (The standard approve/reject endpoints reject
    auto-approved recons by design.)
    """
    recon = await _owned_reconciliation(db, reconciliation_id, owner.user_id)
    if recon.overall_status != "auto_approved":
        raise HTTPException(
            status_code=400,
            detail=(
                f"Override is only allowed on auto_approved reconciliations "
                f"(this one is '{recon.overall_status}'). Use approve or reject instead."
            ),
        )

    review = HumanReview(
        reconciliation_id=reconciliation_id,
        decision=body.decision,
        reviewer_notes=body.reviewer_notes,
        decided_by=body.decided_by,
    )
    db.add(review)

    recon.overall_status = body.decision
    recon.updated_at = datetime.now(timezone.utc)

    inv_stmt = select(Invoice).where(
        Invoice.id == recon.invoice_id,
        Invoice.owner_id == owner.user_id,
    )
    invoice = (await db.execute(inv_stmt)).scalar_one()
    invoice.business_status = body.decision
    invoice.updated_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(review)
    return review
