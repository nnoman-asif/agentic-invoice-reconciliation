"""Database query tools for agents — all reads require owner_id."""

from __future__ import annotations

import uuid

from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.sql import Select

from app.config import SYSTEM_USER_ID
from app.models.database import (
    DeliveryReceipt,
    Invoice,
    PurchaseOrder,
    Vendor,
)


def scope_to_owner(
    stmt: Select,
    model,
    owner_id: uuid.UUID,
    *,
    include_system: bool = False,
) -> Select:
    """Restrict a select to rows the owner can read.

    When ``include_system`` is True, also include rows owned by the
    permanent system user (shared demo reference data).
    """
    if include_system:
        return stmt.where(
            or_(model.owner_id == owner_id, model.owner_id == SYSTEM_USER_ID)
        )
    return stmt.where(model.owner_id == owner_id)


def _prefer_own(model, owner_id: uuid.UUID):
    """Order so the caller's own rows beat system-owned ones."""
    return case((model.owner_id == owner_id, 0), else_=1)


async def find_vendor_by_name_or_tax_id(
    db: AsyncSession,
    owner_id: uuid.UUID,
    name: str | None = None,
    tax_id: str | None = None,
) -> Vendor | None:
    """Find a vendor by tax ID (exact) or name (case-insensitive).

    Prefers the caller's own vendor over a system-owned match.
    """
    if tax_id:
        stmt = select(Vendor).where(Vendor.tax_id == tax_id)
        stmt = scope_to_owner(stmt, Vendor, owner_id, include_system=True)
        stmt = stmt.order_by(_prefer_own(Vendor, owner_id))
        result = await db.execute(stmt)
        vendor = result.scalars().first()
        if vendor:
            return vendor

    if name:
        stmt = select(Vendor).where(func.lower(Vendor.name) == func.lower(name))
        stmt = scope_to_owner(stmt, Vendor, owner_id, include_system=True)
        stmt = stmt.order_by(_prefer_own(Vendor, owner_id))
        result = await db.execute(stmt)
        vendor = result.scalars().first()
        if vendor:
            return vendor

        # Partial match fallback
        stmt = select(Vendor).where(func.lower(Vendor.name).contains(name.lower()))
        stmt = scope_to_owner(stmt, Vendor, owner_id, include_system=True)
        stmt = stmt.order_by(_prefer_own(Vendor, owner_id))
        result = await db.execute(stmt)
        return result.scalars().first()

    return None


async def find_purchase_order_by_number(
    db: AsyncSession,
    owner_id: uuid.UUID,
    po_number: str,
    vendor_id: uuid.UUID | None = None,
) -> PurchaseOrder | None:
    """Find a PO by exact number, optionally filtered by vendor.

    Prefers the caller's own PO over a system-owned match.
    """
    stmt = (
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.line_items))
        .where(PurchaseOrder.po_number == po_number)
    )
    stmt = scope_to_owner(stmt, PurchaseOrder, owner_id, include_system=True)
    if vendor_id:
        stmt = stmt.where(PurchaseOrder.vendor_id == vendor_id)
    stmt = stmt.order_by(_prefer_own(PurchaseOrder, owner_id))
    result = await db.execute(stmt)
    return result.scalars().first()


async def find_purchase_orders_by_vendor(
    db: AsyncSession,
    owner_id: uuid.UUID,
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
    stmt = scope_to_owner(stmt, PurchaseOrder, owner_id, include_system=True)

    if amount is not None:
        lower = amount * (1 - tolerance_pct / 100)
        upper = amount * (1 + tolerance_pct / 100)
        stmt = stmt.where(PurchaseOrder.total_amount.between(lower, upper))

    stmt = stmt.order_by(_prefer_own(PurchaseOrder, owner_id))
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def find_delivery_receipts_for_po(
    db: AsyncSession,
    owner_id: uuid.UUID,
    po_id: uuid.UUID,
) -> list[DeliveryReceipt]:
    """Get all delivery receipts (with line items) for a PO."""
    stmt = (
        select(DeliveryReceipt)
        .options(selectinload(DeliveryReceipt.line_items))
        .where(DeliveryReceipt.po_id == po_id)
    )
    stmt = scope_to_owner(stmt, DeliveryReceipt, owner_id, include_system=True)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def check_duplicate_invoice(
    db: AsyncSession,
    owner_id: uuid.UUID,
    invoice_number: str,
    current_invoice_id: uuid.UUID | str,
) -> bool:
    """Check if another invoice with the same number exists for this owner."""
    current_id = (
        current_invoice_id
        if isinstance(current_invoice_id, uuid.UUID)
        else uuid.UUID(str(current_invoice_id))
    )
    stmt = select(Invoice.id).where(
        and_(
            Invoice.owner_id == owner_id,
            Invoice.invoice_number == invoice_number,
            Invoice.id != current_id,
        )
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none() is not None
