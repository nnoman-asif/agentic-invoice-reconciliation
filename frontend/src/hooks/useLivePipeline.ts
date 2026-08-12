import { useEffect, useMemo, useRef, useState } from "react"
import { useInvoice, useInvoiceReconciliation } from "@/api/invoices"
import type { ProcessingStatus } from "@/api/types"
import { queueStatusLabel } from "@/components/invoice/ProcessingStatusBadge"

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

/** Return shape of `useLivePipeline`, exported so consumers can pass
 *  the result down as a prop instead of re-running the hook (which
 *  would create a second `displayedIndex` state and let the sidebar
 *  and the visualizer drift out of sync). */
export interface LivePipeline {
  stages: AgentStageState[]
  invoice:
    | NonNullable<ReturnType<typeof useInvoice>["data"]>
    | undefined
  isProcessing: boolean
  isFailed: boolean
  totalProcessingMs: number | null
  /**
   * The processing_status value that the visualizer is *displaying*
   * right now. Differs from `invoice.processing_status` while the
   * catch-up animation is mid-flight (server may already say
   * "completed" while the UI is still walking matcher → anomaly →
   * resolving). Lets sidebars/badges stay in sync with the canvas.
   */
  displayedStatus: ProcessingStatus | undefined
  /** Human-readable queue / throttle hint while status is queued. */
  queueMessage: string | null
}

const INDEX_TO_STATUS: Record<number, ProcessingStatus> = {
  0: "parsing",
  1: "matching",
  2: "detecting",
  3: "resolving",
  4: "completed",
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
    description: "LLM recommends; deterministic rules decide auto-approve or human review",
  },
]

// Maps an invoice's processing_status to the index of the stage
// that's "running" (or 4 / -2 / -1 for special states).
//   * queued maps to -1 so stages stay idle while we surface the
//     queue-position / high-traffic message instead of a fake parser spin.
//   * "detecting" exists so the anomaly node has a status to live
//     under, otherwise the matcher would flip straight to "resolving"
//     and the anomaly node would never appear active.
const STATUS_TO_INDEX: Record<ProcessingStatus, number> = {
  queued: -1,
  parsing: 0,
  matching: 1,
  detecting: 2,
  resolving: 3,
  completed: 4,
  failed: -2,
}

// How long each intermediate stage stays visible while the visualizer
// catches up to a new server status. Several agents (matcher, anomaly,
// resolution) frequently complete in under 100ms, much faster than the
// 1.5s polling interval, so without this throttle the UI would jump
// from "parser running" straight to "all done" and the user would
// never see the in-between stages light up. Cosmetic only; doesn't
// alter underlying data.
const STAGE_ADVANCE_MS = 1000

