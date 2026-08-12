import { useState } from "react"
import { isAxiosError } from "axios"
import { toast } from "sonner"
import {
  Truck,
  Calendar,
  Package,
  Pencil,
  Trash2,
  Loader2,
  ShoppingCart,
} from "lucide-react"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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
import { ReceiptForm } from "@/components/receipt/ReceiptForm"
import {
  useDeleteReceipt,
  useDeliveryReceipt,
} from "@/api/delivery-receipts"
import { usePurchaseOrder } from "@/api/purchase-orders"
import { useReceiptSheet } from "@/store/receipt"
import { usePOSheet } from "@/store/po"
import { formatDate, formatRelative } from "@/lib/format"

interface DeleteErrorDetail {
  message?: string
  match_count?: number
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

export function ReceiptSheet() {
  const receiptId = useReceiptSheet((s) => s.receiptId)
  const close = useReceiptSheet((s) => s.close)
  const openPO = usePOSheet((s) => s.open)
  const open = !!receiptId

  const { data: receipt } = useDeliveryReceipt(receiptId)
  const { data: po } = usePurchaseOrder(receipt?.po_id ?? null)

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [forceDelete, setForceDelete] = useState(false)
  const deleteMutation = useDeleteReceipt()

  const handleSheetOpenChange = (o: boolean) => {
    if (!o) {
      close()
      setEditOpen(false)
      setDeleteOpen(false)
      setForceDelete(false)
    }
  }

  const onConfirmDelete = async () => {
    if (!receipt) return
    try {
      await deleteMutation.mutateAsync({ id: receipt.id, force: forceDelete })
      toast.success(`Deleted ${receipt.receipt_number}`)
      setDeleteOpen(false)
      close()
    } catch (e: unknown) {
      if (isAxiosError(e) && e.response?.status === 409) {
        const detail = e.response.data?.detail as DeleteErrorDetail | string
        const message =
          typeof detail === "string"
            ? detail
            : detail?.message ?? "Receipt is referenced by other records"
        toast.warning("Confirm force delete", { description: message })
        setForceDelete(true)
        return
      }
      const message = e instanceof Error ? e.message : "Delete failed"
      toast.error("Could not delete receipt", { description: message })
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleSheetOpenChange}>
      <SheetContent className="overflow-hidden flex flex-col p-0 sm:max-w-xl">
        <SheetHeader className="space-y-3">
          {!receipt ? (
            <>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <div className="size-12 rounded-2xl bg-gradient-to-br from-emerald-500/15 to-teal-500/15 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <Truck className="size-6 text-emerald-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="font-mono">
                    {receipt.receipt_number}
                  </SheetTitle>
                  <SheetDescription className="flex flex-wrap items-center gap-2 pt-1">
                    <Badge
                      variant={receiptStatusVariant(receipt.status)}
                      className="capitalize"
                    >
                      {receipt.status}
                    </Badge>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="size-3" />
                      {formatDate(receipt.received_date)}
                    </span>
                  </SheetDescription>
                </div>
                {receipt && !receipt.is_system && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditOpen(true)}
                  aria-label="Edit delivery receipt"
                  className="shrink-0"
                >
                  <Pencil className="size-4" />
                </Button>
                )}
              </div>

              <div className="grid grid-cols-3 divide-x divide-border/60 border-y border-border/60 -mx-6 px-0">
                <Stat
                  label="Lines"
                  value={String(receipt.line_items.length)}
                />
                <Stat
                  label="Receiver"
                  value={receipt.receiver_name || "—"}
                />
                <Stat
                  label="Received"
                  value={formatRelative(receipt.received_date)}
                />
              </div>

              {po && (
                <button
                  type="button"
                  onClick={() => openPO(po.id)}
                  className="flex items-center gap-2 text-sm text-left hover:text-primary transition-colors"
                >
                  <ShoppingCart className="size-3.5 text-muted-foreground" />
                  <span className="font-mono">{po.po_number}</span>
                </button>
              )}

              {receipt.notes && (
                <p className="text-sm text-muted-foreground italic pt-2">
                  {receipt.notes}
                </p>
              )}
            </>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            <Package className="size-3.5" />
            Line items
          </div>
          {!receipt ? (
            <Skeleton className="h-32 w-full" />
          ) : receipt.line_items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No line items.
            </p>
          ) : (
            <ul className="space-y-2">
              {receipt.line_items.map((line) => (
                <li
                  key={line.id}
                  className="rounded-lg border border-border/60 px-3 py-2.5"
                >
                  <div className="font-medium text-sm">
                    {line.item_description}
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                    recv {line.quantity_received} · acc {line.quantity_accepted}{" "}
                    · rej {line.quantity_rejected}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {receipt && !receipt.is_system && (
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
              Delete receipt
            </Button>
          </SheetFooter>
        )}
      </SheetContent>

      {receipt && (
        <>
          <ReceiptForm
            open={editOpen}
            onOpenChange={setEditOpen}
            receiptId={receipt.id}
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
                  Delete {receipt.receipt_number}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes the receipt and its line items.
                  If invoices already matched against these lines, pass
                  force-delete to detach those matches.
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
}: {
  label: string
  value: string
}) {
  return (
    <div className="px-4 py-3 text-center">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
        {label}
      </div>
      <div className="font-bold text-base tabular-nums truncate">{value}</div>
    </div>
  )
}
