import { useState } from "react"
import { Link } from "react-router-dom"
import { isAxiosError } from "axios"
import { toast } from "sonner"
import {
  Building2,
  Mail,
  MapPin,
  Hash,
  ShoppingCart,
  FileText,
  Clock,
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
import {
  useDeleteVendor,
  useVendor,
  useVendorInvoices,
  useVendorPOs,
  useVendorStats,
} from "@/api/vendors"
import { useVendorSheet } from "@/store/vendor"
import { useAuthStore } from "@/store/auth"
import { AUTH_ENABLED } from "@/lib/firebase"
import {
  formatCurrency,
  formatDate,
  formatDuration,
  formatRelative,
  shortId,
} from "@/lib/format"
import { ProcessingStatusBadge } from "@/components/invoice/ProcessingStatusBadge"
import { BusinessStatusBadge } from "@/components/invoice/BusinessStatusBadge"
import { VendorForm } from "@/components/vendor/VendorForm"

interface DeleteErrorDetail {
  message?: string
  po_count?: number
  invoice_count?: number
}

export function VendorSheet() {
  const vendorId = useVendorSheet((s) => s.vendorId)
  const close = useVendorSheet((s) => s.close)
  const open = !!vendorId
  const canWrite = useAuthStore((s) => !AUTH_ENABLED || Boolean(s.firebaseUser))

  const { data: vendor } = useVendor(vendorId)
  const { data: pos } = useVendorPOs(vendorId)
  const { data: invoices } = useVendorInvoices(vendorId)
  const { data: stats } = useVendorStats(vendorId)

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteBlockedReason, setDeleteBlockedReason] = useState<string | null>(
    null
  )
  const deleteMutation = useDeleteVendor()

  const handleSheetOpenChange = (o: boolean) => {
    if (!o) {
      close()
      setEditOpen(false)
      setDeleteOpen(false)
      setDeleteBlockedReason(null)
    }
  }

  const onConfirmDelete = async () => {
    if (!vendor) return
    try {
      await deleteMutation.mutateAsync(vendor.id)
      toast.success(`Deleted vendor ${vendor.name}`)
      setDeleteOpen(false)
      close()
    } catch (e: unknown) {
      if (isAxiosError(e) && e.response?.status === 409) {
        const detail = e.response.data?.detail as DeleteErrorDetail | string
        const message =
          typeof detail === "string"
            ? detail
            : detail?.message ??
              "Vendor is still referenced by other records."
        setDeleteBlockedReason(message)
        return
      }
      const message = e instanceof Error ? e.message : "Delete failed"
      toast.error("Could not delete vendor", { description: message })
    }
  }

  const hasReferences =
    (pos && pos.length > 0) || (invoices && invoices.length > 0)

  return (
    <Sheet open={open} onOpenChange={handleSheetOpenChange}>
      <SheetContent className="overflow-hidden flex flex-col p-0">
        <SheetHeader className="space-y-3">
          {!vendor ? (
            <>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <div className="size-12 rounded-2xl bg-gradient-to-br from-blue-500/15 to-indigo-500/15 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <Building2 className="size-6 text-blue-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="truncate">{vendor.name}</SheetTitle>
                  <SheetDescription>
                    <code className="text-xs font-mono">{vendor.code}</code>
                  </SheetDescription>
                </div>
                {vendor && !vendor.is_system && canWrite && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditOpen(true)}
                  aria-label="Edit vendor"
                  className="shrink-0"
                >
                  <Pencil className="size-4" />
                </Button>
                )}
              </div>

              <div className="space-y-1.5 text-sm pt-2">
                {vendor.tax_id && (
                  <InfoRow icon={Hash} label="Tax ID" value={vendor.tax_id} />
                )}
                {vendor.address && (
                  <InfoRow
                    icon={MapPin}
                    label="Address"
                    value={vendor.address}
                  />
                )}
                {vendor.contact_email && (
                  <InfoRow
                    icon={Mail}
                    label="Email"
                    value={vendor.contact_email}
                  />
                )}
              </div>

              {/* Stats overview */}
              <div className="grid grid-cols-3 divide-x divide-border/60 border-y border-border/60 -mx-6 px-0 mt-3">
                <Stat
                  label="Invoices"
                  value={String(stats?.invoice_count ?? invoices?.length ?? 0)}
                />
                <Stat
                  label="POs"
                  value={String(stats?.po_count ?? pos?.length ?? 0)}
                />
                <Stat
                  label="Approved"
                  value={String(stats?.approved_count ?? 0)}
                />
              </div>
            </>
          )}
        </SheetHeader>

        <Tabs defaultValue="invoices" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="mx-6 mt-4 self-start">
            <TabsTrigger value="invoices">
              <FileText className="size-3.5" />
              Invoices
              {invoices && (
                <Badge variant="muted" className="ml-1.5">
                  {invoices.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="pos">
              <ShoppingCart className="size-3.5" />
              POs
              {pos && (
                <Badge variant="muted" className="ml-1.5">
                  {pos.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="invoices"
            className="flex-1 overflow-y-auto px-6 pb-6 mt-3"
          >
            {!invoices || invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No invoices from this vendor yet
              </p>
            ) : (
              <ul className="space-y-2">
                {invoices.map((inv) => (
                  <li key={inv.id}>
                    <Link
                      to={`/invoices/${inv.id}`}
                      onClick={close}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border/60 hover:border-primary/40 hover:bg-accent/30 transition-colors"
                    >
                      <Clock className="size-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {inv.invoice_number ?? `Invoice ${shortId(inv.id)}`}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                          <ProcessingStatusBadge
                            status={inv.processing_status}
                            className="text-[10px]"
                          />
                          <BusinessStatusBadge status={inv.business_status} />
                          <span>{formatRelative(inv.created_at)}</span>
                        </div>
                      </div>
                      <span className="font-mono tabular-nums text-sm">
                        {formatCurrency(inv.total_amount)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent
            value="pos"
            className="flex-1 overflow-y-auto px-6 pb-6 mt-3"
          >
            {!pos || pos.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No purchase orders for this vendor
              </p>
            ) : (
              <ul className="space-y-2">
                {pos.map((po) => (
                  <li
                    key={po.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border/60"
                  >
                    <ShoppingCart className="size-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono font-medium text-sm">
                        {po.po_number}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Issued {formatDate(po.issue_date)} ·{" "}
                        <span className="capitalize">{po.status}</span>
                      </div>
                    </div>
                    <span className="font-mono tabular-nums text-sm">
                      {formatCurrency(po.total_amount, po.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>

        {vendor && !vendor.is_system && canWrite && (
          <SheetFooter className="border-t border-border/60 px-6 py-3 mt-0">
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive gap-1.5"
              onClick={() => {
                setDeleteBlockedReason(null)
                setDeleteOpen(true)
              }}
            >
              <Trash2 className="size-3.5" />
              Delete vendor
            </Button>
          </SheetFooter>
        )}
      </SheetContent>

      {vendor && canWrite && (
        <>
          <VendorForm
            open={editOpen}
            onOpenChange={setEditOpen}
            vendor={vendor}
          />
          <AlertDialog
            open={deleteOpen}
            onOpenChange={(o) => {
              setDeleteOpen(o)
              if (!o) setDeleteBlockedReason(null)
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Delete {vendor.name}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {deleteBlockedReason ? (
                    <>
                      <span className="text-destructive font-medium">
                        Cannot delete:
                      </span>{" "}
                      {deleteBlockedReason} Reassign or remove the
                      referenced records first.
                    </>
                  ) : hasReferences ? (
                    <>
                      This vendor has{" "}
                      <span className="font-semibold text-foreground">
                        {pos?.length ?? 0}{" "}
                        {(pos?.length ?? 0) === 1
                          ? "purchase order"
                          : "purchase orders"}
                      </span>{" "}
                      and{" "}
                      <span className="font-semibold text-foreground">
                        {invoices?.length ?? 0}{" "}
                        {(invoices?.length ?? 0) === 1 ? "invoice" : "invoices"}
                      </span>
                      . The database will refuse the delete until you
                      remove or reassign those.
                    </>
                  ) : (
                    "This will permanently delete the vendor. No POs or invoices reference it, so nothing else is affected."
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteMutation.isPending}>
                  {deleteBlockedReason ? "Close" : "Cancel"}
                </AlertDialogCancel>
                {!deleteBlockedReason && (
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
                    Delete
                  </AlertDialogAction>
                )}
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </Sheet>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className="break-all">{value}</span>
    </div>
  )
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="px-4 py-3 text-center">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
        {label}
      </div>
      <div className="font-bold text-lg tabular-nums">{value}</div>
      {sub && (
        <div className="text-[10px] text-muted-foreground tabular-nums">
          {sub}
        </div>
      )}
    </div>
  )
}
