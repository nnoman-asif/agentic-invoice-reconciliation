import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.database import (
    Invoice,
    PurchaseOrder,
    Reconciliation,
    Vendor,
)
from app.models.schemas import (
    InvoiceListResponse,
    PurchaseOrderListResponse,
    VendorResponse,
)

router = APIRouter()


@router.get("/vendors", response_model=list[VendorResponse])
async def list_vendors(db: AsyncSession = Depends(get_db)):
    stmt = select(Vendor).order_by(Vendor.name)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/vendors/{vendor_id}", response_model=VendorResponse)
async def get_vendor(vendor_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    stmt = select(Vendor).where(Vendor.id == vendor_id)
    result = await db.execute(stmt)
    vendor = result.scalar_one_or_none()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor


@router.get("/vendors/{vendor_id}/purchase-orders", response_model=list[PurchaseOrderListResponse])
async def get_vendor_purchase_orders(
    vendor_id: uuid.UUID, db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(PurchaseOrder)
        .where(PurchaseOrder.vendor_id == vendor_id)
        .order_by(PurchaseOrder.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/vendors/{vendor_id}/invoices", response_model=list[InvoiceListResponse])
async def get_vendor_invoices(
    vendor_id: uuid.UUID, db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Invoice)
        .where(Invoice.vendor_id == vendor_id)
        .order_by(Invoice.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/vendors/{vendor_id}/stats")
async def get_vendor_stats(
    vendor_id: uuid.UUID, db: AsyncSession = Depends(get_db)
):
    """Aggregated stats for a vendor."""
    po_count_q = await db.execute(
        select(func.count(PurchaseOrder.id)).where(
            PurchaseOrder.vendor_id == vendor_id
        )
    )
    po_count = po_count_q.scalar() or 0

    po_total_q = await db.execute(
        select(func.coalesce(func.sum(PurchaseOrder.total_amount), 0)).where(
            PurchaseOrder.vendor_id == vendor_id
        )
    )
    po_total = float(po_total_q.scalar() or 0)

    inv_count_q = await db.execute(
        select(func.count(Invoice.id)).where(Invoice.vendor_id == vendor_id)
    )
    inv_count = inv_count_q.scalar() or 0

    inv_total_q = await db.execute(
        select(func.coalesce(func.sum(Invoice.total_amount), 0)).where(
            Invoice.vendor_id == vendor_id
        )
    )
    inv_total = float(inv_total_q.scalar() or 0)

    avg_time_q = await db.execute(
        select(func.avg(Reconciliation.processing_time_ms))
        .join(Invoice, Invoice.id == Reconciliation.invoice_id)
        .where(Invoice.vendor_id == vendor_id)
    )
    avg_time_ms = avg_time_q.scalar()

    approved_q = await db.execute(
        select(func.count(Invoice.id)).where(
            Invoice.vendor_id == vendor_id,
            Invoice.business_status == "approved",
        )
    )
    approved_count = approved_q.scalar() or 0

    return {
        "vendor_id": str(vendor_id),
        "po_count": po_count,
        "po_total": po_total,
        "invoice_count": inv_count,
        "invoice_total": inv_total,
        "approved_count": approved_count,
        "avg_processing_time_ms": float(avg_time_ms) if avg_time_ms else None,
    }
