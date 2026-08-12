import uuid
from datetime import date, datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field, field_validator


# ── Enums ──────────────────────────────────────────────────────────

class POStatus(str, Enum):
    DRAFT = "draft"
    ISSUED = "issued"
    FULFILLED = "fulfilled"
    CANCELLED = "cancelled"


class DeliveryStatus(str, Enum):
    RECEIVED = "received"
    PARTIAL = "partial"
    REJECTED = "rejected"


class ProcessingStatus(str, Enum):
    QUEUED = "queued"
    PARSING = "parsing"
    MATCHING = "matching"
    DETECTING = "detecting"  # anomaly agent running
    RESOLVING = "resolving"
    COMPLETED = "completed"
    FAILED = "failed"


class BusinessStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    PENDING_REVIEW = "pending_review"
    CANCELLED = "cancelled"


class MatchType(str, Enum):
    FULL_MATCH = "full_match"
    PARTIAL_MATCH = "partial_match"
    NO_MATCH = "no_match"


class ReconciliationStatus(str, Enum):
    AUTO_APPROVED = "auto_approved"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"


class LineMatchStatus(str, Enum):
    MATCHED = "matched"
    PARTIAL = "partial"
    MISMATCH = "mismatch"
    UNMATCHED = "unmatched"


class DiscrepancyType(str, Enum):
    DUPLICATE_INVOICE = "duplicate_invoice"
    PRICE_DEVIATION = "price_deviation"
    QUANTITY_MISMATCH = "quantity_mismatch"
    MISSING_PO = "missing_po"
    MISSING_RECEIPT = "missing_receipt"
    DATE_ANOMALY = "date_anomaly"
    AMOUNT_EXCEEDS_PO = "amount_exceeds_po"
    UNAUTHORIZED_VENDOR = "unauthorized_vendor"


