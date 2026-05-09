import { motion } from "framer-motion"
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from "lucide-react"

import { AnimatedNumber } from "@/components/shared/AnimatedNumber"
import { useDashboardStats } from "@/api/dashboard"
import { cn } from "@/lib/utils"

interface StatBlock {
  label: string
  value: number
  format?: (n: number) => string
  icon: React.ComponentType<{ className?: string }>
  accent: "blue" | "emerald" | "amber" | "purple"
}

const ACCENT: Record<StatBlock["accent"], string> = {
  blue: "text-blue-500 from-blue-500/15",
  emerald: "text-emerald-500 from-emerald-500/15",
  amber: "text-amber-500 from-amber-500/15",
  purple: "text-purple-500 from-purple-500/15",
}

function formatMs(ms: number): string {
  if (!ms || ms <= 0) return "—"
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60_000).toFixed(1)}m`
}

export function LiveStats() {
  const { data: stats } = useDashboardStats()

  const totalInvoices = stats?.total_invoices ?? 0
  // Full optional chaining: `stats?.by_business_status.approved` would
  // try to read `.approved` on `undefined` while loading and throw at
  // first render before data arrives.
  const approved = stats?.by_business_status?.approved ?? 0
  const pendingReview = stats?.by_business_status?.pending_review ?? 0
  const totalDiscrepancies = Object.values(
    stats?.top_discrepancy_types ?? {}
  ).reduce((a, b) => a + b, 0)
  const avgMs = stats?.avg_processing_time_ms ?? 0

  const blocks: StatBlock[] = [
    { label: "Invoices reconciled", value: totalInvoices, icon: FileText, accent: "blue" },
    { label: "Auto-approvals", value: approved, icon: CheckCircle2, accent: "emerald" },
    { label: "Discrepancies caught", value: totalDiscrepancies, icon: AlertTriangle, accent: "amber" },
    { label: "Avg processing", value: avgMs, icon: Clock, accent: "purple", format: formatMs },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      {blocks.map((b, i) => {
        const Icon = b.icon
        return (
          <motion.div
            key={b.label}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.07, duration: 0.4 }}
            className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/50 backdrop-blur-xl p-5 sm:p-6 shadow-soft"
          >
            <div
              className={cn(
                "absolute -top-10 -right-10 size-32 rounded-full blur-3xl bg-gradient-radial",
                ACCENT[b.accent]
              )}
            />
            <div className="relative flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground mb-2">
              <Icon className={cn("size-4", ACCENT[b.accent])} />
              <span>{b.label}</span>
            </div>
            <div className="relative text-3xl sm:text-4xl font-bold tracking-tight tabular-nums">
              <AnimatedNumber value={b.value} format={b.format} />
              {pendingReview > 0 && b.label === "Auto-approvals" && (
                <span className="ml-2 text-xs sm:text-sm font-medium text-muted-foreground/70">
                  · {pendingReview} reviewed
                </span>
              )}
            </div>
            <div className="relative mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live from your DB
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
