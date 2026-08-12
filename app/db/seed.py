"""
Seed the database with sample vendors, purchase orders, and delivery receipts.
All rows are owned by the system user (shared demo reference data).

Usage:
    python -m app.db.seed
    python -m app.db.seed --with-embeddings
"""

import sys
import uuid
from datetime import date

import psycopg2
import psycopg2.extras
from psycopg2.extras import execute_values

from app.config import SYSTEM_USER_ID, settings

# Register UUID adapter so psycopg2 can handle uuid.UUID objects
psycopg2.extras.register_uuid()

# ── Fixed UUIDs for reproducible, idempotent seeding ──────────────

VENDOR_IDS = [
    uuid.UUID("a1000000-0000-4000-8000-000000000001"),
    uuid.UUID("a1000000-0000-4000-8000-000000000002"),
    uuid.UUID("a1000000-0000-4000-8000-000000000003"),
]
PO_IDS = [
    uuid.UUID("a2000000-0000-4000-8000-000000000001"),
    uuid.UUID("a2000000-0000-4000-8000-000000000002"),
    uuid.UUID("a2000000-0000-4000-8000-000000000003"),
    uuid.UUID("a2000000-0000-4000-8000-000000000004"),
    uuid.UUID("a2000000-0000-4000-8000-000000000005"),
]
PO_LINE_IDS = [
    [
        uuid.UUID("a3000000-0000-4000-8000-000000000011"),
        uuid.UUID("a3000000-0000-4000-8000-000000000012"),
        uuid.UUID("a3000000-0000-4000-8000-000000000013"),
    ],
    [
        uuid.UUID("a3000000-0000-4000-8000-000000000021"),
        uuid.UUID("a3000000-0000-4000-8000-000000000022"),
        uuid.UUID("a3000000-0000-4000-8000-000000000023"),
    ],
    [
        uuid.UUID("a3000000-0000-4000-8000-000000000031"),
        uuid.UUID("a3000000-0000-4000-8000-000000000032"),
        uuid.UUID("a3000000-0000-4000-8000-000000000033"),
    ],
    [
        uuid.UUID("a3000000-0000-4000-8000-000000000041"),
        uuid.UUID("a3000000-0000-4000-8000-000000000042"),
        uuid.UUID("a3000000-0000-4000-8000-000000000043"),
    ],
    [
        uuid.UUID("a3000000-0000-4000-8000-000000000051"),
        uuid.UUID("a3000000-0000-4000-8000-000000000052"),
        uuid.UUID("a3000000-0000-4000-8000-000000000053"),
    ],
]
DR_IDS = [
    uuid.UUID("a4000000-0000-4000-8000-000000000001"),
    uuid.UUID("a4000000-0000-4000-8000-000000000002"),
    uuid.UUID("a4000000-0000-4000-8000-000000000003"),
    uuid.UUID("a4000000-0000-4000-8000-000000000004"),
    uuid.UUID("a4000000-0000-4000-8000-000000000005"),
]
DR_LINE_IDS = [
    [
        uuid.UUID("a5000000-0000-4000-8000-000000000011"),
        uuid.UUID("a5000000-0000-4000-8000-000000000012"),
        uuid.UUID("a5000000-0000-4000-8000-000000000013"),
    ],
    [
        uuid.UUID("a5000000-0000-4000-8000-000000000021"),
        uuid.UUID("a5000000-0000-4000-8000-000000000022"),
        uuid.UUID("a5000000-0000-4000-8000-000000000023"),
    ],
    [
        uuid.UUID("a5000000-0000-4000-8000-000000000031"),
        uuid.UUID("a5000000-0000-4000-8000-000000000032"),
        uuid.UUID("a5000000-0000-4000-8000-000000000033"),
    ],
    [
        uuid.UUID("a5000000-0000-4000-8000-000000000041"),
        uuid.UUID("a5000000-0000-4000-8000-000000000042"),
        uuid.UUID("a5000000-0000-4000-8000-000000000043"),
    ],
    [
        uuid.UUID("a5000000-0000-4000-8000-000000000051"),
        uuid.UUID("a5000000-0000-4000-8000-000000000052"),
        uuid.UUID("a5000000-0000-4000-8000-000000000053"),
    ],
]


def get_connection():
    return psycopg2.connect(
        host=settings.postgres_host,
        port=settings.postgres_port,
        dbname=settings.postgres_db,
        user=settings.postgres_user,
        password=settings.postgres_password,
    )


