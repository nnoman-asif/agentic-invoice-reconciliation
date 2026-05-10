import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.database import (
    Discrepancy,
    Invoice,
    POLineItem,
    PurchaseOrder,
    Reconciliation,
)
from app.models.schemas import (
    MatchedInvoiceForPO,
    PurchaseOrderCreate,
    PurchaseOrderListResponse,
    PurchaseOrderResponse,
)

router = APIRouter()


@router.get("/purchase-orders", response_model=list[PurchaseOrderListResponse])
async def list_purchase_orders(db: AsyncSession = Depends(get_db)):
    stmt = select(PurchaseOrder).order_by(PurchaseOrder.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/purchase-orders", response_model=PurchaseOrderResponse, status_code=201)
async def create_purchase_order(
    data: PurchaseOrderCreate,
    db: AsyncSession = Depends(get_db),
):
    po = PurchaseOrder(
        po_number=data.po_number,
        vendor_id=data.vendor_id,
        issue_date=data.issue_date,
        expected_delivery_date=data.expected_delivery_date,
        status=data.status.value,
        total_amount=data.total_amount,
        currency=data.currency,
        notes=data.notes,
    )
    db.add(po)
    await db.flush()

    for item in data.line_items:
        line = POLineItem(
            po_id=po.id,
            line_number=item.line_number,
            item_code=item.item_code,
            item_description=item.item_description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            total_price=item.total_price,
            unit_of_measure=item.unit_of_measure,
        )
        db.add(line)

    await db.flush()

    stmt = (
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.line_items))
        .where(PurchaseOrder.id == po.id)
    )
    result = await db.execute(stmt)
    return result.scalar_one()


@router.get("/purchase-orders/{po_id}", response_model=PurchaseOrderResponse)
async def get_purchase_order(po_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.line_items))
        .where(PurchaseOrder.id == po_id)
    )
    result = await db.execute(stmt)
    po = result.scalar_one_or_none()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return po


@router.get(
    "/purchase-orders/{po_id}/invoices",
    response_model=list[MatchedInvoiceForPO],
)
async def list_invoices_matched_to_po(
    po_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Invoices that the matcher agent reconciled against this PO.

    Powers the 'Matched Invoices' tab in the PO detail sheet so users
    can jump straight from a PO to any invoice it produced a
    reconciliation for.
    """
    # Subquery: count of discrepancies per reconciliation
    disc_count_sq = (
        select(
            Discrepancy.reconciliation_id.label("reconciliation_id"),
            func.count(Discrepancy.id).label("disc_count"),
        )
        .group_by(Discrepancy.reconciliation_id)
        .subquery()
    )

    stmt = (
        select(
            Invoice.id.label("invoice_id"),
            Invoice.invoice_number,
            Invoice.business_status,
            Invoice.total_amount,
            Reconciliation.id.label("reconciliation_id"),
            Reconciliation.match_type,
            Reconciliation.overall_status,
            func.coalesce(disc_count_sq.c.disc_count, 0).label("discrepancies_count"),
        )
        .join(Reconciliation, Reconciliation.invoice_id == Invoice.id)
        .outerjoin(
            disc_count_sq,
            disc_count_sq.c.reconciliation_id == Reconciliation.id,
        )
        .where(Reconciliation.po_id == po_id)
        .order_by(Reconciliation.created_at.desc())
    )

    result = await db.execute(stmt)
    rows = result.all()
    return [
        MatchedInvoiceForPO(
            invoice_id=row.invoice_id,
            invoice_number=row.invoice_number,
            business_status=row.business_status,
            total_amount=float(row.total_amount) if row.total_amount is not None else None,
            reconciliation_id=row.reconciliation_id,
            match_type=row.match_type,
            overall_status=row.overall_status,
            discrepancies_count=int(row.discrepancies_count or 0),
        )
        for row in rows
    ]
