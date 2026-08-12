"""Pre-provider PDF safety checks for invoice uploads."""

from __future__ import annotations

import re
from dataclasses import dataclass

import fitz  # PyMuPDF

PDF_MAGIC = b"%PDF-"

_INVOICE_MARKERS = (
    "invoice",
    "bill",
    "total",
    "amount due",
    "quantity",
    "unit price",
    "subtotal",
    "tax",
    "purchase order",
)

# Currency-like decimals: 1,234.56 or 1234.56 or 1.234,56 (loose)
_DECIMAL_RE = re.compile(r"\d{1,3}(?:[.,]\d{3})*[.,]\d{2}|\d+[.,]\d{2}")


@dataclass(frozen=True)
class ValidationResult:
    ok: bool
    reason: str | None = None
    text: str | None = None
    page_count: int | None = None


def validate_pdf(
    content: bytes,
    *,
    max_pages: int,
    max_chars: int,
) -> ValidationResult:
    """Validate a PDF before any LLM / embedding call.

    Returns ``ok=False`` with a human-readable ``reason`` on rejection,
    or ``ok=True`` with extracted ``text`` on success. Never truncates
    oversize text — oversized documents are rejected outright.
    """
    if not content:
        return ValidationResult(ok=False, reason="File is empty")

    if not content.startswith(PDF_MAGIC):
        return ValidationResult(
            ok=False,
            reason="File content is not a valid PDF (missing %PDF- header).",
        )

    try:
        doc = fitz.open(stream=content, filetype="pdf")
    except Exception as exc:
        return ValidationResult(
            ok=False,
            reason=f"Could not open this PDF ({exc.__class__.__name__})",
        )

    try:
        if doc.needs_pass:
            return ValidationResult(
                ok=False,
                reason="This PDF is password protected",
            )

        page_count = doc.page_count
        if page_count > max_pages:
            return ValidationResult(
                ok=False,
                reason=(
                    f"PDF has {page_count} pages; "
                    f"maximum allowed is {max_pages}"
                ),
                page_count=page_count,
            )

        pages: list[str] = []
        for page in doc:
            pages.append(page.get_text() or "")
        text = "\n\n".join(pages).strip()

        if len(text) > max_chars:
            return ValidationResult(
                ok=False,
                reason=(
                    f"Extracted text is {len(text)} characters; "
                    f"maximum allowed is {max_chars}"
                ),
                page_count=page_count,
            )

        if not text:
            return ValidationResult(
                ok=False,
                reason="This looks like a scanned PDF; OCR is not enabled",
                page_count=page_count,
            )

        lower = text.lower()
        marker_hits = sum(1 for marker in _INVOICE_MARKERS if marker in lower)
        decimal_hits = len(_DECIMAL_RE.findall(text))
        if marker_hits < 2 or decimal_hits < 2:
            return ValidationResult(
                ok=False,
                reason=(
                    "This does not look like an invoice "
                    "(need invoice keywords and amount-like numbers)"
                ),
                page_count=page_count,
            )

        return ValidationResult(
            ok=True,
            text=text,
            page_count=page_count,
        )
    finally:
        doc.close()
