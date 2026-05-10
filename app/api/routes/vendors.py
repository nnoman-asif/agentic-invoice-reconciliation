import csv
import io
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
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
    ImportResponse,
    ImportRowResult,
    InvoiceListResponse,
    PurchaseOrderListResponse,
    VendorResponse,
)

router = APIRouter()

VENDOR_IMPORT_REQUIRED_COLUMNS = ("code", "name")
VENDOR_IMPORT_OPTIONAL_COLUMNS = ("tax_id", "address", "contact_email")


@router.get("/vendors", response_model=list[VendorResponse])
async def list_vendors(db: AsyncSession = Depends(get_db)):
    stmt = select(Vendor).order_by(Vendor.name)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/vendors/import", response_model=ImportResponse)
async def import_vendors_csv(
    file: UploadFile = File(..., description="CSV with one row per vendor"),
    db: AsyncSession = Depends(get_db),
):
    """Bulk-load vendors from a CSV file.

    One row per vendor with columns: `code,name,tax_id,address,contact_email`
    (only `code` and `name` are required). Always returns 200 so the
    UI can render partial-success details. Only unparseable CSVs return
    400.
    """
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="CSV file is empty")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"CSV must be UTF-8 encoded ({exc.reason})",
        ) from exc

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(
            status_code=400,
            detail="CSV has no header row",
        )

    fieldnames_lower = {fn.strip().lower() for fn in reader.fieldnames}
    missing = [
        c for c in VENDOR_IMPORT_REQUIRED_COLUMNS if c not in fieldnames_lower
    ]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"CSV missing required columns: {', '.join(missing)}",
        )

    response = ImportResponse()
    rows = list(enumerate(reader, start=2))  # header is row 1

    if not rows:
        return response

    # Pre-load existing codes to skip duplicates against DB.
    candidate_codes = {(r.get("code") or "").strip() for _, r in rows}
    candidate_codes.discard("")
    existing_codes: set[str] = set()
    if candidate_codes:
        existing_q = await db.execute(
            select(Vendor.code).where(Vendor.code.in_(candidate_codes))
        )
        existing_codes = {c for c in existing_q.scalars()}

    seen_in_file: set[str] = set()
    for row_no, row in rows:
        code = (row.get("code") or "").strip()
        name = (row.get("name") or "").strip()
        result = ImportRowResult(row=row_no, identifier=code or name or None)

        if not code:
            result.reason = "code is required"
            response.errors.append(result)
            continue
        if not name:
            result.reason = "name is required"
            response.errors.append(result)
            continue
        if code in seen_in_file:
            result.reason = "duplicate code in file"
            response.skipped.append(result)
            continue
        if code in existing_codes:
            result.reason = "code already exists"
            response.skipped.append(result)
            continue

        seen_in_file.add(code)
        vendor = Vendor(
            code=code,
            name=name,
            tax_id=(row.get("tax_id") or "").strip() or None,
            address=(row.get("address") or "").strip() or None,
            contact_email=(row.get("contact_email") or "").strip() or None,
        )
        db.add(vendor)
        try:
            await db.commit()
        except Exception as exc:  # pragma: no cover - defensive
            await db.rollback()
            result.reason = f"insert failed: {exc.__class__.__name__}"
            response.errors.append(result)
            continue

        result.id = vendor.id
        response.imported.append(result)

    return response


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
