import { FileText, CheckCircle2, AlertTriangle, Activity } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard } from "@/components/dashboard/StatCard"
import { MatchRateChart } from "@/components/dashboard/MatchRateChart"
import { TopDiscrepanciesChart } from "@/components/dashboard/TopDiscrepanciesChart"
import { ActivityFeed } from "@/components/dashboard/ActivityFeed"
import { ProcessingTimeCard } from "@/components/dashboard/ProcessingTimeChart"
import { useDashboardStats } from "@/api/dashboard"
import { PageSkeleton } from "@/components/shared/LoadingSkeleton"

export function DashboardPage() {
  const { data: stats, isLoading } = useDashboardStats()

  if (isLoading || !stats) {
    return <PageSkeleton />
  }

  const approved = stats.by_business_status.approved ?? 0
  const pendingReview = stats.by_business_status.pending_review ?? 0
  const completed = stats.by_processing_status.completed ?? 0
  const totalDiscrepancies = Object.values(stats.top_discrepancy_types).reduce(
    (a, b) => a + b,
    0
  )

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Real-time overview of your invoice reconciliation pipeline."
      />

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Invoices"
          value={stats.total_invoices}
          icon={FileText}
          accent="blue"
          index={0}
        />
        <StatCard
          label="Auto-Approved"
          value={approved}
          icon={CheckCircle2}
          accent="emerald"
          index={1}
        />
        <StatCard
          label="Needs Review"
          value={pendingReview}
          icon={AlertTriangle}
          accent="amber"
          index={2}
        />
        <StatCard
          label="Completed"
          value={completed}
          icon={Activity}
          accent="purple"
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
