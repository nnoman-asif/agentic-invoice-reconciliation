import uuid
from datetime import date, datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import case, delete as sql_delete
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import OwnerContext, get_current_owner, require_owned_write
from app.db.session import get_db
from app.models.database import (
    DeliveryLineItem,
    DeliveryReceipt,
    LineItemMatch,
    POLineItem,
    PurchaseOrder,
)
from app.models.schemas import (
    DeliveryLineItemCreate,
    DeliveryReceiptCreate,
    DeliveryReceiptResponse,
    DeliveryReceiptUpdate,
    ImportResponse,
    ImportRowResult,
)
from app.tools.db_queries import scope_to_owner
from app.tools.tabular import TabularError, read_tabular

router = APIRouter()

RECEIPT_IMPORT_REQUIRED_COLUMNS = (
    "receipt_number",
    "po_number",
    "received_date",
    "item_description",
    "quantity_received",
    "quantity_accepted",
)
RECEIPT_IMPORT_RECEIPT_LEVEL_COLUMNS = (
    "po_number",
    "received_date",
    "receiver_name",
    "status",
    "notes",
)
RECEIPT_IMPORT_STATUSES = {"received", "partial", "rejected"}


def _parse_date(raw: str, field: str) -> date:
    raw = (raw or "").strip()
    if not raw:
        raise ValueError(f"{field} is required")
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


def _norm_desc(value: str) -> str:
    return (value or "").strip().lower()


def _line_upsert_key(
    po_line_item_id: uuid.UUID | None, item_description: str
) -> tuple[str, str]:
    if po_line_item_id is not None:
        return ("po", str(po_line_item_id))
    return ("desc", _norm_desc(item_description))


async def _po_line_ids(db: AsyncSession, po_id: uuid.UUID) -> set[uuid.UUID]:
    result = await db.execute(
        select(POLineItem.id).where(POLineItem.po_id == po_id)
    )
    return set(result.scalars())


async def _visible_po(
    db: AsyncSession, po_id: uuid.UUID, owner_id: uuid.UUID
) -> PurchaseOrder | None:
    stmt = select(PurchaseOrder).where(PurchaseOrder.id == po_id)
    stmt = scope_to_owner(stmt, PurchaseOrder, owner_id, include_system=True)
    return (await db.execute(stmt)).scalar_one_or_none()


def _upsert_delivery_lines(
    receipt: DeliveryReceipt,
    items: list[DeliveryLineItemCreate],
    valid_po_line_ids: set[uuid.UUID],
) -> None:
    """Smart upsert keyed by po_line_item_id, else normalised description."""
    incoming_keys: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for item in items:
        if (
            item.po_line_item_id is not None
            and item.po_line_item_id not in valid_po_line_ids
        ):
            raise HTTPException(
                status_code=400,
                detail="po_line_item_id does not belong to this purchase order",
            )
        key = _line_upsert_key(item.po_line_item_id, item.item_description)
        if key in seen:
            raise HTTPException(
                status_code=400,
                detail="Duplicate line item key in payload",
            )
        seen.add(key)
        incoming_keys.append(key)

    existing_by_key = {
        _line_upsert_key(li.po_line_item_id, li.item_description): li
        for li in receipt.line_items
    }

    for item, key in zip(items, incoming_keys):
        existing = existing_by_key.get(key)
        if existing is not None:
            existing.po_line_item_id = item.po_line_item_id
            existing.item_description = item.item_description
            existing.quantity_received = item.quantity_received
            existing.quantity_accepted = item.quantity_accepted
            existing.quantity_rejected = item.quantity_rejected
        else:
            receipt.line_items.append(
                DeliveryLineItem(
                    po_line_item_id=item.po_line_item_id,
                    item_description=item.item_description,
                    quantity_received=item.quantity_received,
                    quantity_accepted=item.quantity_accepted,
                    quantity_rejected=item.quantity_rejected,
                )
            )

    incoming_set = set(incoming_keys)
    for existing in list(receipt.line_items):
        if (
            _line_upsert_key(existing.po_line_item_id, existing.item_description)
            not in incoming_set
        ):
            receipt.line_items.remove(existing)


@router.get("/delivery-receipts", response_model=list[DeliveryReceiptResponse])
async def list_delivery_receipts(
    po_id: uuid.UUID | None = Query(
        None, description="Filter to receipts for a specific purchase order"
    ),
    db: AsyncSession = Depends(get_db),
    owner: OwnerContext = Depends(get_current_owner),
):
    stmt = (
        select(DeliveryReceipt)
        .options(selectinload(DeliveryReceipt.line_items))
        .order_by(DeliveryReceipt.created_at.desc())
    )
    stmt = scope_to_owner(
        stmt, DeliveryReceipt, owner.user_id, include_system=True
    )
    if po_id is not None:
        stmt = stmt.where(DeliveryReceipt.po_id == po_id)
    result = await db.execute(stmt)
    return result.scalars().unique().all()