class Severity(str, Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


class ReviewDecision(str, Enum):
    APPROVED = "approved"
    REJECTED = "rejected"


# ── Vendor ─────────────────────────────────────────────────────────

class VendorBase(BaseModel):
    name: str
    code: str
    tax_id: str | None = None
    address: str | None = None
    contact_email: str | None = None


class VendorCreate(VendorBase):
    pass


class VendorUpdate(BaseModel):
    """All fields optional for PATCH-style partial updates."""
    name: str | None = None
    code: str | None = None
    tax_id: str | None = None
    address: str | None = None
    contact_email: str | None = None


class VendorResponse(VendorBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Line Items (shared) ───────────────────────────────────────────

class LineItemBase(BaseModel):
    line_number: int
    item_code: str | None = None
    item_description: str
    quantity: float
    unit_price: float
    total_price: float
    unit_of_measure: str | None = None


class POLineItemCreate(LineItemBase):
    pass


class POLineItemResponse(LineItemBase):
    id: uuid.UUID

    model_config = {"from_attributes": True}


class InvoiceLineItemResponse(LineItemBase):
    id: uuid.UUID

    model_config = {"from_attributes": True}


# ── Purchase Order ─────────────────────────────────────────────────

class PurchaseOrderBase(BaseModel):
    po_number: str
    vendor_id: uuid.UUID
    issue_date: date
    expected_delivery_date: date | None = None
    status: POStatus = POStatus.ISSUED
    total_amount: float
    currency: str = "USD"
    notes: str | None = None


class PurchaseOrderCreate(PurchaseOrderBase):
    line_items: list[POLineItemCreate]


class PurchaseOrderUpdate(BaseModel):
    """All fields optional for PATCH-style partial updates.

    When `line_items` is provided, the route does a smart upsert keyed
    by `line_number` so existing rows referenced by FK
    (`line_item_matches.po_line_item_id`) survive when their content
    changes — only truly removed lines are deleted.
    """
    po_number: str | None = None
    vendor_id: uuid.UUID | None = None
    issue_date: date | None = None
    expected_delivery_date: date | None = None
    status: POStatus | None = None
    currency: str | None = None
    notes: str | None = None
    line_items: list[POLineItemCreate] | None = None


class PurchaseOrderResponse(PurchaseOrderBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    line_items: list[POLineItemResponse] = []

    model_config = {"from_attributes": True}


class PurchaseOrderListResponse(BaseModel):
    id: uuid.UUID
    po_number: str
    vendor_id: uuid.UUID
    issue_date: date
    status: str
    total_amount: float
    currency: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MatchedInvoiceForPO(BaseModel):
    """Compact view of an invoice that has reconciled against a PO.

    Used by the PO detail sheet's 'Matched Invoices' tab so the user can
    see which invoices in their pipeline were matched to this PO and
    jump into any of them.
    """
    invoice_id: uuid.UUID
    invoice_number: str | None
    business_status: str
    total_amount: float | None
    reconciliation_id: uuid.UUID
    match_type: str
    overall_status: str
    discrepancies_count: int


# ── CSV Import ─────────────────────────────────────────────────────

class ImportRowResult(BaseModel):
    """One row's outcome from a CSV import.

    `row` is the 1-indexed line number in the original CSV (header is
    row 1, so the first data row is row 2). For the PO importer where
    multiple CSV rows produce one PO, `row` points to the *first* line
    of the group. `identifier` is whatever natural key the user can
    find in their CSV (po_number, vendor code, …).
    """
    row: int
    identifier: str | None = None
    reason: str | None = None
    id: uuid.UUID | None = None


class ImportResponse(BaseModel):
    """Partial-success result for a CSV import.

    `imported` are the rows we created, `skipped` are non-fatal cases
    (already exists, duplicate within the file), and `errors` are
    actual failures that need user attention. The endpoint returns
    HTTP 200 even with non-empty errors so the UI can surface details
    without a network-level failure.
    """
    imported: list[ImportRowResult] = []
    skipped: list[ImportRowResult] = []
    errors: list[ImportRowResult] = []


# ── Delivery Receipt ──────────────────────────────────────────────

class DeliveryLineItemCreate(BaseModel):
    po_line_item_id: uuid.UUID | None = None
    item_description: str
    quantity_received: float
    quantity_accepted: float
    quantity_rejected: float = 0


class DeliveryLineItemResponse(DeliveryLineItemCreate):
    id: uuid.UUID

    model_config = {"from_attributes": True}


class DeliveryReceiptBase(BaseModel):
    receipt_number: str
    po_id: uuid.UUID
    received_date: date
    receiver_name: str | None = None
    status: DeliveryStatus = DeliveryStatus.RECEIVED
    notes: str | None = None


class DeliveryReceiptCreate(DeliveryReceiptBase):
    line_items: list[DeliveryLineItemCreate]


class DeliveryReceiptResponse(DeliveryReceiptBase):
    id: uuid.UUID
    created_at: datetime
    line_items: list[DeliveryLineItemResponse] = []

    model_config = {"from_attributes": True}


# ── Invoice ────────────────────────────────────────────────────────

class InvoiceUploadResponse(BaseModel):
    id: uuid.UUID
    processing_status: str
    business_status: str
    raw_file_path: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class InvoiceResponse(BaseModel):
    id: uuid.UUID
    invoice_number: str | None
    po_reference: str | None
    vendor_id: uuid.UUID | None
    invoice_date: date | None
    due_date: date | None
    total_amount: float | None
    tax_amount: float | None
    currency: str
    processing_status: str
    business_status: str
    raw_file_path: str | None
    file_content_type: str | None
    parsed_data: dict | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime
    line_items: list[InvoiceLineItemResponse] = []

    model_config = {"from_attributes": True}


class InvoiceListResponse(BaseModel):
    id: uuid.UUID
    invoice_number: str | None
    vendor_id: uuid.UUID | None
    total_amount: float | None
    processing_status: str
    business_status: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Reconciliation ────────────────────────────────────────────────

class LineItemMatchResponse(BaseModel):
    id: uuid.UUID
    invoice_line_item_id: uuid.UUID
    po_line_item_id: uuid.UUID | None
    delivery_line_item_id: uuid.UUID | None
    status: str
    description_similarity: float | None
    quantity_invoiced: float | None
    quantity_ordered: float | None
    quantity_delivered: float | None
    price_invoiced: float | None
    price_ordered: float | None
    price_deviation_pct: float | None

    model_config = {"from_attributes": True}


class DiscrepancyResponse(BaseModel):
    id: uuid.UUID
    reconciliation_id: uuid.UUID
    line_item_match_id: uuid.UUID | None
    type: str
    severity: str
    description: str
    expected_value: str | None
    actual_value: str | None
    deviation_pct: float | None
    created_at: datetime

    model_config = {"from_attributes": True}


class HumanReviewResponse(BaseModel):
    id: uuid.UUID
    reconciliation_id: uuid.UUID
    decision: str
    reviewer_notes: str | None
    decided_by: str | None
    decided_at: datetime

    model_config = {"from_attributes": True}


class ReconciliationResponse(BaseModel):
    id: uuid.UUID
    invoice_id: uuid.UUID
    po_id: uuid.UUID | None
    match_type: str
    overall_status: str
    confidence_score: float | None
    agent_recommendation: str | None
    recommendation_reasoning: str | None
    trace_id: str | None
    processing_time_ms: int | None
    created_at: datetime
    updated_at: datetime
    line_item_matches: list[LineItemMatchResponse] = []
    discrepancies: list[DiscrepancyResponse] = []
    human_reviews: list[HumanReviewResponse] = []

    model_config = {"from_attributes": True}


# ── Human Review Request ──────────────────────────────────────────

class ReviewRequest(BaseModel):
    """Body for /exceptions/{id}/approve and /exceptions/{id}/reject.

    `decided_by` is required so every human review has a real
    accountable reviewer recorded for audit.
    """
    reviewer_notes: str | None = None
    decided_by: str = Field(min_length=1)

    @field_validator("decided_by")
    @classmethod
    def _strip_decided_by(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("decided_by must not be empty")
        return v


class OverrideRequest(BaseModel):
    """Body for /exceptions/{id}/override -- used to flip a previously
    auto-approved reconciliation to approved or rejected with a
    mandatory human reason.
    """
    decision: Literal["approved", "rejected"]
    reviewer_notes: str = Field(min_length=1)
    decided_by: str = Field(min_length=1)

    @field_validator("reviewer_notes", "decided_by")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be empty")
        return v


# ── Dashboard ─────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_invoices: int
    by_processing_status: dict[str, int]
    by_business_status: dict[str, int]
    total_reconciliations: int
    match_rate: dict[str, int]
    avg_processing_time_ms: float | None
    # Top-10 discrepancy types by count (capped for chart rendering).
    top_discrepancy_types: dict[str, int]
    # Sum across ALL discrepancy rows in the system, not just the top
    # 10 surfaced above. Use this when displaying a "total discrepancies"
    # number to the user, so the count doesn't silently undercount when
    # there are more than 10 distinct types.
    total_discrepancies: int


# ── Health ────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    postgres: str
    redis: str
    ollama: str


# ── Auth ──────────────────────────────────────────────────────────

class AuthMeResponse(BaseModel):
    id: uuid.UUID
    kind: str
    email: str | None = None
    display_name: str | None = None
    daily_invoice_limit: int
    max_upload_mb: int
    max_pdf_pages: int
    last_seen_at: datetime | None = None
    created_at: datetime | None = None
    scheduled_deletion_at: datetime | None = None


class GuestAuthResponse(BaseModel):
    guest_token: str
    user: AuthMeResponse
