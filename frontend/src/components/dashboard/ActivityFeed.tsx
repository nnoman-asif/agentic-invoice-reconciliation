import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { FileText } from "lucide-react"

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { ProcessingStatusBadge } from "@/components/invoice/ProcessingStatusBadge"
import { useInvoices } from "@/api/invoices"
import { formatRelative, formatCurrency, shortId } from "@/lib/format"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/EmptyState"
import { EmptyInbox } from "@/components/shared/illustrations/EmptyInbox"

export function ActivityFeed() {
  const { data: invoices, isLoading } = useInvoices()
  const recent = invoices?.slice(0, 8) ?? []

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Latest invoices being processed</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))
        ) : recent.length === 0 ? (
          <EmptyState
            illustration={<EmptyInbox className="w-full" />}
            title="No invoices yet"
            description="Upload an invoice to get started"
          />
        ) : (
          recent.map((inv, i) => (
            <motion.div
              key={inv.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Link
                to={`/invoices/${inv.id}`}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/50 transition-colors group"
              >
                <div className="size-9 rounded-lg bg-muted/60 border border-border/60 flex items-center justify-center shrink-0 group-hover:border-primary/40 transition-colors">
                  <FileText className="size-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">
                      {inv.invoice_number ?? `Invoice ${shortId(inv.id)}`}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                      {formatCurrency(inv.total_amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <ProcessingStatusBadge status={inv.processing_status} />
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatRelative(inv.created_at)}
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
