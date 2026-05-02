import { useState } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RefreshCcw,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"

// Use CDN-hosted PDF worker to avoid bundling complications
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface Props {
  fileUrl: string
}

const ZOOM_STEP = 0.2
const MIN_ZOOM = 0.5
const MAX_ZOOM = 2.5

export function PDFViewer({ fileUrl }: Props) {
  const [numPages, setNumPages] = useState<number>(0)
  const [page, setPage] = useState(1)
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0)
  const [error, setError] = useState<string | null>(null)

  const baseWidth = Math.min(680, window.innerWidth - 100)
  const reset = () => {
    setScale(1)
    setRotation(0)
  }

  const zoomIn = () => setScale((s) => Math.min(MAX_ZOOM, +(s + ZOOM_STEP).toFixed(2)))
  const zoomOut = () => setScale((s) => Math.max(MIN_ZOOM, +(s - ZOOM_STEP).toFixed(2)))
  const rotate = () =>
    setRotation((r) => (((r + 90) % 360) as 0 | 90 | 180 | 270))

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border/60 bg-muted/30 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FileText className="size-4 text-muted-foreground" />
          Invoice
        </div>

        <div className="flex items-center gap-1">
          {/* Page navigation */}
          {numPages > 0 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-xs font-mono tabular-nums px-2 text-muted-foreground min-w-[3rem] text-center">
                {page} / {numPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                disabled={page >= numPages}
                onClick={() => setPage((p) => Math.min(numPages, p + 1))}
              >
                <ChevronRight className="size-4" />
              </Button>

              <span className="mx-1.5 h-4 w-px bg-border/60" />
            </>
          )}

          {/* Zoom controls */}
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={zoomOut}
                disabled={scale <= MIN_ZOOM}
              >
                <ZoomOut className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom out</TooltipContent>
          </Tooltip>
          <span className="text-xs font-mono tabular-nums px-1 text-muted-foreground min-w-[3rem] text-center">
            {Math.round(scale * 100)}%
          </span>
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={zoomIn}
                disabled={scale >= MAX_ZOOM}
              >
                <ZoomIn className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom in</TooltipContent>
          </Tooltip>

          <span className="mx-1.5 h-4 w-px bg-border/60" />

          {/* Rotate */}
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={rotate}
              >
                <RotateCw className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Rotate 90°</TooltipContent>
          </Tooltip>

          {/* Reset (only when something is changed) */}
          {(scale !== 1 || rotation !== 0) && (
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={reset}
                >
                  <RefreshCcw className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reset view</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-muted/20 p-4">
        {error ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            {error}
          </div>
        ) : (
          <Document
            file={fileUrl}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            onLoadError={(e) => setError(e.message)}
            loading={<Skeleton className="w-full h-[600px]" />}
            className="flex justify-center"
          >
            <Page
              pageNumber={page}
              renderAnnotationLayer={false}
              renderTextLayer={false}
              className="shadow-elevated rounded-lg overflow-hidden transition-transform"
              width={baseWidth}
              scale={scale}
              rotate={rotation}
            />
          </Document>
        )}
      </div>
    </div>
  )
}
