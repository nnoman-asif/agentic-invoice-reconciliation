import { Search, Activity, Menu, User, Settings, LogOut } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useUIStore } from "@/store/ui"
import { useAuthStore } from "@/store/auth"
import { useHealth } from "@/api/health"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { ThemeToggle } from "./ThemeToggle"
import { NotificationBell } from "./NotificationBell"
import { useMobileSidebar } from "./MobileSidebar"
import { cn } from "@/lib/utils"
import { isMacPlatform, modKeyLabel } from "@/lib/platform"
import { ROUTES } from "@/lib/routes"

export function TopBar() {
  const setCommandOpen = useUIStore((s) => s.setCommandPaletteOpen)
  const openMobileSidebar = useMobileSidebar((s) => s.setOpen)
  const navigate = useNavigate()
  const me = useAuthStore((s) => s.me)
  const signOut = useAuthStore((s) => s.signOut)
  const { data: health } = useHealth()
  const isDesktop = useMediaQuery("(min-width: 1024px)")
  const isMac = isMacPlatform()
  const modKey = modKeyLabel()

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
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground border border-border/60 shrink-0">
            <span>{modKey}</span>
            {!isMac && <span aria-hidden>+</span>}
            <span>K</span>
          </kbd>
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">


          <NotificationBell />
          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 hidden sm:inline-flex rounded-full"
                aria-label="Account"
              >
                <div className="size-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-semibold shadow-inner transition-transform hover:scale-105">
                  {me?.display_name ? me.display_name.slice(0, 2).toUpperCase() : me?.email ? me.email.slice(0, 2).toUpperCase() : <User className="size-4" />}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{me?.display_name || "Invoice Agent"}</p>
                  <p className="text-xs leading-none text-muted-foreground">{me?.email || "demo@agentic.ai"}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate(`${ROUTES.settings}#profile`)}>
                <User className="mr-2 size-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`${ROUTES.settings}#appearance`)}>
                <Settings className="mr-2 size-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-destructive focus:text-destructive cursor-pointer"
                onClick={() => void signOut().then(() => navigate(ROUTES.landing, { replace: true }))}
              >
                <LogOut className="mr-2 size-4" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