def seed_vendors(cur):
    vendors = [
        (VENDOR_IDS[0], SYSTEM_USER_ID, "Acme Industrial Supplies", "ACME-001", "TAX-ACME-9821",
         "123 Industrial Park, Houston, TX 77001", "billing@acmeindustrial.com"),
        (VENDOR_IDS[1], SYSTEM_USER_ID, "Global Steel Corporation", "GSC-002", "TAX-GSC-4455",
         "456 Steel Avenue, Pittsburgh, PA 15201", "accounts@globalsteel.com"),
        (VENDOR_IDS[2], SYSTEM_USER_ID, "Precision Parts Manufacturing", "PPM-003", "TAX-PPM-7712",
         "789 Precision Blvd, Detroit, MI 48201", "invoices@precisionparts.com"),
    ]
    execute_values(
        cur,
        """INSERT INTO vendors (id, owner_id, name, code, tax_id, address, contact_email)
           VALUES %s ON CONFLICT (owner_id, code) DO NOTHING""",
        vendors,
    )
    print(f"  [seed] {len(vendors)} vendors inserted.")


def seed_purchase_orders(cur):
    pos = [
        # PO-1: Acme - fasteners
        (PO_IDS[0], SYSTEM_USER_ID, "PO-2026-001", VENDOR_IDS[0], date(2026, 1, 10), date(2026, 2, 10),
         "issued", 15750.00, "USD", None),
        # PO-2: Global Steel - steel plates
        (PO_IDS[1], SYSTEM_USER_ID, "PO-2026-002", VENDOR_IDS[1], date(2026, 1, 15), date(2026, 2, 15),
         "issued", 48200.00, "USD", None),
        # PO-3: Precision Parts - bearings
        (PO_IDS[2], SYSTEM_USER_ID, "PO-2026-003", VENDOR_IDS[2], date(2026, 1, 20), date(2026, 2, 28),
         "issued", 9360.00, "USD", None),
        # PO-4: Acme - safety equipment
        (PO_IDS[3], SYSTEM_USER_ID, "PO-2026-004", VENDOR_IDS[0], date(2026, 2, 1), date(2026, 3, 1),
         "issued", 6840.00, "USD", None),
        # PO-5: Global Steel - pipes
        (PO_IDS[4], SYSTEM_USER_ID, "PO-2026-005", VENDOR_IDS[1], date(2026, 2, 5), date(2026, 3, 5),
         "issued", 32500.00, "USD", None),
    ]
    execute_values(
        cur,
        """INSERT INTO purchase_orders
           (id, owner_id, po_number, vendor_id, issue_date, expected_delivery_date, status, total_amount, currency, notes)
           VALUES %s ON CONFLICT (owner_id, po_number) DO NOTHING""",
        pos,
    )
    print(f"  [seed] {len(pos)} purchase orders inserted.")

    # Line items for each PO
    po_lines = [
        # PO-1 lines
        (PO_LINE_IDS[0][0], PO_IDS[0], 1, "BOLT-M8X50", "Steel Bolts M8x50mm Grade 8.8", 500, 5.50, 2750.00, "pcs"),
        (PO_LINE_IDS[0][1], PO_IDS[0], 2, "NUT-M8",     "Hex Nuts M8 Zinc Plated",        500, 2.00, 1000.00, "pcs"),
        (PO_LINE_IDS[0][2], PO_IDS[0], 3, "WSHR-M8",    "Flat Washers M8 Stainless",       1000, 12.00, 12000.00, "pcs"),
        # PO-2 lines
        (PO_LINE_IDS[1][0], PO_IDS[1], 1, "SP-10MM",  "Hot Rolled Steel Plate 10mm",   20, 1200.00, 24000.00, "sheets"),
        (PO_LINE_IDS[1][1], PO_IDS[1], 2, "SP-5MM",   "Cold Rolled Steel Plate 5mm",   30, 800.00, 24000.00, "sheets"),
        (PO_LINE_IDS[1][2], PO_IDS[1], 3, "SC-FLAT",  "Steel Cutting Service - Flat",  1, 200.00, 200.00, "lot"),
        # PO-3 lines
        (PO_LINE_IDS[2][0], PO_IDS[2], 1, "BRG-6205",  "Ball Bearing 6205-2RS",       100, 45.00, 4500.00, "pcs"),
        (PO_LINE_IDS[2][1], PO_IDS[2], 2, "BRG-6208",  "Ball Bearing 6208-2RS",       60, 72.00, 4320.00, "pcs"),
        (PO_LINE_IDS[2][2], PO_IDS[2], 3, "SEAL-6205", "Bearing Seal 6205 Rubber",    100, 5.40, 540.00, "pcs"),
        # PO-4 lines
        (PO_LINE_IDS[3][0], PO_IDS[3], 1, "HELM-001", "Safety Helmet Class E",        50, 45.00, 2250.00, "pcs"),
        (PO_LINE_IDS[3][1], PO_IDS[3], 2, "GLOV-LRG", "Safety Gloves Leather L",     200, 12.00, 2400.00, "pairs"),
        (PO_LINE_IDS[3][2], PO_IDS[3], 3, "GOGL-CLR", "Safety Goggles Clear Lens",   100, 21.90, 2190.00, "pcs"),
        # PO-5 lines
        (PO_LINE_IDS[4][0], PO_IDS[4], 1, "PIPE-4IN",  "Steel Pipe 4in Schedule 40",  50, 350.00, 17500.00, "lengths"),
        (PO_LINE_IDS[4][1], PO_IDS[4], 2, "PIPE-2IN",  "Steel Pipe 2in Schedule 40",  60, 200.00, 12000.00, "lengths"),
        (PO_LINE_IDS[4][2], PO_IDS[4], 3, "FLNG-4IN",  "Pipe Flange 4in 150lb",       20, 150.00, 3000.00, "pcs"),
    ]
    execute_values(
        cur,
        """INSERT INTO po_line_items
           (id, po_id, line_number, item_code, item_description, quantity, unit_price, total_price, unit_of_measure)
           VALUES %s ON CONFLICT (po_id, line_number) DO NOTHING""",
        po_lines,
    )
    print(f"  [seed] {len(po_lines)} PO line items inserted.")


