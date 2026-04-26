"""Database query tools for agents."""

import uuid

from sqlalchemy import and_, select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.database import (
    DeliveryLineItem,
    DeliveryReceipt,
    Invoice,
    POLineItem,
    PurchaseOrder,
    Vendor,
)


async def find_vendor_by_name_or_tax_id(
    db: AsyncSession,
    name: str | None = None,
    tax_id: str | None = None,
) -> Vendor | None:
    """Find a vendor by tax ID (exact) or name (case-insensitive)."""
    if tax_id:
        stmt = select(Vendor).where(Vendor.tax_id == tax_id)
        result = await db.execute(stmt)
        vendor = result.scalar_one_or_none()
        if vendor:
            return vendor

    if name:
        stmt = select(Vendor).where(func.lower(Vendor.name) == func.lower(name))
        result = await db.execute(stmt)
        vendor = result.scalar_one_or_none()
        if vendor:
            return vendor

        # Partial match fallback
        stmt = select(Vendor).where(func.lower(Vendor.name).contains(name.lower()))
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    return None


async def find_purchase_order_by_number(
    db: AsyncSession,
    po_number: str,
    vendor_id: uuid.UUID | None = None,
) -> PurchaseOrder | None:
    """Find a PO by exact number, optionally filtered by vendor."""
    stmt = (
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.line_items))
        .where(PurchaseOrder.po_number == po_number)
    )
    if vendor_id:
        stmt = stmt.where(PurchaseOrder.vendor_id == vendor_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def find_purchase_orders_by_vendor(
    db: AsyncSession,
    vendor_id: uuid.UUID,
    amount: float | None = None,
    tolerance_pct: float = 10.0,
) -> list[PurchaseOrder]:
    """Find POs for a vendor, optionally filtered by approximate total amount."""
    stmt = (
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.line_items))
        .where(
            and_(
                PurchaseOrder.vendor_id == vendor_id,
                PurchaseOrder.status.in_(["issued", "fulfilled"]),
            )
        )
    )

    if amount is not None:
        lower = amount * (1 - tolerance_pct / 100)
        upper = amount * (1 + tolerance_pct / 100)
        stmt = stmt.where(PurchaseOrder.total_amount.between(lower, upper))

    result = await db.execute(stmt)
    return list(result.scalars().all())


async def find_delivery_receipts_for_po(
    db: AsyncSession,
    po_id: uuid.UUID,
) -> list[DeliveryReceipt]:
    """Get all delivery receipts (with line items) for a PO."""
    stmt = (
        select(DeliveryReceipt)
        .options(selectinload(DeliveryReceipt.line_items))
        .where(DeliveryReceipt.po_id == po_id)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def check_duplicate_invoice(
    db: AsyncSession,
    invoice_number: str,
    current_invoice_id: uuid.UUID,
) -> bool:
    """Check if another invoice with the same number exists."""
    stmt = select(Invoice.id).where(
        and_(
            Invoice.invoice_number == invoice_number,
            Invoice.id != current_invoice_id,
        )
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none() is not None
