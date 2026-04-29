import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import { AnimatedNumber } from "@/components/shared/AnimatedNumber"
import { cn } from "@/lib/utils"
import { TrendingDown, TrendingUp } from "lucide-react"

interface StatCardProps {
  label: string
  value: number
  format?: (n: number) => string
  icon: React.ComponentType<{ className?: string }>
  trend?: {
    value: number
    label: string
  }
  accent?: "blue" | "emerald" | "amber" | "purple"
  index?: number
}

const ACCENT: Record<NonNullable<StatCardProps["accent"]>, string> = {
  blue: "from-blue-500/15 to-blue-500/0 text-blue-500",
  emerald: "from-emerald-500/15 to-emerald-500/0 text-emerald-500",
  amber: "from-amber-500/15 to-amber-500/0 text-amber-500",
  purple: "from-purple-500/15 to-purple-500/0 text-purple-500",
}

export function StatCard({
  label,
  value,
  format,
  icon: Icon,
  trend,
  accent = "blue",
  index = 0,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.05,
        duration: 0.4,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <Card className="relative overflow-hidden p-6 hover:shadow-elevated transition-shadow group">
        {/* Decorative gradient blur */}
        <div
          className={cn(
            "absolute -top-12 -right-12 size-40 rounded-full blur-3xl opacity-60 bg-gradient-radial",
            ACCENT[accent]
          )}
        />

        <div className="relative flex items-start justify-between mb-3">
          <span className="text-sm font-medium text-muted-foreground">
            {label}
          </span>
          <div
            className={cn(
              "size-9 rounded-lg flex items-center justify-center bg-gradient-to-br",
              ACCENT[accent]
            )}
          >
            <Icon className="size-4" />
          </div>
        </div>

        <div className="text-4xl font-bold tracking-tight tabular-nums">
          <AnimatedNumber value={value} format={format} />
        </div>

        {trend && (
          <div className="mt-3 flex items-center gap-1.5 text-xs">
            {trend.value >= 0 ? (
              <TrendingUp className="size-3.5 text-emerald-500" />
            ) : (
              <TrendingDown className="size-3.5 text-red-500" />
            )}
            <span
              className={cn(
                "font-medium tabular-nums",
                trend.value >= 0 ? "text-emerald-500" : "text-red-500"
              )}
            >
              {trend.value > 0 ? "+" : ""}
              {trend.value}%
            </span>
            <span className="text-muted-foreground">{trend.label}</span>
          </div>
        )}
      </Card>
    </motion.div>
  )
}
