import { motion } from "framer-motion"
import { CheckCircle2, AlertCircle, XCircle, MinusCircle } from "lucide-react"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { LineItemMatch, LineMatchStatus } from "@/api/types"
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format"
import { cn } from "@/lib/utils"

interface Props {
  match: LineItemMatch
  index: number
  hovered: boolean
  onHover: (id: string | null) => void
}

const ICONS: Record<LineMatchStatus, React.ComponentType<{ className?: string }>> = {
  matched: CheckCircle2,
  partial: AlertCircle,
  mismatch: XCircle,
  unmatched: MinusCircle,
}

const STATUS_COLOR: Record<LineMatchStatus, string> = {
  matched: "border-emerald-500/40 bg-emerald-500/5",
  partial: "border-amber-500/40 bg-amber-500/5",
  mismatch: "border-red-500/40 bg-red-500/5",
  unmatched: "border-border bg-card",
}

const ICON_COLOR: Record<LineMatchStatus, string> = {
  matched: "text-emerald-500",
  partial: "text-amber-500",
  mismatch: "text-red-500",
  unmatched: "text-muted-foreground",
}

export function MatchedItemCard({ match, index, hovered, onHover }: Props) {
  const Icon = ICONS[match.status]
  const sim = match.description_similarity ?? 0

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      data-match-id={match.id}
      onMouseEnter={() => onHover(match.id)}
      onMouseLeave={() => onHover(null)}
    >
      <Card
        className={cn(
          "transition-all border",
          STATUS_COLOR[match.status],
          hovered && "shadow-glow scale-[1.02]"
        )}
      >
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Icon className={cn("size-4", ICON_COLOR[match.status])} />
              <Badge variant="outline" className="capitalize">
                {match.status}
              </Badge>
            </div>
            <div className="text-xs font-mono tabular-nums text-muted-foreground">
              Line #{index + 1}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <div className="text-muted-foreground mb-0.5">Qty</div>
              <div className="font-mono font-semibold tabular-nums">
                {formatNumber(match.quantity_invoiced ?? 0, 0)}
              </div>
              {match.quantity_ordered !== null && (
                <div className="text-[10px] text-muted-foreground tabular-nums">
                  ord {formatNumber(match.quantity_ordered, 0)}
                </div>
              )}
            </div>
            <div>
              <div className="text-muted-foreground mb-0.5">Price</div>
              <div className="font-mono font-semibold tabular-nums">
                {formatCurrency(match.price_invoiced)}
              </div>
              {match.price_deviation_pct !== null &&
                match.price_deviation_pct > 0 && (
                  <div
                    className={cn(
                      "text-[10px] tabular-nums",
                      match.price_deviation_pct > 5
                        ? "text-amber-500"
                        : "text-muted-foreground"
                    )}
                  >
                    {formatPercent(match.price_deviation_pct)} dev
                  </div>
                )}
            </div>
            <div>
              <div className="text-muted-foreground mb-0.5">Similarity</div>
              <div className="font-mono font-semibold tabular-nums">
                {Math.round(sim * 100)}%
              </div>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
