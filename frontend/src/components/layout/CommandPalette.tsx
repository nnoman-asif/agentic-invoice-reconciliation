import { useEffect, useState } from "react"
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
import { HighlightedText } from "@/components/shared/HighlightedText"
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
  const [search, setSearch] = useState("")

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

  // Reset search when closing
  useEffect(() => {
    if (!open) setSearch("")
  }, [open])

  const go = (path: string) => {
    navigate(path)
    setOpen(false)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Type a command or search…"
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => go(ROUTES.dashboard)}>
            <LayoutDashboard />
            <HighlightedText text="Dashboard" query={search} />
          </CommandItem>
          <CommandItem onSelect={() => go(ROUTES.inbox)}>
            <Inbox />
            <HighlightedText text="Invoice Inbox" query={search} />
          </CommandItem>
          <CommandItem onSelect={() => go(ROUTES.exceptions)}>
            <AlertTriangle />
            <HighlightedText text="Exceptions" query={search} />
          </CommandItem>
          <CommandItem onSelect={() => go(ROUTES.purchaseOrders)}>
            <ShoppingCart />
            <HighlightedText text="Purchase Orders" query={search} />
          </CommandItem>
          <CommandItem onSelect={() => go(ROUTES.pipeline)}>
            <Workflow />
            <HighlightedText text="Pipeline" query={search} />
            <CommandShortcut>Live</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => go(ROUTES.flow)}>
            <Sparkles />
            <HighlightedText text="3D Flow" query={search} />
          </CommandItem>
          <CommandItem onSelect={() => go(ROUTES.settings)}>
            <Settings />
            <HighlightedText text="Settings" query={search} />
          </CommandItem>
        </CommandGroup>

        {invoices && invoices.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Recent Invoices">
              {invoices.slice(0, 5).map((inv) => {
                const label =
                  inv.invoice_number ?? `Invoice ${shortId(inv.id)}`
                return (
                  <CommandItem
                    key={inv.id}
                    onSelect={() => go(`/invoices/${inv.id}`)}
                  >
                    <FileSearch />
                    <span className="flex-1">
                      <HighlightedText text={label} query={search} />
                    </span>
                    <CommandShortcut>{inv.processing_status}</CommandShortcut>
                  </CommandItem>
                )
              })}
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
            <HighlightedText text="Switch to Light" query={search} />
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setTheme("dark")
              setOpen(false)
            }}
          >
            <Moon />
            <HighlightedText text="Switch to Dark" query={search} />
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setTheme("system")
              setOpen(false)
            }}
          >
            <Monitor />
            <HighlightedText text="Use System theme" query={search} />
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
