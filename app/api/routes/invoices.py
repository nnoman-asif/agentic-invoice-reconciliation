import hashlib
import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile
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
from app.tools.pdf_validation import PDF_MAGIC, validate_pdf

logger = logging.getLogger(__name__)

router = APIRouter()

ALLOWED_EXTENSIONS = {".pdf"}
ALLOWED_CONTENT_TYPES = {"application/pdf", "application/x-pdf"}
_READ_CHUNK = 64 * 1024


async def _read_upload_capped(file: UploadFile, max_bytes: int) -> bytes:
    """Read the upload in chunks; abort if it exceeds ``max_bytes``."""
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(_READ_CHUNK)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(status_code=413, detail="File too large")
        chunks.append(chunk)
    return b"".join(chunks)


@router.post("/invoices/upload", response_model=InvoiceUploadResponse, status_code=201)
async def upload_invoice(
    request: Request,
    response: Response,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    owner: OwnerContext = Depends(get_current_owner),
):
    # ── Validation ─────────────────────────────────────────────────
    max_mb = min(settings.max_upload_size_mb, owner.max_upload_mb)
    max_bytes = max_mb * 1024 * 1024

    if file.size is not None and file.size > max_bytes:
        raise HTTPException(status_code=413, detail="File too large")
    if file.size == 0:
        raise HTTPException(status_code=400, detail="File is empty")

    ext = Path(file.filename).suffix.lower() if file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=(
                f"Unsupported file extension '{ext or '(none)'}'. "
                f"Only {', '.join(sorted(ALLOWED_EXTENSIONS))} is allowed."
            ),
        )

    if file.content_type and file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail=(
                f"Unsupported content type '{file.content_type}'. "
                "Only application/pdf is allowed."
            ),
        )

    content = await _read_upload_capped(file, max_bytes)
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="File is empty")

    # Fast magic check before heavier validation
    if not content.startswith(PDF_MAGIC):
        raise HTTPException(
            status_code=415,
            detail="File content is not a valid PDF (missing %PDF- header).",
        )

    file_hash = hashlib.sha256(content).hexdigest()
    existing_q = await db.execute(
        select(Invoice).where(
            Invoice.owner_id == owner.user_id,
            Invoice.file_hash == file_hash,
        )
    )
    existing = existing_q.scalar_one_or_none()
    if existing is not None:
        response.status_code = 200
        return existing

    validated = validate_pdf(
        content,
        max_pages=owner.max_pdf_pages,
        max_chars=settings.max_pdf_chars,
    )
    if not validated.ok:
        raise HTTPException(status_code=400, detail=validated.reason)

    # ── Persist file + DB row ──────────────────────────────────────
    invoice_id = uuid.uuid4()
    file_path = f"{settings.upload_dir}/{invoice_id}{ext or '.pdf'}"
    Path(file_path).parent.mkdir(parents=True, exist_ok=True)
    with open(file_path, "wb") as f:
        f.write(content)

    invoice = Invoice(
        id=invoice_id,
        owner_id=owner.user_id,
        processing_status="queued",
        business_status="pending",
        raw_file_path=file_path,
        file_content_type=file.content_type or "application/pdf",
        file_hash=file_hash,
        raw_text=validated.text,
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
        logger.error("[Upload] Redis enqueue failed for invoice %s: %s", invoice_id, e)
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
