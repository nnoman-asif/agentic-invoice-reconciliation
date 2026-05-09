import { motion } from "framer-motion"
import { Sparkles, MousePointer2 } from "lucide-react"

import { useInvoices } from "@/api/invoices"
import { FlowScene } from "@/components/flow/FlowScene"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/shared/EmptyState"
import { EmptyInbox } from "@/components/shared/illustrations/EmptyInbox"
import { Skeleton } from "@/components/ui/skeleton"

export function FlowPage() {
  const { data: invoices, isLoading } = useInvoices()

  return (
    <div className="space-y-4">
      {/* Header overlay */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">3D Flow</h1>
            <Badge variant="default" className="gap-1.5">
              <Sparkles className="size-3" />
              Beta
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Cinematic visualization of invoices flowing through the pipeline.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
          <MousePointer2 className="size-3" />
          Drag to rotate · Scroll to zoom · Click a card to open
        </div>
      </motion.div>

      {/* 3D Canvas */}
      <Card className="relative overflow-hidden h-[640px] border-border/40">
        {isLoading ? (
          <Skeleton className="absolute inset-0" />
        ) : !invoices || invoices.length === 0 ? (
          <EmptyState
            illustration={<EmptyInbox className="w-full" />}
            title="No invoices to visualize"
            description="Upload an invoice to see it flow through the pipeline in 3D"
          />
        ) : (
          <>
            <FlowScene invoices={invoices} />

            {/* Gradient overlay at bottom for legend -- uses the
                theme-aware background token so it works in light mode
                instead of slamming a hard slate-950. */}
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent pointer-events-none" />

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 px-4 py-2 rounded-full glass-strong">
              <Legend color="#10b981" label="Approved" />
              <Legend color="#f59e0b" label="Pending Review" />
              <Legend color="#ef4444" label="Rejected" />
              <Legend color="#64748b" label="Pending" />
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span
        className="size-2 rounded-full shadow-[0_0_6px_currentColor]"
        style={{ backgroundColor: color, color }}
      />
      <span className="text-foreground/80">{label}</span>
    </div>
  )
}
