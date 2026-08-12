import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import OwnerContext, get_current_owner
from app.config import settings
from app.db.session import get_db
from app.models.database import Invoice, Reconciliation
from app.models.schemas import (
    InvoiceListResponse,
    InvoiceResponse,
    InvoiceUploadResponse,
    ReconciliationResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# Strict allow-lists for upload validation. Anything else is rejected
# at the HTTP layer so it never enters the worker pipeline.
PDF_MAGIC = b"%PDF-"
ALLOWED_EXTENSIONS = {".pdf"}
ALLOWED_CONTENT_TYPES = {"application/pdf", "application/x-pdf"}


@router.post("/invoices/upload", response_model=InvoiceUploadResponse, status_code=201)
async def upload_invoice(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    owner: OwnerContext = Depends(get_current_owner),
):
    # ── Validation ─────────────────────────────────────────────────
    # Size cap (early exit before reading body)
    max_mb = min(settings.max_upload_size_mb, owner.max_upload_mb)
    if file.size is not None and file.size > max_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large")
    if file.size == 0:
        raise HTTPException(status_code=400, detail="File is empty")

    # Extension whitelist
    ext = Path(file.filename).suffix.lower() if file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=(
                f"Unsupported file extension '{ext or '(none)'}'. "
                f"Only {', '.join(sorted(ALLOWED_EXTENSIONS))} is allowed."
            ),
        )

    # Content-type whitelist (browser-set; not authoritative on its own
    # but rejecting obviously-wrong types gives a clearer error)
    if file.content_type and file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail=(
                f"Unsupported content type '{file.content_type}'. "
                "Only application/pdf is allowed."
            ),
        )

    # Read the body and verify the PDF magic header. This catches
    # spoofed extensions and zero-byte payloads regardless of what
    # `file.size` reported (some clients omit Content-Length).
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="File is empty")
    if not content.startswith(PDF_MAGIC):
        raise HTTPException(
            status_code=415,
            detail="File content is not a valid PDF (missing %PDF- header).",
        )

    # ── Persist file + DB row ──────────────────────────────────────
    invoice_id = uuid.uuid4()
    file_path = f"{settings.upload_dir}/{invoice_id}{ext}"
    Path(file_path).parent.mkdir(parents=True, exist_ok=True)
    with open(file_path, "wb") as f:
        f.write(content)

    invoice = Invoice(
        id=invoice_id,
        owner_id=owner.user_id,
        processing_status="queued",
        business_status="pending",
        raw_file_path=file_path,
        file_content_type=file.content_type,
    )
    db.add(invoice)

    # COMMIT BEFORE ENQUEUE -- otherwise the worker can race ahead and
    # see "invoice not found" because the upload's transaction is still
    # open (this was bug C3).
    await db.commit()
    await db.refresh(invoice)

    try:
        await request.app.state.redis.lpush("invoice_queue", str(invoice_id))
    except Exception as e:
        logger.error(f"[Upload] Redis enqueue failed for invoice {invoice_id}: {e}")
        raise HTTPException(
            status_code=503,
            detail=(
                "Invoice saved but could not be queued for processing. "
                "Use POST /api/webhooks/invoice-received with "
                f'{{"invoice_id": "{invoice_id}"}} to retry.'
            ),
        ) from e

    return invoice


@router.get("/invoices", response_model=list[InvoiceListResponse])
async def list_invoices(
    processing_status: str | None = Query(None),
    business_status: str | None = Query(None),
    vendor_id: uuid.UUID | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    owner: OwnerContext = Depends(get_current_owner),
):
    stmt = (
        select(Invoice)
        .where(Invoice.owner_id == owner.user_id)
        .order_by(Invoice.created_at.desc())
    )

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
async def get_invoice(
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    owner: OwnerContext = Depends(get_current_owner),
):
    stmt = (
        select(Invoice)
        .options(selectinload(Invoice.line_items))
        .where(
            Invoice.id == invoice_id,
            Invoice.owner_id == owner.user_id,
        )
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
    owner: OwnerContext = Depends(get_current_owner),
):
    inv_q = await db.execute(
        select(Invoice.id).where(
            Invoice.id == invoice_id,
            Invoice.owner_id == owner.user_id,
        )
    )
    if not inv_q.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Invoice not found")

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
