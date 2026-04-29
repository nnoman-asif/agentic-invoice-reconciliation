import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Ban,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { BusinessStatus } from "@/api/types"

const CONFIG: Record<
  BusinessStatus,
  {
    label: string
    icon: React.ComponentType<{ className?: string }>
    variant: "default" | "secondary" | "success" | "destructive" | "warning" | "muted"
  }
> = {
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

export function BusinessStatusBadge({ status }: { status: BusinessStatus }) {
  const config = CONFIG[status]
  const Icon = config.icon
  return (
    <Badge variant={config.variant} className="gap-1.5">
      <Icon className="size-3" />
      {config.label}
    </Badge>
  )
}
