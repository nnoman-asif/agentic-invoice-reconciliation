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
      {/* Pulse rings when running. Track the node's actual size with
          inset-0 so they stay aligned across responsive sizes. */}
      {isRunning && (
        <div className="relative size-14 sm:size-20 lg:size-24">
          <motion.div
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
            className="absolute inset-0 rounded-full bg-primary/30"
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
          />
          <NodeBubble
            isCompleted={isCompleted}
            isRunning={isRunning}
            isError={isError}
            active={active}
            Icon={Icon}
            absolute
          />
        </div>
      )}
      {!isRunning && (
        <NodeBubble
          isCompleted={isCompleted}
          isRunning={isRunning}
          isError={isError}
          active={active}
          Icon={Icon}
        />
      )}

      {/* Label. Container is intentionally wider than the bubble so
          longer labels like "Resolution" (~62px at 10px) fit without
          spilling into the adjacent column. The combined column width
          drives the visualizer's min-width below. */}
      <div className="mt-2 sm:mt-3 text-center w-[72px] sm:w-24 lg:w-28">
        <div
          className={cn(
            "font-semibold text-[10px] sm:text-sm leading-tight transition-colors",
            isCompleted || isRunning ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {stage.label}
        </div>
        {stage.duration && (
          <div className="text-[10px] sm:text-xs text-muted-foreground font-mono mt-0.5">
            {stage.duration < 1000
              ? `${stage.duration}ms`
              : `${(stage.duration / 1000).toFixed(1)}s`}
          </div>
        )}
        {isRunning && (
          <div className="text-[10px] sm:text-xs text-primary mt-0.5 font-medium">
            Running…
          </div>
        )}
      </div>
    </motion.button>
  )
}

function NodeBubble({
  isCompleted,
  isRunning,
  isError,
  active,
  Icon,
  absolute,
}: {
  isCompleted: boolean
  isRunning: boolean
  isError: boolean
  active: boolean
  Icon: React.ComponentType<{ className?: string }>
  absolute?: boolean
}) {
  return (
    <div
      className={cn(
        "size-14 sm:size-20 lg:size-24 rounded-full border-2 flex items-center justify-center transition-all duration-500",
        absolute ? "absolute inset-0" : "relative",
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
        <CheckCircle2 className="size-6 sm:size-8 lg:size-9 text-success" />
      ) : isError ? (
        <XCircle className="size-6 sm:size-8 lg:size-9 text-destructive" />
      ) : isRunning ? (
        <Loader2 className="size-6 sm:size-8 lg:size-9 text-primary animate-spin" />
      ) : (
        <Icon className="size-6 sm:size-8 lg:size-9 text-muted-foreground transition-colors" />
      )}
    </div>
  )
}
