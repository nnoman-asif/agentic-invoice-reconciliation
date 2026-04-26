import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.database import POLineItem, PurchaseOrder
from app.models.schemas import (
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