@router.post("/delivery-receipts", response_model=DeliveryReceiptResponse, status_code=201)
async def create_delivery_receipt(
    data: DeliveryReceiptCreate,
    db: AsyncSession = Depends(get_db),
    owner: OwnerContext = Depends(get_current_owner),
):
    # PO must be visible (own or system) so receipts can attach to demo POs.
    po = await _visible_po(db, data.po_id, owner.user_id)
    if not po:
        raise HTTPException(status_code=400, detail="Purchase order not found")

    existing_q = await db.execute(
        select(DeliveryReceipt.id).where(
            DeliveryReceipt.owner_id == owner.user_id,
            DeliveryReceipt.receipt_number == data.receipt_number,
        )
    )
    if existing_q.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail=f"receipt_number {data.receipt_number!r} already exists",
        )

    valid_po_line_ids = await _po_line_ids(db, data.po_id)
    for item in data.line_items:
        if (
            item.po_line_item_id is not None
            and item.po_line_item_id not in valid_po_line_ids
        ):
            raise HTTPException(
                status_code=400,
                detail="po_line_item_id does not belong to this purchase order",
            )

    receipt = DeliveryReceipt(
        owner_id=owner.user_id,
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
        db.add(
            DeliveryLineItem(
                receipt_id=receipt.id,
                po_line_item_id=item.po_line_item_id,
                item_description=item.item_description,
                quantity_received=item.quantity_received,
                quantity_accepted=item.quantity_accepted,
                quantity_rejected=item.quantity_rejected,
            )
        )

    await db.flush()

    stmt = (
        select(DeliveryReceipt)
        .options(selectinload(DeliveryReceipt.line_items))
        .where(DeliveryReceipt.id == receipt.id)
    )
    result = await db.execute(stmt)
    return result.scalar_one()


@router.post("/delivery-receipts/import", response_model=ImportResponse)
async def import_delivery_receipts(
    file: UploadFile = File(..., description="CSV or XLSX with one row per line item"),
    db: AsyncSession = Depends(get_db),
    owner: OwnerContext = Depends(get_current_owner),
):
    """Bulk-load delivery receipts from a CSV or Excel file.

    One row per line item; rows sharing a `receipt_number` are grouped
    into a single receipt. Receipt-level columns must be consistent
    within each group.

    Always returns 200 so the UI can render partial-success details.
    Only unparseable files return 400.
    """
    raw = await file.read()
    try:
        fieldnames, rows = read_tabular(file.filename, raw)
    except TabularError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    fieldnames_lower = set(fieldnames)
    missing = [
        c for c in RECEIPT_IMPORT_REQUIRED_COLUMNS if c not in fieldnames_lower
    ]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"File missing required columns: {', '.join(missing)}",
        )

    response = ImportResponse()

    groups: dict[str, dict] = {}
    for idx, row in rows:
        receipt_number = (row.get("receipt_number") or "").strip()
        if not receipt_number:
            response.errors.append(
                ImportRowResult(row=idx, reason="receipt_number is required")
            )
            continue
        slot = groups.setdefault(receipt_number, {"first_row": idx, "rows": []})
        slot["rows"].append((idx, row))

    if not groups:
        return response

    po_numbers = {
        (group["rows"][0][1].get("po_number") or "").strip()
        for group in groups.values()
    }
    po_numbers.discard("")
    pos_by_number: dict[str, PurchaseOrder] = {}
    if po_numbers:
        po_stmt = (
            select(PurchaseOrder)
            .options(selectinload(PurchaseOrder.line_items))
            .where(PurchaseOrder.po_number.in_(po_numbers))
        )
        po_stmt = scope_to_owner(
            po_stmt, PurchaseOrder, owner.user_id, include_system=True
        )
        po_stmt = po_stmt.order_by(
            case((PurchaseOrder.owner_id == owner.user_id, 0), else_=1)
        )
        po_result = await db.execute(po_stmt)
        for po in po_result.scalars().unique():
            if po.po_number not in pos_by_number:
                pos_by_number[po.po_number] = po

    existing_q = await db.execute(
        select(DeliveryReceipt.receipt_number).where(
            DeliveryReceipt.owner_id == owner.user_id,
            DeliveryReceipt.receipt_number.in_(groups.keys()),
        )
    )
    existing_numbers = {n for n in existing_q.scalars()}

    for receipt_number, group in groups.items():
        first_row = group["first_row"]
        group_rows = group["rows"]
        result = ImportRowResult(row=first_row, identifier=receipt_number)

        if receipt_number in existing_numbers:
            result.reason = "receipt_number already exists"
            response.skipped.append(result)
            continue

        head = group_rows[0][1]
        receipt_level = {
            col: (head.get(col) or "").strip()
            for col in RECEIPT_IMPORT_RECEIPT_LEVEL_COLUMNS
        }
        inconsistent: list[str] = []
        for r_no, r in group_rows[1:]:
            for col in RECEIPT_IMPORT_RECEIPT_LEVEL_COLUMNS:
                if (r.get(col) or "").strip() != receipt_level[col]:
                    inconsistent.append(
                        f"row {r_no}: {col} differs from row {first_row}"
                    )
        if inconsistent:
            result.reason = "; ".join(inconsistent[:3]) + (
                " (…)" if len(inconsistent) > 3 else ""
            )
            response.errors.append(result)
            continue

        po_number = receipt_level["po_number"]
        if not po_number:
            result.reason = "po_number is required"
            response.errors.append(result)
            continue
        po = pos_by_number.get(po_number)
        if not po:
            result.reason = f"purchase order {po_number!r} not found"
            response.errors.append(result)
            continue

        try:
            received_date = _parse_date(
                receipt_level["received_date"], "received_date"
            )
        except ValueError as exc:
            result.reason = str(exc)
            response.errors.append(result)
            continue

        status = (receipt_level["status"] or "received").lower()
        if status not in RECEIPT_IMPORT_STATUSES:
            result.reason = (
                f"status must be one of {sorted(RECEIPT_IMPORT_STATUSES)} "
                f"(got {status!r})"
            )
            response.errors.append(result)
            continue

        po_lines_by_number = {li.line_number: li for li in po.line_items}
        line_items: list[DeliveryLineItem] = []
        line_error: str | None = None
        seen_keys: set[tuple[str, str]] = set()
        for r_no, r in group_rows:
            try:
                description = (r.get("item_description") or "").strip()
                if not description:
                    raise ValueError("item_description is required")
                qty_received = _parse_decimal(
                    r.get("quantity_received", ""), "quantity_received"
                )
                qty_accepted = _parse_decimal(
                    r.get("quantity_accepted", ""), "quantity_accepted"
                )
                rejected_raw = (r.get("quantity_rejected") or "").strip()
                qty_rejected = (
                    _parse_decimal(rejected_raw, "quantity_rejected")
                    if rejected_raw
                    else round(qty_received - qty_accepted, 3)
                )
                if qty_received < 0 or qty_accepted < 0 or qty_rejected < 0:
                    raise ValueError("quantities must be >= 0")
                if round(qty_received - qty_accepted - qty_rejected, 3) != 0:
                    raise ValueError(
                        "quantity_received must equal "
                        "quantity_accepted + quantity_rejected"
                    )

                po_line_item_id = None
                po_line_raw = (r.get("po_line_number") or "").strip()
                if po_line_raw:
                    po_line_number = _parse_int(po_line_raw, "po_line_number")
                    po_line = po_lines_by_number.get(po_line_number)
                    if po_line is None:
                        raise ValueError(
                            f"PO {po_number} has no line_number {po_line_number}"
                        )
                    po_line_item_id = po_line.id

                key = _line_upsert_key(po_line_item_id, description)
                if key in seen_keys:
                    raise ValueError("duplicate line item within this receipt")
                seen_keys.add(key)
            except ValueError as exc:
                line_error = f"row {r_no}: {exc}"
                break
            line_items.append(
                DeliveryLineItem(
                    po_line_item_id=po_line_item_id,
                    item_description=description,
                    quantity_received=qty_received,
                    quantity_accepted=qty_accepted,
                    quantity_rejected=qty_rejected,
                )
            )

        if line_error:
            result.reason = line_error
            response.errors.append(result)
            continue

        receipt = DeliveryReceipt(
            owner_id=owner.user_id,
            receipt_number=receipt_number,
            po_id=po.id,
            received_date=received_date,
            receiver_name=receipt_level["receiver_name"] or None,
            status=status,
            notes=receipt_level["notes"] or None,
        )
        db.add(receipt)
        await db.flush()
        for li in line_items:
            li.receipt_id = receipt.id
            db.add(li)

        try:
            await db.commit()
        except Exception as exc:  # pragma: no cover - defensive
            await db.rollback()
            result.reason = f"insert failed: {exc.__class__.__name__}"
            response.errors.append(result)
            continue

        result.id = receipt.id
        response.imported.append(result)

    return response


