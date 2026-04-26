"""Generate sample invoice PDFs for testing the reconciliation pipeline.

Usage:
    python -m sample_data.generate_sample_pdfs

Requires: pip install reportlab
"""

import os
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "invoices")


def generate_invoice_1_clean_match():
    """Invoice that perfectly matches PO-2026-001 (clean match scenario)."""
    path = os.path.join(OUTPUT_DIR, "invoice_clean_match.pdf")
    doc = SimpleDocTemplate(path, pagesize=letter)
    styles = getSampleStyleSheet()
    elements = []

    elements.append(Paragraph("<b>ACME INDUSTRIAL SUPPLIES</b>", styles["Title"]))
    elements.append(Paragraph("123 Industrial Park, Houston, TX 77001", styles["Normal"]))
    elements.append(Paragraph("Tax ID: TAX-ACME-9821", styles["Normal"]))
    elements.append(Spacer(1, 0.3 * inch))

    elements.append(Paragraph("<b>INVOICE</b>", styles["Heading1"]))
    elements.append(Spacer(1, 0.2 * inch))

    info_data = [
        ["Invoice Number:", "INV-2026-0142"],
        ["Invoice Date:", "February 15, 2026"],
        ["Due Date:", "March 17, 2026"],
        ["PO Reference:", "PO-2026-001"],
    ]
    info_table = Table(info_data, colWidths=[2 * inch, 3 * inch])
    info_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 0.3 * inch))

    line_data = [
        ["#", "Item Code", "Description", "Qty", "Unit", "Unit Price", "Total"],
        ["1", "BOLT-M8X50", "Steel Bolts M8x50mm Grade 8.8", "500", "pcs", "$5.50", "$2,750.00"],
        ["2", "NUT-M8", "Hex Nuts M8 Zinc Plated", "500", "pcs", "$2.00", "$1,000.00"],
        ["3", "WSHR-M8", "Flat Washers M8 Stainless", "1000", "pcs", "$12.00", "$12,000.00"],
    ]
    line_table = Table(line_data, colWidths=[0.4 * inch, 1 * inch, 2.2 * inch, 0.5 * inch, 0.5 * inch, 0.8 * inch, 1 * inch])
    line_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2c3e50")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
    ]))
    elements.append(line_table)
    elements.append(Spacer(1, 0.3 * inch))

    totals = [
        ["", "", "", "", "", "Subtotal:", "$15,750.00"],
        ["", "", "", "", "", "Tax (0%):", "$0.00"],
        ["", "", "", "", "", "TOTAL:", "$15,750.00"],
    ]
    totals_table = Table(totals, colWidths=[0.4 * inch, 1 * inch, 2.2 * inch, 0.5 * inch, 0.5 * inch, 0.8 * inch, 1 * inch])
    totals_table.setStyle(TableStyle([
        ("FONTNAME", (5, 2), (6, 2), "Helvetica-Bold"),
        ("ALIGN", (5, 0), (-1, -1), "RIGHT"),
        ("LINEABOVE", (5, 2), (6, 2), 1, colors.black),
    ]))
    elements.append(totals_table)

    doc.build(elements)
    print(f"  Generated: {path}")


