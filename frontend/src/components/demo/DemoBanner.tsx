import { useState } from "react"
import { Link } from "react-router-dom"
import { Sparkles, Play, ArrowRight, Lock } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScenarioPicker } from "./ScenarioPicker"
import { ROUTES } from "@/lib/routes"

interface DemoBannerProps {
  onStarted?: (invoiceId?: string) => void
  className?: string
}

export function DemoBanner({ onStarted, className }: DemoBannerProps) {
  const [pickerOpen, setPickerOpen] = useState(false)

  return (
    <>
      <ScenarioPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onStarted={onStarted}
      />
      <Card
        className={`relative overflow-hidden p-6 sm:p-8 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-secondary/5 ${
          className ?? ""
        }`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-primary/40 text-primary gap-1"
              >
                <Sparkles className="size-3" />
                Demo Mode Active
              </Badge>
              <span className="text-xs text-muted-foreground">
                3 sample invoices available daily
              </span>
            </div>
            <h3 className="text-lg font-semibold tracking-tight">
              Experience Agentic Reconciliation
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Run our pre-configured invoice scenarios to watch the 4-agent
              pipeline match, detect anomalies, and resolve in real time. To
              upload custom PDF files and manage reference data, create an
              account.
            </p>
          </div>
          <div className="flex flex-wrap sm:flex-col gap-2.5 shrink-0 w-full sm:w-auto">
            <Button
              size="default"
              className="gap-2 w-full sm:w-auto shadow-sm"
              onClick={() => setPickerOpen(true)}
            >
              <Play className="size-4" />
              Try a Demo Scenario
            </Button>
            <Button
              size="default"
              variant="outline"
              asChild
              className="gap-1.5 w-full sm:w-auto"
            >
              <Link to={ROUTES.login}>
                <Lock className="size-3.5" />
                Sign in for Full Access
                <ArrowRight className="size-3.5 ml-auto" />
              </Link>
            </Button>
          </div>
        </div>
      </Card>
    </>
  )
}
