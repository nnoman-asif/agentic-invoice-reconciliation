import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import delete as sql_delete
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import OwnerContext, get_current_owner, require_owned_write
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
    VendorCreate,
    VendorResponse,
    VendorUpdate,
)
from app.tools.db_queries import scope_to_owner
from app.tools.tabular import TabularError, read_tabular

router = APIRouter()

VENDOR_IMPORT_REQUIRED_COLUMNS = ("code", "name")
VENDOR_IMPORT_OPTIONAL_COLUMNS = ("tax_id", "address", "contact_email")


async def _visible_vendor(
    db: AsyncSession, vendor_id: uuid.UUID, owner_id: uuid.UUID
) -> Vendor | None:
    stmt = select(Vendor).where(Vendor.id == vendor_id)
    stmt = scope_to_owner(stmt, Vendor, owner_id, include_system=True)
    return (await db.execute(stmt)).scalar_one_or_none()


@router.get("/vendors", response_model=list[VendorResponse])
async def list_vendors(
    db: AsyncSession = Depends(get_db),
    owner: OwnerContext = Depends(get_current_owner),
):
    stmt = select(Vendor).order_by(Vendor.name)
    stmt = scope_to_owner(stmt, Vendor, owner.user_id, include_system=True)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/vendors", response_model=VendorResponse, status_code=201)
async def create_vendor(
    data: VendorCreate,
    db: AsyncSession = Depends(get_db),
    owner: OwnerContext = Depends(get_current_owner),
):
    code_q = await db.execute(
        select(Vendor.id).where(
            Vendor.owner_id == owner.user_id,
            Vendor.code == data.code,
        )
    )
    if code_q.scalar_one_or_none():
        raise HTTPException(
            status_code=409, detail=f"code {data.code!r} already exists"
        )
    if data.tax_id:
        tax_q = await db.execute(
            select(Vendor.id).where(
                Vendor.owner_id == owner.user_id,
                Vendor.tax_id == data.tax_id,
            )
        )
        if tax_q.scalar_one_or_none():
            raise HTTPException(
                status_code=409,
                detail=f"tax_id {data.tax_id!r} already exists",
            )

    vendor = Vendor(
        owner_id=owner.user_id,
        code=data.code,
        name=data.name,
        tax_id=data.tax_id,
        address=data.address,
        contact_email=data.contact_email,
    )
    db.add(vendor)
    await db.flush()
    return vendor


@router.put("/vendors/{vendor_id}", response_model=VendorResponse)
async def update_vendor(
    vendor_id: uuid.UUID,
    data: VendorUpdate,
    db: AsyncSession = Depends(get_db),
    owner: OwnerContext = Depends(get_current_owner),
):
    vendor = await db.get(Vendor, vendor_id)
    require_owned_write(vendor, owner.user_id, not_found="Vendor not found")

    if data.code is not None and data.code != vendor.code:
        code_q = await db.execute(
            select(Vendor.id).where(
                Vendor.owner_id == owner.user_id,
                Vendor.code == data.code,
                Vendor.id != vendor_id,
            )
        )
        if code_q.scalar_one_or_none():
            raise HTTPException(
                status_code=409, detail=f"code {data.code!r} already exists"
            )
        vendor.code = data.code

    if data.tax_id is not None and data.tax_id != vendor.tax_id:
        if data.tax_id:  # only check uniqueness for non-empty values
            tax_q = await db.execute(
                select(Vendor.id).where(
                    Vendor.owner_id == owner.user_id,
                    Vendor.tax_id == data.tax_id,
                    Vendor.id != vendor_id,
                )
            )
            if tax_q.scalar_one_or_none():
                raise HTTPException(
                    status_code=409,
                    detail=f"tax_id {data.tax_id!r} already exists",
                )
        vendor.tax_id = data.tax_id or None

    if data.name is not None:
        vendor.name = data.name
    if data.address is not None:
        vendor.address = data.address or None
    if data.contact_email is not None:
        vendor.contact_email = data.contact_email or None

    await db.flush()
    return vendor


@router.delete("/vendors/{vendor_id}", status_code=204)
async def delete_vendor(
    vendor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    owner: OwnerContext = Depends(get_current_owner),
):
    """Delete a vendor.

    Both `purchase_orders.vendor_id` and `invoices.vendor_id` are
    `ON DELETE RESTRICT`, so the DB will refuse if either side is
    populated. We pre-check for a friendlier 409 response with
    counts; the IntegrityError catch is a safety net for races.
    """
    vendor = await db.get(Vendor, vendor_id)
    require_owned_write(vendor, owner.user_id, not_found="Vendor not found")

    po_count_q = await db.execute(
        select(func.count(PurchaseOrder.id)).where(
            PurchaseOrder.vendor_id == vendor_id,
            PurchaseOrder.owner_id == owner.user_id,
        )
    )
    po_count = int(po_count_q.scalar() or 0)
    inv_count_q = await db.execute(
        select(func.count(Invoice.id)).where(
            Invoice.vendor_id == vendor_id,
            Invoice.owner_id == owner.user_id,
        )
    )
    inv_count = int(inv_count_q.scalar() or 0)

    if po_count > 0 or inv_count > 0:
        raise HTTPException(
            status_code=409,
            detail={
                "message": (
                    f"Vendor has {po_count} purchase order"
                    f"{'' if po_count == 1 else 's'} and "
                    f"{inv_count} invoice{'' if inv_count == 1 else 's'}; "
                    "delete or reassign them before removing the vendor."
                ),
                "po_count": po_count,
                "invoice_count": inv_count,
            },
        )

    try:
        await db.execute(
            sql_delete(Vendor).where(
                Vendor.id == vendor_id,
                Vendor.owner_id == owner.user_id,
            )
        )
    except IntegrityError as exc:  # pragma: no cover - race-safety net
        raise HTTPException(
            status_code=409,
            detail="Vendor is still referenced by other records",
        ) from exc
    return None


