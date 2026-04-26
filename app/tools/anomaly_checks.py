"""Anomaly detection checks for the reconciliation pipeline."""

from dataclasses import dataclass
from datetime import date

from app.config import settings


@dataclass
class AnomalyResult:
    type: str
    severity: str  # critical / warning / info
    description: str
    expected_value: str | None = None
    actual_value: str | None = None
    deviation_pct: float | None = None
    line_item_match_id: str | None = None


def check_price_deviations(
    line_matches: list[dict],
    threshold: float | None = None,
) -> list[AnomalyResult]:
    """Flag line items where invoice price deviates from PO price beyond threshold."""
    threshold = threshold or settings.price_deviation_threshold
    anomalies = []

    for match in line_matches:
        dev = match.get("price_deviation_pct")
        if dev is not None and dev > threshold:
            severity = "critical" if dev > threshold * 2 else "warning"
            anomalies.append(AnomalyResult(
                type="price_deviation",
                severity=severity,
                description=(
                    f"Unit price deviation of {dev:.1f}% "
                    f"(invoiced: {match.get('price_invoiced')}, "
                    f"ordered: {match.get('price_ordered')})"
                ),
                expected_value=str(match.get("price_ordered")),
                actual_value=str(match.get("price_invoiced")),
                deviation_pct=dev,
                line_item_match_id=match.get("id"),
            ))

    return anomalies


def check_quantity_mismatches(line_matches: list[dict]) -> list[AnomalyResult]:
    """Flag line items where invoiced quantity doesn't match delivered quantity."""
    anomalies = []

    for match in line_matches:
        qty_inv = match.get("quantity_invoiced")
        qty_del = match.get("quantity_delivered")
        if qty_inv is None or qty_del is None:
            continue

        if abs(qty_inv - qty_del) > 0.001:
            diff_pct = abs(qty_inv - qty_del) / qty_del * 100 if qty_del else 100
            severity = "critical" if qty_inv > qty_del else "warning"
            anomalies.append(AnomalyResult(
                type="quantity_mismatch",
                severity=severity,
                description=(
                    f"Quantity mismatch: invoiced {qty_inv}, "
                    f"delivered {qty_del} (diff: {diff_pct:.1f}%)"
                ),
                expected_value=str(qty_del),
                actual_value=str(qty_inv),
                deviation_pct=round(diff_pct, 2),
                line_item_match_id=match.get("id"),
            ))

    return anomalies


def check_missing_po(po_found: bool) -> list[AnomalyResult]:
    """Flag if no matching PO was found for the invoice."""
    if not po_found:
        return [AnomalyResult(
            type="missing_po",
            severity="critical",
            description="No matching purchase order found for this invoice",
        )]
    return []


def check_missing_receipt(line_matches: list[dict]) -> list[AnomalyResult]:
    """Flag if no delivery receipt was found for any line items."""
    has_delivery = any(m.get("delivery_line_item_id") for m in line_matches)
    if not has_delivery and line_matches:
        return [AnomalyResult(
            type="missing_receipt",
            severity="warning",
            description="No delivery receipt found for any invoice line items",
        )]
    return []


def check_date_anomalies(
    invoice_date: date | None,
    po_issue_date: date | None,
) -> list[AnomalyResult]:
    """Flag if invoice date is before PO issue date."""
    if invoice_date and po_issue_date and invoice_date < po_issue_date:
        return [AnomalyResult(
            type="date_anomaly",
            severity="warning",
            description=(
                f"Invoice date ({invoice_date}) is before "
                f"PO issue date ({po_issue_date})"
            ),
            expected_value=str(po_issue_date),
            actual_value=str(invoice_date),
        )]
    return []


def check_amount_exceeds_po(
    invoice_total: float | None,
    po_total: float | None,
) -> list[AnomalyResult]:
    """Flag if invoice total exceeds PO total."""
    if invoice_total is not None and po_total is not None:
        if invoice_total > po_total:
            diff_pct = (invoice_total - po_total) / po_total * 100
            return [AnomalyResult(
                type="amount_exceeds_po",
                severity="critical" if diff_pct > 10 else "warning",
                description=(
                    f"Invoice total ({invoice_total}) exceeds "
                    f"PO total ({po_total}) by {diff_pct:.1f}%"
                ),
                expected_value=str(po_total),
                actual_value=str(invoice_total),
                deviation_pct=round(diff_pct, 2),
            )]
    return []


def check_duplicate(is_duplicate: bool) -> list[AnomalyResult]:
    """Flag duplicate invoice number."""
    if is_duplicate:
        return [AnomalyResult(
            type="duplicate_invoice",
            severity="critical",
            description="An invoice with this number already exists in the system",
        )]
    return []


def check_unauthorized_vendor(vendor_found: bool) -> list[AnomalyResult]:
    """Flag if the vendor is not recognized in the system."""
    if not vendor_found:
        return [AnomalyResult(
            type="unauthorized_vendor",
            severity="critical",
            description="Invoice vendor is not registered in the system",
        )]
    return []


def run_all_checks(
    line_matches: list[dict],
    po_found: bool,
    vendor_found: bool,
    is_duplicate: bool,
    invoice_date: date | None = None,
    po_issue_date: date | None = None,
    invoice_total: float | None = None,
    po_total: float | None = None,
) -> list[AnomalyResult]:
    """Run all anomaly checks and return combined results."""
    anomalies: list[AnomalyResult] = []
    anomalies.extend(check_duplicate(is_duplicate))
    anomalies.extend(check_unauthorized_vendor(vendor_found))
    anomalies.extend(check_missing_po(po_found))
    anomalies.extend(check_missing_receipt(line_matches))
    anomalies.extend(check_price_deviations(line_matches))
    anomalies.extend(check_quantity_mismatches(line_matches))
    anomalies.extend(check_date_anomalies(invoice_date, po_issue_date))
    anomalies.extend(check_amount_exceeds_po(invoice_total, po_total))
    return anomalies
