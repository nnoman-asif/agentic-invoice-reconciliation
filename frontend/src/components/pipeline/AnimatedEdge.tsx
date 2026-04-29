import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface Props {
  active: boolean
  completed: boolean
  className?: string
}

export function AnimatedEdge({ active, completed, className }: Props) {
  return (
    <div className={cn("relative h-px flex-1", className)}>
      {/* Base track */}
      <div
        className={cn(
          "absolute inset-0 transition-colors",
          completed
            ? "bg-success/40"
            : active
              ? "bg-primary/40"
              : "bg-border"
        )}
      />

      {/* Flowing dot */}
      {active && (
        <motion.div
          initial={{ left: "0%", opacity: 0 }}
          animate={{
            left: ["0%", "100%"],
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "linear",
            times: [0, 0.1, 0.9, 1],
          }}
          className="absolute -top-1 size-2.5 rounded-full bg-primary shadow-[0_0_8px_2px_rgba(59,130,246,0.6)]"
        />
      )}

      {/* Glow line for active */}
      {active && (
        <motion.div
          initial={{ scaleX: 0, originX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50 blur-sm"
        />
      )}
    </div>
  )
}
