import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.db.session import get_db
from app.models.database import Invoice, InvoiceLineItem, Reconciliation
from app.models.schemas import (
    InvoiceListResponse,
    InvoiceResponse,
    InvoiceUploadResponse,
    ReconciliationResponse,
)

router = APIRouter()


@router.post("/invoices/upload", response_model=InvoiceUploadResponse, status_code=201)
async def upload_invoice(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    if file.size and file.size > settings.max_upload_size_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large")

    invoice_id = uuid.uuid4()
    ext = Path(file.filename).suffix if file.filename else ".pdf"
    file_path = f"{settings.upload_dir}/{invoice_id}{ext}"

    Path(file_path).parent.mkdir(parents=True, exist_ok=True)
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    invoice = Invoice(
        id=invoice_id,
        processing_status="queued",
        business_status="pending",
        raw_file_path=file_path,
        file_content_type=file.content_type,
    )
    db.add(invoice)
    await db.flush()

    await request.app.state.redis.lpush("invoice_queue", str(invoice_id))

    return invoice


@router.get("/invoices", response_model=list[InvoiceListResponse])
async def list_invoices(
    processing_status: str | None = Query(None),
    business_status: str | None = Query(None),
    vendor_id: uuid.UUID | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Invoice).order_by(Invoice.created_at.desc())

    if processing_status:
        stmt = stmt.where(Invoice.processing_status == processing_status)
    if business_status:
        stmt = stmt.where(Invoice.business_status == business_status)
    if vendor_id:
        stmt = stmt.where(Invoice.vendor_id == vendor_id)

    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(invoice_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Invoice)
        .options(selectinload(Invoice.line_items))
        .where(Invoice.id == invoice_id)
    )
    result = await db.execute(stmt)
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@router.get("/invoices/{invoice_id}/reconciliation", response_model=ReconciliationResponse)
async def get_invoice_reconciliation(
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
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
    reconciliation = result.scalar_one_or_none()
    if not reconciliation:
        raise HTTPException(status_code=404, detail="No reconciliation found for this invoice")
    return reconciliation
