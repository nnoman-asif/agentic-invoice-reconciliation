"""3-way matching logic for invoice line items against PO and delivery data."""

from dataclasses import dataclass, field

import numpy as np
import ollama

from app.config import settings


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


def get_embedding(text: str) -> list[float]:
    """Get embedding from Ollama for a single text."""
    response = ollama.embed(
        model=settings.ollama_embedding_model,
        input=text,
    )
    return response["embeddings"][0]


def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    a = np.array(vec_a)
    b = np.array(vec_b)
    dot = np.dot(a, b)
    norm = np.linalg.norm(a) * np.linalg.norm(b)
    if norm == 0:
        return 0.0
    return float(dot / norm)


def compute_description_similarity(desc_a: str, desc_b: str) -> float:
    """Compute semantic similarity between two item descriptions using embeddings."""
    emb_a = get_embedding(desc_a)
    emb_b = get_embedding(desc_b)
    return cosine_similarity(emb_a, emb_b)


def compute_price_deviation(price_a: float, price_b: float) -> float:
    """Compute percentage deviation between two prices."""
    if price_b == 0:
        return 100.0 if price_a != 0 else 0.0
    return abs(price_a - price_b) / price_b * 100


def match_line_items(
    invoice_lines: list[dict],
    po_lines: list[dict],
    delivery_lines: list[dict],
    similarity_threshold: float = 0.7,
) -> list[LineMatchResult]:
    """
    Perform 3-way matching of invoice lines against PO and delivery lines.

    Each dict must have: id, item_description, item_code (optional), quantity, unit_price
    Delivery lines also need: po_line_item_id, quantity_accepted
    """
    results: list[LineMatchResult] = []
    used_po_ids: set[str] = set()

    # Build delivery lookup by po_line_item_id
    delivery_by_po_line: dict[str, list[dict]] = {}
    for dl in delivery_lines:
        key = dl.get("po_line_item_id")
        if key:
            delivery_by_po_line.setdefault(str(key), []).append(dl)

    for inv_line in invoice_lines:
        best_match: LineMatchResult | None = None
        best_score = -1.0

        for po_line in po_lines:
            if str(po_line["id"]) in used_po_ids:
                continue

            # Try exact item_code match first
            if inv_line.get("item_code") and po_line.get("item_code"):
                if inv_line["item_code"].strip().upper() == po_line["item_code"].strip().upper():
                    similarity = 1.0
                else:
                    similarity = compute_description_similarity(
                        inv_line["item_description"],
                        po_line["item_description"],
                    )
            else:
                similarity = compute_description_similarity(
                    inv_line["item_description"],
                    po_line["item_description"],
                )

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
