import { motion } from "framer-motion"
import {
  Loader2,
  Clock,
  Search,
  Layers,
  Brain,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { ProcessingStatus } from "@/api/types"
import { cn } from "@/lib/utils"

type Config = {
  label: string
  icon: React.ComponentType<{ className?: string }>
  variant: "default" | "secondary" | "success" | "destructive" | "warning" | "muted"
  spinning?: boolean
}

const CONFIG: Record<ProcessingStatus, Config> = {
  queued: { label: "Queued", icon: Clock, variant: "muted" },
  parsing: { label: "Parsing", icon: Search, variant: "default", spinning: true },
  matching: { label: "Matching", icon: Layers, variant: "default", spinning: true },
  resolving: { label: "Resolving", icon: Brain, variant: "default", spinning: true },
  completed: { label: "Completed", icon: CheckCircle2, variant: "success" },
  failed: { label: "Failed", icon: XCircle, variant: "destructive" },
}

// Backend uses `str` columns (not enums) so the API can technically
// return any value. Falling back to a neutral badge keeps the UI alive
// instead of throwing `Cannot read properties of undefined`.
function getConfig(status: ProcessingStatus): Config {
  return CONFIG[status] ?? { label: status, icon: HelpCircle, variant: "muted" }
}

export function ProcessingStatusBadge({
  status,
  className,
}: {
  status: ProcessingStatus
  className?: string
}) {
  const config = getConfig(status)
  const Icon = config.icon

  const isActive = config.spinning

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      key={status}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
    >
      <Badge variant={config.variant} className={cn("gap-1.5", className)}>
        {isActive ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Icon className="size-3" />
        )}
        {config.label}
      </Badge>
    </motion.div>
  )
}
