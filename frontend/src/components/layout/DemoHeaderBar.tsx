import { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { Sparkles, Play, ArrowRight, Lock } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScenarioPicker } from "@/components/demo/ScenarioPicker"
import { useAuthStore } from "@/store/auth"
import { AUTH_ENABLED } from "@/lib/firebase"
import { ROUTES } from "@/lib/routes"
import { queryClient } from "@/api/client"

export function DemoHeaderBar() {
  const location = useLocation()
  const [pickerOpen, setPickerOpen] = useState(false)
  const canWrite = useAuthStore((s) => !AUTH_ENABLED || Boolean(s.firebaseUser))

  if (canWrite) {
    return null
  }

  return (
    <>
      <ScenarioPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onStarted={() => {
          void queryClient.invalidateQueries()
        }}
      />
      <div
        role="status"
        className="border-b border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-background text-foreground backdrop-blur-sm"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-10">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className="border-primary/40 text-primary gap-1 shrink-0 bg-background/60 text-xs font-medium"
              >
                <Sparkles className="size-3" />
                Demo Mode Active
              </Badge>
              <span className="text-xs text-muted-foreground">
                3 sample invoices available daily
              </span>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-1 sm:line-clamp-none">
              <span className="font-semibold text-foreground">
                Experience Agentic Reconciliation:
              </span>{" "}
              Run pre-configured scenarios to watch the 4-agent pipeline in real time. Sign in to upload custom PDFs.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              className="gap-1.5 shadow-sm h-8 text-xs"
              onClick={() => setPickerOpen(true)}
            >
              <Play className="size-3.5" />
              Try a Demo Scenario
            </Button>
            <Button
              size="sm"
              variant="outline"
              asChild
              className="gap-1.5 h-8 text-xs bg-background/60 hover:bg-background"
            >
              <Link to={ROUTES.login} state={{ from: location.pathname }}>
                <Lock className="size-3" />
                <span>Sign in for Full Access</span>
                <ArrowRight className="size-3.5 ml-0.5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