export function useLivePipeline(invoiceId: string | undefined) {
  const { data: invoice } = useInvoice(invoiceId)
  const { data: recon } = useInvoiceReconciliation(invoiceId, {
    invoiceProcessingStatus: invoice?.processing_status,
  })

  // Server-driven "where the pipeline really is" index.
  // -1 = no invoice yet, -2 = failed, 0-3 = stage running, 4 = done.
  const serverIndex = invoice
    ? STATUS_TO_INDEX[invoice.processing_status] ?? -1
    : -1

  // Cosmetic "where the visualizer is showing" index. Tracks
  // serverIndex with a small throttled lag so each stage gets visible
  // air time even when the backend rips through them.
  const [displayedIndex, setDisplayedIndex] = useState(serverIndex)
  const lastInvoiceId = useRef(invoiceId)
  // Tracks whether we've already seen an invoice payload land for the
  // current id. The very first invoice fetch flips this to true and we
  // snap to whatever state the server reports -- so a page refresh on
  // a completed invoice shows it as completed instantly instead of
  // re-playing the entire 0 → 4 animation.
  const hasSnappedToInitial = useRef(false)

  useEffect(() => {
    // Switching invoices: reset the snap guard so the new invoice's
    // first server value also snaps immediately.
    if (lastInvoiceId.current !== invoiceId) {
      lastInvoiceId.current = invoiceId
      hasSnappedToInitial.current = false
      setDisplayedIndex(serverIndex)
      return
    }
    // First time we ever see real data for this invoice (-1 means
    // invoice query hasn't resolved yet). Snap, don't animate.
    if (!hasSnappedToInitial.current && serverIndex !== -1) {
      hasSnappedToInitial.current = true
      setDisplayedIndex(serverIndex)
      return
    }
    // Failed: jump straight there so the error stage lights up now.
    if (serverIndex === -2) {
      setDisplayedIndex(-2)
      return
    }
    // Already caught up (or ahead, if the server somehow regressed).
    if (displayedIndex >= serverIndex) {
      if (displayedIndex !== serverIndex) setDisplayedIndex(serverIndex)
      return
    }
    // Behind by one or more stages -> tick forward by one with a delay.
    const timer = window.setTimeout(() => {
      setDisplayedIndex((prev) => Math.min(prev + 1, serverIndex))
    }, STAGE_ADVANCE_MS)
    return () => window.clearTimeout(timer)
  }, [serverIndex, displayedIndex, invoiceId])

  return useMemo<LivePipeline>(() => {
    // Drive `isProcessing`, the badge label, and `totalProcessingMs`
    // from `displayedIndex` rather than the raw server status.
    // Otherwise the server may report "completed" while the catch-up
    // animation is still walking through stages 1..3, producing a
    // contradictory header that says "Completed · 0/4 stages" with a
    // spinning Parser node underneath.
    const currentIndex = displayedIndex
    const isFailed = currentIndex === -2
    const isQueued = invoice?.processing_status === "queued"
    const isAnimating = currentIndex >= 0 && currentIndex < 4
    const isProcessing = isAnimating || isQueued

    // When the pipeline failed, the parser is the most common culprit
    // but not the only one -- if `parsed_data` is populated the parser
    // clearly succeeded, so blame the next-most-likely stage instead.
    // Any stages before the failed one are kept "completed" so the
    // visualizer reflects how far the pipeline actually got.
    let failureIndex = -1
    if (currentIndex === -2) {
      failureIndex = invoice?.parsed_data ? 1 : 0
    }

    const stages: AgentStageState[] = STAGES.map((stage, idx) => {
      let status: StageStatus = "idle"

      if (currentIndex === -2) {
        if (idx < failureIndex) status = "completed"
        else if (idx === failureIndex) status = "error"
        else status = "idle"
      } else if (currentIndex === 4) {
        status = "completed"
      } else if (idx < currentIndex) {
        status = "completed"
      } else if (idx === currentIndex) {
        status = "running"
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
    }

    let displayedStatus: ProcessingStatus | undefined
    if (isQueued) displayedStatus = "queued"
    else if (currentIndex === -2) displayedStatus = "failed"
    else if (currentIndex >= 0 && currentIndex <= 4) {
      displayedStatus = INDEX_TO_STATUS[currentIndex]
    }

    const queueMessage = isQueued
      ? queueStatusLabel(
          invoice?.queue_position,
          invoice?.provider_throttled
        ) ?? "Waiting in queue"
      : null

    return {
      stages,
      invoice,
      isProcessing,
      isFailed,
      // Whole-pipeline wall time. Surface this once at the top of the
      // visualizer instead of attaching it to a single stage -- the
      // previous code stuck this on stages[3] which made it look like
      // the resolution agent took 34s when in reality the parser was
      // the slow one. Withheld until the catch-up animation reaches
      // the final node so the header doesn't trumpet "Total time" on
      // top of a still-spinning visualization.
      totalProcessingMs:
        currentIndex === 4 ? recon?.processing_time_ms ?? null : null,
      displayedStatus,
      queueMessage,
    }
  }, [invoice, recon, displayedIndex])
}

export const PIPELINE_STAGES = STAGES
