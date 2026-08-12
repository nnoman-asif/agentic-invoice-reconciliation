import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Check, Loader2, Play } from "lucide-react"

import type { DemoScenario, DemoScenariosResponse } from "@/api/demo"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useDemoMode } from "@/hooks/useDemoMode"
import { ROUTES } from "@/lib/routes"
import { cn } from "@/lib/utils"

interface ScenarioPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after a scenario is successfully enqueued. */
  onStarted?: (invoiceId?: string) => void
}

export function ScenarioPicker({
  open,
  onOpenChange,
  onStarted,
}: ScenarioPickerProps) {
  const { loadScenarios, runScenario, isRunning } = useDemoMode()
  const [data, setData] = useState<DemoScenariosResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [runningId, setRunningId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    void loadScenarios().then((res) => {
      if (!cancelled) {
        setData(res)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [open, loadScenarios])

  const remaining = data?.remaining_today ?? 0
  const limit = data?.limit_per_day ?? 3
  const depleted = !loading && data !== null && remaining <= 0

  const onPick = async (scenario: DemoScenario) => {
    if (depleted || isRunning || scenario.used) return
    setRunningId(scenario.id)
    const ok = await runScenario(scenario.id)
    setRunningId(null)
    if (ok) {
      onOpenChange(false)
      onStarted?.()
      // Refresh remaining/used markers next open
      setData(null)
    } else {
      const refreshed = await loadScenarios()
      setData(refreshed)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Try a live demo</DialogTitle>
          <DialogDescription>
            Pick a scenario. Each run enqueues a sample invoice against the
            shared system purchase orders.
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {loading
            ? "Loading scenarios…"
            : `${remaining} of ${limit} demos remaining today`}
        </p>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : depleted ? (
          <div className="space-y-4 py-4 text-center">
            <p className="text-sm text-muted-foreground">
              You&apos;ve used today&apos;s demo runs. Sign in to keep uploading
              and reviewing invoices.
            </p>
            <Button asChild>
              <Link to={ROUTES.login} onClick={() => onOpenChange(false)}>
                Sign in to keep going
              </Link>
            </Button>
          </div>
        ) : (
          <ul className="space-y-2">
            {(data?.scenarios ?? []).map((scenario) => {
              const busy = runningId === scenario.id
              const disabled = depleted || isRunning || scenario.used
              return (
                <li key={scenario.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => void onPick(scenario)}
                    className={cn(
                      "w-full text-left rounded-xl border border-border/70 p-4 transition-colors",
                      "hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      disabled && "opacity-60 cursor-not-allowed hover:bg-transparent"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{scenario.title}</span>
                          {scenario.used && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Check className="size-3.5" />
                              Used
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground leading-snug">
                          {scenario.description}
                        </p>
                        <p className="text-xs font-mono text-muted-foreground/80">
                          {scenario.po_number} · {scenario.expected_outcome}
                        </p>
                      </div>
                      <span className="shrink-0 mt-0.5 text-muted-foreground">
                        {busy ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Play className="size-4" />
                        )}
                      </span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
