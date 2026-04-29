import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import { motion, AnimatePresence } from "framer-motion"
import { Upload, FileText, Loader2, Check } from "lucide-react"
import { toast } from "sonner"

import { useUploadInvoice } from "@/api/invoices"
import { cn } from "@/lib/utils"

export function InvoiceUploadZone() {
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const upload = useUploadInvoice()

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return
      setUploading(true)
      try {
        for (const file of acceptedFiles) {
          await upload.mutateAsync(file)
          toast.success(`${file.name} uploaded`, {
            description: "Processing has started in the background.",
          })
        }
        setSuccess(true)
        setTimeout(() => setSuccess(false), 1800)
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Upload failed"
        toast.error("Upload failed", { description: message })
      } finally {
        setUploading(false)
      }
    },
    [upload]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".png", ".jpg", ".jpeg"],
    },
    multiple: true,
    disabled: uploading,
  })

  return (
    <div
      {...getRootProps()}
      className={cn(
        "relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer group",
        isDragActive
          ? "border-primary bg-primary/5 shadow-glow"
          : "border-border hover:border-border/80 bg-card/30 hover:bg-card/50",
        uploading && "pointer-events-none opacity-90"
      )}
    >
      <input {...getInputProps()} />

      {/* Decorative gradient */}
      <div className="absolute inset-0 gradient-mesh opacity-50 pointer-events-none" />

      <div className="relative flex flex-col items-center justify-center text-center px-6 py-12 sm:py-16">
        <AnimatePresence mode="wait">
          {success ? (
            <motion.div
              key="success"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="size-14 rounded-2xl bg-success/15 border border-success/30 flex items-center justify-center mb-4"
            >
              <Check className="size-7 text-success" />
            </motion.div>
          ) : uploading ? (
            <motion.div
              key="uploading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="size-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4"
            >
              <Loader2 className="size-6 text-primary animate-spin" />
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className={cn(
                "size-14 rounded-2xl flex items-center justify-center mb-4 transition-all",
                isDragActive
                  ? "bg-primary/15 border border-primary/30"
                  : "bg-muted/60 border border-border/60 group-hover:border-border"
              )}
            >
              {isDragActive ? (
                <FileText className="size-6 text-primary" />
              ) : (
                <Upload className="size-6 text-muted-foreground group-hover:text-foreground transition-colors" />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <h3 className="text-lg font-semibold mb-1.5">
          {success
            ? "Upload complete"
            : uploading
              ? "Uploading…"
              : isDragActive
                ? "Drop your invoice here"
                : "Upload an invoice"}
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mb-4">
          {isDragActive
            ? "Release to start processing"
            : "Drag & drop an invoice PDF here, or click to browse. Multiple files supported."}
        </p>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
          <span className="px-2 py-0.5 rounded-md bg-muted/60 border border-border/60 font-mono">
            PDF
          </span>
          <span className="px-2 py-0.5 rounded-md bg-muted/60 border border-border/60 font-mono">
            PNG
          </span>
          <span className="px-2 py-0.5 rounded-md bg-muted/60 border border-border/60 font-mono">
            JPG
          </span>
          <span className="ml-2">Max 10MB</span>
        </div>
      </div>
    </div>
  )
}
