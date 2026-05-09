import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface ConfidenceBarProps {
  value: number | null | undefined // 0-1
  label?: boolean
  size?: "sm" | "md" | "lg"
  className?: string
}

export function ConfidenceBar({
  value,
  label = true,
  size = "md",
  className,
}: ConfidenceBarProps) {
  // Clamp to [0, 1] and guard NaN / Infinity so a bad backend value
  // never produces a width > 100% or breaks the layout entirely.
  const safe = Number.isFinite(value) ? Math.min(1, Math.max(0, value as number)) : 0
  const pct = Math.round(safe * 100)

  const heightCls =
    size === "sm" ? "h-1" : size === "lg" ? "h-3" : "h-2"

  const colorCls =
    pct >= 90
      ? "from-emerald-500 to-emerald-400"
      : pct >= 70
        ? "from-blue-500 to-blue-400"
        : pct >= 50
          ? "from-amber-500 to-amber-400"
          : "from-red-500 to-red-400"

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Confidence</span>
          <span className="font-mono font-medium tabular-nums">{pct}%</span>
        </div>
      )}
      <div className={cn("w-full overflow-hidden rounded-full bg-muted", heightCls)}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "h-full rounded-full bg-gradient-to-r",
            colorCls
          )}
        />
      </div>
    </div>
  )
}
