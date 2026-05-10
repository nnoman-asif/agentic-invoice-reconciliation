import { useState } from "react"
import { motion } from "framer-motion"
import { ArrowRight, Search } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TableSkeleton } from "@/components/shared/LoadingSkeleton"
import { EmptyState } from "@/components/shared/EmptyState"
import { NoData } from "@/components/shared/illustrations/NoData"
import { VendorBadge } from "@/components/shared/VendorBadge"
import { ExportButton } from "@/components/shared/ExportButton"
import { ImportButton } from "@/components/shared/ImportButton"
import { useImportPOsCsv, usePurchaseOrders } from "@/api/purchase-orders"
import { usePOSheet } from "@/store/po"
import { formatCurrency, formatDate } from "@/lib/format"
import type { CsvColumn } from "@/lib/csv"
import type { PurchaseOrderListItem } from "@/api/types"

const PO_COLUMNS: CsvColumn<PurchaseOrderListItem>[] = [
  { header: "ID", accessor: (p) => p.id },
  { header: "PO Number", accessor: (p) => p.po_number },
  { header: "Vendor ID", accessor: (p) => p.vendor_id },
  { header: "Issue Date", accessor: (p) => p.issue_date },
  { header: "Total Amount", accessor: (p) => p.total_amount },
  { header: "Currency", accessor: (p) => p.currency },
  { header: "Status", accessor: (p) => p.status },
  { header: "Created At", accessor: (p) => p.created_at },
]

export function PurchaseOrdersPage() {
  const [search, setSearch] = useState("")
  const { data, isLoading } = usePurchaseOrders()
  const openSheet = usePOSheet((s) => s.open)
  const importMutation = useImportPOsCsv()

  const filtered = data?.filter((po) => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      po.po_number.toLowerCase().includes(s) ||
      po.id.toLowerCase().includes(s) ||
      po.status.toLowerCase().includes(s)
    )
  })

  return (
    <div className="space-y-8">
      <PageHeader
        title="Purchase Orders"
        description="Reference data the matcher agent uses to reconcile incoming invoices. In production these typically sync from your ERP; here you can seed sample data, import via CSV, or manage them directly."
        actions={
          <>
            <ImportButton
              entity="purchase orders"
              templateUrl="/samples/purchase-orders-template.csv"
              importMutation={importMutation}
            />
            <ExportButton
              data={data}
              columns={PO_COLUMNS}
              filenamePrefix="purchase-orders"
            />
          </>
        }
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search PO number or ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : !filtered || filtered.length === 0 ? (
        <Card>
          <EmptyState
            illustration={<NoData className="w-full" />}
            title="No purchase orders"
            description={
              search ? "No POs match your search" : "Run the seed script to load sample POs"
            }
          />
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-muted/30">
              <tr className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <th className="px-5 py-3">PO Number</th>
                <th className="px-5 py-3">Vendor</th>
                <th className="px-5 py-3">Issue Date</th>
                <th className="px-5 py-3">Total</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.map((po, i) => (
                <motion.tr
                  key={po.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  onClick={() => openSheet(po.id)}
                  className="hover:bg-accent/30 transition-colors cursor-pointer group"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium">{po.po_number}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                    <VendorBadge vendorId={po.vendor_id} />
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">
                    {formatDate(po.issue_date)}
                  </td>
                  <td className="px-5 py-3.5 font-mono tabular-nums">
                    {formatCurrency(po.total_amount, po.currency)}
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge
                      variant={
                        po.status === "issued"
                          ? "default"
                          : po.status === "fulfilled"
                            ? "success"
                            : po.status === "cancelled"
                              ? "destructive"
                              : "muted"
                      }
                    >
                      {po.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <ArrowRight className="size-4 text-muted-foreground/40 group-hover:text-foreground/70 transition-colors" />
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
