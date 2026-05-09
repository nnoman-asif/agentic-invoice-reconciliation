import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  Bell,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileUp,
  AlertOctagon,
  Trash2,
  Check,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useUIStore, type AppNotification } from "@/store/ui"
import { formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"

const ICONS: Record<
  AppNotification["type"],
  { icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  uploaded: { icon: FileUp, color: "text-blue-500" },
  approved: { icon: CheckCircle2, color: "text-emerald-500" },
  needs_review: { icon: AlertTriangle, color: "text-amber-500" },
  rejected: { icon: XCircle, color: "text-red-500" },
  failed: { icon: AlertOctagon, color: "text-red-500" },
}

export function NotificationBell() {
  const notifications = useUIStore((s) => s.notifications)
  const unread = useUIStore((s) => s.unreadCount)
  const markRead = useUIStore((s) => s.markRead)
  const markAllRead = useUIStore((s) => s.markAllRead)
  const clear = useUIStore((s) => s.clearNotifications)
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  const handleItemClick = (n: AppNotification) => {
    if (!n.read) markRead(n.id)
    setOpen(false)
    navigate(`/invoices/${n.invoiceId}`)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 relative"
          aria-label={
            unread > 0 ? `Notifications (${unread} unread)` : "Notifications"
          }
        >
          <Bell className="size-4" />
          <AnimatePresence>
            {unread > 0 && (
              <motion.span
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute top-1.5 right-1.5 min-w-[16px] h-[16px] px-[3px] rounded-full bg-red-500 text-white text-[9px] font-semibold flex items-center justify-center shadow-[0_0_0_2px_hsl(var(--background))]"
              >
                {unread > 9 ? "9+" : unread}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/60">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Notifications</span>
            {notifications.length > 0 && (
              <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {notifications.length}
              </span>
            )}
          </div>
          {notifications.length > 0 && (
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation()
                    markAllRead()
                  }}
                >
                  <Check className="size-3" />
                  Read all
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation()
                  clear()
                }}
              >
                <Trash2 className="size-3" />
                Clear
              </Button>
            </div>
          )}
        </div>

        <div className="max-h-[360px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-10 px-4 text-center">
              <div className="size-10 rounded-full bg-muted/60 border border-border/60 flex items-center justify-center mx-auto mb-3">
                <Bell className="size-4 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                No notifications yet
              </p>
            </div>
          ) : (
            <ul className="py-1">
              {notifications.map((n) => {
                const cfg = ICONS[n.type]
                const Icon = cfg.icon
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleItemClick(n)}
                      className={cn(
                        "w-full text-left flex items-start gap-3 px-3 py-2.5 hover:bg-accent/50 transition-colors",
                        !n.read && "bg-primary/5"
                      )}
                    >
                      <Icon className={cn("size-4 mt-0.5 shrink-0", cfg.color)} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm leading-snug">{n.message}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {formatRelative(new Date(n.timestamp))}
                        </div>
                      </div>
                      {!n.read && (
                        <span className="size-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
