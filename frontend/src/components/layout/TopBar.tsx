import { Search, Command, Activity, Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useUIStore } from "@/store/ui"
import { useHealth } from "@/api/health"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { ThemeToggle } from "./ThemeToggle"
import { NotificationBell } from "./NotificationBell"
import { useMobileSidebar } from "./MobileSidebar"
import { cn } from "@/lib/utils"

export function TopBar() {
  const setCommandOpen = useUIStore((s) => s.setCommandPaletteOpen)
  const openMobileSidebar = useMobileSidebar((s) => s.setOpen)
  const { data: health } = useHealth()
  const isDesktop = useMediaQuery("(min-width: 1024px)")

  const overallHealthy = health?.status === "healthy"

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-border/60 bg-background/70 backdrop-blur-2xl">
      <div className="flex items-center justify-between gap-3 h-full px-4 sm:px-6">
        {/* Mobile hamburger */}
        {!isDesktop && (
          <Button
            variant="ghost"
            size="icon"
            className="size-9 shrink-0"
            onClick={() => openMobileSidebar(true)}
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </Button>
        )}

        {/* Search trigger */}
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          aria-label="Open command palette"
          aria-keyshortcuts="Control+K Meta+K"
          className="group flex items-center gap-3 w-full max-w-md px-3.5 h-10 rounded-lg border border-border/60 bg-background/60 hover:bg-accent/30 hover:border-border transition-all text-sm min-w-0"
        >
          <Search className="size-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground flex-1 text-left truncate">
            <span className="hidden sm:inline">
              Search invoices, vendors, actions…
            </span>
            <span className="inline sm:hidden">Search…</span>
          </span>
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground border border-border/60 shrink-0">
            <Command className="size-3" />K
          </kbd>
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Health indicator */}
          {health && (
            <Badge
              variant={overallHealthy ? "success" : "warning"}
              className="hidden md:inline-flex"
            >
              <Activity
                className={cn(
                  "size-3",
                  overallHealthy ? "text-success" : "text-warning"
                )}
              />
              {overallHealthy ? "All systems healthy" : "Degraded"}
            </Badge>
          )}

          <NotificationBell />
          <ThemeToggle />

          <Button
            variant="ghost"
            size="icon"
            className="size-9 hidden sm:inline-flex"
            aria-label="Account"
          >
            <div className="size-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-semibold">
              IA
            </div>
          </Button>
        </div>
      </div>
    </header>
  )
}
