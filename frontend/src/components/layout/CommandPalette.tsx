import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  LayoutDashboard,
  Inbox,
  AlertTriangle,
  ShoppingCart,
  Workflow,
  Sparkles,
  Settings,
  FileSearch,
  Sun,
  Moon,
  Monitor,
} from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { useUIStore } from "@/store/ui"
import { useTheme } from "@/hooks/useTheme"
import { ROUTES } from "@/lib/routes"
import { useInvoices } from "@/api/invoices"
import { shortId } from "@/lib/format"

export function CommandPalette() {
  const open = useUIStore((s) => s.commandPaletteOpen)
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen)
  const navigate = useNavigate()
  const { setTheme } = useTheme()
  const { data: invoices } = useInvoices()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(!open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [open, setOpen])

  const go = (path: string) => {
    navigate(path)
    setOpen(false)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => go(ROUTES.dashboard)}>
            <LayoutDashboard />
            Dashboard
          </CommandItem>
          <CommandItem onSelect={() => go(ROUTES.inbox)}>
            <Inbox />
            Invoice Inbox
          </CommandItem>
          <CommandItem onSelect={() => go(ROUTES.exceptions)}>
            <AlertTriangle />
            Exceptions
          </CommandItem>
          <CommandItem onSelect={() => go(ROUTES.purchaseOrders)}>
            <ShoppingCart />
            Purchase Orders
          </CommandItem>
          <CommandItem onSelect={() => go(ROUTES.pipeline)}>
            <Workflow />
            Pipeline
            <CommandShortcut>Live</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => go(ROUTES.flow)}>
            <Sparkles />
            3D Flow
          </CommandItem>
          <CommandItem onSelect={() => go(ROUTES.settings)}>
            <Settings />
            Settings
          </CommandItem>
        </CommandGroup>

        {invoices && invoices.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Recent Invoices">
              {invoices.slice(0, 5).map((inv) => (
                <CommandItem
                  key={inv.id}
                  onSelect={() => go(`/invoices/${inv.id}`)}
                >
                  <FileSearch />
                  <span className="flex-1">
                    {inv.invoice_number ?? `Invoice ${shortId(inv.id)}`}
                  </span>
                  <CommandShortcut>{inv.processing_status}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Theme">
          <CommandItem
            onSelect={() => {
              setTheme("light")
              setOpen(false)
            }}
          >
            <Sun />
            Switch to Light
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setTheme("dark")
              setOpen(false)
            }}
          >
            <Moon />
            Switch to Dark
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setTheme("system")
              setOpen(false)
            }}
          >
            <Monitor />
            Use System theme
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
