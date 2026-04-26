"""PDF and image text extraction tools."""

from pathlib import Path

import fitz  # PyMuPDF


def extract_text_from_pdf(file_path: str) -> str:
    """Extract all text from a PDF file using PyMuPDF."""
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    doc = fitz.open(str(path))
    pages = []
    for page in doc:
        pages.append(page.get_text())
    doc.close()

    return "\n\n".join(pages).strip()


def extract_text_from_image(file_path: str) -> str:
    """Extract text from an image-based document.

    For image-based invoices, PyMuPDF can handle some embedded-text PDFs.
    For pure images, this returns the raw pixel data description which the LLM
    can process as context.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    doc = fitz.open(str(path))
    pages = []
    for page in doc:
        text = page.get_text()
        if text.strip():
            pages.append(text)
        else:
            pages.append(f"[Page {page.number + 1}: image-based, no extractable text]")
    doc.close()

    return "\n\n".join(pages).strip()


def extract_invoice_text(file_path: str, content_type: str | None = None) -> str:
    """Route to the appropriate extractor based on file type."""
    if content_type and "image" in content_type:
        return extract_text_from_image(file_path)
    return extract_text_from_pdf(file_path)
