import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  XCircle,
  ArrowRight,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState } from "@/components/shared/EmptyState"
import { AllClear } from "@/components/shared/illustrations/AllClear"
import { ExportButton } from "@/components/shared/ExportButton"
import { TableSkeleton } from "@/components/shared/LoadingSkeleton"
import type { CsvColumn } from "@/lib/csv"
import {
  useApproveException,
  useExceptions,
  useRejectException,
} from "@/api/exceptions"
import { useReconciliationByInvoice } from "@/api/reconciliations"
import { useAuthStore } from "@/store/auth"
import { AUTH_ENABLED } from "@/lib/firebase"
import { formatCurrency, formatRelative, shortId } from "@/lib/format"
import type { InvoiceListItem } from "@/api/types"
import { cn } from "@/lib/utils"

type ActionType = "approve" | "reject"

const EXCEPTION_COLUMNS: CsvColumn<InvoiceListItem>[] = [
  { header: "Invoice ID", accessor: (i) => i.id },
  { header: "Invoice Number", accessor: (i) => i.invoice_number ?? "" },
  { header: "Vendor ID", accessor: (i) => i.vendor_id ?? "" },
  { header: "Total Amount", accessor: (i) => i.total_amount ?? "" },
  { header: "Business Status", accessor: (i) => i.business_status },
  { header: "Created At", accessor: (i) => i.created_at },
]

type DialogState =
  | { open: false }
  | {
      open: true
      type: ActionType
      // Single mode
      reconciliationId?: string
      // Bulk mode
      reconciliationIds?: string[]
    }

