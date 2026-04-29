import { motion } from "framer-motion"
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Search,
  Layers,
  AlertTriangle,
  Brain,
} from "lucide-react"

import { cn } from "@/lib/utils"
import type { AgentStage, AgentStageState } from "@/hooks/useLivePipeline"

const ICONS: Record<AgentStage, React.ComponentType<{ className?: string }>> = {
  parser: Search,
  matcher: Layers,
  anomaly: AlertTriangle,
  resolution: Brain,
}

interface Props {
  stage: AgentStageState
  active: boolean
  onClick?: () => void
}

export function AgentNode({ stage, active, onClick }: Props) {
  const Icon = ICONS[stage.id]
  const isCompleted = stage.status === "completed"
  const isRunning = stage.status === "running"
  const isError = stage.status === "error"

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "relative group flex flex-col items-center cursor-pointer",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl"
      )}
    >
      {/* Pulse rings when running */}
      {isRunning && (
        <>
          <motion.div
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
            className="absolute inset-0 rounded-full bg-primary/30"
            style={{ width: 96, height: 96 }}
          />
          <motion.div
            initial={{ scale: 1, opacity: 0.4 }}
            animate={{ scale: 1.3, opacity: 0 }}
            transition={{
              duration: 1.6,
              repeat: Infinity,
              ease: "easeOut",
              delay: 0.4,
            }}
            className="absolute inset-0 rounded-full bg-primary/30"
            style={{ width: 96, height: 96 }}
          />
        </>
      )}

      {/* Node */}
      <div
        className={cn(
          "relative size-24 rounded-full border-2 flex items-center justify-center transition-all duration-500",
          isCompleted
            ? "bg-success/10 border-success/40 shadow-[0_0_24px_rgba(34,197,94,0.25)]"
            : isRunning
              ? "bg-primary/10 border-primary shadow-glow"
              : isError
                ? "bg-destructive/10 border-destructive/40 shadow-[0_0_24px_rgba(239,68,68,0.25)]"
                : "bg-card border-border/60",
          active && "ring-4 ring-primary/30"
        )}
      >
        {isCompleted ? (
          <CheckCircle2 className="size-9 text-success" />
        ) : isError ? (
          <XCircle className="size-9 text-destructive" />
        ) : isRunning ? (
          <Loader2 className="size-9 text-primary animate-spin" />
        ) : (
          <Icon
            className={cn(
              "size-9 transition-colors",
              "text-muted-foreground"
            )}
          />
        )}
      </div>

      {/* Label */}
      <div className="mt-3 text-center">
        <div
          className={cn(
            "font-semibold text-sm transition-colors",
            isCompleted || isRunning ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {stage.label}
        </div>
        {stage.duration && (
          <div className="text-xs text-muted-foreground font-mono mt-0.5">
            {stage.duration < 1000
              ? `${stage.duration}ms`
              : `${(stage.duration / 1000).toFixed(1)}s`}
          </div>
        )}
        {isRunning && (
          <div className="text-xs text-primary mt-0.5 font-medium">
            Running…
          </div>
        )}
      </div>
    </motion.button>
  )
}
