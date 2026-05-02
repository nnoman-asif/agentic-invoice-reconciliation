import { Link } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Activity } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { useInvoices } from "@/api/invoices"
import { ProcessingStatusBadge } from "@/components/invoice/ProcessingStatusBadge"
import { shortId } from "@/lib/format"

const ACTIVE_STATUSES = ["queued", "parsing", "matching", "resolving"] as const

export function LiveActivityPulse() {
  const { data: invoices } = useInvoices()
  const active = invoices?.filter((inv) =>
    ACTIVE_STATUSES.includes(
      inv.processing_status as (typeof ACTIVE_STATUSES)[number]
    )
  ) ?? []

  return (
    <AnimatePresence>
      {active.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -8, height: 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden"
        >
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2.5">
                <span className="relative flex size-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full size-2.5 bg-primary" />
                </span>
                <span className="text-sm font-semibold">
                  Processing {active.length} invoice
                  {active.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                {active.slice(0, 4).map((inv) => (
                  <Link
                    key={inv.id}
                    to={`/invoices/${inv.id}`}
                    className="flex items-center gap-2 text-xs bg-background/60 px-2.5 py-1.5 rounded-lg border border-border/60 hover:border-primary/40 transition-colors group"
                  >
                    <Activity className="size-3 text-primary shrink-0 group-hover:animate-pulse" />
                    <span className="font-mono">
                      {inv.invoice_number ?? shortId(inv.id)}
                    </span>
                    <ProcessingStatusBadge
                      status={inv.processing_status}
                      className="text-[10px]"
                    />
                  </Link>
                ))}
                {active.length > 4 && (
                  <span className="text-xs text-muted-foreground">
                    +{active.length - 4} more
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