export function ExceptionsPage() {
  const { data: invoices, isLoading } = useExceptions()
  const [dialog, setDialog] = useState<DialogState>({ open: false })
  const [notes, setNotes] = useState("")
  const [decidedBy, setDecidedBy] = useState("admin")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Map invoice_id -> reconciliation_id (collected as cards mount)
  const [reconMap, setReconMap] = useState<Record<string, string>>({})
  // Inline error inside the bulk dialog when every action failed
  const [submitError, setSubmitError] = useState<string | null>(null)
  const canWrite = useAuthStore((s) => !AUTH_ENABLED || Boolean(s.firebaseUser))

  const approveMut = useApproveException()
  const rejectMut = useRejectException()

  // Reset selection when invoice list changes
  useEffect(() => {
    if (!invoices) return
    setSelected((prev) => {
      const next = new Set<string>()
      for (const id of prev) {
        if (invoices.some((i) => i.id === id)) next.add(id)
      }
      return next
    })
  }, [invoices])

  const allSelectableIds = useMemo(
    () => invoices?.map((i) => i.id) ?? [],
    [invoices]
  )
  const allSelected =
    allSelectableIds.length > 0 && selected.size === allSelectableIds.length

  // Number of selected invoices whose recon record has loaded and is ready for bulk action
  const selectedReadyCount = useMemo(() => {
    let count = 0
    for (const id of selected) {
      if (reconMap[id]) count++
    }
    return count
  }, [selected, reconMap])

  const bulkReady =
    selected.size > 0 && selectedReadyCount === selected.size

  const openBulk = (type: ActionType) => {
    const reconciliationIds = Array.from(selected)
      .map((id) => reconMap[id])
      .filter((id): id is string => Boolean(id))
    if (reconciliationIds.length === 0) return
    setSubmitError(null)
    setDialog({ open: true, type, reconciliationIds })
  }

  const openSingle = (type: ActionType, reconciliationId: string) => {
    setSubmitError(null)
    setDialog({ open: true, type, reconciliationId })
  }

  const closeDialog = () => {
    setDialog({ open: false })
    setNotes("")
    setSubmitError(null)
  }

  const handleSubmit = async () => {
    if (!dialog.open) return
    const ids =
      dialog.reconciliationIds ??
      (dialog.reconciliationId ? [dialog.reconciliationId] : [])
    if (ids.length === 0) return

    let succeeded = 0
    let failed = 0
    let lastErrorMessage: string | null = null

    for (const reconciliationId of ids) {
      try {
        if (dialog.type === "approve") {
          await approveMut.mutateAsync({
            reconciliationId,
            body: {
              reviewer_notes: notes || undefined,
              decided_by: decidedBy || "admin",
            },
          })
        } else {
          await rejectMut.mutateAsync({
            reconciliationId,
            body: {
              reviewer_notes: notes || undefined,
              decided_by: decidedBy || "admin",
            },
          })
        }
        succeeded++
      } catch (e: unknown) {
        failed++
        const msg =
          e instanceof Error
            ? e.message
            : `Failed to ${dialog.type} exception`
        lastErrorMessage = msg
      }
    }

    if (succeeded > 0) {
      toast.success(
        ids.length === 1
          ? `Exception ${dialog.type === "approve" ? "approved" : "rejected"}`
          : `${succeeded} of ${ids.length} ${dialog.type === "approve" ? "approved" : "rejected"}`
      )
    }

    if (failed > 0 && succeeded === 0) {
      setSubmitError(
        lastErrorMessage ??
          `Could not ${dialog.type} ${failed === 1 ? "this exception" : `any of the ${failed} exceptions`}.`
      )
      toast.error(
        `${dialog.type === "approve" ? "Approve" : "Reject"} failed`,
        { description: "See the dialog for details." }
      )
      return
    }

    if (failed > 0) {
      toast.error(`${failed} action${failed === 1 ? "" : "s"} failed`)
    }

    setSelected(new Set())
    closeDialog()
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(allSelectableIds))
  }

  const registerRecon = (invoiceId: string, reconciliationId: string) => {
    setReconMap((prev) =>
      prev[invoiceId] === reconciliationId
        ? prev
        : { ...prev, [invoiceId]: reconciliationId }
    )
  }

  const dialogIds =
    dialog.open
      ? dialog.reconciliationIds ??
        (dialog.reconciliationId ? [dialog.reconciliationId] : [])
      : []
  const dialogIsBulk = dialogIds.length > 1

  return (
    <div className="space-y-8">
      <PageHeader
        title="Exception Queue"
        description="Invoices that need a human decision. Each card shows the agent's recommendation."
        actions={
          invoices && invoices.length > 0 ? (
            <div className="flex items-center gap-2">
              {canWrite && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleAll}
                  className="gap-2"
                  aria-pressed={allSelected}
                >
                  {allSelected ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <CircleDashed className="size-4" />
                  )}
                  {allSelected ? "Deselect all" : "Select all"}
                </Button>
              )}
              <ExportButton
                data={invoices}
                columns={EXCEPTION_COLUMNS}
                filenamePrefix="exceptions"
              />
            </div>
          ) : null
        }
      />

      {/* Bulk action toolbar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-between gap-3 px-5 py-3 rounded-xl border border-primary/30 bg-primary/5">
              <div className="flex items-center gap-3">
                <span className="size-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold tabular-nums">
                  {selected.size}
                </span>
                <span className="text-sm font-medium">
                  {selected.size} invoice{selected.size === 1 ? "" : "s"} selected
                  {!bulkReady && (
                    <span className="ml-2 text-xs text-muted-foreground font-normal">
                      ({selectedReadyCount} of {selected.size} ready)
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelected(new Set())}
                >
                  <X className="size-4" />
                  Clear
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openBulk("reject")}
                  disabled={!bulkReady}
                  title={
                    !bulkReady
                      ? "Waiting for selection details to load"
                      : undefined
                  }
                >
                  <XCircle className="size-4" />
                  Reject all
                </Button>
                <Button
                  size="sm"
                  onClick={() => openBulk("approve")}
                  disabled={!bulkReady}
                  title={
                    !bulkReady
                      ? "Waiting for selection details to load"
                      : undefined
                  }
                >
                  <CheckCircle2 className="size-4" />
                  Approve all
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <TableSkeleton rows={3} />
      ) : !invoices || invoices.length === 0 ? (
        <Card>
          <EmptyState
            illustration={<AllClear className="w-full" />}
            title="All clear"
            description="No invoices currently need review. Great work!"
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {invoices.map((inv, i) => (
            <ExceptionCard
              key={inv.id}
              invoice={inv}
              index={i}
              checked={selected.has(inv.id)}
              onToggle={() => toggleSelect(inv.id)}
              onAction={openSingle}
              onReconLoaded={(reconId) => registerRecon(inv.id, reconId)}
              canWrite={canWrite}
            />
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialog.open} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog.open && dialog.type === "approve"
                ? dialogIsBulk
                  ? `Approve ${dialogIds.length} invoices`
                  : "Approve invoice"
                : dialogIsBulk
                  ? `Reject ${dialogIds.length} invoices`
                  : "Reject invoice"}
            </DialogTitle>
            <DialogDescription>
              {dialogIsBulk
                ? "Your note and reviewer name will be applied to every selected invoice."
                : "Your note and reviewer name will be recorded on this reconciliation."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {submitError && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                {submitError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="reviewer">Reviewer name</Label>
              <Input
                id="reviewer"
                value={decidedBy}
                onChange={(e) => setDecidedBy(e.target.value)}
                placeholder="Your name or role"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  dialog.open && dialog.type === "approve"
                    ? "Reason for manual approval..."
                    : "Reason for rejection..."
                }
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              variant={
                dialog.open && dialog.type === "approve"
                  ? "default"
                  : "destructive"
              }
              onClick={handleSubmit}
              disabled={approveMut.isPending || rejectMut.isPending}
            >
              {dialog.open && dialog.type === "approve"
                ? `Approve${dialogIsBulk ? ` ${dialogIds.length}` : ""}`
                : `Reject${dialogIsBulk ? ` ${dialogIds.length}` : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface ExceptionCardProps {
  invoice: InvoiceListItem
  index: number
  checked: boolean
  onToggle: () => void
  onAction: (type: ActionType, reconciliationId: string) => void
  onReconLoaded: (reconciliationId: string) => void
  canWrite?: boolean
}

function ExceptionCard({
  invoice,
  index,
  checked,
  onToggle,
  onAction,
  onReconLoaded,
  canWrite = true,
}: ExceptionCardProps) {
  const { data: recon } = useReconciliationByInvoice(invoice.id)

  useEffect(() => {
    if (recon?.id) onReconLoaded(recon.id)
  }, [recon?.id, onReconLoaded])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card
        className={cn(
          "hover:shadow-elevated transition-all overflow-hidden",
          checked && "ring-2 ring-primary/40 border-primary/40"
        )}
      >
        <CardContent className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              {canWrite && (
                <Checkbox
                  checked={checked}
                  onCheckedChange={onToggle}
                  className="mt-1.5"
                />
              )}
              <div className="size-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="size-5 text-amber-500" />
              </div>
              <div className="min-w-0">
                <Link
                  to={`/invoices/${invoice.id}`}
                  className="font-semibold hover:underline truncate block"
                >
                  {invoice.invoice_number ?? `Invoice ${shortId(invoice.id)}`}
                </Link>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {formatRelative(invoice.created_at)} ·{" "}
                  {formatCurrency(invoice.total_amount)}
                </div>
              </div>
            </div>
            <Link
              to={`/invoices/${invoice.id}`}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowRight className="size-4" />
            </Link>
          </div>

          {/* Recommendation */}
          {recon && (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Agent recommendation
                </span>
                {recon.confidence_score !== null && (
                  <Badge variant="muted" className="ml-auto">
                    {Math.round(recon.confidence_score * 100)}% confidence
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {recon.recommendation_reasoning ?? recon.agent_recommendation ?? "—"}
              </p>
              {recon.discrepancies.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {recon.discrepancies.slice(0, 3).map((d) => (
                    <Badge
                      key={d.id}
                      variant={
                        d.severity === "critical" ? "destructive" : "warning"
                      }
                      className="text-[10px]"
                    >
                      {d.type.replace(/_/g, " ")}
                    </Badge>
                  ))}
                  {recon.discrepancies.length > 3 && (
                    <Badge variant="muted" className="text-[10px]">
                      +{recon.discrepancies.length - 3} more
                    </Badge>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          {canWrite && recon && (
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="default"
                size="sm"
                className="flex-1"
                onClick={() => onAction("approve", recon.id)}
              >
                <CheckCircle2 className="size-4" />
                Approve
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => onAction("reject", recon.id)}
              >
                <XCircle className="size-4" />
                Reject
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
