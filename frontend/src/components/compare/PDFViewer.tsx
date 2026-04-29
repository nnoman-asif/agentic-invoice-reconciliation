import { useState } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import { ChevronLeft, ChevronRight, FileText } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"

// Use CDN-hosted PDF worker to avoid bundling complications
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface Props {
  fileUrl: string
}

export function PDFViewer({ fileUrl }: Props) {
  const [numPages, setNumPages] = useState<number>(0)
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border/60 bg-muted/30">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FileText className="size-4 text-muted-foreground" />
          Invoice
        </div>
        {numPages > 0 && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-xs font-mono tabular-nums px-2 text-muted-foreground">
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
          </div>
        )}
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
              className="shadow-elevated rounded-lg overflow-hidden"
              width={Math.min(680, window.innerWidth - 100)}
            />
          </Document>
        )}
      </div>
    </div>
  )
}
