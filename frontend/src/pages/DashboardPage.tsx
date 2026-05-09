import { FileText, CheckCircle2, AlertTriangle, Activity } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard } from "@/components/dashboard/StatCard"
import { MatchRateChart } from "@/components/dashboard/MatchRateChart"
import { TopDiscrepanciesChart } from "@/components/dashboard/TopDiscrepanciesChart"
import { ActivityFeed } from "@/components/dashboard/ActivityFeed"
import { LiveActivityPulse } from "@/components/dashboard/LiveActivityPulse"
import { ProcessingTimeCard } from "@/components/dashboard/ProcessingTimeChart"
import { useDashboardStats } from "@/api/dashboard"
import { useDailyTrends } from "@/hooks/useDailyTrends"
import { PageSkeleton } from "@/components/shared/LoadingSkeleton"

export function DashboardPage() {
  const { data: stats, isLoading } = useDashboardStats()
  const trends = useDailyTrends()

  if (isLoading || !stats) {
    return <PageSkeleton />
  }

  const approved = stats.by_business_status?.approved ?? 0
  const pendingReview = stats.by_business_status?.pending_review ?? 0
  const completed = stats.by_processing_status?.completed ?? 0
  // True total across every discrepancy row, not just the top-10 types
  // surfaced in the chart -- otherwise the summary number could lie
  // when there are more than 10 distinct discrepancy types.
  const totalDiscrepancies = stats.total_discrepancies

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Real-time overview of your invoice reconciliation pipeline."
      />

      <LiveActivityPulse />

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Invoices"
          value={stats.total_invoices}
          icon={FileText}
          accent="blue"
          sparkline={trends.total}
          index={0}
        />
        <StatCard
          // "Approved" rather than "Auto-Approved" -- this count
          // includes manually approved invoices too, not just the
          // ones the agent auto-approved.
          label="Approved"
          value={approved}
          icon={CheckCircle2}
          accent="emerald"
          sparkline={trends.approved}
          index={1}
        />
        <StatCard
          label="Needs Review"
          value={pendingReview}
          icon={AlertTriangle}
          accent="amber"
          sparkline={trends.pendingReview}
          index={2}
        />
        <StatCard
          label="Completed"
          value={completed}
          icon={Activity}
          accent="purple"
          sparkline={trends.completed}
          index={3}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MatchRateChart matchRate={stats.match_rate} />
        <ProcessingTimeCard
          avgMs={stats.avg_processing_time_ms}
          totalReconciliations={stats.total_reconciliations}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TopDiscrepanciesChart discrepancies={stats.top_discrepancy_types} />
          <div className="mt-2 text-xs text-muted-foreground">
            {totalDiscrepancies} total discrepancies detected across all
            invoices
          </div>
        </div>
        <ActivityFeed />
      </div>
    </div>
  )
}
