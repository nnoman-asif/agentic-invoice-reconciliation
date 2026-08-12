import uuid
from datetime import date, datetime, timezone

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    DECIMAL,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def _utc_now() -> datetime:
    """Return current UTC time as a timezone-aware datetime.

    Using a TZ-aware value (vs. the naive `datetime.utcnow`) so asyncpg
    sends the correct instant to PostgreSQL's TIMESTAMPTZ columns,
    independent of the host machine's local timezone.
    """
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    kind: Mapped[str] = mapped_column(String(10), nullable=False)  # user | guest | system
    firebase_uid: Mapped[str | None] = mapped_column(String(128), unique=True)
    email: Mapped[str | None] = mapped_column(String(255))
    display_name: Mapped[str | None] = mapped_column(String(255))
    daily_invoice_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    max_upload_mb: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    max_pdf_pages: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utc_now)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now, onupdate=_utc_now)

    vendors: Mapped[list["Vendor"]] = relationship(
        back_populates="owner",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    purchase_orders: Mapped[list["PurchaseOrder"]] = relationship(
        back_populates="owner",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    delivery_receipts: Mapped[list["DeliveryReceipt"]] = relationship(
        back_populates="owner",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    invoices: Mapped[list["Invoice"]] = relationship(
        back_populates="owner",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    quota_requests: Mapped[list["QuotaRequest"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        CheckConstraint("kind IN ('user', 'guest', 'system')", name="chk_users_kind"),
        Index("idx_users_kind", "kind"),
        Index("idx_users_last_seen", "last_seen_at"),
    )


class Vendor(Base):
    __tablename__ = "vendors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    tax_id: Mapped[str | None] = mapped_column(String(50))
    address: Mapped[str | None] = mapped_column(Text)
    contact_email: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now, onupdate=_utc_now)

    owner: Mapped["User"] = relationship(back_populates="vendors")
    purchase_orders: Mapped[list["PurchaseOrder"]] = relationship(back_populates="vendor")
    invoices: Mapped[list["Invoice"]] = relationship(back_populates="vendor")

    __table_args__ = (
        UniqueConstraint("owner_id", "code", name="uq_vendors_owner_code"),
        UniqueConstraint("owner_id", "tax_id", name="uq_vendors_owner_tax_id"),
        Index("idx_vendors_owner_id", "owner_id"),
        Index("idx_vendors_name", "name"),
    )


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    po_number: Mapped[str] = mapped_column(String(50), nullable=False)
    vendor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("vendors.id", ondelete="RESTRICT"), nullable=False)
    issue_date: Mapped[date] = mapped_column(nullable=False)
    expected_delivery_date: Mapped[date | None] = mapped_column()
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    total_amount: Mapped[float] = mapped_column(DECIMAL(15, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now, onupdate=_utc_now)

    owner: Mapped["User"] = relationship(back_populates="purchase_orders")
    vendor: Mapped["Vendor"] = relationship(back_populates="purchase_orders")
    line_items: Mapped[list["POLineItem"]] = relationship(back_populates="purchase_order", cascade="all, delete-orphan")
    delivery_receipts: Mapped[list["DeliveryReceipt"]] = relationship(back_populates="purchase_order", cascade="all, delete-orphan")
    reconciliations: Mapped[list["Reconciliation"]] = relationship(back_populates="purchase_order")

    __table_args__ = (
        UniqueConstraint("owner_id", "po_number", name="uq_po_owner_number"),
        Index("idx_po_owner_id", "owner_id"),
        Index("idx_po_vendor_id", "vendor_id"),
        Index("idx_po_status", "status"),
    )


class POLineItem(Base):
    __tablename__ = "po_line_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    po_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False)
    line_number: Mapped[int] = mapped_column(Integer, nullable=False)
    item_code: Mapped[str | None] = mapped_column(String(100))
    item_description: Mapped[str] = mapped_column(String(500), nullable=False)
    quantity: Mapped[float] = mapped_column(DECIMAL(12, 3), nullable=False)
    unit_price: Mapped[float] = mapped_column(DECIMAL(15, 2), nullable=False)
    total_price: Mapped[float] = mapped_column(DECIMAL(15, 2), nullable=False)
    unit_of_measure: Mapped[str | None] = mapped_column(String(20))
    # Unconstrained vector so local Ollama (1024) and Gemini (1536) can
    # coexist. embedding_model + embedding_dim stamp the producer; a
    # mismatch is treated as a cache miss. No HNSW index (by design).
    description_embedding: Mapped[list[float] | None] = mapped_column(Vector(), nullable=True)
    embedding_model: Mapped[str | None] = mapped_column(String(100))
    embedding_dim: Mapped[int | None] = mapped_column(Integer)

    purchase_order: Mapped["PurchaseOrder"] = relationship(back_populates="line_items")

    __table_args__ = (
        UniqueConstraint("po_id", "line_number", name="uq_po_line"),
        Index("idx_poli_po_id", "po_id"),
    )


class DeliveryReceipt(Base):
    __tablename__ = "delivery_receipts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    receipt_number: Mapped[str] = mapped_column(String(50), nullable=False)
    po_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False)
    received_date: Mapped[date] = mapped_column(nullable=False)
    receiver_name: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="received")
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)

    owner: Mapped["User"] = relationship(back_populates="delivery_receipts")
    purchase_order: Mapped["PurchaseOrder"] = relationship(back_populates="delivery_receipts")
    line_items: Mapped[list["DeliveryLineItem"]] = relationship(back_populates="delivery_receipt", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("owner_id", "receipt_number", name="uq_dr_owner_receipt"),
        Index("idx_dr_owner_id", "owner_id"),
        Index("idx_dr_po_id", "po_id"),
    )


class DeliveryLineItem(Base):
    __tablename__ = "delivery_line_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    receipt_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("delivery_receipts.id", ondelete="CASCADE"), nullable=False)
    po_line_item_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("po_line_items.id", ondelete="SET NULL"))
    item_description: Mapped[str] = mapped_column(String(500), nullable=False)
    quantity_received: Mapped[float] = mapped_column(DECIMAL(12, 3), nullable=False)
    quantity_accepted: Mapped[float] = mapped_column(DECIMAL(12, 3), nullable=False)
    quantity_rejected: Mapped[float] = mapped_column(DECIMAL(12, 3), nullable=False, default=0)

    delivery_receipt: Mapped["DeliveryReceipt"] = relationship(back_populates="line_items")

    __table_args__ = (
        CheckConstraint("quantity_received = quantity_accepted + quantity_rejected", name="chk_dli_qty"),
        Index("idx_dli_receipt_id", "receipt_id"),
        Index("idx_dli_po_line_item", "po_line_item_id"),
    )


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    invoice_number: Mapped[str | None] = mapped_column(String(100))
    po_reference: Mapped[str | None] = mapped_column(String(100))
    vendor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("vendors.id", ondelete="RESTRICT"))
    invoice_date: Mapped[date | None] = mapped_column()
    due_date: Mapped[date | None] = mapped_column()
    total_amount: Mapped[float | None] = mapped_column(DECIMAL(15, 2))
    tax_amount: Mapped[float | None] = mapped_column(DECIMAL(15, 2))
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    processing_status: Mapped[str] = mapped_column(String(20), nullable=False, default="queued")
    business_status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    raw_file_path: Mapped[str | None] = mapped_column(String(500))
    file_content_type: Mapped[str | None] = mapped_column(String(50))
    file_hash: Mapped[str | None] = mapped_column(String(64))
    raw_text: Mapped[str | None] = mapped_column(Text)
    file_deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    parsed_data: Mapped[dict | None] = mapped_column(JSONB)
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now, onupdate=_utc_now)

    owner: Mapped["User"] = relationship(back_populates="invoices")
    vendor: Mapped["Vendor | None"] = relationship(back_populates="invoices")
    line_items: Mapped[list["InvoiceLineItem"]] = relationship(back_populates="invoice", cascade="all, delete-orphan")
    reconciliations: Mapped[list["Reconciliation"]] = relationship(back_populates="invoice", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("owner_id", "invoice_number", name="uq_inv_owner_number"),
        UniqueConstraint("owner_id", "file_hash", name="uq_inv_owner_file_hash"),
        Index("idx_inv_owner_id", "owner_id"),
        Index("idx_inv_vendor_id", "vendor_id"),
        Index("idx_inv_processing_status", "processing_status"),
        Index("idx_inv_business_status", "business_status"),
        Index("idx_inv_vendor_date", "vendor_id", "invoice_date"),
    )


