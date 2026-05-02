import { Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  downloadCsv,
  timestampedFilename,
  type CsvColumn,
} from "@/lib/csv"
import { toast } from "sonner"

interface Props<T> {
  data: T[] | undefined
  columns: CsvColumn<T>[]
  filenamePrefix: string
  label?: string
  size?: "default" | "sm"
}

export function ExportButton<T>({
  data,
  columns,
  filenamePrefix,
  label = "Export CSV",
  size = "sm",
}: Props<T>) {
  const disabled = !data || data.length === 0

  const handle = () => {
    if (!data || data.length === 0) return
    try {
      downloadCsv(timestampedFilename(filenamePrefix), data, columns)
      toast.success("Export complete", {
        description: `${data.length} row${data.length === 1 ? "" : "s"} downloaded.`,
      })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Export failed"
      toast.error("Export failed", { description: message })
    }
  }

  const button = (
    <Button
      variant="outline"
      size={size}
      onClick={handle}
      disabled={disabled}
      className="gap-2"
    >
      <Download className="size-4" />
      {label}
    </Button>
  )

  if (disabled) {
    return (
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <span>{button}</span>
        </TooltipTrigger>
        <TooltipContent>Nothing to export yet</TooltipContent>
      </Tooltip>
    )
  }

  return button
}
