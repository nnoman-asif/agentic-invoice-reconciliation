"""Parser Agent: extracts structured data from invoice documents."""

from __future__ import annotations

import json
import logging

from langchain_ollama import ChatOllama

from app.config import settings
from app.tools.pdf_extractor import extract_invoice_text

logger = logging.getLogger(__name__)

PARSER_SYSTEM_PROMPT = """You are an invoice data extraction specialist. Given the raw text of an invoice document, extract all relevant structured information.

You MUST respond with valid JSON only. No additional text or explanation.

Extract the following fields:
{
  "invoice_number": "the invoice number/ID",
  "vendor_name": "the vendor/supplier company name",
  "vendor_tax_id": "vendor tax ID if present, else null",
  "po_reference": "referenced purchase order number if present, else null",
  "invoice_date": "YYYY-MM-DD format",
  "due_date": "YYYY-MM-DD format if present, else null",
  "total_amount": numeric value (no currency symbol),
  "tax_amount": numeric value if present, else null,
  "currency": "3-letter currency code, default USD",
  "line_items": [
    {
      "line_number": 1,
      "item_code": "item/part code if present, else null",
      "item_description": "description of the item",
      "quantity": numeric value,
      "unit_price": numeric value,
      "total_price": numeric value,
      "unit_of_measure": "unit if present, else null"
    }
  ]
}

Rules:
- Extract ALL line items found in the invoice
- If a field is not found in the document, set it to null
- Amounts must be plain numbers without currency symbols
- Dates must be in YYYY-MM-DD format
- Be precise with quantities and prices"""


def parse_invoice(state: dict) -> dict:
    """Extract structured data from an invoice file using LLM."""
    invoice_id = state["invoice_id"]
    logger.info(f"[ParserAgent] Parsing invoice {invoice_id}")

    raw_file_path = state.get("raw_file_path", "")
    content_type = state.get("file_content_type")

    try:
        raw_text = extract_invoice_text(raw_file_path, content_type)
    except FileNotFoundError:
        return {**state, "error": f"Invoice file not found: {raw_file_path}"}

    if not raw_text.strip():
        return {**state, "error": "No text could be extracted from the invoice file"}

    llm = ChatOllama(
        model=settings.ollama_llm_model,
        base_url=settings.ollama_base_url,
        temperature=0,
        format="json",
    )

    messages = [
        ("system", PARSER_SYSTEM_PROMPT),
        ("human", f"Extract structured data from this invoice:\n\n{raw_text}"),
    ]

    try:
        response = llm.invoke(messages)
        parsed = json.loads(response.content)
    except json.JSONDecodeError as e:
        return {**state, "error": f"LLM returned invalid JSON: {e}"}
    except Exception as e:
        return {**state, "error": f"LLM parsing failed: {e}"}

    return {
        **state,
        "raw_text": raw_text,
        "parsed_data": parsed,
        "invoice_number": parsed.get("invoice_number"),
        "vendor_name": parsed.get("vendor_name"),
        "vendor_tax_id": parsed.get("vendor_tax_id"),
        "po_reference": parsed.get("po_reference"),
        "invoice_date": parsed.get("invoice_date"),
        "due_date": parsed.get("due_date"),
        "total_amount": parsed.get("total_amount"),
        "tax_amount": parsed.get("tax_amount"),
        "line_items": parsed.get("line_items", []),
    }