class InvoiceLineItem(Base):
    __tablename__ = "invoice_line_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    line_number: Mapped[int] = mapped_column(Integer, nullable=False)
    item_code: Mapped[str | None] = mapped_column(String(100))
    item_description: Mapped[str] = mapped_column(String(500), nullable=False)
    quantity: Mapped[float] = mapped_column(DECIMAL(12, 3), nullable=False)
    unit_price: Mapped[float] = mapped_column(DECIMAL(15, 2), nullable=False)
    total_price: Mapped[float] = mapped_column(DECIMAL(15, 2), nullable=False)
    unit_of_measure: Mapped[str | None] = mapped_column(String(20))

    invoice: Mapped["Invoice"] = relationship(back_populates="line_items")

    __table_args__ = (
        UniqueConstraint("invoice_id", "line_number", name="uq_inv_line"),
        Index("idx_ili_invoice_id", "invoice_id"),
    )


class Reconciliation(Base):
    __tablename__ = "reconciliations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    po_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("purchase_orders.id", ondelete="SET NULL"))
    match_type: Mapped[str] = mapped_column(String(20), nullable=False)
    overall_status: Mapped[str] = mapped_column(String(20), nullable=False)
    confidence_score: Mapped[float | None] = mapped_column(Float)
    agent_recommendation: Mapped[str | None] = mapped_column(Text)
    recommendation_reasoning: Mapped[str | None] = mapped_column(Text)
    trace_id: Mapped[str | None] = mapped_column(String(100))
    processing_time_ms: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now, onupdate=_utc_now)

    invoice: Mapped["Invoice"] = relationship(back_populates="reconciliations")
    purchase_order: Mapped["PurchaseOrder | None"] = relationship(back_populates="reconciliations")
    line_item_matches: Mapped[list["LineItemMatch"]] = relationship(back_populates="reconciliation", cascade="all, delete-orphan")
    discrepancies: Mapped[list["Discrepancy"]] = relationship(back_populates="reconciliation", cascade="all, delete-orphan")
    human_reviews: Mapped[list["HumanReview"]] = relationship(back_populates="reconciliation", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint(
            "confidence_score IS NULL OR (confidence_score >= 0.0 AND confidence_score <= 1.0)",
            name="chk_confidence",
        ),
        Index("idx_rec_invoice_id", "invoice_id"),
        Index("idx_rec_overall_status", "overall_status"),
        Index("idx_rec_created_at", "created_at"),
    )


