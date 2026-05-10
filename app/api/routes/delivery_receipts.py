import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.database import DeliveryLineItem, DeliveryReceipt
from app.models.schemas import (
    DeliveryReceiptCreate,
    DeliveryReceiptResponse,
)

router = APIRouter()


@router.get("/delivery-receipts", response_model=list[DeliveryReceiptResponse])
async def list_delivery_receipts(
    po_id: uuid.UUID | None = Query(
        None, description="Filter to receipts for a specific purchase order"
    ),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(DeliveryReceipt)
        .options(selectinload(DeliveryReceipt.line_items))
        .order_by(DeliveryReceipt.created_at.desc())
    )
    if po_id is not None:
        stmt = stmt.where(DeliveryReceipt.po_id == po_id)
    result = await db.execute(stmt)
    return result.scalars().unique().all()


@router.post("/delivery-receipts", response_model=DeliveryReceiptResponse, status_code=201)
async def create_delivery_receipt(
    data: DeliveryReceiptCreate,
    db: AsyncSession = Depends(get_db),
):
    receipt = DeliveryReceipt(
        receipt_number=data.receipt_number,
        po_id=data.po_id,
        received_date=data.received_date,
        receiver_name=data.receiver_name,
        status=data.status.value,
        notes=data.notes,
    )
    db.add(receipt)
    await db.flush()

    for item in data.line_items:
        line = DeliveryLineItem(
            receipt_id=receipt.id,
            po_line_item_id=item.po_line_item_id,
            item_description=item.item_description,
            quantity_received=item.quantity_received,
            quantity_accepted=item.quantity_accepted,
            quantity_rejected=item.quantity_rejected,
        )
        db.add(line)

    await db.flush()

    stmt = (
        select(DeliveryReceipt)
        .options(selectinload(DeliveryReceipt.line_items))
        .where(DeliveryReceipt.id == receipt.id)
    )
    result = await db.execute(stmt)
    return result.scalar_one()


@router.get("/delivery-receipts/{receipt_id}", response_model=DeliveryReceiptResponse)
async def get_delivery_receipt(receipt_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(DeliveryReceipt)
        .options(selectinload(DeliveryReceipt.line_items))
        .where(DeliveryReceipt.id == receipt_id)
    )
    result = await db.execute(stmt)
    receipt = result.scalar_one_or_none()
    if not receipt:
        raise HTTPException(status_code=404, detail="Delivery receipt not found")
    return receipt
