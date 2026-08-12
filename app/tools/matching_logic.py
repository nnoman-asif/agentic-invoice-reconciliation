"""3-way matching logic for invoice line items against PO and delivery data."""

from dataclasses import dataclass

import numpy as np

from app.config import settings
from app.tools.embeddings import (
    cosine_similarity_matrix,
    embedding_cache_usable,
    get_embeddings_batch,
)


@dataclass
class LineMatchResult:
    invoice_line_item_id: str
    po_line_item_id: str | None = None
    delivery_line_item_id: str | None = None
    status: str = "unmatched"
    description_similarity: float | None = None
    quantity_invoiced: float | None = None
    quantity_ordered: float | None = None
    quantity_delivered: float | None = None
    price_invoiced: float | None = None
    price_ordered: float | None = None
    price_deviation_pct: float | None = None


def compute_price_deviation(price_a: float, price_b: float) -> float:
    """Compute percentage deviation between two prices."""
    if price_b == 0:
        return 100.0 if price_a != 0 else 0.0
    return abs(price_a - price_b) / price_b * 100


def match_line_items(
    invoice_lines: list[dict],
    po_lines: list[dict],
    delivery_lines: list[dict],
    similarity_threshold: float = 0.7,  # tuned vs Qwen3; re-check before trusting Gemini
) -> list[LineMatchResult]:
    """
    Perform 3-way matching of invoice lines against PO and delivery lines.

    Each dict must have: id, item_description, item_code (optional), quantity, unit_price
    Delivery lines also need: po_line_item_id, quantity_accepted
    PO lines may include description_embedding (cached vector) to avoid re-embedding.
    """
    results: list[LineMatchResult] = []
    used_po_ids: set[str] = set()

    # Build delivery lookup by po_line_item_id
    delivery_by_po_line: dict[str, list[dict]] = {}
    for dl in delivery_lines:
        key = dl.get("po_line_item_id")
        if key:
            delivery_by_po_line.setdefault(str(key), []).append(dl)

    n = len(invoice_lines)
    m = len(po_lines)
    if n == 0:
        return results

    # One batch for all invoice descriptions, plus any PO lines that
    # arrived without a usable cached embedding (model/dim mismatch is a
    # cache miss so Ollama and Gemini vectors are never mixed).
    texts: list[str] = [inv.get("item_description", "") for inv in invoice_lines]
    po_uncached_indices: list[int] = []
    for j, po in enumerate(po_lines):
        if not embedding_cache_usable(
            po.get("embedding_model"),
            po.get("embedding_dim"),
            po.get("description_embedding"),
        ):
            po_uncached_indices.append(j)
            texts.append(po.get("item_description", ""))

    vectors: list[list[float]] = []
    if texts:
        try:
            vectors = get_embeddings_batch(texts)
        except Exception:
            # Leave vectors empty; sim stays 0.0 except exact item_code hits.
            vectors = []

    inv_embeddings: list[list[float] | None] = [None] * n
    po_embeddings: list[list[float] | None] = [
        list(po["description_embedding"])
        if embedding_cache_usable(
            po.get("embedding_model"),
            po.get("embedding_dim"),
            po.get("description_embedding"),
        )
        else None
        for po in po_lines
    ]

    if len(vectors) >= n:
        for i in range(n):
            inv_embeddings[i] = vectors[i]
        for offset, j in enumerate(po_uncached_indices):
            idx = n + offset
            if idx < len(vectors):
                po_embeddings[j] = vectors[idx]

    # N x M similarity: 1.0 for exact item_code match, cosine otherwise,
    # 0.0 when a vector is unavailable.
    sim = np.zeros((n, m), dtype=float)
    inv_rows: list[list[float]] = []
    inv_row_map: list[int] = []
    for i, emb in enumerate(inv_embeddings):
        if emb is not None:
            inv_rows.append(emb)
            inv_row_map.append(i)

    po_rows: list[list[float]] = []
    po_row_map: list[int] = []
    for j, emb in enumerate(po_embeddings):
        if emb is not None:
            po_rows.append(emb)
            po_row_map.append(j)

    if inv_rows and po_rows:
        matrix = cosine_similarity_matrix(
            np.asarray(inv_rows, dtype=float),
            np.asarray(po_rows, dtype=float),
        )
        for ri, i in enumerate(inv_row_map):
            for rj, j in enumerate(po_row_map):
                sim[i, j] = float(matrix[ri, rj])

    for i, inv_line in enumerate(invoice_lines):
        inv_code = (inv_line.get("item_code") or "").strip().upper()
        if not inv_code:
            continue
        for j, po_line in enumerate(po_lines):
            po_code = (po_line.get("item_code") or "").strip().upper()
            if po_code and inv_code == po_code:
                sim[i, j] = 1.0

    for i, inv_line in enumerate(invoice_lines):
        best_match: LineMatchResult | None = None
        best_score = -1.0

        for j, po_line in enumerate(po_lines):
            if str(po_line["id"]) in used_po_ids:
                continue

            similarity = float(sim[i, j])

            if similarity > best_score and similarity >= similarity_threshold:
                # Find corresponding delivery
                po_line_id_str = str(po_line["id"])
                deliveries = delivery_by_po_line.get(po_line_id_str, [])
                total_delivered = sum(d.get("quantity_accepted", 0) for d in deliveries)
                delivery_line_id = str(deliveries[0]["id"]) if deliveries else None

                price_dev = compute_price_deviation(
                    inv_line["unit_price"],
                    po_line["unit_price"],
                )

                # Determine status
                qty_match = abs(inv_line["quantity"] - po_line["quantity"]) < 0.001
                price_match = price_dev < settings.price_deviation_threshold
                delivery_match = abs(inv_line["quantity"] - total_delivered) < 0.001 if deliveries else False

                if qty_match and price_match and (delivery_match or not deliveries):
                    status = "matched"
                elif similarity >= 0.85 and (qty_match or price_match):
                    status = "partial"
                else:
                    status = "mismatch"

                candidate = LineMatchResult(
                    invoice_line_item_id=str(inv_line["id"]),
                    po_line_item_id=po_line_id_str,
                    delivery_line_item_id=delivery_line_id,
                    status=status,
                    description_similarity=round(similarity, 4),
                    quantity_invoiced=inv_line["quantity"],
                    quantity_ordered=po_line["quantity"],
                    quantity_delivered=total_delivered if deliveries else None,
                    price_invoiced=inv_line["unit_price"],
                    price_ordered=po_line["unit_price"],
                    price_deviation_pct=round(price_dev, 2),
                )

                if similarity > best_score:
                    best_score = similarity
                    best_match = candidate

        if best_match and best_match.po_line_item_id:
            used_po_ids.add(best_match.po_line_item_id)
            results.append(best_match)
        else:
            results.append(LineMatchResult(
                invoice_line_item_id=str(inv_line["id"]),
                status="unmatched",
                quantity_invoiced=inv_line["quantity"],
                price_invoiced=inv_line["unit_price"],
            ))

    return results
