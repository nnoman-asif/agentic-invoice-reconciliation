import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import { AnimatedNumber } from "@/components/shared/AnimatedNumber"
import { Sparkline } from "@/components/dashboard/Sparkline"
import { cn } from "@/lib/utils"
import { TrendingDown, TrendingUp } from "lucide-react"

type Accent = "blue" | "emerald" | "amber" | "purple"

interface StatCardProps {
  label: string
  value: number
  format?: (n: number) => string
  icon: React.ComponentType<{ className?: string }>
  trend?: {
    value: number
    label: string
  }
  /** 7+ data points rendered as a sparkline at the bottom of the card */
  sparkline?: number[]
  accent?: Accent
  index?: number
}

const ACCENT: Record<Accent, string> = {
  blue: "from-blue-500/15 to-blue-500/0 text-blue-500",
  emerald: "from-emerald-500/15 to-emerald-500/0 text-emerald-500",
  amber: "from-amber-500/15 to-amber-500/0 text-amber-500",
  purple: "from-purple-500/15 to-purple-500/0 text-purple-500",
}

const SPARK_COLOR: Record<Accent, string> = {
  blue: "rgb(59 130 246)",
  emerald: "rgb(16 185 129)",
  amber: "rgb(245 158 11)",
  purple: "rgb(168 85 247)",
}

export function StatCard({
  label,
  value,
  format,
  icon: Icon,
  trend,
  sparkline,
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

        {sparkline && sparkline.length > 1 && (
          <div className="relative mt-4 -mx-1">
            <Sparkline
              data={sparkline}
              color={SPARK_COLOR[accent]}
              width={240}
              height={36}
              className="w-full"
            />
            <div className="text-[10px] text-muted-foreground/80 mt-1">
              Last 7 days
            </div>
          </div>
        )}
      </Card>
    </motion.div>
  )
}