@router.post("/vendors/import", response_model=ImportResponse)
async def import_vendors_csv(
    file: UploadFile = File(..., description="CSV or XLSX with one row per vendor"),
    db: AsyncSession = Depends(get_db),
    owner: OwnerContext = Depends(get_current_owner),
):
    """Bulk-load vendors from a CSV or Excel file.

    One row per vendor with columns: `code,name,tax_id,address,contact_email`
    (only `code` and `name` are required). Always returns 200 so the
    UI can render partial-success details. Only unparseable files return
    400.
    """
    raw = await file.read()
    try:
        fieldnames, rows = read_tabular(file.filename, raw)
    except TabularError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    fieldnames_lower = set(fieldnames)
    missing = [
        c for c in VENDOR_IMPORT_REQUIRED_COLUMNS if c not in fieldnames_lower
    ]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"File missing required columns: {', '.join(missing)}",
        )

    response = ImportResponse()

    if not rows:
        return response

    # Pre-load existing codes to skip duplicates against DB (this owner).
    candidate_codes = {(r.get("code") or "").strip() for _, r in rows}
    candidate_codes.discard("")
    existing_codes: set[str] = set()
    if candidate_codes:
        existing_q = await db.execute(
            select(Vendor.code).where(
                Vendor.owner_id == owner.user_id,
                Vendor.code.in_(candidate_codes),
            )
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
            owner_id=owner.user_id,
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
async def get_vendor(
    vendor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    owner: OwnerContext = Depends(get_current_owner),
):
    vendor = await _visible_vendor(db, vendor_id, owner.user_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor


@router.get("/vendors/{vendor_id}/purchase-orders", response_model=list[PurchaseOrderListResponse])
async def get_vendor_purchase_orders(
    vendor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    owner: OwnerContext = Depends(get_current_owner),
):
    if not await _visible_vendor(db, vendor_id, owner.user_id):
        raise HTTPException(status_code=404, detail="Vendor not found")

    stmt = (
        select(PurchaseOrder)
        .where(PurchaseOrder.vendor_id == vendor_id)
        .order_by(PurchaseOrder.created_at.desc())
    )
    stmt = scope_to_owner(stmt, PurchaseOrder, owner.user_id, include_system=True)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/vendors/{vendor_id}/invoices", response_model=list[InvoiceListResponse])
async def get_vendor_invoices(
    vendor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    owner: OwnerContext = Depends(get_current_owner),
):
    if not await _visible_vendor(db, vendor_id, owner.user_id):
        raise HTTPException(status_code=404, detail="Vendor not found")

    stmt = (
        select(Invoice)
        .where(
            Invoice.vendor_id == vendor_id,
            Invoice.owner_id == owner.user_id,
        )
        .order_by(Invoice.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/vendors/{vendor_id}/stats")
async def get_vendor_stats(
    vendor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    owner: OwnerContext = Depends(get_current_owner),
):
    """Aggregated stats for a vendor."""
    if not await _visible_vendor(db, vendor_id, owner.user_id):
        raise HTTPException(status_code=404, detail="Vendor not found")

    po_scope = scope_to_owner(
        select(func.count(PurchaseOrder.id)).where(
            PurchaseOrder.vendor_id == vendor_id
        ),
        PurchaseOrder,
        owner.user_id,
        include_system=True,
    )
    po_count = (await db.execute(po_scope)).scalar() or 0

    po_total_stmt = scope_to_owner(
        select(func.coalesce(func.sum(PurchaseOrder.total_amount), 0)).where(
            PurchaseOrder.vendor_id == vendor_id
        ),
        PurchaseOrder,
        owner.user_id,
        include_system=True,
    )
    po_total = float((await db.execute(po_total_stmt)).scalar() or 0)

    inv_count_q = await db.execute(
        select(func.count(Invoice.id)).where(
            Invoice.vendor_id == vendor_id,
            Invoice.owner_id == owner.user_id,
        )
    )
    inv_count = inv_count_q.scalar() or 0

    inv_total_q = await db.execute(
        select(func.coalesce(func.sum(Invoice.total_amount), 0)).where(
            Invoice.vendor_id == vendor_id,
            Invoice.owner_id == owner.user_id,
        )
    )
    inv_total = float(inv_total_q.scalar() or 0)

    avg_time_q = await db.execute(
        select(func.avg(Reconciliation.processing_time_ms))
        .join(Invoice, Invoice.id == Reconciliation.invoice_id)
        .where(
            Invoice.vendor_id == vendor_id,
            Invoice.owner_id == owner.user_id,
        )
    )
    avg_time_ms = avg_time_q.scalar()

    approved_q = await db.execute(
        select(func.count(Invoice.id)).where(
            Invoice.vendor_id == vendor_id,
            Invoice.owner_id == owner.user_id,
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
