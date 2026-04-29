import { useState } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { AlertTriangle, CheckCircle2, XCircle, ArrowRight } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState } from "@/components/shared/EmptyState"
import { TableSkeleton } from "@/components/shared/LoadingSkeleton"
import {
  useApproveException,
  useExceptions,
  useRejectException,
} from "@/api/exceptions"
import { useReconciliationByInvoice } from "@/api/reconciliations"
import { formatCurrency, formatRelative, shortId } from "@/lib/format"
import type { InvoiceListItem } from "@/api/types"

type DialogState = {
  open: boolean
  type: "approve" | "reject"
  invoiceId: string | null
  reconciliationId: string | null
}

export function ExceptionsPage() {
  const { data: invoices, isLoading } = useExceptions()
  const [dialog, setDialog] = useState<DialogState>({
    open: false,
    type: "approve",
    invoiceId: null,
    reconciliationId: null,
  })
  const [notes, setNotes] = useState("")
  const [decidedBy, setDecidedBy] = useState("admin")

  const approveMut = useApproveException()
  const rejectMut = useRejectException()

  const closeDialog = () => {
    setDialog({ ...dialog, open: false })
    setNotes("")
  }

  const submit = async () => {
    if (!dialog.reconciliationId) return
    try {
      const args = {
        reconciliationId: dialog.reconciliationId,
        body: { reviewer_notes: notes || null, decided_by: decidedBy || null },
      }
      if (dialog.type === "approve") {
        await approveMut.mutateAsync(args)
        toast.success("Exception approved", {
          description: "Invoice has been approved.",
        })
      } else {
        await rejectMut.mutateAsync(args)
        toast.success("Exception rejected", {
          description: "Invoice has been rejected.",
        })
      }
      closeDialog()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Action failed"
      toast.error("Failed", { description: message })
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Exception Queue"
        description="Invoices that need a human decision. Each card shows the agent's recommendation."
      />

      {isLoading ? (
        <TableSkeleton rows={3} />
      ) : !invoices || invoices.length === 0 ? (
        <Card>
          <EmptyState
            icon={CheckCircle2}
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
              onAction={(type, recId) =>
                setDialog({
                  open: true,
                  type,
                  invoiceId: inv.id,
                  reconciliationId: recId,
                })
              }
            />
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialog.open} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog.type === "approve" ? "Approve invoice" : "Reject invoice"}
            </DialogTitle>
            <DialogDescription>
              Add an optional note explaining your decision. This will be stored
              for audit and used by the RAG retriever for future similar cases.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="decided-by">Reviewer</Label>
              <Input
                id="decided-by"
                placeholder="your name"
                value={decidedBy}
                onChange={(e) => setDecidedBy(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder={
                  dialog.type === "approve"
                    ? "e.g., Price increase was pre-approved by procurement"
                    : "e.g., Unauthorized vendor change"
                }
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              variant={dialog.type === "reject" ? "destructive" : "default"}
              disabled={approveMut.isPending || rejectMut.isPending}
            >
              {dialog.type === "approve" ? (
                <CheckCircle2 className="size-4" />
              ) : (
                <XCircle className="size-4" />
              )}
              {dialog.type === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ExceptionCard({
  invoice,
  index,
  onAction,
}: {
  invoice: InvoiceListItem
  index: number
  onAction: (type: "approve" | "reject", reconciliationId: string) => void
}) {
  const { data: recon } = useReconciliationByInvoice(invoice.id)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className="hover:shadow-elevated transition-all overflow-hidden">
        <CardContent className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
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
          {recon && (
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
