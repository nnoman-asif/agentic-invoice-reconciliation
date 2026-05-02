import { motion } from "framer-motion"
import {
  Upload,
  Search,
  Layers,
  AlertTriangle,
  Brain,
  CheckCircle2,
  XCircle,
  User,
} from "lucide-react"

import type { Invoice, Reconciliation } from "@/api/types"
import { formatDateTime, formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"

interface TimelineEvent {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  timestamp: string
  variant: "default" | "success" | "warning" | "destructive" | "muted"
}

const VARIANT_CLASSES: Record<TimelineEvent["variant"], string> = {
  default: "text-primary bg-primary/10 border-primary/20",
  success: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  warning: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  destructive: "text-red-500 bg-red-500/10 border-red-500/20",
  muted: "text-muted-foreground bg-muted/40 border-border/60",
}

function buildEvents(
  invoice: Invoice,
  recon: Reconciliation | null
): TimelineEvent[] {
  const events: TimelineEvent[] = []

  events.push({
    icon: Upload,
    title: "Invoice uploaded",
    description: invoice.raw_file_path
      ? `File saved: ${invoice.raw_file_path.split("/").pop()}`
      : undefined,
    timestamp: invoice.created_at,
    variant: "default",
  })

  if (invoice.parsed_data && invoice.invoice_number) {
    events.push({
      icon: Search,
      title: "Parser extracted invoice data",
      description: `Found ${invoice.line_items?.length ?? 0} line items, total ${invoice.total_amount ?? "—"}`,
      timestamp: invoice.updated_at,
      variant: "default",
    })
  }

  if (recon) {
    if (recon.po_id) {
      events.push({
        icon: Layers,
        title: "Matcher found purchase order",
        description: `Match type: ${recon.match_type.replace("_", " ")}`,
        timestamp: recon.created_at,
        variant: "default",
      })
    }

    if (recon.discrepancies.length > 0) {
      const critical = recon.discrepancies.filter(
        (d) => d.severity === "critical"
      ).length
      events.push({
        icon: AlertTriangle,
        title: `${recon.discrepancies.length} discrepanc${recon.discrepancies.length === 1 ? "y" : "ies"} detected`,
        description:
          critical > 0
            ? `${critical} critical, ${recon.discrepancies.length - critical} other`
            : "All low-severity",
        timestamp: recon.created_at,
        variant: critical > 0 ? "warning" : "muted",
      })
    } else {
      events.push({
        icon: CheckCircle2,
        title: "No discrepancies detected",
        description: "All anomaly checks passed",
        timestamp: recon.created_at,
        variant: "success",
      })
    }

    events.push({
      icon: Brain,
      title: "Resolution agent decision",
      description: recon.agent_recommendation ?? "No recommendation",
      timestamp: recon.created_at,
      variant:
        recon.overall_status === "auto_approved" ||
        recon.overall_status === "approved"
          ? "success"
          : recon.overall_status === "rejected"
            ? "destructive"
            : "warning",
    })

    for (const review of recon.human_reviews) {
      events.push({
        icon: review.decision === "approved" ? CheckCircle2 : XCircle,
        title: `Human ${review.decision} the invoice`,
        description: [
          review.decided_by ? `by ${review.decided_by}` : null,
          review.reviewer_notes,
        ]
          .filter(Boolean)
          .join(" — "),
        timestamp: review.decided_at,
        variant: review.decision === "approved" ? "success" : "destructive",
      })
    }
  }

  if (invoice.processing_status === "failed") {
    events.push({
      icon: XCircle,
      title: "Processing failed",
      description: invoice.error_message ?? "Unknown error",
      timestamp: invoice.updated_at,
      variant: "destructive",
    })
  }

  return events.sort(
    (a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )
}

export function ActivityTimeline({
  invoice,
  reconciliation,
}: {
  invoice: Invoice
  reconciliation: Reconciliation | null
}) {
  const events = buildEvents(invoice, reconciliation)

  return (
    <ol className="relative space-y-1 pl-6">
      <span className="absolute left-4 top-2 bottom-2 w-px bg-border" />
      {events.map((event, i) => {
        const Icon = event.icon
        return (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="relative pb-5 last:pb-0"
          >
            <div
              className={cn(
                "absolute -left-6 size-8 rounded-full border-2 flex items-center justify-center bg-background z-10",
                VARIANT_CLASSES[event.variant]
              )}
            >
              <Icon className="size-3.5" />
            </div>

            <div className="ml-4">
              <div className="flex items-start gap-2 flex-wrap">
                <h4 className="font-medium text-sm leading-snug flex-1 min-w-0">
                  {event.title}
                </h4>
                <time
                  className="text-xs text-muted-foreground shrink-0"
                  title={formatDateTime(event.timestamp)}
                >
                  {formatRelative(event.timestamp)}
                </time>
              </div>
              {event.description && (
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  {event.description}
                </p>
              )}
            </div>
          </motion.li>
        )
      })}

      {events.length === 0 && (
        <li className="text-sm text-muted-foreground py-4">
          <User className="size-4 inline mr-2" />
          No activity yet
        </li>
      )}
    </ol>
  )
}
