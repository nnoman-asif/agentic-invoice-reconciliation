import { NavLink } from "react-router-dom"
import {
  LayoutDashboard,
  Inbox,
  AlertTriangle,
  FileSearch,
  Workflow,
  Sparkles,
  ShoppingCart,
  Truck,
  Building2,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react"
import { AppLogo } from "@/components/shared/AppLogo"
import { motion } from "framer-motion"

import { cn } from "@/lib/utils"
import { ROUTES } from "@/lib/routes"
import { useUIStore } from "@/store/ui"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"

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
  { label: "Delivery Receipts", icon: Truck, to: ROUTES.deliveryReceipts },
  { label: "Vendors", icon: Building2, to: ROUTES.vendors },
]

const SHOWCASE_ITEMS: NavItem[] = [
  { label: "Pipeline", icon: Workflow, to: ROUTES.pipeline, badge: "Live" },
  { label: "3D Flow", icon: Sparkles, to: ROUTES.flow, badge: "New" },
]

export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggle = useUIStore((s) => s.toggleSidebar)

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 248 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="sticky top-0 h-screen flex flex-col border-r border-border/60 bg-background/60 backdrop-blur-2xl"
    >
      {/* Logo -- doubles as a "go home" link to the landing page */}
      <NavLink
        to={ROUTES.landing}
        aria-label="Back to landing page"
        className="flex items-center gap-3 px-4 h-16 border-b border-border/60 hover:bg-accent/30 transition-colors"
      >
        <AppLogo size="md" />
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col leading-tight"
          >
            <span className="text-sm font-semibold">Reconciliation</span>
            <span className="text-[11px] text-muted-foreground">
              Agentic AI
            </span>
          </motion.div>
        )}
      </NavLink>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
        <NavSection title="Workspace" collapsed={collapsed} items={NAV_ITEMS} />
        <NavSection
          title="Showcase"
          collapsed={collapsed}
          items={SHOWCASE_ITEMS}
        />
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border/60 space-y-1">
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
          {!collapsed && <span>Settings</span>}
        </NavLink>

        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggle}
              className="w-full justify-start gap-3 px-3 text-muted-foreground"
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
              {!collapsed && <span>Collapse</span>}
            </Button>
          </TooltipTrigger>
          {collapsed && (
            <TooltipContent side="right">Expand sidebar</TooltipContent>
          )}
        </Tooltip>
      </div>
    </motion.aside>
  )
}

function NavSection({
  title,
  collapsed,
  items,
}: {
  title: string
  collapsed: boolean
  items: NavItem[]
}) {
  return (
    <div>
      {!collapsed && (
        <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          {title}
        </div>
      )}
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.to}>
            <NavLinkItem item={item} collapsed={collapsed} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function NavLinkItem({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const link = (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="nav-indicator"
              className="absolute inset-0 rounded-lg bg-primary/10"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
          <item.icon className="size-4 shrink-0 relative z-10" />
          {!collapsed && (
            <>
              <span className="relative z-10 flex-1">{item.label}</span>
              {item.badge && (
                <span className="relative z-10 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-primary/15 text-primary">
                  {item.badge}
                </span>
              )}
            </>
          )}
        </>
      )}
    </NavLink>
  )

  if (collapsed) {
    return (
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    )
  }

  return link
}
