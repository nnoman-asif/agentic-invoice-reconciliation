import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

import { AgentNode } from "./AgentNode"
import { AnimatedEdge } from "./AnimatedEdge"
import { AgentInternals } from "./AgentInternals"
import {
  type AgentStage,
  type LivePipeline,
} from "@/hooks/useLivePipeline"
import { Card, CardContent } from "@/components/ui/card"
import { formatDuration } from "@/lib/format"

interface Props {
  pipeline: LivePipeline
}

export function PipelineVisualizer({ pipeline }: Props) {
  const { stages, invoice, isProcessing, totalProcessingMs } = pipeline
  const [selected, setSelected] = useState<AgentStage | null>(null)

  const selectedStage = selected
    ? stages.find((s) => s.id === selected)
    : null

  return (
    <div className="space-y-6">
      {/* Pipeline canvas. The inner row enforces a min-width that keeps
          bubbles and labels from crushing into each other; on narrow
          viewports the card becomes horizontally scrollable instead
          (`overflow-x-auto` on the wrapper) so all four agents stay
          legible regardless of screen size. */}
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-mesh opacity-50 pointer-events-none" />
        <CardContent className="relative py-8 px-3 sm:py-12 sm:px-8">
          <div className="overflow-x-auto -mx-3 sm:mx-0">
            <div className="flex items-center justify-between gap-2 max-w-3xl mx-auto min-w-[440px] sm:min-w-0 px-3 sm:px-0">
              {stages.map((stage, idx) => (
                <div
                  key={stage.id}
                  className="flex items-center flex-1 min-w-0"
                >
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
              label={totalProcessingMs ? "Total time" : "Stages complete"}
              value={
                totalProcessingMs
                  ? formatDuration(totalProcessingMs)
                  : `${stages.filter((s) => s.status === "completed").length} / ${stages.length}`
              }
            />
          </div>

          {!selectedStage && (
            <div className="mt-4 text-center text-xs text-muted-foreground">
              Click any agent above to inspect its prompt, input, and output
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected stage internals */}
      <AnimatePresence mode="wait">
        {selectedStage && (
          <motion.div
            key={selectedStage.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            <AgentInternals stage={selectedStage} />
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
