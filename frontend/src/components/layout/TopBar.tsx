import { Search, Command, Activity } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useUIStore } from "@/store/ui"
import { useHealth } from "@/api/health"
import { ThemeToggle } from "./ThemeToggle"
import { cn } from "@/lib/utils"

export function TopBar() {
  const setCommandOpen = useUIStore((s) => s.setCommandPaletteOpen)
  const { data: health } = useHealth()

  const overallHealthy = health?.status === "healthy"

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-border/60 bg-background/70 backdrop-blur-2xl">
      <div className="flex items-center justify-between gap-4 h-full px-6">
        {/* Search trigger */}
        <button
          onClick={() => setCommandOpen(true)}
          className="group flex items-center gap-3 w-full max-w-md px-3.5 h-10 rounded-lg border border-border/60 bg-background/60 hover:bg-accent/30 hover:border-border transition-all text-sm"
        >
          <Search className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground flex-1 text-left">
            Search invoices, vendors, actions…
          </span>
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground border border-border/60">
            <Command className="size-3" />K
          </kbd>
        </button>

        <div className="flex items-center gap-2">
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

          <ThemeToggle />

          <Button variant="ghost" size="icon" className="size-9">
            <div className="size-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-semibold">
              IA
            </div>
          </Button>
        </div>
      </div>
    </header>
  )
}
