"""Demo scenario definitions (sample PDFs + system POs)."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

# Project root: app/demo/scenarios.py -> parents[2]
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
_SAMPLE_DIR = _PROJECT_ROOT / "sample_data" / "invoices"


@dataclass(frozen=True)
class DemoScenario:
    id: str
    title: str
    description: str
    pdf_filename: str
    po_number: str
    expected_outcome: str

    @property
    def pdf_path(self) -> Path:
        return _SAMPLE_DIR / self.pdf_filename


SCENARIOS: dict[str, DemoScenario] = {
    "clean_match": DemoScenario(
        id="clean_match",
        title="Clean match",
        description="Invoice lines match PO-2026-001 and delivery — typically auto-approved.",
        pdf_filename="invoice_clean_match.pdf",
        po_number="PO-2026-001",
        expected_outcome="auto_approved",
    ),
    "price_deviation": DemoScenario(
        id="price_deviation",
        title="Price deviation",
        description="Unit prices diverge from PO-2026-002 — routed to human review.",
        pdf_filename="invoice_price_deviation.pdf",
        po_number="PO-2026-002",
        expected_outcome="pending_review",
    ),
    "qty_mismatch": DemoScenario(
        id="qty_mismatch",
        title="Quantity mismatch",
        description="Invoiced quantity exceeds delivered amount on PO-2026-003.",
        pdf_filename="invoice_qty_mismatch.pdf",
        po_number="PO-2026-003",
        expected_outcome="pending_review",
    ),
}


def get_scenario(scenario_id: str) -> DemoScenario | None:
    return SCENARIOS.get(scenario_id)


def list_scenarios() -> list[DemoScenario]:
    return list(SCENARIOS.values())