class LineItemMatch(Base):
    __tablename__ = "line_item_matches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reconciliation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("reconciliations.id", ondelete="CASCADE"), nullable=False)
    invoice_line_item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("invoice_line_items.id", ondelete="CASCADE"), nullable=False)
    po_line_item_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("po_line_items.id", ondelete="SET NULL"))
    delivery_line_item_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("delivery_line_items.id", ondelete="SET NULL"))
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    description_similarity: Mapped[float | None] = mapped_column(Float)
    quantity_invoiced: Mapped[float | None] = mapped_column(DECIMAL(12, 3))
    quantity_ordered: Mapped[float | None] = mapped_column(DECIMAL(12, 3))
    quantity_delivered: Mapped[float | None] = mapped_column(DECIMAL(12, 3))
    price_invoiced: Mapped[float | None] = mapped_column(DECIMAL(15, 2))
    price_ordered: Mapped[float | None] = mapped_column(DECIMAL(15, 2))
    price_deviation_pct: Mapped[float | None] = mapped_column(Float)

    reconciliation: Mapped["Reconciliation"] = relationship(back_populates="line_item_matches")

    __table_args__ = (
        Index("idx_lim_rec_id", "reconciliation_id"),
    )


class Discrepancy(Base):
    __tablename__ = "discrepancies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reconciliation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("reconciliations.id", ondelete="CASCADE"), nullable=False)
    line_item_match_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("line_item_matches.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String(30), nullable=False)
    severity: Mapped[str] = mapped_column(String(10), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    expected_value: Mapped[str | None] = mapped_column(String(100))
    actual_value: Mapped[str | None] = mapped_column(String(100))
    deviation_pct: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)

    reconciliation: Mapped["Reconciliation"] = relationship(back_populates="discrepancies")

    __table_args__ = (
        Index("idx_disc_rec_id", "reconciliation_id"),
        Index("idx_disc_type", "type"),
        Index("idx_disc_severity", "severity"),
    )


class HumanReview(Base):
    __tablename__ = "human_reviews"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reconciliation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("reconciliations.id", ondelete="CASCADE"), nullable=False)
    decision: Mapped[str] = mapped_column(String(20), nullable=False)
    reviewer_notes: Mapped[str | None] = mapped_column(Text)
    decided_by: Mapped[str | None] = mapped_column(String(255))
    decided_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)

    reconciliation: Mapped["Reconciliation"] = relationship(back_populates="human_reviews")

    __table_args__ = (
        Index("idx_hr_rec_id", "reconciliation_id"),
    )


class QuotaRequest(Base):
    """Durable record of a user asking for a higher daily invoice limit."""

    __tablename__ = "quota_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    requested_limit: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)

    user: Mapped["User"] = relationship(back_populates="quota_requests")

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'approved', 'rejected')",
            name="chk_quota_requests_status",
        ),
        Index("idx_quota_requests_user_id", "user_id"),
        Index("idx_quota_requests_status", "status"),
    )