@router.get("/delivery-receipts/{receipt_id}", response_model=DeliveryReceiptResponse)
async def get_delivery_receipt(
    receipt_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    owner: OwnerContext = Depends(get_current_owner),
):
    stmt = (
        select(DeliveryReceipt)
        .options(selectinload(DeliveryReceipt.line_items))
        .where(DeliveryReceipt.id == receipt_id)
    )
    stmt = scope_to_owner(
        stmt, DeliveryReceipt, owner.user_id, include_system=True
    )
    result = await db.execute(stmt)
    receipt = result.scalar_one_or_none()
    if not receipt:
        raise HTTPException(status_code=404, detail="Delivery receipt not found")
    return receipt


@router.put("/delivery-receipts/{receipt_id}", response_model=DeliveryReceiptResponse)
async def update_delivery_receipt(
    receipt_id: uuid.UUID,
    data: DeliveryReceiptUpdate,
    db: AsyncSession = Depends(get_db),
    owner: OwnerContext = Depends(get_current_owner),
):
    """Update a receipt. Line items upsert by `po_line_item_id` when
    set, otherwise by normalised `item_description`, so
    `line_item_matches` FKs survive edits.
    """
    stmt = (
        select(DeliveryReceipt)
        .options(selectinload(DeliveryReceipt.line_items))
        .where(DeliveryReceipt.id == receipt_id)
    )
    result = await db.execute(stmt)
    receipt = result.scalar_one_or_none()
    require_owned_write(
        receipt, owner.user_id, not_found="Delivery receipt not found"
    )

    if (
        data.receipt_number is not None
        and data.receipt_number != receipt.receipt_number
    ):
        existing_q = await db.execute(
            select(DeliveryReceipt.id).where(
                DeliveryReceipt.owner_id == owner.user_id,
                DeliveryReceipt.receipt_number == data.receipt_number,
                DeliveryReceipt.id != receipt_id,
            )
        )
        if existing_q.scalar_one_or_none():
            raise HTTPException(
                status_code=409,
                detail=f"receipt_number {data.receipt_number!r} already exists",
            )
        receipt.receipt_number = data.receipt_number

    if data.po_id is not None and data.po_id != receipt.po_id:
        po = await _visible_po(db, data.po_id, owner.user_id)
        if not po:
            raise HTTPException(status_code=400, detail="Purchase order not found")
        receipt.po_id = data.po_id

    if data.received_date is not None:
        receipt.received_date = data.received_date
    if data.receiver_name is not None:
        receipt.receiver_name = data.receiver_name
    if data.status is not None:
        receipt.status = data.status.value
    if data.notes is not None:
        receipt.notes = data.notes

    if data.line_items is not None:
        valid_po_line_ids = await _po_line_ids(db, receipt.po_id)
        _upsert_delivery_lines(receipt, data.line_items, valid_po_line_ids)
    elif data.po_id is not None:
        valid_po_line_ids = await _po_line_ids(db, receipt.po_id)
        for li in receipt.line_items:
            if (
                li.po_line_item_id is not None
                and li.po_line_item_id not in valid_po_line_ids
            ):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Existing line items reference a different PO. "
                        "Send line_items when changing po_id."
                    ),
                )

    await db.flush()

    refresh_stmt = (
        select(DeliveryReceipt)
        .options(selectinload(DeliveryReceipt.line_items))
        .where(DeliveryReceipt.id == receipt_id)
    )
    refreshed = await db.execute(refresh_stmt)
    return refreshed.scalar_one()


