import { useMemo } from "react"
import { useInvoice, useInvoiceReconciliation } from "@/api/invoices"
import type { ProcessingStatus } from "@/api/types"

export type AgentStage =
  | "parser"
  | "matcher"
  | "anomaly"
  | "resolution"

export type StageStatus = "idle" | "running" | "completed" | "error"

export interface AgentStageState {
  id: AgentStage
  label: string
  description: string
  status: StageStatus
  duration?: number
  output?: Record<string, unknown>
}

const STAGES: { id: AgentStage; label: string; description: string }[] = [
  {
    id: "parser",
    label: "Parser",
    description: "Extracts structured data from invoice PDF using LLM",
  },
  {
    id: "matcher",
    label: "Matcher",
    description: "Finds matching PO and delivery receipts, runs 3-way matching",
  },
  {
    id: "anomaly",
    label: "Anomaly",
    description: "Runs 8 deterministic checks for discrepancies",
  },
  {
    id: "resolution",
    label: "Resolution",
    description: "LLM + RAG decides auto-approve or human review",
  },
]

// Maps an invoice's processing_status to the index of the stage
// that's "running" (or -1 / -2 for special states).
//   * queued maps to 0 so the parser node lights up "running" the
//     moment the upload is enqueued -- previously queued mapped to
//     -1, which left every stage idle and made it look like nothing
//     was happening even though work was imminent.
const STATUS_TO_INDEX: Record<ProcessingStatus, number> = {
  queued: 0,
  parsing: 0,
  matching: 1,
  resolving: 3, // resolution agent runs during this status
  completed: 4,
  failed: -2,
}

export function useLivePipeline(invoiceId: string | undefined) {
  const { data: invoice } = useInvoice(invoiceId)
  const { data: recon } = useInvoiceReconciliation(invoiceId, {
    invoiceProcessingStatus: invoice?.processing_status,
  })

  return useMemo<{
    stages: AgentStageState[]
    invoice: typeof invoice
    isProcessing: boolean
    isFailed: boolean
  }>(() => {
    const isFailed = invoice?.processing_status === "failed"
    const isProcessing =
      !!invoice &&
      invoice.processing_status !== "completed" &&
      invoice.processing_status !== "failed"

    // Fall back to -1 for any unknown status string the backend might
    // return so the UI doesn't render `undefined` comparisons that
    // produce nonsense stage states.
    const currentIndex = invoice
      ? STATUS_TO_INDEX[invoice.processing_status] ?? -1
      : -1

    const stages: AgentStageState[] = STAGES.map((stage, idx) => {
      let status: StageStatus = "idle"

      if (currentIndex === -2) {
        // failed: mark first stage as error or whatever was running
        status = idx === 0 ? "error" : "idle"
      } else if (currentIndex === 4) {
        // all completed
        status = "completed"
      } else if (idx < currentIndex) {
        status = "completed"
      } else if (idx === currentIndex) {
        status = "running"
      } else if (currentIndex >= 1 && idx === 2 && currentIndex >= 2) {
        // anomaly typically runs together with matching
        status = "completed"
      } else {
        status = "idle"
      }

      return {
        id: stage.id,
        label: stage.label,
        description: stage.description,
        status,
      }
    })

    // Enrich with reconciliation outputs once available
    if (recon) {
      stages[0].output = {
        invoice_number: invoice?.invoice_number,
        vendor_id: invoice?.vendor_id,
        line_items: invoice?.line_items?.length ?? 0,
      }
      stages[1].output = {
        match_type: recon.match_type,
        line_matches: recon.line_item_matches.length,
        po_id: recon.po_id,
      }
      stages[2].output = {
        discrepancies: recon.discrepancies.length,
        critical: recon.discrepancies.filter((d) => d.severity === "critical")
          .length,
      }
      stages[3].output = {
        overall_status: recon.overall_status,
        confidence: recon.confidence_score,
      }
      stages[3].duration = recon.processing_time_ms ?? undefined
    }

    return {
      stages,
      invoice,
      isProcessing,
      isFailed,
    }
  }, [invoice, recon])
}

export const PIPELINE_STAGES = STAGES
