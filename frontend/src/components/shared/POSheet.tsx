import { Link } from "react-router-dom"
import {
  ShoppingCart,
  Calendar,
  FileText,
  Package,
  Truck,
  ArrowRight,
} from "lucide-react"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { VendorBadge } from "@/components/shared/VendorBadge"
import { BusinessStatusBadge } from "@/components/invoice/BusinessStatusBadge"
import {
  usePurchaseOrder,
  usePurchaseOrderInvoices,
} from "@/api/purchase-orders"
import { useDeliveryReceipts } from "@/api/delivery-receipts"
import { usePOSheet } from "@/store/po"
import {
  formatCurrency,
  formatDate,
  formatRelative,
  shortId,
} from "@/lib/format"
import type { BusinessStatus } from "@/api/types"

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

export function POSheet() {
  const poId = usePOSheet((s) => s.poId)
  const close = usePOSheet((s) => s.close)
  const open = !!poId

  const { data: po } = usePurchaseOrder(poId)
  const { data: invoices } = usePurchaseOrderInvoices(poId)
  const { data: receipts } = useDeliveryReceipts({
    poId,
    enabled: !!poId,
  })

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()}>
      <SheetContent className="overflow-hidden flex flex-col p-0 sm:max-w-xl">
        <SheetHeader className="space-y-3">
          {!po ? (
            <>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <div className="size-12 rounded-2xl bg-gradient-to-br from-blue-500/15 to-indigo-500/15 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <ShoppingCart className="size-6 text-blue-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="font-mono">{po.po_number}</SheetTitle>
                  <SheetDescription className="flex flex-wrap items-center gap-2 pt-1">
                    <VendorBadge vendorId={po.vendor_id} />
                    <span className="text-muted-foreground">·</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="size-3" />
                      Issued {formatDate(po.issue_date)}
                    </span>
                  </SheetDescription>
                </div>
              </div>

              <div className="grid grid-cols-3 divide-x divide-border/60 border-y border-border/60 -mx-6 px-0">
                <Stat
                  label="Total"
                  value={formatCurrency(po.total_amount, po.currency)}
                />
                <Stat
                  label="Line items"
                  value={String(po.line_items.length)}
                />
                <Stat label="Status" value={po.status} capitalize />
              </div>

              {po.notes && (
                <p className="text-sm text-muted-foreground italic pt-2">
                  {po.notes}
                </p>
              )}
            </>
          )}
        </SheetHeader>

        <Tabs
          defaultValue="lines"
          className="flex-1 overflow-hidden flex flex-col"
        >
          <TabsList className="mx-6 mt-4 self-start">
            <TabsTrigger value="lines">
              <Package className="size-3.5" />
              Line Items
              {po && (
                <Badge variant="muted" className="ml-1.5">
                  {po.line_items.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="invoices">
              <FileText className="size-3.5" />
              Matched Invoices
              {invoices && (
                <Badge variant="muted" className="ml-1.5">
                  {invoices.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="deliveries">
              <Truck className="size-3.5" />
              Deliveries
              {receipts && (
                <Badge variant="muted" className="ml-1.5">
                  {receipts.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="lines"
            className="flex-1 overflow-y-auto px-6 pb-6 mt-3"
          >
            {!po ? (
              <Skeleton className="h-32 w-full" />
            ) : po.line_items.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No line items.
              </p>
            ) : (
              <ul className="space-y-2">
                {po.line_items.map((line) => (
                  <li
                    key={line.id}
                    className="rounded-lg border border-border/60 px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate">
                          {line.item_description}
                        </div>
                        <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                          Line {line.line_number} ·{" "}
                          {line.item_code ?? "—"} · qty {line.quantity}
                          {line.unit_of_measure
                            ? ` ${line.unit_of_measure}`
                            : ""}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono tabular-nums text-sm font-medium">
                          {formatCurrency(line.total_price, po.currency)}
                        </div>
                        <div className="text-[10px] text-muted-foreground tabular-nums">
                          @ {formatCurrency(line.unit_price, po.currency)}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent
            value="invoices"
            className="flex-1 overflow-y-auto px-6 pb-6 mt-3"
          >
            {!invoices || invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No invoices have matched against this PO yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {invoices.map((inv) => (
                  <li key={inv.invoice_id}>
                    <Link
                      to={`/invoices/${inv.invoice_id}`}
                      onClick={close}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border/60 hover:border-primary/40 hover:bg-accent/30 transition-colors"
                    >
                      <FileText className="size-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {inv.invoice_number ??
                            `Invoice ${shortId(inv.invoice_id)}`}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                          <BusinessStatusBadge
                            status={inv.business_status as BusinessStatus}
                          />
                          <Badge variant="muted">
                            {inv.match_type.replace(/_/g, " ")}
                          </Badge>
                          {inv.discrepancies_count > 0 && (
                            <span className="text-amber-600">
                              {inv.discrepancies_count}{" "}
                              {inv.discrepancies_count === 1
                                ? "discrepancy"
                                : "discrepancies"}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="font-mono tabular-nums text-sm shrink-0">
                        {formatCurrency(inv.total_amount)}
                      </span>
                      <ArrowRight className="size-4 text-muted-foreground shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent
            value="deliveries"
            className="flex-1 overflow-y-auto px-6 pb-6 mt-3"
          >
            {!receipts || receipts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No delivery receipts recorded for this PO yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {receipts.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-lg border border-border/60 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-mono font-medium text-sm">
                        {r.receipt_number}
                      </div>
                      <Badge
                        variant={receiptStatusVariant(r.status)}
                        className="capitalize"
                      >
                        {r.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Received {formatRelative(r.received_date)}
                      {r.receiver_name ? ` by ${r.receiver_name}` : ""} ·{" "}
                      {r.line_items.length}{" "}
                      {r.line_items.length === 1 ? "line" : "lines"}
                    </div>
                    {r.notes && (
                      <div className="text-xs text-muted-foreground italic mt-1">
                        {r.notes}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}

function Stat({
  label,
  value,
  capitalize,
}: {
  label: string
  value: string
  capitalize?: boolean
}) {
  return (
    <div className="px-4 py-3 text-center">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
        {label}
      </div>
      <div
        className={
          "font-bold text-base tabular-nums" +
          (capitalize ? " capitalize" : "")
        }
      >
        {value}
      </div>
    </div>
  )
}