def seed_delivery_receipts(cur):
    receipts = [
        # Full delivery for PO-1
        (DR_IDS[0], SYSTEM_USER_ID, "REC-2026-001", PO_IDS[0], date(2026, 2, 8), "John Smith", "received", None),
        # Full delivery for PO-2
        (DR_IDS[1], SYSTEM_USER_ID, "REC-2026-002", PO_IDS[1], date(2026, 2, 14), "Jane Doe", "received", None),
        # Partial delivery for PO-3 (80% of bearings)
        (DR_IDS[2], SYSTEM_USER_ID, "REC-2026-003", PO_IDS[2], date(2026, 2, 25), "Mike Johnson", "partial",
         "80 of 100 bearings 6205 received; full qty for 6208 and seals"),
        # Full delivery for PO-4
        (DR_IDS[3], SYSTEM_USER_ID, "REC-2026-004", PO_IDS[3], date(2026, 2, 28), "Sarah Lee", "received", None),
        # Full delivery for PO-5
        (DR_IDS[4], SYSTEM_USER_ID, "REC-2026-005", PO_IDS[4], date(2026, 3, 3), "Tom Wilson", "received", None),
    ]
    execute_values(
        cur,
        """INSERT INTO delivery_receipts
           (id, owner_id, receipt_number, po_id, received_date, receiver_name, status, notes)
           VALUES %s ON CONFLICT (owner_id, receipt_number) DO NOTHING""",
        receipts,
    )
    print(f"  [seed] {len(receipts)} delivery receipts inserted.")

    dr_lines = [
        # REC-1: full delivery of PO-1
        (DR_LINE_IDS[0][0], DR_IDS[0], PO_LINE_IDS[0][0], "Steel Bolts M8x50mm Grade 8.8", 500, 500, 0),
        (DR_LINE_IDS[0][1], DR_IDS[0], PO_LINE_IDS[0][1], "Hex Nuts M8 Zinc Plated",        500, 500, 0),
        (DR_LINE_IDS[0][2], DR_IDS[0], PO_LINE_IDS[0][2], "Flat Washers M8 Stainless",       1000, 1000, 0),
        # REC-2: full delivery of PO-2
        (DR_LINE_IDS[1][0], DR_IDS[1], PO_LINE_IDS[1][0], "Hot Rolled Steel Plate 10mm", 20, 20, 0),
        (DR_LINE_IDS[1][1], DR_IDS[1], PO_LINE_IDS[1][1], "Cold Rolled Steel Plate 5mm", 30, 30, 0),
        (DR_LINE_IDS[1][2], DR_IDS[1], PO_LINE_IDS[1][2], "Steel Cutting Service - Flat", 1, 1, 0),
        # REC-3: partial delivery of PO-3
        (DR_LINE_IDS[2][0], DR_IDS[2], PO_LINE_IDS[2][0], "Ball Bearing 6205-2RS",   80, 80, 0),   # 80 of 100
        (DR_LINE_IDS[2][1], DR_IDS[2], PO_LINE_IDS[2][1], "Ball Bearing 6208-2RS",   60, 60, 0),
        (DR_LINE_IDS[2][2], DR_IDS[2], PO_LINE_IDS[2][2], "Bearing Seal 6205 Rubber", 100, 100, 0),
        # REC-4: full delivery of PO-4
        (DR_LINE_IDS[3][0], DR_IDS[3], PO_LINE_IDS[3][0], "Safety Helmet Class E",     50, 50, 0),
        (DR_LINE_IDS[3][1], DR_IDS[3], PO_LINE_IDS[3][1], "Safety Gloves Leather L",   200, 200, 0),
        (DR_LINE_IDS[3][2], DR_IDS[3], PO_LINE_IDS[3][2], "Safety Goggles Clear Lens", 100, 100, 0),
        # REC-5: full delivery of PO-5
        (DR_LINE_IDS[4][0], DR_IDS[4], PO_LINE_IDS[4][0], "Steel Pipe 4in Schedule 40", 50, 50, 0),
        (DR_LINE_IDS[4][1], DR_IDS[4], PO_LINE_IDS[4][1], "Steel Pipe 2in Schedule 40", 60, 60, 0),
        (DR_LINE_IDS[4][2], DR_IDS[4], PO_LINE_IDS[4][2], "Pipe Flange 4in 150lb",      20, 20, 0),
    ]
    execute_values(
        cur,
        """INSERT INTO delivery_line_items
           (id, receipt_id, po_line_item_id, item_description, quantity_received, quantity_accepted, quantity_rejected)
           VALUES %s ON CONFLICT DO NOTHING""",
        dr_lines,
    )
    print(f"  [seed] {len(dr_lines)} delivery line items inserted.")


