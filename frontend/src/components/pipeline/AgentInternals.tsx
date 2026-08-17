import {
  Code2,
  FileInput,
  FileOutput,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import type {
  AgentStage,
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
        <Tabs defaultValue="input" className="w-full">
          <div className="px-6 pt-5 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-lg font-semibold">{stage.label} Agent</h3>
              <p className="text-sm text-muted-foreground">
                {stage.description}
              </p>
            </div>
            <TabsList>
              <TabsTrigger value="input">
                <FileInput className="size-3.5" />
                Input
              </TabsTrigger>
              <TabsTrigger value="output">
                <FileOutput className="size-3.5" />
                Output
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="input" className="p-0 m-0">
            <StageBody
              label="Input shape"
              status={stage.status}
              hasData={!!stage.output}
              content={JSON.stringify(getStageInputShape(stage.id), null, 2)}
              runningHint="The agent is processing right now - input is being consumed."
              completedHint="See live data in the pipeline state above. Schema:"
            />
          </TabsContent>

          <TabsContent value="output" className="p-0 m-0">
            <StageBody
              label="Last output"
              status={stage.status}
              hasData={!!stage.output}
              content={
                stage.output ? JSON.stringify(stage.output, null, 2) : ""
              }
              runningHint="Agent is still executing - output will appear once this stage completes."
              completedHint="Output captured from the last run:"
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
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
        title="Waiting to run"
        body="An earlier stage is still in progress. This panel will fill in as the pipeline reaches it."
      />
    )
  }

  // Running: spinner + clear "in flight" message.
  if (status === "running") {
    return (
      <StagePlaceholder
        icon={<Loader2 className="size-4 animate-spin" />}
        title="Running…"
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
        title="Failed"
        body="This stage errored out. See the invoice's error message for details."
        accent="destructive"
      />
    )
  }

  // Completed: render the data when we have it; otherwise note that
  // the recon row hasn't streamed in yet (rare, very brief window
  // between status=completed and recon GET landing).
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

function getStageInputShape(stage: AgentStage): Record<string, unknown> {
  switch (stage) {
    case "parser":
      return {
        invoice_id: "uuid",
        raw_file_path: "uploads/invoices/<uuid>.pdf",
        file_content_type: "application/pdf",
      }
    case "matcher":
      return {
        invoice_number: "string | null",
        vendor_name: "string | null",
        vendor_tax_id: "string | null",
        po_reference: "string | null",
        line_items: "Array<{ description, quantity, unit_price, ... }>",
      }
    case "anomaly":
      return {
        line_item_matches: "Array<LineItemMatch>",
        matched_po: "PurchaseOrder | null",
        vendor_found: "boolean",
        is_duplicate: "boolean",
      }
    case "resolution":
      return {
        discrepancies: "Array<Discrepancy>",
        line_item_matches: "Array<LineItemMatch>",
      }
  }
}