def generate_invoice_2_price_deviation():
    """Invoice with price deviation from PO-2026-002 (exception scenario)."""
    path = os.path.join(OUTPUT_DIR, "invoice_price_deviation.pdf")
    doc = SimpleDocTemplate(path, pagesize=letter)
    styles = getSampleStyleSheet()
    elements = []

    elements.append(Paragraph("<b>GLOBAL STEEL CORPORATION</b>", styles["Title"]))
    elements.append(Paragraph("456 Steel Avenue, Pittsburgh, PA 15201", styles["Normal"]))
    elements.append(Paragraph("Tax ID: TAX-GSC-4455", styles["Normal"]))
    elements.append(Spacer(1, 0.3 * inch))

    elements.append(Paragraph("<b>INVOICE</b>", styles["Heading1"]))
    elements.append(Spacer(1, 0.2 * inch))

    info_data = [
        ["Invoice Number:", "GSC-INV-8834"],
        ["Invoice Date:", "February 20, 2026"],
        ["Due Date:", "March 22, 2026"],
        ["PO Reference:", "PO-2026-002"],
    ]
    info_table = Table(info_data, colWidths=[2 * inch, 3 * inch])
    info_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 0.3 * inch))

    # Note: price deviations - steel plate 10mm is $1,260 instead of $1,200 (5% over)
    line_data = [
        ["#", "Code", "Description", "Qty", "Unit Price", "Total"],
        ["1", "SP-10MM", "Hot Rolled Steel Plate 10mm", "20", "$1,260.00", "$25,200.00"],
        ["2", "SP-5MM", "Cold Rolled Steel Plate 5mm", "30", "$800.00", "$24,000.00"],
        ["3", "SC-FLAT", "Steel Cutting Service - Flat", "1", "$200.00", "$200.00"],
    ]
    line_table = Table(line_data, colWidths=[0.4 * inch, 0.8 * inch, 2.5 * inch, 0.5 * inch, 1 * inch, 1.2 * inch])
    line_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a5276")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
    ]))
    elements.append(line_table)
    elements.append(Spacer(1, 0.3 * inch))

    elements.append(Paragraph("<b>Total Due: $49,400.00</b>", styles["Heading2"]))

    doc.build(elements)
    print(f"  Generated: {path}")


def generate_invoice_3_quantity_mismatch():
    """Invoice with quantity mismatch for PO-2026-003 (partial delivery scenario)."""
    path = os.path.join(OUTPUT_DIR, "invoice_qty_mismatch.pdf")
    doc = SimpleDocTemplate(path, pagesize=letter)
    styles = getSampleStyleSheet()
    elements = []

    elements.append(Paragraph("<b>Precision Parts Manufacturing</b>", styles["Title"]))
    elements.append(Paragraph("789 Precision Blvd, Detroit, MI 48201", styles["Normal"]))
    elements.append(Paragraph("Tax ID: TAX-PPM-7712", styles["Normal"]))
    elements.append(Spacer(1, 0.3 * inch))

    elements.append(Paragraph("<b>INVOICE</b>", styles["Heading1"]))
    elements.append(Spacer(1, 0.2 * inch))

    info_data = [
        ["Invoice #:", "PPM-INV-2026-055"],
        ["Date:", "January 28, 2026"],
        ["Due:", "February 27, 2026"],
        ["PO:", "PO-2026-003"],
    ]
    info_table = Table(info_data, colWidths=[1.5 * inch, 3 * inch])
    info_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 0.3 * inch))

    # Note: invoicing for 100 bearings 6205 but only 80 were delivered
    line_data = [
        ["Item", "Qty", "Price", "Total"],
        ["Ball Bearing 6205-2RS (BRG-6205)", "100 pcs", "$47.25", "$4,725.00"],
        ["Ball Bearing 6208-2RS (BRG-6208)", "60 pcs", "$72.00", "$4,320.00"],
        ["Bearing Seal 6205 Rubber (SEAL-6205)", "100 pcs", "$5.40", "$540.00"],
    ]
    line_table = Table(line_data, colWidths=[3 * inch, 1 * inch, 1 * inch, 1.2 * inch])
    line_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#6c3483")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
    ]))
    elements.append(line_table)
    elements.append(Spacer(1, 0.3 * inch))

    elements.append(Paragraph("Subtotal: $9,585.00", styles["Normal"]))
    elements.append(Paragraph("Sales Tax (5%): $479.25", styles["Normal"]))
    elements.append(Paragraph("<b>TOTAL: $10,064.25</b>", styles["Heading2"]))

    doc.build(elements)
    print(f"  Generated: {path}")


if __name__ == "__main__":
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print("Generating sample invoice PDFs...")
    generate_invoice_1_clean_match()
    generate_invoice_2_price_deviation()
    generate_invoice_3_quantity_mismatch()
    print("\nDone! PDFs saved to:", OUTPUT_DIR)
