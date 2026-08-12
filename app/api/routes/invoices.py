import hashlib
import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile
from fastapi.responses import FileResponse
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
from app.tools.limits import (
    acquire_inflight,
    check_upload_rate,
    enqueue_invoice,
    get_queue_position,
    is_provider_throttled,
    release_inflight,
)
from app.tools.pdf_validation import PDF_MAGIC, validate_pdf
from app.tools.quota import assert_accepting_work
from app.tools.storage import get_storage

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


def _invoice_response(
    invoice: Invoice,
    *,
    queue_position: int | None = None,
    provider_throttled: bool = False,
) -> InvoiceResponse:
    data = InvoiceResponse.model_validate(invoice)
    return data.model_copy(
        update={
            "queue_position": queue_position,
            "provider_throttled": provider_throttled,
        }
    )


@router.post("/invoices/upload", response_model=InvoiceUploadResponse, status_code=201)
async def upload_invoice(
    request: Request,
    response: Response,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    owner: OwnerContext = Depends(get_current_owner),
):
    redis = request.app.state.redis
    await assert_accepting_work(redis)
    await check_upload_rate(redis, owner.user_id)

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
        pos = None
        throttled = False
        if existing.processing_status == "queued":
            pos = await get_queue_position(redis, existing.id)
            throttled = await is_provider_throttled(redis)
        upload = InvoiceUploadResponse.model_validate(existing)
        return upload.model_copy(
            update={"queue_position": pos, "provider_throttled": throttled}
        )

    validated = validate_pdf(
        content,
        max_pages=owner.max_pdf_pages,
        max_chars=settings.max_pdf_chars,
    )
    if not validated.ok:
        raise HTTPException(status_code=400, detail=validated.reason)

    # Reserve in-flight before persist so we never enqueue past the cap.
    invoice_id = uuid.uuid4()
    await acquire_inflight(redis, owner.user_id, invoice_id)

    # ── Persist file + DB row ──────────────────────────────────────
    try:
        file_path = get_storage().write_bytes(
            f"{invoice_id}{ext or '.pdf'}", content
        )
    except Exception:
        await release_inflight(redis, owner.user_id, invoice_id)
        raise

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
    try:
        await db.commit()
        await db.refresh(invoice)
    except Exception:
        await release_inflight(redis, owner.user_id, invoice_id)
        raise

    try:
        position = await enqueue_invoice(redis, owner.user_id, invoice_id)
    except Exception as e:
        logger.error("[Upload] Redis enqueue failed for invoice %s: %s", invoice_id, e)
        await release_inflight(redis, owner.user_id, invoice_id)
        raise HTTPException(
            status_code=503,
            detail=(
                "Invoice saved but could not be queued for processing. "
                "Use POST /api/webhooks/invoice-received with "
                f'{{"invoice_id": "{invoice_id}"}} to retry.'
            ),
        ) from e

    throttled = await is_provider_throttled(redis)
    upload = InvoiceUploadResponse.model_validate(invoice)
    return upload.model_copy(
        update={"queue_position": position, "provider_throttled": throttled}
    )


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
    request: Request,
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

    queue_position = None
    throttled = False
    if invoice.processing_status == "queued":
        redis = request.app.state.redis
        queue_position = await get_queue_position(redis, invoice.id)
        throttled = await is_provider_throttled(redis)
    return _invoice_response(
        invoice,
        queue_position=queue_position,
        provider_throttled=throttled,
    )


@router.get("/invoices/{invoice_id}/file")
async def get_invoice_file(
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    owner: OwnerContext = Depends(get_current_owner),
):
    """Stream the original PDF for the owning caller only."""
    stmt = select(Invoice).where(
        Invoice.id == invoice_id,
        Invoice.owner_id == owner.user_id,
    )
    result = await db.execute(stmt)
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.file_deleted_at is not None:
        raise HTTPException(
            status_code=410,
            detail="Original document expired",
        )

    path = get_storage().resolve_stored(invoice.raw_file_path)
    if path is None or not path.exists():
        raise HTTPException(status_code=404, detail="Invoice file not found")

    media = invoice.file_content_type or "application/pdf"
    return FileResponse(
        path,
        media_type=media,
        filename=path.name,
        content_disposition_type="inline",
        headers={
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
            "Cache-Control": "private, no-store",
        },
    )


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
