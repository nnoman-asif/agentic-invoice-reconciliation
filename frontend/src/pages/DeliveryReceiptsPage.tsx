import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { ArrowRight, Plus, Search } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TableSkeleton } from "@/components/shared/LoadingSkeleton"
import { EmptyState } from "@/components/shared/EmptyState"
import { NoData } from "@/components/shared/illustrations/NoData"
import { ExportButton } from "@/components/shared/ExportButton"
import { ImportButton } from "@/components/shared/ImportButton"
import { ReceiptForm } from "@/components/receipt/ReceiptForm"
import {
  useDeliveryReceipts,
  useImportReceiptsCsv,
} from "@/api/delivery-receipts"
import { usePurchaseOrders } from "@/api/purchase-orders"
import { useReceiptSheet } from "@/store/receipt"
import { useAuthStore } from "@/store/auth"
import { AUTH_ENABLED } from "@/lib/firebase"
import { formatDate } from "@/lib/format"
import type { CsvColumn } from "@/lib/csv"
import type { DeliveryReceipt } from "@/api/types"

function receiptStatusVariant(
  status: string
): "success" | "warning" | "destructive" | "muted" {
  switch (status) {
    case "received":
      return "success"
    case "partial":
      return "warning"
    case "rejected":
      return "destructive"
    default:
      return "muted"
  }
}

export function DeliveryReceiptsPage() {
  const [search, setSearch] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const { data, isLoading } = useDeliveryReceipts()
  const { data: pos } = usePurchaseOrders()
  const openSheet = useReceiptSheet((s) => s.open)
  const importMutation = useImportReceiptsCsv()
  const canWrite = useAuthStore((s) => !AUTH_ENABLED || Boolean(s.firebaseUser))

  const poNumberById = useMemo(() => {
    const map = new Map<string, string>()
    for (const po of pos ?? []) map.set(po.id, po.po_number)
    return map
  }, [pos])

  const columns: CsvColumn<DeliveryReceipt>[] = [
    { header: "ID", accessor: (r) => r.id },
    { header: "Receipt Number", accessor: (r) => r.receipt_number },
    {
      header: "PO Number",
      accessor: (r) => poNumberById.get(r.po_id) ?? r.po_id,
    },
    { header: "Received Date", accessor: (r) => r.received_date },
    { header: "Receiver", accessor: (r) => r.receiver_name ?? "" },
    { header: "Status", accessor: (r) => r.status },
    { header: "Lines", accessor: (r) => r.line_items.length },
    { header: "Created At", accessor: (r) => r.created_at },
  ]

  const filtered = data?.filter((r) => {
    if (!search) return true
    const s = search.toLowerCase()
    const poNumber = (poNumberById.get(r.po_id) ?? "").toLowerCase()
    return (
      r.receipt_number.toLowerCase().includes(s) ||
      r.id.toLowerCase().includes(s) ||
      r.status.toLowerCase().includes(s) ||
      poNumber.includes(s) ||
      (r.receiver_name ?? "").toLowerCase().includes(s)
    )
  })

  return (
    <div className="space-y-8">
      <PageHeader
        title="Delivery Receipts"
        description="Goods-received records the matcher uses for three-way reconciliation against purchase orders and invoices. Import a CSV or Excel file, or enter receipts directly."
        actions={
          <>
            {canWrite && (
              <ImportButton
                entity="delivery receipts"
                templateUrl="/samples/delivery-receipts-template.csv"
                importMutation={importMutation}
              />
            )}
            <ExportButton
              data={data}
              columns={columns}
              filenamePrefix="delivery-receipts"
            />
            {canWrite && (
              <Button size="sm" className="gap-1.5" onClick={() => setFormOpen(true)}>
                <Plus className="size-4" />
                New receipt
              </Button>
            )}
          </>
        }
      />

      {canWrite && <ReceiptForm open={formOpen} onOpenChange={setFormOpen} />}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search receipt number, PO, or receiver…"
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
            title="No delivery receipts"
            description={
              search
                ? "No receipts match your search"
                : "Run the seed script or import a file to load sample receipts"
            }
          />
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-muted/30">
              <tr className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <th className="px-5 py-3">Receipt</th>
                <th className="px-5 py-3">PO</th>
                <th className="px-5 py-3">Received</th>
                <th className="px-5 py-3">Lines</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.map((r, i) => (
                <motion.tr
                  key={r.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  onClick={() => openSheet(r.id)}
                  className="hover:bg-accent/30 transition-colors cursor-pointer group"
                >
                  <td className="px-5 py-3.5">
                    <div className="font-mono font-medium">{r.receipt_number}</div>
                    {r.receiver_name && (
                      <div className="text-xs text-muted-foreground">
                        {r.receiver_name}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-muted-foreground">
                    {poNumberById.get(r.po_id) ?? "—"}
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">
                    {formatDate(r.received_date)}
                  </td>
                  <td className="px-5 py-3.5 tabular-nums">
                    {r.line_items.length}
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge
                      variant={receiptStatusVariant(r.status)}
                      className="capitalize"
                    >
                      {r.status}
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
