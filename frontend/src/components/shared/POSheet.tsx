import { useState } from "react"
import { Link } from "react-router-dom"
import { isAxiosError } from "axios"
import { toast } from "sonner"
import {
  ShoppingCart,
  Calendar,
  FileText,
  Package,
  Truck,
  ArrowRight,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { VendorBadge } from "@/components/shared/VendorBadge"
import { BusinessStatusBadge } from "@/components/invoice/BusinessStatusBadge"
import { POForm } from "@/components/po/POForm"
import {
  useDeletePO,
  usePurchaseOrder,
  usePurchaseOrderInvoices,
} from "@/api/purchase-orders"
import { useDeliveryReceipts } from "@/api/delivery-receipts"
import { usePOSheet } from "@/store/po"
import { useReceiptSheet } from "@/store/receipt"
import {
  formatCurrency,
  formatDate,
  formatRelative,
  shortId,
} from "@/lib/format"
import type { BusinessStatus } from "@/api/types"

interface DeleteErrorDetail {
  message?: string
  reconciliation_count?: number
}

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
  const openReceipt = useReceiptSheet((s) => s.open)
  const open = !!poId

  const { data: po } = usePurchaseOrder(poId)
  const { data: invoices } = usePurchaseOrderInvoices(poId)
  const { data: receipts } = useDeliveryReceipts({
    poId,
    enabled: !!poId,
  })

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [forceDelete, setForceDelete] = useState(false)
  const deleteMutation = useDeletePO()

  const handleSheetOpenChange = (o: boolean) => {
    if (!o) {
      close()
      setEditOpen(false)
      setDeleteOpen(false)
      setForceDelete(false)
    }
  }

  const onConfirmDelete = async () => {
    if (!po) return
    try {
      await deleteMutation.mutateAsync({ id: po.id, force: forceDelete })
      toast.success(`Deleted ${po.po_number}`)
      setDeleteOpen(false)
      close()
    } catch (e: unknown) {
      // 409 with referenced reconciliations -> reveal the force option.
      if (isAxiosError(e) && e.response?.status === 409) {
        const detail = e.response.data?.detail as DeleteErrorDetail | string
        const message =
          typeof detail === "string"
            ? detail
            : detail?.message ?? "PO is referenced by other records"
        toast.warning("Confirm force delete", { description: message })
        setForceDelete(true)
        return
      }
      const message = e instanceof Error ? e.message : "Delete failed"
      toast.error("Could not delete PO", { description: message })
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleSheetOpenChange}>
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
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditOpen(true)}
                  aria-label="Edit purchase order"
                  className="shrink-0"
                >
                  <Pencil className="size-4" />
                </Button>
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
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => openReceipt(r.id)}
                      className="w-full text-left rounded-lg border border-border/60 p-3 hover:border-primary/40 hover:bg-accent/30 transition-colors"
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
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>

        {po && (
          <SheetFooter className="border-t border-border/60 px-6 py-3 mt-0">
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive gap-1.5"
              onClick={() => {
                setForceDelete(false)
                setDeleteOpen(true)
              }}
            >
              <Trash2 className="size-3.5" />
              Delete PO
            </Button>
          </SheetFooter>
        )}
      </SheetContent>

      {po && (
        <>
          <POForm
            open={editOpen}
            onOpenChange={setEditOpen}
            poId={po.id}
          />
          <AlertDialog
            open={deleteOpen}
            onOpenChange={(o) => {
              setDeleteOpen(o)
              if (!o) setForceDelete(false)
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Delete {po.po_number}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {invoices && invoices.length > 0 ? (
                    <>
                      This PO is referenced by{" "}
                      <span className="font-semibold text-foreground">
                        {invoices.length}{" "}
                        {invoices.length === 1
                          ? "reconciliation"
                          : "reconciliations"}
                      </span>
                      . Deleting will detach those records from the PO
                      (the reconciliations themselves stay) and remove
                      every line item. This cannot be undone.
                    </>
                  ) : (
                    <>
                      This will permanently delete the PO and all of
                      its line items. No reconciliations reference it,
                      so nothing else is affected.
                    </>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteMutation.isPending}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault()
                    onConfirmDelete()
                  }}
                  disabled={deleteMutation.isPending}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
                >
                  {deleteMutation.isPending && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  {forceDelete ? "Delete anyway" : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
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
