import { useEffect, useRef } from "react"
import { useParams, Link } from "react-router-dom"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  FileText,
  Calendar,
  Building2,
  AlertTriangle,
  Sparkles,
  GitCompare,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCcw,
} from "lucide-react"

import { PageSkeleton } from "@/components/shared/LoadingSkeleton"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProcessingStatusBadge } from "@/components/invoice/ProcessingStatusBadge"
import { BusinessStatusBadge } from "@/components/invoice/BusinessStatusBadge"
import { LineItemMatchRow } from "@/components/invoice/LineItemMatchRow"
import { ActivityTimeline } from "@/components/invoice/ActivityTimeline"
import { ConfidenceBar } from "@/components/shared/ConfidenceBar"
import { EmptyState } from "@/components/shared/EmptyState"
import { AllClear } from "@/components/shared/illustrations/AllClear"
import { NoData } from "@/components/shared/illustrations/NoData"
import { NoMatches } from "@/components/shared/illustrations/NoMatches"
import { VendorBadge } from "@/components/shared/VendorBadge"
import { useInvoice, useInvoiceReconciliation } from "@/api/invoices"
import { celebrateFromElement } from "@/lib/confetti"
import {
  formatCurrency,
  formatDate,
  formatDuration,
  shortId,
} from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { cn } from "@/lib/utils"

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const {
    data: invoice,
    isLoading,
    isError,
    error,
    refetch,
  } = useInvoice(id)
  const { data: recon } = useInvoiceReconciliation(id, {
    invoiceProcessingStatus: invoice?.processing_status,
  })

  // Trigger confetti once per approved invoice (auto or manual) and deduplicate across session views.
  const celebratedRef = useRef<Set<string>>(new Set())
  const successBadgeRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!recon || !id) return
    const celebratory =
      recon.overall_status === "auto_approved" ||
      recon.overall_status === "approved"
    if (!celebratory) return
    if (celebratedRef.current.has(id)) return
    celebratedRef.current.add(id)
    // small delay so the badge is mounted and visible
    const t = window.setTimeout(() => {
      celebrateFromElement(successBadgeRef.current)
    }, 250)
    return () => window.clearTimeout(t)
  }, [recon, id])

  if (isLoading) {
    return <PageSkeleton />
  }

  if (isError || !invoice) {
    const message =
      error instanceof Error ? error.message : "Could not load this invoice"
    return (
      <div className="space-y-6">
        <Link to={ROUTES.inbox}>
          <Button variant="ghost" size="sm" className="-ml-3 text-muted-foreground">
            <ArrowLeft className="size-4" />
            Back to inbox
          </Button>
        </Link>
        <Card>
          <EmptyState
            illustration={<NoData className="w-full" />}
            title="Invoice not available"
            description={message}
            action={
              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCcw className="size-4" />
                Try again
              </Button>
            }
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link to={ROUTES.inbox}>
        <Button variant="ghost" size="sm" className="-ml-3 text-muted-foreground">
          <ArrowLeft className="size-4" />
          Back to inbox
        </Button>
      </Link>

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-8"
      >
        <div className="absolute inset-0 gradient-mesh opacity-40 pointer-events-none" />
        <div className="relative flex flex-col lg:flex-row lg:items-start gap-6 justify-between">
          <div className="flex items-start gap-4 min-w-0">
            <div className="size-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <FileText className="size-7 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold tracking-tight truncate">
                  {invoice.invoice_number ?? "Pending parse"}
                </h1>
                <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {shortId(invoice.id)}
                </code>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {invoice.vendor_id && (
                  <VendorBadge vendorId={invoice.vendor_id} />
                )}
                {invoice.po_reference && (
                  <span className="flex items-center gap-1.5">
                    <Building2 className="size-3.5" />
                    PO {invoice.po_reference}
                  </span>
                )}
                {invoice.invoice_date && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="size-3.5" />
                    {formatDate(invoice.invoice_date)}
                  </span>
                )}
                {invoice.total_amount != null && (
                  <span className="font-mono font-medium tabular-nums text-foreground">
                    {formatCurrency(invoice.total_amount, invoice.currency)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <ProcessingStatusBadge
              status={invoice.processing_status}
              queuePosition={invoice.queue_position}
              providerThrottled={invoice.provider_throttled}
            />
            <BusinessStatusBadge status={invoice.business_status} />
          </div>
        </div>
      </motion.div>

      {/* Compare CTA */}
      {recon && (
        <Link to={ROUTES.compareView(invoice.id)}>
          <Card className="hover:shadow-elevated transition-shadow cursor-pointer group">
            <CardContent className="flex items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-gradient-to-br from-blue-500/15 to-indigo-500/15 border border-blue-500/20 flex items-center justify-center">
                  <GitCompare className="size-5 text-blue-500" />
                </div>
                <div>
                  <div className="font-medium">Side-by-side compare</div>
                  <div className="text-sm text-muted-foreground">
                    View invoice next to matched PO and delivery data
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm">
                Open
              </Button>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Reconciliation result */}
      {recon ? (
        <>
          {/* Recommendation */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  Agent recommendation
                </CardTitle>
                <div className="text-sm text-muted-foreground mt-1">
                  {recon.agent_recommendation ?? "—"}
                </div>
              </div>
              <div ref={successBadgeRef} className="shrink-0">
                <Badge
                  variant={
                    recon.overall_status === "auto_approved" || recon.overall_status === "approved"
                      ? "success"
                      : recon.overall_status === "rejected"
                        ? "destructive"
                        : "warning"
                  }
                >
                  {recon.overall_status === "auto_approved" && (
                    <CheckCircle2 className="size-3" />
                  )}
                  {recon.overall_status === "rejected" && <XCircle className="size-3" />}
                  {recon.overall_status === "pending_review" && (
                    <AlertTriangle className="size-3" />
                  )}
                  {recon.overall_status.replace(/_/g, " ")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {recon.recommendation_reasoning && (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {recon.recommendation_reasoning}
                </p>
              )}
              <ConfidenceBar value={recon.confidence_score} size="lg" />
              <div className="grid grid-cols-3 gap-3 pt-2 text-xs">
                <Stat label="Match type" value={recon.match_type.replace(/_/g, " ")} />
                <Stat
                  label="Processing time"
                  value={formatDuration(recon.processing_time_ms)}
                />
                <Stat
                  label="Discrepancies"
                  value={String(recon.discrepancies.length)}
                  highlight={recon.discrepancies.length > 0}
                />
              </div>
            </CardContent>
          </Card>

          {/* Activity timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityTimeline invoice={invoice} reconciliation={recon} />
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="matches">
            <TabsList>
              <TabsTrigger value="matches">
                Line Matches
                <Badge variant="muted" className="ml-2">
                  {recon.line_item_matches.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="discrepancies">
                Discrepancies
                {recon.discrepancies.length > 0 && (
                  <Badge variant="warning" className="ml-2">
                    {recon.discrepancies.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="reviews">
                Reviews
                {recon.human_reviews.length > 0 && (
                  <Badge variant="muted" className="ml-2">
                    {recon.human_reviews.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="raw">Raw Data</TabsTrigger>
            </TabsList>

            <TabsContent value="matches" className="space-y-3">
              {recon.line_item_matches.length === 0 ? (
                <EmptyState
                  illustration={<NoMatches className="w-full" />}
                  title="No line item matches"
                  description="The agent could not match any line items"
                />
              ) : (
                recon.line_item_matches.map((m, i) => (
                  <LineItemMatchRow key={m.id} match={m} index={i} />
                ))
              )}
            </TabsContent>

            <TabsContent value="discrepancies" className="space-y-3">
              {recon.discrepancies.length === 0 ? (
                <EmptyState
                  illustration={<AllClear className="w-full" />}
                  title="No discrepancies"
                  description="This invoice passed all anomaly checks"
                />
              ) : (
                recon.discrepancies.map((d, i) => (
                  <motion.div
                    key={d.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Card className="overflow-hidden">
                      <CardContent className="p-5">
                        <div className="flex items-start gap-3">
                          <Badge
                            variant={
                              d.severity === "critical"
                                ? "destructive"
                                : d.severity === "warning"
                                  ? "warning"
                                  : "muted"
                            }
                          >
                            {d.severity}
                          </Badge>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm mb-1">
                              {d.type.replace(/_/g, " ")}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {d.description}
                            </div>
                            {(d.expected_value || d.actual_value) && (
                              <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
                                {d.expected_value && (
                                  <div>
                                    <span className="text-muted-foreground">Expected: </span>
                                    <span className="font-mono">{d.expected_value}</span>
                                  </div>
                                )}
                                {d.actual_value && (
                                  <div>
                                    <span className="text-muted-foreground">Actual: </span>
                                    <span className="font-mono">{d.actual_value}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              )}
            </TabsContent>

            <TabsContent value="reviews" className="space-y-3">
              {recon.human_reviews.length === 0 ? (
                <EmptyState
                  illustration={<NoData className="w-full" />}
                  title="No human reviews"
                  description="This reconciliation has not been reviewed by a human yet"
                />
              ) : (
                recon.human_reviews.map((r) => (
                  <Card key={r.id}>
                    <CardContent className="p-5 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            r.decision === "approved" ? "success" : "destructive"
                          }
                        >
                          {r.decision}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          by {r.decided_by ?? "anonymous"} •{" "}
                          {formatDate(r.decided_at)}
                        </span>
                      </div>
                      {r.reviewer_notes && (
                        <p className="text-sm text-muted-foreground">
                          {r.reviewer_notes}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="raw">
              <Card>
                <CardContent className="p-0">
                  <pre className="p-5 text-xs font-mono overflow-x-auto leading-relaxed">
                    {JSON.stringify(invoice.parsed_data ?? {}, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <EmptyState
          illustration={<NoData className="w-full" />}
          title="No reconciliation yet"
          description={
            invoice.processing_status === "failed"
              ? `Processing failed: ${invoice.error_message ?? "unknown error"}`
              : "Reconciliation is in progress. This page will update automatically."
          }
        />
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div
        className={cn(
          "font-medium mt-0.5 capitalize",
          highlight && "text-amber-500"
        )}
      >
        {value}
      </div>
    </div>
  )
}
