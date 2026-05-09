import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Ban,
  HelpCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { BusinessStatus } from "@/api/types"

type Config = {
  label: string
  icon: React.ComponentType<{ className?: string }>
  variant: "default" | "secondary" | "success" | "destructive" | "warning" | "muted"
}

const CONFIG: Record<BusinessStatus, Config> = {
  pending: { label: "Pending", icon: Clock, variant: "muted" },
  approved: { label: "Approved", icon: CheckCircle2, variant: "success" },
  rejected: { label: "Rejected", icon: XCircle, variant: "destructive" },
  pending_review: {
    label: "Needs Review",
    icon: AlertTriangle,
    variant: "warning",
  },
  cancelled: { label: "Cancelled", icon: Ban, variant: "muted" },
}

// Backend uses `str` columns (not enums) so the API can technically
// return any value. Falling back to a neutral badge keeps the UI alive
// instead of throwing `Cannot read properties of undefined`.
function getConfig(status: BusinessStatus): Config {
  return CONFIG[status] ?? { label: status, icon: HelpCircle, variant: "muted" }
}

export function BusinessStatusBadge({ status }: { status: BusinessStatus }) {
  const config = getConfig(status)
  const Icon = config.icon
  return (
    <Badge variant={config.variant} className="gap-1.5">
      <Icon className="size-3" />
      {config.label}
    </Badge>
  )
}
