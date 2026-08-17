import { useState } from "react"

import { PageHeader } from "@/components/shared/PageHeader"
import { InvoiceUploadZone } from "@/components/invoice/InvoiceUploadZone"
import { InvoiceTable } from "@/components/invoice/InvoiceTable"
import { EmptyState } from "@/components/shared/EmptyState"
import { EmptyInbox } from "@/components/shared/illustrations/EmptyInbox"
import { ExportButton } from "@/components/shared/ExportButton"
import { TableSkeleton } from "@/components/shared/LoadingSkeleton"
import { useInvoices } from "@/api/invoices"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/store/auth"
import { AUTH_ENABLED } from "@/lib/firebase"
import { cn } from "@/lib/utils"
import type { CsvColumn } from "@/lib/csv"
import type { InvoiceListItem } from "@/api/types"

const INVOICE_COLUMNS: CsvColumn<InvoiceListItem>[] = [
  { header: "ID", accessor: (i) => i.id },
  { header: "Invoice Number", accessor: (i) => i.invoice_number ?? "" },
  { header: "Vendor ID", accessor: (i) => i.vendor_id ?? "" },
  { header: "Total Amount", accessor: (i) => i.total_amount ?? "" },
  { header: "Processing Status", accessor: (i) => i.processing_status },
  { header: "Business Status", accessor: (i) => i.business_status },
  { header: "Created At", accessor: (i) => i.created_at },
]

const FILTERS = [
  { value: "", label: "All" },
  { value: "queued,parsing,matching,resolving", label: "Processing" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
]

export function InboxPage() {
  const [filter, setFilter] = useState("")
  const { data: invoices, isLoading, refetch } = useInvoices()
  const canWrite = useAuthStore((s) => !AUTH_ENABLED || Boolean(s.firebaseUser))

  const filtered = filter
    ? invoices?.filter((inv) => filter.split(",").includes(inv.processing_status))
    : invoices

  return (
    <div className="space-y-8">
      <PageHeader
        title="Invoice Inbox"
        description="Drop invoices in to start automated reconciliation. Watch as agents process each one in real time."
        actions={
          <ExportButton
            data={invoices}
            columns={INVOICE_COLUMNS}
            filenamePrefix="invoices"
          />
        }
      />

      {canWrite && <InvoiceUploadZone />}

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
              illustration={<EmptyInbox className="w-full" />}
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
