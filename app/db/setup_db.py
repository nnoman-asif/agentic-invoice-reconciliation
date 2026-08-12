"""
Standalone database setup script.
Creates all 12 tables with correct types, constraints, indices, and FK cascade rules.
Also bootstraps the system and local-dev users.

Usage:
    python -m app.db.setup_db
    python -m app.db.setup_db --reset
"""

import sys

import psycopg2

from app.config import LOCAL_DEV_USER_ID, SYSTEM_USER_ID, settings


TABLES_SQL = f"""

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 0. users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kind                  VARCHAR(10)  NOT NULL,
    firebase_uid          VARCHAR(128),
    email                 VARCHAR(255),
    display_name          VARCHAR(255),
    daily_invoice_limit   INTEGER      NOT NULL DEFAULT 15,
    max_upload_mb         INTEGER      NOT NULL DEFAULT 5,
    max_pdf_pages         INTEGER      NOT NULL DEFAULT 10,
    last_seen_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT chk_users_kind CHECK (kind IN ('user', 'guest', 'system')),
    CONSTRAINT uq_users_firebase_uid UNIQUE (firebase_uid)
);

CREATE INDEX IF NOT EXISTS idx_users_kind ON users (kind);
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users (last_seen_at);

-- ============================================================
-- 1. vendors
-- ============================================================
CREATE TABLE IF NOT EXISTS vendors (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id        UUID         NOT NULL,
    name            VARCHAR(255) NOT NULL,
    code            VARCHAR(50)  NOT NULL,
    tax_id          VARCHAR(50),
    address         TEXT,
    contact_email   VARCHAR(255),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT uq_vendors_owner_code   UNIQUE (owner_id, code),
    CONSTRAINT uq_vendors_owner_tax_id UNIQUE (owner_id, tax_id),
    CONSTRAINT fk_vendors_owner FOREIGN KEY (owner_id)
        REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vendors_owner_id ON vendors (owner_id);
CREATE INDEX IF NOT EXISTS idx_vendors_name ON vendors (name);

-- ============================================================
-- 2. purchase_orders
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_orders (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id                UUID           NOT NULL,
    po_number               VARCHAR(50)    NOT NULL,
    vendor_id               UUID           NOT NULL,
    issue_date              DATE           NOT NULL,
    expected_delivery_date  DATE,
    status                  VARCHAR(20)    NOT NULL DEFAULT 'draft',
    total_amount            DECIMAL(15,2)  NOT NULL,
    currency                VARCHAR(3)     NOT NULL DEFAULT 'USD',
    notes                   TEXT,
    created_at              TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ    NOT NULL DEFAULT now(),

    CONSTRAINT uq_po_owner_number UNIQUE (owner_id, po_number),
    CONSTRAINT fk_po_owner FOREIGN KEY (owner_id)
        REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_po_vendor FOREIGN KEY (vendor_id)
        REFERENCES vendors (id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_po_owner_id ON purchase_orders (owner_id);
CREATE INDEX IF NOT EXISTS idx_po_vendor_id ON purchase_orders (vendor_id);
CREATE INDEX IF NOT EXISTS idx_po_status    ON purchase_orders (status);

-- ============================================================
-- 3. po_line_items
-- ============================================================
CREATE TABLE IF NOT EXISTS po_line_items (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    po_id                 UUID           NOT NULL,
    line_number           INTEGER        NOT NULL,
    item_code             VARCHAR(100),
    item_description      VARCHAR(500)   NOT NULL,
    quantity              DECIMAL(12,3)  NOT NULL,
    unit_price            DECIMAL(15,2)  NOT NULL,
    total_price           DECIMAL(15,2)  NOT NULL,
    unit_of_measure       VARCHAR(20),
    description_embedding vector,
    embedding_model       VARCHAR(100),
    embedding_dim         INTEGER,

    CONSTRAINT uq_po_line UNIQUE (po_id, line_number),
    CONSTRAINT fk_poli_po FOREIGN KEY (po_id)
        REFERENCES purchase_orders (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_poli_po_id ON po_line_items (po_id);

-- ============================================================
-- 4. delivery_receipts
-- ============================================================
CREATE TABLE IF NOT EXISTS delivery_receipts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id        UUID         NOT NULL,
    receipt_number  VARCHAR(50)  NOT NULL,
    po_id           UUID         NOT NULL,
    received_date   DATE         NOT NULL,
    receiver_name   VARCHAR(255),
    status          VARCHAR(20)  NOT NULL DEFAULT 'received',
    notes           TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT uq_dr_owner_receipt UNIQUE (owner_id, receipt_number),
    CONSTRAINT fk_dr_owner FOREIGN KEY (owner_id)
        REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_dr_po FOREIGN KEY (po_id)
        REFERENCES purchase_orders (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dr_owner_id ON delivery_receipts (owner_id);
CREATE INDEX IF NOT EXISTS idx_dr_po_id ON delivery_receipts (po_id);

-- ============================================================
-- 5. delivery_line_items
-- ============================================================
CREATE TABLE IF NOT EXISTS delivery_line_items (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_id        UUID           NOT NULL,
    po_line_item_id   UUID,
    item_description  VARCHAR(500)   NOT NULL,
    quantity_received DECIMAL(12,3)  NOT NULL,
    quantity_accepted DECIMAL(12,3)  NOT NULL,
    quantity_rejected DECIMAL(12,3)  NOT NULL DEFAULT 0,

    CONSTRAINT chk_dli_qty CHECK (quantity_received = quantity_accepted + quantity_rejected),
    CONSTRAINT fk_dli_receipt FOREIGN KEY (receipt_id)
        REFERENCES delivery_receipts (id) ON DELETE CASCADE,
    CONSTRAINT fk_dli_poli FOREIGN KEY (po_line_item_id)
        REFERENCES po_line_items (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_dli_receipt_id     ON delivery_line_items (receipt_id);
CREATE INDEX IF NOT EXISTS idx_dli_po_line_item   ON delivery_line_items (po_line_item_id);

-- ============================================================
-- 6. invoices
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id            UUID           NOT NULL,
    invoice_number      VARCHAR(100),
    po_reference        VARCHAR(100),
    vendor_id           UUID,
    invoice_date        DATE,
    due_date            DATE,
    total_amount        DECIMAL(15,2),
    tax_amount          DECIMAL(15,2),
    currency            VARCHAR(3)     NOT NULL DEFAULT 'USD',
    processing_status   VARCHAR(20)    NOT NULL DEFAULT 'queued',
    business_status     VARCHAR(20)    NOT NULL DEFAULT 'pending',
    raw_file_path       VARCHAR(500),
    file_content_type   VARCHAR(50),
    file_hash           CHAR(64),
    raw_text            TEXT,
    file_deleted_at     TIMESTAMPTZ,
    parsed_data         JSONB,
    error_message       TEXT,
    created_at          TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ    NOT NULL DEFAULT now(),

    CONSTRAINT uq_inv_owner_number UNIQUE (owner_id, invoice_number),
    CONSTRAINT uq_inv_owner_file_hash UNIQUE (owner_id, file_hash),
    CONSTRAINT fk_inv_owner FOREIGN KEY (owner_id)
        REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_inv_vendor FOREIGN KEY (vendor_id)
        REFERENCES vendors (id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_inv_owner_id           ON invoices (owner_id);
CREATE INDEX IF NOT EXISTS idx_inv_vendor_id          ON invoices (vendor_id);
CREATE INDEX IF NOT EXISTS idx_inv_processing_status  ON invoices (processing_status);
CREATE INDEX IF NOT EXISTS idx_inv_business_status    ON invoices (business_status);
CREATE INDEX IF NOT EXISTS idx_inv_vendor_date        ON invoices (vendor_id, invoice_date);

-- ============================================================
-- 7. invoice_line_items
-- ============================================================
CREATE TABLE IF NOT EXISTS invoice_line_items (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id       UUID           NOT NULL,
    line_number      INTEGER        NOT NULL,
    item_code        VARCHAR(100),
    item_description VARCHAR(500)   NOT NULL,
    quantity         DECIMAL(12,3)  NOT NULL,
    unit_price       DECIMAL(15,2)  NOT NULL,
    total_price      DECIMAL(15,2)  NOT NULL,
    unit_of_measure  VARCHAR(20),

    CONSTRAINT uq_inv_line UNIQUE (invoice_id, line_number),
    CONSTRAINT fk_ili_inv FOREIGN KEY (invoice_id)
        REFERENCES invoices (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ili_invoice_id ON invoice_line_items (invoice_id);

-- ============================================================
-- 8. reconciliations
-- ============================================================
CREATE TABLE IF NOT EXISTS reconciliations (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id                  UUID           NOT NULL,
    po_id                       UUID,
    match_type                  VARCHAR(20)    NOT NULL,
    overall_status              VARCHAR(20)    NOT NULL,
    confidence_score            FLOAT,
    agent_recommendation        TEXT,
    recommendation_reasoning    TEXT,
    trace_id                    VARCHAR(100),
    processing_time_ms          INTEGER,
    created_at                  TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ    NOT NULL DEFAULT now(),

    CONSTRAINT chk_confidence CHECK (
        confidence_score IS NULL
        OR (confidence_score >= 0.0 AND confidence_score <= 1.0)
    ),
    CONSTRAINT fk_rec_invoice FOREIGN KEY (invoice_id)
        REFERENCES invoices (id) ON DELETE CASCADE,
    CONSTRAINT fk_rec_po FOREIGN KEY (po_id)
        REFERENCES purchase_orders (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_rec_invoice_id     ON reconciliations (invoice_id);
CREATE INDEX IF NOT EXISTS idx_rec_overall_status ON reconciliations (overall_status);
CREATE INDEX IF NOT EXISTS idx_rec_created_at     ON reconciliations (created_at);

-- ============================================================
-- 9. line_item_matches
-- ============================================================
CREATE TABLE IF NOT EXISTS line_item_matches (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reconciliation_id       UUID           NOT NULL,
    invoice_line_item_id    UUID           NOT NULL,
    po_line_item_id         UUID,
    delivery_line_item_id   UUID,
    status                  VARCHAR(20)    NOT NULL,
    description_similarity  FLOAT,
    quantity_invoiced       DECIMAL(12,3),
    quantity_ordered        DECIMAL(12,3),
    quantity_delivered      DECIMAL(12,3),
    price_invoiced          DECIMAL(15,2),
    price_ordered           DECIMAL(15,2),
    price_deviation_pct     FLOAT,

    CONSTRAINT fk_lim_rec FOREIGN KEY (reconciliation_id)
        REFERENCES reconciliations (id) ON DELETE CASCADE,
    CONSTRAINT fk_lim_ili FOREIGN KEY (invoice_line_item_id)
        REFERENCES invoice_line_items (id) ON DELETE CASCADE,
    CONSTRAINT fk_lim_poli FOREIGN KEY (po_line_item_id)
        REFERENCES po_line_items (id) ON DELETE SET NULL,
    CONSTRAINT fk_lim_dli FOREIGN KEY (delivery_line_item_id)
        REFERENCES delivery_line_items (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_lim_rec_id ON line_item_matches (reconciliation_id);

-- ============================================================
-- 10. discrepancies
-- ============================================================
CREATE TABLE IF NOT EXISTS discrepancies (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reconciliation_id   UUID           NOT NULL,
    line_item_match_id  UUID,
    type                VARCHAR(30)    NOT NULL,
    severity            VARCHAR(10)    NOT NULL,
    description         TEXT           NOT NULL,
    expected_value      VARCHAR(100),
    actual_value        VARCHAR(100),
    deviation_pct       FLOAT,
    created_at          TIMESTAMPTZ    NOT NULL DEFAULT now(),

    CONSTRAINT fk_disc_rec FOREIGN KEY (reconciliation_id)
        REFERENCES reconciliations (id) ON DELETE CASCADE,
    CONSTRAINT fk_disc_lim FOREIGN KEY (line_item_match_id)
        REFERENCES line_item_matches (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_disc_rec_id   ON discrepancies (reconciliation_id);
CREATE INDEX IF NOT EXISTS idx_disc_type     ON discrepancies (type);
CREATE INDEX IF NOT EXISTS idx_disc_severity ON discrepancies (severity);

-- ============================================================
-- 11. human_reviews
-- ============================================================
CREATE TABLE IF NOT EXISTS human_reviews (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reconciliation_id   UUID           NOT NULL,
    decision            VARCHAR(20)    NOT NULL,
    reviewer_notes      TEXT,
    decided_by          VARCHAR(255),
    decided_at          TIMESTAMPTZ    NOT NULL DEFAULT now(),

    CONSTRAINT fk_hr_rec FOREIGN KEY (reconciliation_id)
        REFERENCES reconciliations (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_hr_rec_id ON human_reviews (reconciliation_id);

-- Bootstrap system + local-dev users (idempotent).
INSERT INTO users (id, kind, display_name, daily_invoice_limit, max_upload_mb, max_pdf_pages)
VALUES
    ('{SYSTEM_USER_ID}', 'system', 'System', 0, 0, 0),
    ('{LOCAL_DEV_USER_ID}', 'user', 'Local Dev', 15, 10, 10)
ON CONFLICT (id) DO NOTHING;

-- Idempotent migrations for DBs created before this schema revision.
-- Prefer `python -m app.db.setup_db --reset` on disposable local DBs.
ALTER TABLE po_line_items
    ALTER COLUMN description_embedding TYPE vector;
ALTER TABLE po_line_items
    ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(100);
ALTER TABLE po_line_items
    ADD COLUMN IF NOT EXISTS embedding_dim INTEGER;
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS file_hash CHAR(64);
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS raw_text TEXT;
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS file_deleted_at TIMESTAMPTZ;

"""

