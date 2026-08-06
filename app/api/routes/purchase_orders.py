import csv
import io
import logging
import uuid
from datetime import date, datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import delete as sql_delete
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
    Vendor,
)
from app.models.schemas import (
    ImportResponse,
    ImportRowResult,
    MatchedInvoiceForPO,
    PurchaseOrderCreate,
    PurchaseOrderListResponse,
    PurchaseOrderResponse,
    PurchaseOrderUpdate,
)
from app.tools.embeddings import get_embeddings_batch

logger = logging.getLogger(__name__)


def _embed_po_lines(lines: list[POLineItem]) -> None:
    """Batch-embed line descriptions onto `description_embedding`.

    On failure, leaves embeddings as NULL and logs a warning so PO
    writes still succeed; the matcher will fill the cache later.
    """
    if not lines:
        return
    try:
        vectors = get_embeddings_batch([li.item_description for li in lines])
        for li, vec in zip(lines, vectors):
            li.description_embedding = vec
    except Exception as e:
        logger.warning(
            "[PO] Failed to embed %d line description(s): %s",
            len(lines),
            e,
        )
        for li in lines:
            li.description_embedding = None

PO_IMPORT_REQUIRED_COLUMNS = (
    "po_number",
    "vendor_code",
    "issue_date",
    "line_number",
    "item_description",
    "quantity",
    "unit_price",
)
PO_IMPORT_OPTIONAL_COLUMNS = (
    "expected_delivery_date",
    "currency",
    "notes",
    "item_code",
    "unit_of_measure",
)
PO_IMPORT_PO_LEVEL_COLUMNS = (
    "vendor_code",
    "issue_date",
    "expected_delivery_date",
    "currency",
    "notes",
)


def _parse_date(raw: str, field: str) -> date:
    raw = (raw or "").strip()
    if not raw:
        raise ValueError(f"{field} is required")
    # Accept ISO YYYY-MM-DD; reject anything else so users get a clear
    # signal instead of mysterious silent reinterpretation.
    try:
        return datetime.strptime(raw, "%Y-%m-%d").date()
    except ValueError as exc:
        raise ValueError(f"{field} must be YYYY-MM-DD (got {raw!r})") from exc


def _parse_decimal(raw: str, field: str) -> float:
    raw = (raw or "").strip()
    if not raw:
        raise ValueError(f"{field} is required")
    try:
        return float(raw)
    except ValueError as exc:
        raise ValueError(f"{field} must be a number (got {raw!r})") from exc


def _parse_int(raw: str, field: str) -> int:
    raw = (raw or "").strip()
    if not raw:
        raise ValueError(f"{field} is required")
    try:
        return int(raw)
    except ValueError as exc:
        raise ValueError(f"{field} must be an integer (got {raw!r})") from exc

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
    # Check po_number uniqueness up-front so the user gets a friendly
    # 409 instead of an opaque 500 from a UNIQUE-constraint violation.
    existing_q = await db.execute(
        select(PurchaseOrder.id).where(PurchaseOrder.po_number == data.po_number)
    )
    if existing_q.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail=f"po_number {data.po_number!r} already exists",
        )

    # Vendor must exist (otherwise FK explodes on flush).
    vendor_q = await db.execute(
        select(Vendor.id).where(Vendor.id == data.vendor_id)
    )
    if not vendor_q.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Vendor not found")

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

    lines: list[POLineItem] = []
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
        lines.append(line)

    await db.flush()
    _embed_po_lines(lines)
    await db.flush()

    stmt = (
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.line_items))
        .where(PurchaseOrder.id == po.id)
    )
    result = await db.execute(stmt)
    return result.scalar_one()


