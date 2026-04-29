import { motion } from "framer-motion"
import { CheckCircle2, AlertCircle, MinusCircle, XCircle } from "lucide-react"

import type { LineItemMatch, LineMatchStatus } from "@/api/types"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format"

const STATUS_CONFIG: Record<
  LineMatchStatus,
  {
    label: string
    icon: React.ComponentType<{ className?: string }>
    variant: "success" | "warning" | "destructive" | "muted"
    color: string
  }
> = {
  matched: {
    label: "Matched",
    icon: CheckCircle2,
    variant: "success",
    color: "text-emerald-500",
  },
  partial: {
    label: "Partial",
    icon: AlertCircle,
    variant: "warning",
    color: "text-amber-500",
  },
  mismatch: {
    label: "Mismatch",
    icon: XCircle,
    variant: "destructive",
    color: "text-red-500",
  },
  unmatched: {
    label: "Unmatched",
    icon: MinusCircle,
    variant: "muted",
    color: "text-muted-foreground",
  },
}

export function LineItemMatchRow({
  match,
  index,
}: {
  match: LineItemMatch
  index: number
}) {
  const cfg = STATUS_CONFIG[match.status]
  const Icon = cfg.icon
  const sim = match.description_similarity

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Card className="overflow-hidden">
        <div className="flex items-center gap-4 px-5 py-4 border-b border-border/60 bg-muted/20">
          <div className={cn("flex items-center gap-2", cfg.color)}>
            <Icon className="size-4" />
            <Badge variant={cfg.variant}>{cfg.label}</Badge>
          </div>
          {sim !== null && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Similarity</span>
              <span className="font-mono font-medium tabular-nums">
                {(sim * 100).toFixed(0)}%
              </span>
            </div>
          )}
          <div className="ml-auto text-xs text-muted-foreground font-mono">
            Line #{index + 1}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border/60">
          <Cell label="Invoiced" value={match.quantity_invoiced} price={match.price_invoiced} />
          <Cell label="Ordered" value={match.quantity_ordered} price={match.price_ordered} />
          <Cell label="Delivered" value={match.quantity_delivered} price={null} />
        </div>
        {match.price_deviation_pct !== null && match.price_deviation_pct > 0 && (
          <div className="px-5 py-2.5 border-t border-border/60 bg-muted/10 text-xs text-muted-foreground flex items-center gap-2">
            <span>Price deviation:</span>
            <span
              className={cn(
                "font-mono font-medium tabular-nums",
                match.price_deviation_pct > 5 ? "text-amber-500" : ""
              )}
            >
              {formatPercent(match.price_deviation_pct)}
            </span>
          </div>
        )}
      </Card>
    </motion.div>
  )
}

function Cell({
  label,
  value,
  price,
}: {
  label: string
  value: number | null
  price: number | null
}) {
  return (
    <div className="px-5 py-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
        {label}
      </div>
      <div className="text-2xl font-semibold font-mono tabular-nums">
        {value === null ? "—" : formatNumber(value, value % 1 === 0 ? 0 : 2)}
      </div>
      {price !== null && (
        <div className="text-xs text-muted-foreground mt-0.5">
          @ {formatCurrency(price)}
        </div>
      )}
    </div>
  )
}
