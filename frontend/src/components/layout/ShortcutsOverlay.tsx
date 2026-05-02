import { create } from "zustand"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface ShortcutsState {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

export const useShortcutsOverlay = create<ShortcutsState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}))

interface KeyEntry {
  keys: string[]
  label: string
}

interface Group {
  title: string
  items: KeyEntry[]
}

const GROUPS: Group[] = [
  {
    title: "Navigation",
    items: [
      { keys: ["G", "D"], label: "Go to Dashboard" },
      { keys: ["G", "I"], label: "Go to Inbox" },
      { keys: ["G", "E"], label: "Go to Exceptions" },
      { keys: ["G", "P"], label: "Go to Purchase Orders" },
      { keys: ["G", "L"], label: "Go to Pipeline" },
      { keys: ["G", "F"], label: "Go to 3D Flow" },
      { keys: ["G", "S"], label: "Go to Settings" },
    ],
  },
  {
    title: "Actions",
    items: [
      { keys: ["N"], label: "New invoice (upload)" },
      { keys: ["⌘", "K"], label: "Open command palette" },
      { keys: ["?"], label: "Show this overlay" },
      { keys: ["Esc"], label: "Close dialogs" },
    ],
  },
]

export function ShortcutsOverlay() {
  const open = useShortcutsOverlay((s) => s.open)
  const setOpen = useShortcutsOverlay((s) => s.setOpen)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Move faster through the app with these shortcuts.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-2">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-3">
                {group.title}
              </div>
              <ul className="space-y-2">
                {group.items.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="text-muted-foreground">{item.label}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.keys.map((k, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {i > 0 && (
                            <span className="text-muted-foreground/60 text-xs">
                              then
                            </span>
                          )}
                          <kbd className={cn(
                            "inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md",
                            "border border-border bg-muted text-[11px] font-mono font-medium",
                            "shadow-[inset_0_-1px_0_0_hsl(var(--border))]"
                          )}>
                            {k}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
