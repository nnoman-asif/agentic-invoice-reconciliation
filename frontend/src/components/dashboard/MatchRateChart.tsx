import { motion } from "framer-motion"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface Props {
  matchRate: Record<string, number>
}

const TYPE_LABELS: Record<string, string> = {
  full_match: "Full Match",
  partial_match: "Partial Match",
  no_match: "No Match",
}

const TYPE_COLORS: Record<string, string> = {
  full_match: "bg-emerald-500",
  partial_match: "bg-amber-500",
  no_match: "bg-red-500",
}

export function MatchRateChart({ matchRate }: Props) {
  const total = Object.values(matchRate).reduce((a, b) => a + b, 0)
  const types = ["full_match", "partial_match", "no_match"]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Match Distribution</CardTitle>
        <CardDescription>
          Breakdown of how invoices were reconciled
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Stacked bar */}
        <div className="h-3 w-full rounded-full overflow-hidden flex bg-muted">
          {types.map((type) => {
            const count = matchRate[type] ?? 0
            const pct = total > 0 ? (count / total) * 100 : 0
            if (pct === 0) return null
            return (
              <motion.div
                key={type}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className={cn("h-full", TYPE_COLORS[type])}
              />
            )
          })}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-3 gap-3">
          {types.map((type) => {
            const count = matchRate[type] ?? 0
            const pct = total > 0 ? Math.round((count / total) * 100) : 0
            return (
              <div key={type} className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className={cn("size-2.5 rounded-full", TYPE_COLORS[type])} />
                  <span className="text-xs text-muted-foreground">
                    {TYPE_LABELS[type]}
                  </span>
                </div>
                <div className="text-2xl font-semibold tabular-nums">{count}</div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {pct}%
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
