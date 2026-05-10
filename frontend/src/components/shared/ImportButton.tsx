import { useRef, useState } from "react"
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Info,
  Download,
} from "lucide-react"
import { toast } from "sonner"
import { useMutation } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { ImportResponse } from "@/api/types"

interface ImportButtonProps {
  /** Human-readable label for the entity being imported, e.g. "purchase orders". */
  entity: string
  /** Public path to a downloadable sample CSV. */
  templateUrl: string
  /** TanStack Query mutation that uploads the file and returns the result. */
  importMutation: ReturnType<typeof useMutation<ImportResponse, Error, File>>
  /** Optional override for the trigger button label. */
  label?: string
  size?: "default" | "sm"
}

const PREVIEW_ROWS = 5

export function ImportButton({
  entity,
  templateUrl,
  importMutation,
  label = "Import CSV",
  size = "sm",
}: ImportButtonProps) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string[] | null>(null)
  const [result, setResult] = useState<ImportResponse | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Drive reset from onOpenChange instead of a useEffect: TanStack
  // Query's `useMutation` returns a fresh object reference on every
  // render so depending on `importMutation` in an effect would loop.
  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      setFile(null)
      setPreview(null)
      setResult(null)
      importMutation.reset()
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const handleFileSelected = async (next: File | null) => {
    setFile(next)
    setResult(null)
    if (!next) {
      setPreview(null)
      return
    }
    try {
      const text = await next.text()
      const lines = text.split(/\r?\n/).filter((l) => l.length > 0)
      setPreview(lines.slice(0, PREVIEW_ROWS + 1))
    } catch {
      setPreview(null)
    }
  }

  const onSubmit = async () => {
    if (!file) return
    try {
      const data = await importMutation.mutateAsync(file)
      setResult(data)
      const total =
        data.imported.length + data.skipped.length + data.errors.length
      if (data.imported.length === total && total > 0) {
        toast.success(`Imported ${data.imported.length} ${entity}`)
      } else if (data.imported.length > 0) {
        toast.warning(
          `Imported ${data.imported.length} of ${total} ${entity}`,
          {
            description:
              data.errors.length > 0
                ? `${data.errors.length} error${data.errors.length === 1 ? "" : "s"}`
                : `${data.skipped.length} skipped`,
          }
        )
      } else if (total > 0) {
        toast.error(`Could not import any ${entity}`, {
          description: "See details in the dialog.",
        })
      } else {
        toast.info("Nothing to import", {
          description: "The file had no data rows.",
        })
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Upload failed"
      toast.error("Upload failed", { description: message })
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size={size}
        className="gap-2"
        onClick={() => handleOpenChange(true)}
      >
        <Upload className="size-4" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="capitalize">Import {entity}</DialogTitle>
            <DialogDescription>
              Upload a CSV file. Rows that already exist or fail validation
              will be skipped — the rest will still be imported.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <a
              href={templateUrl}
              download
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Download className="size-3.5" />
              Download sample CSV
            </a>

            <label
              className={cn(
                "block rounded-lg border-2 border-dashed border-border/60 p-6 text-center cursor-pointer hover:border-primary/40 hover:bg-accent/30 transition-colors",
                file && "border-primary/40 bg-primary/5"
              )}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) =>
                  handleFileSelected(e.target.files?.[0] ?? null)
                }
              />
              <FileText className="size-6 mx-auto mb-2 text-muted-foreground" />
              <div className="text-sm font-medium">
                {file ? file.name : "Click to choose a CSV file"}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {file
                  ? `${(file.size / 1024).toFixed(1)} KB`
                  : "Up to a few thousand rows works best"}
              </div>
            </label>

            {preview && preview.length > 0 && !result && (
              <div className="rounded-lg border border-border/60 bg-muted/20 overflow-hidden">
                <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/60">
                  Preview ({Math.min(preview.length - 1, PREVIEW_ROWS)} of{" "}
                  {preview.length - 1} rows shown)
                </div>
                <pre className="text-[11px] font-mono p-3 overflow-x-auto max-h-40 whitespace-pre">
                  {preview.join("\n")}
                </pre>
              </div>
            )}

            {result && <ImportResultPanel result={result} entity={entity} />}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => handleOpenChange(false)}>
              {result ? "Close" : "Cancel"}
            </Button>
            {!result && (
              <Button
                onClick={onSubmit}
                disabled={!file || importMutation.isPending}
                className="gap-2"
              >
                {importMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                {importMutation.isPending ? "Importing…" : "Import"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ImportResultPanel({
  result,
  entity,
}: {
  result: ImportResponse
  entity: string
}) {
  const { imported, skipped, errors } = result
  const total = imported.length + skipped.length + errors.length

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <ResultStat
          icon={<CheckCircle2 className="size-4 text-emerald-500" />}
          count={imported.length}
          label="imported"
        />
        <ResultStat
          icon={<Info className="size-4 text-amber-500" />}
          count={skipped.length}
          label="skipped"
        />
        <ResultStat
          icon={<AlertCircle className="size-4 text-rose-500" />}
          count={errors.length}
          label="errors"
        />
      </div>

      {total === 0 && (
        <p className="text-sm text-muted-foreground text-center">
          The file had no data rows.
        </p>
      )}

      {(skipped.length > 0 || errors.length > 0) && (
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2 max-h-48 overflow-y-auto">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Details
          </div>
          {[...errors, ...skipped].map((row, idx) => {
            const isError = idx < errors.length
            return (
              <div
                key={`${row.row}-${row.identifier ?? idx}`}
                className="text-xs flex items-start gap-2"
              >
                <span
                  className={cn(
                    "font-mono shrink-0 mt-0.5",
                    isError ? "text-rose-500" : "text-amber-500"
                  )}
                >
                  row {row.row}
                </span>
                {row.identifier && (
                  <span className="font-mono shrink-0 mt-0.5 text-muted-foreground">
                    {row.identifier}
                  </span>
                )}
                <span className="text-muted-foreground">
                  {row.reason ?? (isError ? "error" : "skipped")}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {imported.length > 0 && (
        <p className="text-xs text-muted-foreground">
          The list has been refreshed with the new {entity}.
        </p>
      )}
    </div>
  )
}

function ResultStat({
  icon,
  count,
  label,
}: {
  icon: React.ReactNode
  count: number
  label: string
}) {
  return (
    <div className="rounded-lg border border-border/60 px-3 py-2.5">
      <div className="flex items-center justify-center gap-1.5">
        {icon}
        <span className="font-bold tabular-nums text-base">{count}</span>
      </div>
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mt-0.5">
        {label}
      </div>
    </div>
  )
}
