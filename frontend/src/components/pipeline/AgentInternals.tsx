import {
  Code2,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type {
  AgentStageState,
  StageStatus,
} from "@/hooks/useLivePipeline"
import { cn } from "@/lib/utils"

interface Props {
  stage: AgentStageState
}

export function AgentInternals({ stage }: Props) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="px-6 pt-5 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">{stage.label} Agent</h3>
              <StageBadge status={stage.status} />
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {stage.description}
            </p>
          </div>
        </div>

        <StageBody
          label="Execution Output"
          status={stage.status}
          hasData={!!stage.output}
          content={
            stage.output ? JSON.stringify(stage.output, null, 2) : ""
          }
          runningHint="Agent is executing in real-time — live output will stream once complete."
          completedHint="Live results produced by this agent:"
        />
      </CardContent>
    </Card>
  )
}

function StageBadge({ status }: { status: StageStatus }) {
  switch (status) {
    case "idle":
      return <Badge variant="muted">Queued</Badge>
    case "running":
      return (
        <Badge variant="default" className="gap-1.5 animate-pulse">
          <Loader2 className="size-3 animate-spin" />
          Processing
        </Badge>
      )
    case "completed":
      return (
        <Badge variant="success" className="gap-1">
          <CheckCircle2 className="size-3" />
          Completed
        </Badge>
      )
    case "error":
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="size-3" />
          Failed
        </Badge>
      )
  }
}

function StageBody({
  label,
  status,
  hasData,
  content,
  runningHint,
  completedHint,
}: {
  label: string
  status: StageStatus
  hasData: boolean
  content: string
  runningHint: string
  completedHint: string
}) {
  // Idle: stage hasn't started yet.
  if (status === "idle") {
    return (
      <StagePlaceholder
        icon={<Clock className="size-4" />}
        title="Waiting to execute"
        body="Previous stages are running. Live results will populate automatically as the pipeline advances."
      />
    )
  }

  // Running: spinner + clear "in flight" message.
  if (status === "running") {
    return (
      <StagePlaceholder
        icon={<Loader2 className="size-4 animate-spin" />}
        title="Executing agent logic…"
        body={runningHint}
        accent="primary"
      />
    )
  }

  // Error: surface that the pipeline failed at this stage.
  if (status === "error") {
    return (
      <StagePlaceholder
        icon={<AlertCircle className="size-4" />}
        title="Execution failed"
        body="This agent encountered an error during processing. Review the error message for details."
        accent="destructive"
      />
    )
  }

  // Completed: render the data when we have it; otherwise note that
  // the recon row hasn't streamed in yet.
  if (!hasData) {
    return (
      <StagePlaceholder
        icon={<CheckCircle2 className="size-4" />}
        title="Completed"
        body="Loading captured data…"
        accent="success"
      />
    )
  }

  return (
    <div className="border-t border-border/60 m-6 mt-4 rounded-lg bg-muted/30 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/60 bg-muted/40">
        <Code2 className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
      </div>
      {completedHint && (
        <p className="px-4 pt-3 text-xs text-muted-foreground">
          {completedHint}
        </p>
      )}
      <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-words leading-relaxed max-h-80 overflow-y-auto">
        {content}
      </pre>
    </div>
  )
}

function StagePlaceholder({
  icon,
  title,
  body,
  accent,
}: {
  icon: React.ReactNode
  title: string
  body: string
  accent?: "primary" | "success" | "destructive"
}) {
  return (
    <div className="border-t border-border/60 m-6 mt-4 rounded-lg bg-muted/30 px-4 py-6 flex items-start gap-3">
      <div
        className={cn(
          "shrink-0 mt-0.5",
          accent === "primary" && "text-primary",
          accent === "success" && "text-success",
          accent === "destructive" && "text-destructive",
          !accent && "text-muted-foreground"
        )}
      >
        {icon}
      </div>
      <div className="space-y-1">
        <div className="text-sm font-medium">{title}</div>
        <p className="text-xs text-muted-foreground">{body}</p>
      </div>
    </div>
  )
}