@router.put("/purchase-orders/{po_id}", response_model=PurchaseOrderResponse)
async def update_purchase_order(
    po_id: uuid.UUID,
    data: PurchaseOrderUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a PO. Performs a smart upsert on line items keyed by
    `line_number` so existing rows referenced by `line_item_matches`
    are preserved when their content changes — only truly removed
    lines are deleted.
    """
    stmt = (
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.line_items))
        .where(PurchaseOrder.id == po_id)
    )
    result = await db.execute(stmt)
    po = result.scalar_one_or_none()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    # Uniqueness check if po_number is changing.
    if data.po_number is not None and data.po_number != po.po_number:
        existing_q = await db.execute(
            select(PurchaseOrder.id).where(
                PurchaseOrder.po_number == data.po_number,
                PurchaseOrder.id != po_id,
            )
        )
        if existing_q.scalar_one_or_none():
            raise HTTPException(
                status_code=409,
                detail=f"po_number {data.po_number!r} already exists",
            )
        po.po_number = data.po_number

    if data.vendor_id is not None and data.vendor_id != po.vendor_id:
        vendor_q = await db.execute(
            select(Vendor.id).where(Vendor.id == data.vendor_id)
        )
        if not vendor_q.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Vendor not found")
        po.vendor_id = data.vendor_id

    if data.issue_date is not None:
        po.issue_date = data.issue_date
    if data.expected_delivery_date is not None:
        po.expected_delivery_date = data.expected_delivery_date
    if data.status is not None:
        po.status = data.status.value
    if data.currency is not None:
        po.currency = data.currency
    if data.notes is not None:
        po.notes = data.notes

    if data.line_items is not None:
        # Smart upsert keyed by line_number, using ORM relationship
        # management so the in-memory `po.line_items` collection stays
        # in sync (which the response serializer reads from). Updating
        # in place preserves FK references from
        # `line_item_matches.po_line_item_id`.
        incoming_line_numbers = {it.line_number for it in data.line_items}
        if len(incoming_line_numbers) != len(data.line_items):
            raise HTTPException(
                status_code=400,
                detail="Duplicate line_number in payload",
            )

        existing_by_line = {li.line_number: li for li in po.line_items}
        lines_to_embed: list[POLineItem] = []

        for item in data.line_items:
            existing = existing_by_line.get(item.line_number)
            if existing is not None:
                desc_changed = (
                    (existing.item_description or "")
                    != (item.item_description or "")
                )
                existing.item_code = item.item_code
                existing.item_description = item.item_description
                existing.quantity = item.quantity
                existing.unit_price = item.unit_price
                existing.total_price = item.total_price
                existing.unit_of_measure = item.unit_of_measure
                if desc_changed:
                    lines_to_embed.append(existing)
            else:
                # Append via the relationship so the collection (and
                # the response payload) reflects it without a refetch.
                new_line = POLineItem(
                    line_number=item.line_number,
                    item_code=item.item_code,
                    item_description=item.item_description,
                    quantity=item.quantity,
                    unit_price=item.unit_price,
                    total_price=item.total_price,
                    unit_of_measure=item.unit_of_measure,
                )
                po.line_items.append(new_line)
                lines_to_embed.append(new_line)

        # Remove rows no longer in the payload via the relationship —
        # cascade="all, delete-orphan" turns each remove() into a DELETE.
        for existing in list(po.line_items):
            if existing.line_number not in incoming_line_numbers:
                po.line_items.remove(existing)

        # Recompute total from the merged payload.
        po.total_amount = round(
            sum(float(it.total_price) for it in data.line_items), 2
        )

        _embed_po_lines(lines_to_embed)

    await db.flush()

    refresh_stmt = (
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.line_items))
        .where(PurchaseOrder.id == po_id)
    )
    refreshed = await db.execute(refresh_stmt)
    return refreshed.scalar_one()


@router.delete("/purchase-orders/{po_id}", status_code=204)
async def delete_purchase_order(
    po_id: uuid.UUID,
    force: bool = Query(
        False,
        description="If true, also detaches any reconciliations referencing this PO",
    ),
    db: AsyncSession = Depends(get_db),
):
    """Delete a purchase order.

    By default refuses (409) if any `reconciliations` rows reference
    this PO so the user can decide explicitly. When `?force=true`,
    proceeds: reconciliation rows survive (FK is `ON DELETE SET NULL`)
    but lose their PO link, line items cascade away.
    """
    po_q = await db.execute(
        select(PurchaseOrder.id).where(PurchaseOrder.id == po_id)
    )
    if not po_q.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Purchase order not found")

    recon_count_q = await db.execute(
        select(func.count(Reconciliation.id)).where(
            Reconciliation.po_id == po_id
        )
    )
    recon_count = int(recon_count_q.scalar() or 0)

    if recon_count > 0 and not force:
        raise HTTPException(
            status_code=409,
            detail={
                "message": (
                    f"PO is referenced by {recon_count} reconciliation"
                    f"{'' if recon_count == 1 else 's'}. Pass ?force=true "
                    "to delete and detach them."
                ),
                "reconciliation_count": recon_count,
            },
        )

    await db.execute(
        sql_delete(PurchaseOrder).where(PurchaseOrder.id == po_id)
    )
    return None


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


@router.post("/purchase-orders/import", response_model=ImportResponse)
async def import_purchase_orders_csv(
    file: UploadFile = File(..., description="CSV with one row per line item"),
    db: AsyncSession = Depends(get_db),
):
    """Bulk-load purchase orders from a CSV file.

    One row per line item; rows sharing a `po_number` are grouped into
    a single PO. PO-level columns (vendor, issue date, currency, …)
    must be consistent within each group.

    Always returns 200 so the UI can render partial-success details:
    `{imported, skipped, errors}`. Only unparseable CSVs return 400.
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
    missing = [c for c in PO_IMPORT_REQUIRED_COLUMNS if c not in fieldnames_lower]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"CSV missing required columns: {', '.join(missing)}",
        )

    response = ImportResponse()

    # Group rows by po_number, preserving first-seen row number.
    groups: dict[str, dict] = {}  # po_number -> {first_row, rows: [(row_no, dict)]}
    for idx, row in enumerate(reader, start=2):  # header is row 1
        po_number = (row.get("po_number") or "").strip()
        if not po_number:
            response.errors.append(
                ImportRowResult(row=idx, reason="po_number is required")
            )
            continue
        slot = groups.setdefault(
            po_number, {"first_row": idx, "rows": []}
        )
        slot["rows"].append((idx, row))

    if not groups:
        return response

    # Pre-load vendors by code to avoid one query per PO.
    vendor_codes = {
        (rows[0][1].get("vendor_code") or "").strip()
        for _, rows in (
            (g["first_row"], g["rows"]) for g in groups.values()
        )
    }
    vendor_codes.discard("")
    vendors_by_code: dict[str, Vendor] = {}
    if vendor_codes:
        v_result = await db.execute(
            select(Vendor).where(Vendor.code.in_(vendor_codes))
        )
        for vendor in v_result.scalars():
            vendors_by_code[vendor.code] = vendor

    # Pre-load existing po_numbers to skip duplicates against DB.
    existing_q = await db.execute(
        select(PurchaseOrder.po_number).where(
            PurchaseOrder.po_number.in_(groups.keys())
        )
    )
    existing_po_numbers = {pn for pn in existing_q.scalars()}

    # Validate and build POs first; embed once for the whole file; then insert.
    prepared: list[tuple[PurchaseOrder, list[POLineItem], ImportRowResult]] = []

    for po_number, group in groups.items():
        first_row = group["first_row"]
        rows = group["rows"]
        result = ImportRowResult(row=first_row, identifier=po_number)

        if po_number in existing_po_numbers:
            result.reason = "po_number already exists"
            response.skipped.append(result)
            continue

        # Validate PO-level columns are consistent across rows.
        head = rows[0][1]
        po_level = {
            col: (head.get(col) or "").strip() for col in PO_IMPORT_PO_LEVEL_COLUMNS
        }
        inconsistent: list[str] = []
        for r_no, r in rows[1:]:
            for col in PO_IMPORT_PO_LEVEL_COLUMNS:
                if (r.get(col) or "").strip() != po_level[col]:
                    inconsistent.append(
                        f"row {r_no}: {col} differs from row {first_row}"
                    )
        if inconsistent:
            result.reason = "; ".join(inconsistent[:3]) + (
                " (…)" if len(inconsistent) > 3 else ""
            )
            response.errors.append(result)
            continue

        vendor_code = po_level["vendor_code"]
        if not vendor_code:
            result.reason = "vendor_code is required"
            response.errors.append(result)
            continue
        vendor = vendors_by_code.get(vendor_code)
        if not vendor:
            result.reason = f"vendor with code {vendor_code!r} not found"
            response.errors.append(result)
            continue

        # Parse dates.
        try:
            issue_date = _parse_date(po_level["issue_date"], "issue_date")
        except ValueError as exc:
            result.reason = str(exc)
            response.errors.append(result)
            continue
        expected_delivery: date | None = None
        if po_level["expected_delivery_date"]:
            try:
                expected_delivery = _parse_date(
                    po_level["expected_delivery_date"], "expected_delivery_date"
                )
            except ValueError as exc:
                result.reason = str(exc)
                response.errors.append(result)
                continue

        # Build line items.
        line_items: list[POLineItem] = []
        line_error: str | None = None
        seen_line_numbers: set[int] = set()
        for r_no, r in rows:
            try:
                line_number = _parse_int(r.get("line_number", ""), "line_number")
                if line_number in seen_line_numbers:
                    raise ValueError(
                        f"line_number {line_number} appears twice for {po_number}"
                    )
                seen_line_numbers.add(line_number)
                quantity = _parse_decimal(r.get("quantity", ""), "quantity")
                unit_price = _parse_decimal(r.get("unit_price", ""), "unit_price")
                description = (r.get("item_description") or "").strip()
                if not description:
                    raise ValueError("item_description is required")
            except ValueError as exc:
                line_error = f"row {r_no}: {exc}"
                break
            line_items.append(
                POLineItem(
                    line_number=line_number,
                    item_code=(r.get("item_code") or "").strip() or None,
                    item_description=description,
                    quantity=quantity,
                    unit_price=unit_price,
                    total_price=round(quantity * unit_price, 2),
                    unit_of_measure=(r.get("unit_of_measure") or "").strip()
                    or None,
                )
            )

        if line_error:
            result.reason = line_error
            response.errors.append(result)
            continue

        total_amount = round(sum(li.total_price for li in line_items), 2)
        currency = po_level["currency"] or "USD"
        notes = po_level["notes"] or None

        po = PurchaseOrder(
            po_number=po_number,
            vendor_id=vendor.id,
            issue_date=issue_date,
            expected_delivery_date=expected_delivery,
            status="issued",
            total_amount=total_amount,
            currency=currency,
            notes=notes,
        )
        prepared.append((po, line_items, result))

    all_lines = [li for _, lines, _ in prepared for li in lines]
    _embed_po_lines(all_lines)

    for po, line_items, result in prepared:
        db.add(po)
        await db.flush()
        for li in line_items:
            li.po_id = po.id
            db.add(li)

        try:
            await db.commit()
        except Exception as exc:  # pragma: no cover - defensive
            await db.rollback()
            result.reason = f"insert failed: {exc.__class__.__name__}"
            response.errors.append(result)
            continue

        result.id = po.id
        response.imported.append(result)

    return response


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
