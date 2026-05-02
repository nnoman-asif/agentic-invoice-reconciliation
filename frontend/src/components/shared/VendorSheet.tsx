import { Link } from "react-router-dom"
import {
  Building2,
  Mail,
  MapPin,
  Hash,
  ShoppingCart,
  FileText,
  Clock,
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
import {
  useVendor,
  useVendorInvoices,
  useVendorPOs,
  useVendorStats,
} from "@/api/vendors"
import { useVendorSheet } from "@/store/vendor"
import {
  formatCurrency,
  formatDate,
  formatDuration,
  formatRelative,
  shortId,
} from "@/lib/format"
import { ProcessingStatusBadge } from "@/components/invoice/ProcessingStatusBadge"
import { BusinessStatusBadge } from "@/components/invoice/BusinessStatusBadge"

export function VendorSheet() {
  const vendorId = useVendorSheet((s) => s.vendorId)
  const close = useVendorSheet((s) => s.close)
  const open = !!vendorId

  const { data: vendor } = useVendor(vendorId)
  const { data: pos } = useVendorPOs(vendorId)
  const { data: invoices } = useVendorInvoices(vendorId)
  const { data: stats } = useVendorStats(vendorId)

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()}>
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
            </>
          )}
        </SheetHeader>

        {stats && (
          <div className="grid grid-cols-3 divide-x divide-border/60 border-b border-border/60">
            <Stat
              label="Purchase Orders"
              value={stats.po_count.toString()}
              sub={formatCurrency(stats.po_total)}
            />
            <Stat
              label="Invoices"
              value={stats.invoice_count.toString()}
              sub={formatCurrency(stats.invoice_total)}
            />
            <Stat
              label="Avg Time"
              value={formatDuration(stats.avg_processing_time_ms)}
              sub={`${stats.approved_count} approved`}
            />
          </div>
        )}

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
      </SheetContent>
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