def seed_po_embeddings(cur):
    """Precompute system PO line embeddings so demo runs skip embedding calls."""
    from app.tools.embeddings import (
        active_embedding_dim,
        active_embedding_model,
        get_embeddings_batch,
    )

    model = active_embedding_model()
    dim = active_embedding_dim()
    cur.execute(
        """
        SELECT pli.id, pli.item_description
        FROM po_line_items pli
        JOIN purchase_orders po ON po.id = pli.po_id
        WHERE po.owner_id = %s
          AND (pli.description_embedding IS NULL
               OR pli.embedding_model IS DISTINCT FROM %s
               OR pli.embedding_dim IS DISTINCT FROM %s)
        ORDER BY pli.id
        """,
        (
            SYSTEM_USER_ID,
            model,
            dim,
        ),
    )
    rows = cur.fetchall()
    if not rows:
        print("  [seed] PO embeddings already up to date.")
        return

    ids = [r[0] for r in rows]
    texts = [r[1] for r in rows]
    print(f"  [seed] Embedding {len(texts)} PO line description(s)...")
    vectors = get_embeddings_batch(texts)

    for line_id, vec in zip(ids, vectors):
        literal = "[" + ",".join(str(float(x)) for x in vec) + "]"
        cur.execute(
            """
            UPDATE po_line_items
               SET description_embedding = %s::vector,
                   embedding_model = %s,
                   embedding_dim = %s
             WHERE id = %s
            """,
            (literal, model, dim, line_id),
        )
    print(f"  [seed] {len(vectors)} PO line embeddings written.")


def seed_all(*, with_embeddings: bool = False):
    conn = get_connection()
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            seed_vendors(cur)
            seed_purchase_orders(cur)
            seed_delivery_receipts(cur)
            if with_embeddings:
                seed_po_embeddings(cur)
        print("\n[seed] Database seeding complete (owned by system user).")
    except Exception as e:
        print(f"[seed] Error: {e}")
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    with_embeddings = "--with-embeddings" in sys.argv
    seed_all(with_embeddings=with_embeddings)
