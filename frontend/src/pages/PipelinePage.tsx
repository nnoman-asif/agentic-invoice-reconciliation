import { useState, useEffect } from "react"
import { Workflow } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { PipelineVisualizer } from "@/components/pipeline/PipelineVisualizer"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/shared/EmptyState"
import { useInvoices } from "@/api/invoices"
import { ProcessingStatusBadge } from "@/components/invoice/ProcessingStatusBadge"
import { formatRelative, shortId } from "@/lib/format"
import { cn } from "@/lib/utils"

export function PipelinePage() {
  const { data: invoices, isLoading } = useInvoices()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Auto-select most recent processing invoice, or most recent overall
  useEffect(() => {
    if (selectedId || !invoices || invoices.length === 0) return
    const processing = invoices.find(
      (i) =>
        i.processing_status !== "completed" &&
        i.processing_status !== "failed"
    )
    setSelectedId(processing?.id ?? invoices[0].id)
  }, [invoices, selectedId])

  return (
    <div className="space-y-8">
      <PageHeader
        title="Pipeline Visualizer"
        description="Watch the multi-agent reconciliation pipeline in real-time. Click any stage to inspect its output."
        actions={
          <Badge variant="default" className="gap-1.5">
            <span className="size-1.5 rounded-full bg-primary animate-pulse" />
            Live
          </Badge>
        }
      />

      {isLoading ? (
        <Card className="h-72 animate-shimmer-bg" />
      ) : !invoices || invoices.length === 0 ? (
        <Card>
          <EmptyState
            icon={Workflow}
            title="No invoices yet"
            description="Upload an invoice to see the pipeline in action."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          {/* Invoice picker */}
          <Card className="h-fit lg:sticky lg:top-24">
            <CardContent className="p-3 space-y-1">
              <div className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Recent Invoices
              </div>
              {invoices.slice(0, 12).map((inv) => (
                <Button
                  key={inv.id}
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedId(inv.id)}
                  className={cn(
                    "w-full justify-start gap-2 h-auto py-2",
                    selectedId === inv.id &&
                      "bg-primary/10 text-primary hover:bg-primary/15"
                  )}
                >
                  <div className="flex flex-col items-start gap-1 min-w-0 flex-1 text-left">
                    <span className="font-medium text-sm truncate w-full">
                      {inv.invoice_number ?? `Invoice ${shortId(inv.id)}`}
                    </span>
                    <div className="flex items-center gap-2">
                      <ProcessingStatusBadge
                        status={inv.processing_status}
                        className="text-[10px]"
                      />
                      <span className="text-[10px] text-muted-foreground">
                        {formatRelative(inv.created_at)}
                      </span>
                    </div>
                  </div>
                </Button>
              ))}
            </CardContent>
          </Card>

          <div>
            {selectedId ? (
              <PipelineVisualizer invoiceId={selectedId} />
            ) : (
              <Card>
                <EmptyState
                  icon={Workflow}
                  title="Select an invoice"
                  description="Pick an invoice from the list to visualize its pipeline"
                />
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
