import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { GitCompare, FileSearch, FileText } from "lucide-react"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PDFViewer } from "./PDFViewer"
import { MatchedItemCard } from "./MatchedItemCard"
import { ConfidenceBar } from "@/components/shared/ConfidenceBar"
import { EmptyState } from "@/components/shared/EmptyState"
import { NoMatches } from "@/components/shared/illustrations/NoMatches"
import type { Invoice, Reconciliation } from "@/api/types"
import { apiClient } from "@/api/client"
import { cn } from "@/lib/utils"

interface Props {
  invoice: Invoice
  reconciliation: Reconciliation
}

interface LinePosition {
  id: string
  sourceY: number
  targetY: number
  status: string
}

const STATUS_COLOR: Record<string, string> = {
  matched: "rgb(16 185 129)",
  partial: "rgb(245 158 11)",
  mismatch: "rgb(239 68 68)",
  unmatched: "rgb(148 163 184)",
}

export function DocumentCompare({ invoice, reconciliation }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const middleRef = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [linePositions, setLinePositions] = useState<LinePosition[]>([])
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [fileError, setFileError] = useState<"expired" | "missing" | null>(
    null
  )

  // Authenticated blob fetch — the public /uploads mount is gone.
  useEffect(() => {
    if (invoice.file_deleted_at) {
      setFileError("expired")
      setFileUrl(null)
      return
    }

    let objectUrl: string | null = null
    let cancelled = false

    ;(async () => {
      try {
        const { data } = await apiClient.get<Blob>(
          `/api/invoices/${invoice.id}/file`,
          { responseType: "blob" }
        )
        if (cancelled) return
        objectUrl = URL.createObjectURL(data)
        setFileUrl(objectUrl)
        setFileError(null)
      } catch (err: unknown) {
        if (cancelled) return
        const status =
          err && typeof err === "object" && "response" in err
            ? (err as { response?: { status?: number } }).response?.status
            : undefined
        setFileError(status === 410 ? "expired" : "missing")
        setFileUrl(null)
      }
    })()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [invoice.id, invoice.file_deleted_at, invoice.raw_file_path])

  // Recompute the SVG endpoints whenever the layout changes. Anchors:
  //   * left side  = `[data-line-source="<invoiceLineId>"]` -- one of
  //     the parsed line items rendered in the middle column.
  //   * right side = `[data-match-id="<matchId>"]` -- the corresponding
  //     match card on the right.
  // Throttled with requestAnimationFrame to optimize rendering during scrolling.
  useEffect(() => {
    const middle = middleRef.current
    if (!middle) return

    let frame: number | null = null
    let pending = false

    const compute = () => {
      pending = false
      if (!middle) return
      const middleRect = middle.getBoundingClientRect()

      const next: LinePosition[] = []
      for (const match of reconciliation.line_item_matches) {
        const sourceEl = document.querySelector(
          `[data-line-source="${match.invoice_line_item_id}"]`
        ) as HTMLElement | null
        const targetEl = document.querySelector(
          `[data-match-id="${match.id}"]`
        ) as HTMLElement | null
        if (!sourceEl || !targetEl) continue

        const sourceRect = sourceEl.getBoundingClientRect()
        const targetRect = targetEl.getBoundingClientRect()
        next.push({
          id: match.id,
          sourceY:
            sourceRect.top + sourceRect.height / 2 - middleRect.top,
          targetY:
            targetRect.top + targetRect.height / 2 - middleRect.top,
          status: match.status,
        })
      }
      setLinePositions(next)
    }

    const schedule = () => {
      if (pending) return
      pending = true
      frame = window.requestAnimationFrame(compute)
    }

    // Initial compute (after first paint so refs are sized).
    schedule()

    const observer = new ResizeObserver(schedule)
    observer.observe(middle)
    if (containerRef.current) observer.observe(containerRef.current)

    window.addEventListener("scroll", schedule, true)
    window.addEventListener("resize", schedule)

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener("scroll", schedule, true)
      window.removeEventListener("resize", schedule)
    }
  }, [reconciliation.line_item_matches])

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-gradient-to-br from-blue-500/15 to-indigo-500/15 border border-blue-500/20 flex items-center justify-center">
            <GitCompare className="size-5 text-blue-500" />
          </div>
          <div>
            <div className="font-semibold">Reconciliation Compare</div>
            <div className="text-sm text-muted-foreground">
              Hover over any parsed line or match card to highlight its
              connection.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:w-64">
          <Badge variant="muted" className="capitalize">
            {reconciliation.match_type.replace(/_/g, " ")}
          </Badge>
          <ConfidenceBar
            value={reconciliation.confidence_score}
            label={false}
            size="sm"
            className="flex-1"
          />
        </div>
      </Card>

      <div
        ref={containerRef}
        className="relative grid grid-cols-1 lg:grid-cols-[1fr_280px_60px_1fr] gap-0 rounded-xl border border-border/60 bg-card overflow-hidden"
        style={{ minHeight: 720 }}
      >
        {/* COL 1 -- the original PDF */}
        <div className="flex flex-col lg:border-r border-border/60 bg-card overflow-hidden">
          {fileError === "expired" ? (
            <PdfExpired />
          ) : fileUrl ? (
            <PDFViewer fileUrl={fileUrl} />
          ) : (
            <PdfUnavailable />
          )}
        </div>

        {/* COL 2 -- parsed line items (always present so match lines have
             a real left-side anchor for every item, fixing bug M6). */}
        <div className="hidden lg:flex flex-col border-r border-border/60 bg-muted/10 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-muted/30">
            <FileSearch className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Parsed Lines</span>
            <Badge variant="muted" className="ml-auto">
              {invoice.line_items.length}
            </Badge>
          </div>
          <div className="flex-1 overflow-auto p-3 space-y-1.5">
            {invoice.line_items.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                The parser produced no line items.
              </p>
            ) : (
              invoice.line_items.map((line) => {
                // Find the match that points at this parsed line so we
                // can co-highlight on hover.
                const match = reconciliation.line_item_matches.find(
                  (m) => m.invoice_line_item_id === line.id
                )
                const isHovered = !!match && hovered === match.id
                return (
                  <button
                    key={line.id}
                    type="button"
                    data-line-source={line.id}
                    onMouseEnter={() => match && setHovered(match.id)}
                    onMouseLeave={() => setHovered(null)}
                    className={cn(
                      "w-full text-left rounded-lg border px-3 py-2 transition-colors",
                      isHovered
                        ? "border-primary/40 bg-primary/5"
                        : "border-border/40 hover:border-border bg-background"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-sm truncate">
                        {line.item_description || "—"}
                      </div>
                      <div className="font-mono text-xs tabular-nums shrink-0 text-muted-foreground">
                        ${(line.total_price ?? 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                      {line.item_code ?? "—"} · qty {line.quantity}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* COL 3 -- the SVG match-line gutter. Lines now anchor to the
             actual parsed-line buttons in COL 2 instead of falling back
             to "evenly distributed" coordinates. */}
        <div
          ref={middleRef}
          className="hidden lg:block relative overflow-hidden"
        >
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {linePositions.map((line) => {
              const color = STATUS_COLOR[line.status] ?? STATUS_COLOR.unmatched
              const isHovered = hovered === line.id
              return (
                <motion.path
                  key={line.id}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{
                    pathLength: 1,
                    opacity: isHovered ? 1 : 0.45,
                  }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  d={`M 0 ${line.sourceY} C 30 ${line.sourceY}, 30 ${line.targetY}, 60 ${line.targetY}`}
                  stroke={color}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  fill="none"
                  strokeDasharray={
                    line.status === "unmatched" ? "4 4" : undefined
                  }
                />
              )
            })}
          </svg>
        </div>

        {/* COL 4 -- match cards */}
        <div className="flex flex-col bg-muted/10 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-muted/30">
            <FileSearch className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Matched Records</span>
            <Badge variant="muted" className="ml-auto">
              {reconciliation.line_item_matches.length}
            </Badge>
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {reconciliation.line_item_matches.length === 0 ? (
              <EmptyState
                illustration={<NoMatches className="w-full" />}
                title="No matches"
                description="The agent could not find matching line items"
              />
            ) : (
              reconciliation.line_item_matches.map((match, i) => (
                <MatchedItemCard
                  key={match.id}
                  match={match}
                  index={i}
                  hovered={hovered === match.id}
                  onHover={setHovered}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function PdfExpired() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-muted/30">
        <FileText className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Invoice</span>
      </div>
      <div className="flex-1 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Original document expired. Parsed text and reconciliation results
        remain available.
      </div>
    </div>
  )
}

function PdfUnavailable() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-muted/30">
        <FileText className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Invoice</span>
      </div>
      <div className="flex-1 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Original PDF is not available for this invoice.
      </div>
    </div>
  )
}
