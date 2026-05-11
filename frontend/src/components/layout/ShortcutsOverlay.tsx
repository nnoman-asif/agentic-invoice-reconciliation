import { create } from "zustand"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { modKeyLabel } from "@/lib/platform"

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
  /**
   * "sequence" => keys pressed one after another (e.g. G then D).
   * "combo"    => keys held at the same time (e.g. ⌘+K).
   * Defaults to "combo" for single-key entries and "sequence" otherwise
   * so existing entries continue to behave the same way.
   */
  mode?: "sequence" | "combo"
}

interface Group {
  title: string
  items: KeyEntry[]
}

function buildGroups(): Group[] {
  // The mod key is platform-dependent (⌘ on macOS, Ctrl elsewhere)
  // — handlers accept both, this is just the right glyph to show.
  const mod = modKeyLabel()
  return [
    {
      title: "Navigation",
      items: [
        { keys: ["G", "D"], label: "Go to Dashboard", mode: "sequence" },
        { keys: ["G", "I"], label: "Go to Inbox", mode: "sequence" },
        { keys: ["G", "E"], label: "Go to Exceptions", mode: "sequence" },
        { keys: ["G", "P"], label: "Go to Purchase Orders", mode: "sequence" },
        { keys: ["G", "V"], label: "Go to Vendors", mode: "sequence" },
        { keys: ["G", "L"], label: "Go to Pipeline", mode: "sequence" },
        { keys: ["G", "F"], label: "Go to 3D Flow", mode: "sequence" },
        { keys: ["G", "S"], label: "Go to Settings", mode: "sequence" },
      ],
    },
    {
      title: "Actions",
      items: [
        { keys: ["N"], label: "New invoice (upload)" },
        { keys: [mod, "K"], label: "Open command palette", mode: "combo" },
        { keys: ["?"], label: "Show this overlay" },
        { keys: ["Esc"], label: "Close dialogs" },
      ],
    },
  ]
}

export function ShortcutsOverlay() {
  const open = useShortcutsOverlay((s) => s.open)
  const setOpen = useShortcutsOverlay((s) => s.setOpen)
  const groups = buildGroups()

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
          {groups.map((group) => (
            <div key={group.title}>
              <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-3">
                {group.title}
              </div>
              <ul className="space-y-2">
                {group.items.map((item) => {
                  const mode =
                    item.mode ?? (item.keys.length > 1 ? "sequence" : "combo")
                  const separator = mode === "combo" ? "+" : "then"
                  return (
                    <li
                      key={item.label}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="text-muted-foreground">
                        {item.label}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {item.keys.map((k, i) => (
                          <span key={i} className="flex items-center gap-1">
                            {i > 0 && (
                              <span
                                className="text-muted-foreground/60 text-xs"
                                aria-hidden={mode === "combo"}
                              >
                                {separator}
                              </span>
                            )}
                            <kbd
                              className={cn(
                                "inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md",
                                "border border-border bg-muted text-[11px] font-mono font-medium",
                                "shadow-[inset_0_-1px_0_0_hsl(var(--border))]"
                              )}
                            >
                              {k}
                            </kbd>
                          </span>
                        ))}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
