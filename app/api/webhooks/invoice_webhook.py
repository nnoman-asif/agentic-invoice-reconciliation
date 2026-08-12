import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import OwnerContext, get_current_owner
from app.db.session import get_db
from app.models.database import Invoice
from app.tools.limits import acquire_inflight, enqueue_invoice

router = APIRouter()


@router.post("/webhooks/invoice-received")
async def webhook_invoice_received(
    request: Request,
    db: AsyncSession = Depends(get_db),
    owner: OwnerContext = Depends(get_current_owner),
):
    """Trigger processing for an invoice that's already in the DB (e.g., from an ERP push)."""
    body = await request.json()
    invoice_id = body.get("invoice_id")
    if not invoice_id:
        raise HTTPException(status_code=400, detail="invoice_id is required")

    try:
        inv_uuid = uuid.UUID(invoice_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid invoice_id format")

    stmt = select(Invoice).where(
        Invoice.id == inv_uuid,
        Invoice.owner_id == owner.user_id,
    )
    result = await db.execute(stmt)
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.processing_status not in ("queued", "failed"):
        raise HTTPException(
            status_code=409,
            detail=f"Invoice is already in '{invoice.processing_status}' state",
        )

    redis = request.app.state.redis
    await acquire_inflight(redis, owner.user_id, inv_uuid)

    invoice.processing_status = "queued"
    await db.flush()

    position = await enqueue_invoice(redis, owner.user_id, inv_uuid)

    return {
        "status": "queued",
        "invoice_id": str(inv_uuid),
        "queue_position": position,
    }
