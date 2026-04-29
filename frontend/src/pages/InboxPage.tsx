import { useState } from "react"
import { Inbox } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { InvoiceUploadZone } from "@/components/invoice/InvoiceUploadZone"
import { InvoiceTable } from "@/components/invoice/InvoiceTable"
import { EmptyState } from "@/components/shared/EmptyState"
import { TableSkeleton } from "@/components/shared/LoadingSkeleton"
import { useInvoices } from "@/api/invoices"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const FILTERS = [
  { value: "", label: "All" },
  { value: "queued,parsing,matching,resolving", label: "Processing" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
]

export function InboxPage() {
  const [filter, setFilter] = useState("")
  const { data: invoices, isLoading } = useInvoices()

  const filtered = filter
    ? invoices?.filter((inv) => filter.split(",").includes(inv.processing_status))
    : invoices

  return (
    <div className="space-y-8">
      <PageHeader
        title="Invoice Inbox"
        description="Drop invoices in to start automated reconciliation. Watch as agents process each one in real time."
      />

      <InvoiceUploadZone />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 p-1 rounded-lg bg-muted/40 border border-border/60">
            {FILTERS.map((f) => (
              <Button
                key={f.value}
                variant="ghost"
                size="sm"
                onClick={() => setFilter(f.value)}
                className={cn(
                  "h-7 px-3 text-xs font-medium transition-all",
                  filter === f.value
                    ? "bg-background shadow-soft text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label}
              </Button>
            ))}
          </div>

          <div className="text-xs text-muted-foreground tabular-nums">
            {filtered?.length ?? 0} invoice{filtered?.length === 1 ? "" : "s"}
          </div>
        </div>

        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : !filtered || filtered.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-card">
            <EmptyState
              icon={Inbox}
              title="No invoices yet"
              description="Upload your first invoice to begin reconciliation."
            />
          </div>
        ) : (
          <InvoiceTable invoices={filtered} />
        )}
      </div>
    </div>
  )
}
