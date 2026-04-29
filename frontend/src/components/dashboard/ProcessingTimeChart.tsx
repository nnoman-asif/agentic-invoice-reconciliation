import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { formatDuration } from "@/lib/format"
import { Clock } from "lucide-react"

interface Props {
  avgMs: number | null
  totalReconciliations: number
}

export function ProcessingTimeCard({ avgMs, totalReconciliations }: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Processing Performance</CardTitle>
            <CardDescription>
              End-to-end agent pipeline time
            </CardDescription>
          </div>
          <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Clock className="size-5 text-primary" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="text-4xl font-bold tracking-tight tabular-nums">
              {avgMs ? formatDuration(avgMs) : "—"}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              average across {totalReconciliations} reconciliation
              {totalReconciliations !== 1 ? "s" : ""}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 pt-4 border-t border-border/60">
            {[
              { label: "Parser", color: "bg-blue-500" },
              { label: "Matcher", color: "bg-indigo-500" },
              { label: "Anomaly", color: "bg-purple-500" },
              { label: "Resolution", color: "bg-pink-500" },
            ].map((stage) => (
              <div key={stage.label} className="space-y-1">
                <div className={`h-1 rounded-full ${stage.color}`} />
                <div className="text-[11px] text-muted-foreground">
                  {stage.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