DROP_ALL_SQL = """
DROP TABLE IF EXISTS human_reviews CASCADE;
DROP TABLE IF EXISTS discrepancies CASCADE;
DROP TABLE IF EXISTS line_item_matches CASCADE;
DROP TABLE IF EXISTS reconciliations CASCADE;
DROP TABLE IF EXISTS invoice_line_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS delivery_line_items CASCADE;
DROP TABLE IF EXISTS delivery_receipts CASCADE;
DROP TABLE IF EXISTS po_line_items CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;
DROP TABLE IF EXISTS vendors CASCADE;
DROP TABLE IF EXISTS users CASCADE;
"""


def get_connection():
    return psycopg2.connect(
        host=settings.postgres_host,
        port=settings.postgres_port,
        dbname=settings.postgres_db,
        user=settings.postgres_user,
        password=settings.postgres_password,
    )


def create_tables():
    """Create all tables, indices, and constraints."""
    conn = get_connection()
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(TABLES_SQL)
        print("[setup_db] All 12 tables created successfully.")
        print(f"[setup_db] Bootstrapped system={SYSTEM_USER_ID} local-dev={LOCAL_DEV_USER_ID}")
    except Exception as e:
        print(f"[setup_db] Error creating tables: {e}")
        sys.exit(1)
    finally:
        conn.close()


def drop_tables():
    """Drop all tables (use with caution)."""
    conn = get_connection()
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(DROP_ALL_SQL)
        print("[setup_db] All tables dropped.")
    except Exception as e:
        print(f"[setup_db] Error dropping tables: {e}")
        sys.exit(1)
    finally:
        conn.close()


def reset_database():
    """Drop and recreate all tables."""
    drop_tables()
    create_tables()
    print("[setup_db] Database reset complete.")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Invoice Reconciliation Agent - Database Setup")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Drop all tables and recreate them",
    )
    parser.add_argument(
        "--drop",
        action="store_true",
        help="Drop all tables without recreating",
    )
    args = parser.parse_args()

    if args.drop:
        drop_tables()
    elif args.reset:
        reset_database()
    else:
        create_tables()
