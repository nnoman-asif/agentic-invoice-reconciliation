import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Code2 } from "lucide-react"

import { AgentNode } from "./AgentNode"
import { AnimatedEdge } from "./AnimatedEdge"
import { useLivePipeline, type AgentStage } from "@/hooks/useLivePipeline"
import { Card, CardContent } from "@/components/ui/card"

interface Props {
  invoiceId: string
}

export function PipelineVisualizer({ invoiceId }: Props) {
  const { stages, invoice, isProcessing } = useLivePipeline(invoiceId)
  const [selected, setSelected] = useState<AgentStage | null>(null)

  const selectedStage = selected
    ? stages.find((s) => s.id === selected)
    : null

  return (
    <div className="space-y-6">
      {/* Pipeline canvas */}
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-mesh opacity-50 pointer-events-none" />
        <CardContent className="relative py-12 px-8">
          <div className="flex items-center justify-between gap-2 max-w-3xl mx-auto">
            {stages.map((stage, idx) => (
              <div key={stage.id} className="flex items-center flex-1">
                <AgentNode
                  stage={stage}
                  active={selected === stage.id}
                  onClick={() => setSelected(stage.id)}
                />
                {idx < stages.length - 1 && (
                  <AnimatedEdge
                    completed={stage.status === "completed"}
                    active={
                      stage.status === "completed" &&
                      stages[idx + 1].status === "running"
                    }
                  />
                )}
              </div>
            ))}
          </div>

          {/* Pipeline metadata */}
          <div className="mt-8 pt-6 border-t border-border/40 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto text-sm">
            <Field
              label="Status"
              value={
                isProcessing
                  ? "Processing"
                  : invoice?.processing_status === "failed"
                    ? "Failed"
                    : "Completed"
              }
              accent={
                isProcessing
                  ? "primary"
                  : invoice?.processing_status === "failed"
                    ? "destructive"
                    : "success"
              }
            />
            <Field
              label="Invoice"
              value={invoice?.invoice_number ?? "Pending parse"}
            />
            <Field
              label="Stages complete"
              value={`${stages.filter((s) => s.status === "completed").length} / ${stages.length}`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Selected stage detail */}
      <AnimatePresence mode="wait">
        {selectedStage && (
          <motion.div
            key={selectedStage.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            <Card>
              <CardContent className="p-6 space-y-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">
                      {selectedStage.label} Agent
                    </h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
                      {selectedStage.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedStage.description}
                  </p>
                </div>

                {selectedStage.output && (
                  <div className="rounded-lg bg-muted/40 border border-border/60 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2 border-b border-border/60 bg-muted/40">
                      <Code2 className="size-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">
                        Output
                      </span>
                    </div>
                    <pre className="p-4 text-xs font-mono overflow-x-auto leading-relaxed">
                      {JSON.stringify(selectedStage.output, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Field({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: "primary" | "success" | "destructive"
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
        {label}
      </div>
      <div
        className={
          accent === "primary"
            ? "text-primary font-semibold mt-1"
            : accent === "success"
              ? "text-success font-semibold mt-1"
              : accent === "destructive"
                ? "text-destructive font-semibold mt-1"
                : "font-medium mt-1"
        }
      >
        {value}
      </div>
    </div>
  )
}
