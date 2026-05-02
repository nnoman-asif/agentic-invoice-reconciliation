import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { GitCompare, FileSearch } from "lucide-react"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PDFViewer } from "./PDFViewer"
import { MatchedItemCard } from "./MatchedItemCard"
import { ConfidenceBar } from "@/components/shared/ConfidenceBar"
import { EmptyState } from "@/components/shared/EmptyState"
import { NoMatches } from "@/components/shared/illustrations/NoMatches"
import type { Invoice, Reconciliation } from "@/api/types"
import { API_BASE_URL } from "@/api/client"
import { cn } from "@/lib/utils"

interface Props {
  invoice: Invoice
  reconciliation: Reconciliation
}

export function DocumentCompare({ invoice, reconciliation }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [linePositions, setLinePositions] = useState<
    { id: string; sourceY: number; targetY: number; status: string }[]
  >([])

  const fileUrl = invoice.raw_file_path
    ? `${API_BASE_URL}/${invoice.raw_file_path}`
    : null

  // Calculate match line positions from line items in left panel to cards on right
  useEffect(() => {
    const calculate = () => {
      if (!containerRef.current) return
      const container = containerRef.current
      const containerRect = container.getBoundingClientRect()

      const positions = reconciliation.line_item_matches
        .map((match, idx) => {
          // Source: position of invoice line in left panel (we'll use evenly spaced fallback)
          const sourceEl = container.querySelector(
            `[data-line-source="${match.invoice_line_item_id}"]`
          ) as HTMLElement | null
          const targetEl = container.querySelector(
            `[data-match-id="${match.id}"]`
          ) as HTMLElement | null

          if (!targetEl) return null

          const targetRect = targetEl.getBoundingClientRect()
          const targetY = targetRect.top + targetRect.height / 2 - containerRect.top

          let sourceY: number
          if (sourceEl) {
            const sourceRect = sourceEl.getBoundingClientRect()
            sourceY = sourceRect.top + sourceRect.height / 2 - containerRect.top
          } else {
            // Fallback: evenly distribute on left side
            sourceY =
              ((idx + 1) / (reconciliation.line_item_matches.length + 1)) *
              containerRect.height
          }

          return {
            id: match.id,
            sourceY,
            targetY,
            status: match.status,
          }
        })
        .filter(Boolean) as typeof linePositions

      setLinePositions(positions)
    }

    calculate()
    const observer = new ResizeObserver(calculate)
    if (containerRef.current) observer.observe(containerRef.current)
    window.addEventListener("scroll", calculate, true)
    return () => {
      observer.disconnect()
      window.removeEventListener("scroll", calculate, true)
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
              Hover over a line on the right to see how it matches
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:w-64">
          <Badge variant="muted" className="capitalize">
            {reconciliation.match_type.replace("_", " ")}
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
        className="relative grid grid-cols-1 lg:grid-cols-[1fr_60px_1fr] gap-0 rounded-xl border border-border/60 bg-card overflow-hidden"
        style={{ minHeight: 720 }}
      >
        {/* LEFT: PDF or parsed text fallback */}
        <div className="flex flex-col lg:border-r border-border/60 bg-card overflow-hidden">
          {fileUrl ? (
            <PDFViewer fileUrl={fileUrl} />
          ) : (
            <ParsedInvoicePreview invoice={invoice} />
          )}
        </div>

        {/* MIDDLE: SVG match lines */}
        <div className="hidden lg:block relative overflow-hidden">
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="match-line" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
              </linearGradient>
            </defs>
            {linePositions.map((line) => {
              const color =
                line.status === "matched"
                  ? "rgb(16 185 129)"
                  : line.status === "partial"
                    ? "rgb(245 158 11)"
                    : line.status === "mismatch"
                      ? "rgb(239 68 68)"
                      : "rgb(148 163 184)"
              const isHovered = hovered === line.id
              return (
                <motion.path
                  key={line.id}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: isHovered ? 1 : 0.4 }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  d={`M 0 ${line.sourceY} C 30 ${line.sourceY}, 30 ${line.targetY}, 60 ${line.targetY}`}
                  stroke={color}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  fill="none"
                  strokeDasharray={line.status === "unmatched" ? "4 4" : undefined}
                />
              )
            })}
          </svg>
        </div>

        {/* RIGHT: Match cards */}
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

// Fallback when PDF can't be loaded - show parsed data styled as a document
function ParsedInvoicePreview({ invoice }: { invoice: Invoice }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-muted/30">
        <FileSearch className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Parsed Invoice Data</span>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-card border border-border/60 rounded-lg p-8 shadow-soft max-w-md mx-auto">
          <div className="text-2xl font-bold mb-2">
            {invoice.invoice_number ?? "—"}
          </div>
          <div className="text-sm text-muted-foreground mb-6">
            Invoice Date: {invoice.invoice_date ?? "—"}
          </div>

          {invoice.po_reference && (
            <div className="mb-4 text-sm">
              <span className="text-muted-foreground">PO Reference: </span>
              <span className="font-mono font-medium">{invoice.po_reference}</span>
            </div>
          )}

          <div className="space-y-2 my-6 border-t border-b border-border/60 py-4">
            {invoice.line_items.map((line, i) => (
              <div
                key={line.id}
                data-line-source={line.id}
                className={cn(
                  "flex items-center justify-between text-sm py-2",
                  i < invoice.line_items.length - 1 && "border-b border-border/40"
                )}
              >
                <div className="flex-1 min-w-0 pr-4">
                  <div className="font-medium truncate">{line.item_description}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {line.item_code ?? "—"} · qty {line.quantity}
                  </div>
                </div>
                <div className="font-mono font-medium tabular-nums">
                  ${line.total_price.toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-2xl font-bold tabular-nums">
                ${(invoice.total_amount ?? 0).toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
