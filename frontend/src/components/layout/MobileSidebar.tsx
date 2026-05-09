import { useEffect } from "react"
import { NavLink, useLocation } from "react-router-dom"
import {
  LayoutDashboard,
  Inbox,
  AlertTriangle,
  FileSearch,
  Workflow,
  Sparkles,
  ShoppingCart,
  Settings,
} from "lucide-react"
import { create } from "zustand"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ROUTES } from "@/lib/routes"
import { cn } from "@/lib/utils"

interface MobileSidebarStore {
  open: boolean
  setOpen: (open: boolean) => void
}

export const useMobileSidebar = create<MobileSidebarStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))

interface NavItem {
  label: string
  icon: React.ComponentType<{ className?: string }>
  to: string
  badge?: string
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, to: ROUTES.dashboard },
  { label: "Invoice Inbox", icon: Inbox, to: ROUTES.inbox },
  { label: "Exceptions", icon: AlertTriangle, to: ROUTES.exceptions },
  { label: "Purchase Orders", icon: ShoppingCart, to: ROUTES.purchaseOrders },
]

const SHOWCASE_ITEMS: NavItem[] = [
  { label: "Pipeline", icon: Workflow, to: ROUTES.pipeline, badge: "Live" },
  { label: "3D Flow", icon: Sparkles, to: ROUTES.flow, badge: "New" },
]

export function MobileSidebar() {
  const open = useMobileSidebar((s) => s.open)
  const setOpen = useMobileSidebar((s) => s.setOpen)
  const location = useLocation()

  // Auto-close on navigation. `setOpen` is stable from Zustand so
  // it's safe (and lint-clean) to include it in deps.
  useEffect(() => {
    setOpen(false)
  }, [location.pathname, setOpen])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="left" className="p-0 w-[280px] sm:w-[300px]">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="size-9 shrink-0 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-glow">
              <FileSearch className="size-4 text-white" />
            </div>
            <div className="flex flex-col leading-tight">
              <SheetTitle className="text-sm">Reconciliation</SheetTitle>
              <SheetDescription className="text-[11px]">
                Agentic AI
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
          <Section title="Workspace" items={NAV_ITEMS} />
          <Section title="Showcase" items={SHOWCASE_ITEMS} />
        </nav>

        <div className="p-3 border-t border-border/60">
          <NavLink
            to={ROUTES.settings}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )
            }
          >
            <Settings className="size-4 shrink-0" />
            <span>Settings</span>
          </NavLink>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Section({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <div>
      <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        {title}
      </div>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )
              }
            >
              <item.icon className="size-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-primary/15 text-primary">
                  {item.badge}
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}
