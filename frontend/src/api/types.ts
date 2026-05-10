// Mirrors app/models/schemas.py

export type ProcessingStatus =
  | "queued"
  | "parsing"
  | "matching"
  | "resolving"
  | "completed"
  | "failed"

export type BusinessStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "pending_review"
  | "cancelled"

export type MatchType = "full_match" | "partial_match" | "no_match"

export type ReconciliationStatus =
  | "auto_approved"
  | "pending_review"
  | "approved"
  | "rejected"

export type LineMatchStatus = "matched" | "partial" | "mismatch" | "unmatched"

export type DiscrepancyType =
  | "duplicate_invoice"
  | "price_deviation"
  | "quantity_mismatch"
  | "missing_po"
  | "missing_receipt"
  | "date_anomaly"
  | "amount_exceeds_po"
  | "unauthorized_vendor"

export type Severity = "critical" | "warning" | "info"

export type ReviewDecision = "approved" | "rejected"

export interface InvoiceLineItem {
  id: string
  line_number: number
  item_code: string | null
  item_description: string
  quantity: number
  unit_price: number
  total_price: number
  unit_of_measure: string | null
}

export interface POLineItem extends InvoiceLineItem {}

export interface DeliveryLineItem {
  id: string
  po_line_item_id: string | null
  item_description: string
  quantity_received: number
  quantity_accepted: number
  quantity_rejected: number
}

export interface InvoiceListItem {
  id: string
  invoice_number: string | null
  vendor_id: string | null
  total_amount: number | null
  processing_status: ProcessingStatus
  business_status: BusinessStatus
  created_at: string
}

export interface Invoice {
  id: string
  invoice_number: string | null
  po_reference: string | null
  vendor_id: string | null
  invoice_date: string | null
  due_date: string | null
  total_amount: number | null
  tax_amount: number | null
  currency: string
  processing_status: ProcessingStatus
  business_status: BusinessStatus
  raw_file_path: string | null
  file_content_type: string | null
  parsed_data: Record<string, unknown> | null
  error_message: string | null
  created_at: string
  updated_at: string
  line_items: InvoiceLineItem[]
}

export interface InvoiceUploadResponse {
  id: string
  processing_status: ProcessingStatus
  business_status: BusinessStatus
  raw_file_path: string | null
  created_at: string
}

export interface PurchaseOrderListItem {
  id: string
  po_number: string
  vendor_id: string
  issue_date: string
  status: string
  total_amount: number
  currency: string
  created_at: string
}

export interface PurchaseOrder extends PurchaseOrderListItem {
  expected_delivery_date: string | null
  notes: string | null
  updated_at: string
  line_items: POLineItem[]
}

/**
 * Compact view of an invoice that has reconciled against a PO.
 * Used by the PO detail sheet's "Matched Invoices" tab.
 */
export interface MatchedInvoiceForPO {
  invoice_id: string
  invoice_number: string | null
  business_status: string
  total_amount: number | null
  reconciliation_id: string
  match_type: string
  overall_status: string
  discrepancies_count: number
}

/** Per-row result from a bulk CSV import. */
export interface ImportRowResult {
  row: number
  identifier: string | null
  reason: string | null
  id: string | null
}

/**
 * Partial-success result for a CSV import endpoint.
 *
 * `imported` succeeded, `skipped` are non-fatal (already exists,
 * duplicate within the file), and `errors` need user attention.
 */
export interface ImportResponse {
  imported: ImportRowResult[]
  skipped: ImportRowResult[]
  errors: ImportRowResult[]
}

export interface DeliveryReceipt {
  id: string
  receipt_number: string
  po_id: string
  received_date: string
  receiver_name: string | null
  status: string
  notes: string | null
  created_at: string
  line_items: DeliveryLineItem[]
}

export interface LineItemMatch {
  id: string
  invoice_line_item_id: string
  po_line_item_id: string | null
  delivery_line_item_id: string | null
  status: LineMatchStatus
  description_similarity: number | null
  quantity_invoiced: number | null
  quantity_ordered: number | null
  quantity_delivered: number | null
  price_invoiced: number | null
  price_ordered: number | null
  price_deviation_pct: number | null
}

export interface Discrepancy {
  id: string
  reconciliation_id: string
  line_item_match_id: string | null
  type: DiscrepancyType
  severity: Severity
  description: string
  expected_value: string | null
  actual_value: string | null
  deviation_pct: number | null
  created_at: string
}

export interface HumanReview {
  id: string
  reconciliation_id: string
  decision: ReviewDecision
  reviewer_notes: string | null
  decided_by: string | null
  decided_at: string
}

export interface Reconciliation {
  id: string
  invoice_id: string
  po_id: string | null
  match_type: MatchType
  overall_status: ReconciliationStatus
  confidence_score: number | null
  agent_recommendation: string | null
  recommendation_reasoning: string | null
  trace_id: string | null
  processing_time_ms: number | null
  created_at: string
  updated_at: string
  line_item_matches: LineItemMatch[]
  discrepancies: Discrepancy[]
  human_reviews: HumanReview[]
}

export interface DashboardStats {
  total_invoices: number
  by_processing_status: Record<string, number>
  by_business_status: Record<string, number>
  total_reconciliations: number
  match_rate: Record<string, number>
  avg_processing_time_ms: number | null
  /** Top-10 discrepancy types by count, for the chart. */
  top_discrepancy_types: Record<string, number>
  /** Sum across all discrepancy rows -- use this when displaying a total. */
  total_discrepancies: number
}

export interface HealthResponse {
  status: string
  postgres: string
  redis: string
  ollama: string
}

export interface ReviewRequest {
  reviewer_notes?: string | null
  decided_by?: string | null
}