@router.delete("/delivery-receipts/{receipt_id}", status_code=204)
async def delete_delivery_receipt(
    receipt_id: uuid.UUID,
    force: bool = Query(
        False,
        description="If true, detach line-item matches that reference this receipt",
    ),
    db: AsyncSession = Depends(get_db),
    owner: OwnerContext = Depends(get_current_owner),
):
    """Delete a delivery receipt.

    Refuses (409) when `line_item_matches` still point at this
    receipt's lines, unless `?force=true`. Matches survive (FK is
    `ON DELETE SET NULL`) but lose their delivery link.
    """
    receipt = await db.get(DeliveryReceipt, receipt_id)
    require_owned_write(
        receipt, owner.user_id, not_found="Delivery receipt not found"
    )

    match_count_q = await db.execute(
        select(func.count(LineItemMatch.id)).where(
            LineItemMatch.delivery_line_item_id.in_(
                select(DeliveryLineItem.id).where(
                    DeliveryLineItem.receipt_id == receipt_id
                )
            )
        )
    )
    match_count = int(match_count_q.scalar() or 0)

    if match_count > 0 and not force:
        raise HTTPException(
            status_code=409,
            detail={
                "message": (
                    f"Receipt is referenced by {match_count} line-item match"
                    f"{'' if match_count == 1 else 'es'}. Pass ?force=true "
                    "to delete and detach them."
                ),
                "match_count": match_count,
            },
        )

    await db.execute(
        sql_delete(DeliveryReceipt).where(
            DeliveryReceipt.id == receipt_id,
            DeliveryReceipt.owner_id == owner.user_id,
        )
    )
    return None
