import { useState } from "react"
import { toast } from "sonner"

import { useUploadInvoice } from "@/api/invoices"

const SAMPLE_FILES = [
  { name: "invoice_clean_match.pdf", url: "/samples/invoice_clean_match.pdf" },
  { name: "invoice_price_deviation.pdf", url: "/samples/invoice_price_deviation.pdf" },
  { name: "invoice_qty_mismatch.pdf", url: "/samples/invoice_qty_mismatch.pdf" },
] as const

interface UseDemoModeReturn {
  /** Returns true if at least one sample uploaded successfully. */
  runDemo: () => Promise<boolean>
  isRunning: boolean
}

/**
 * Fetches the bundled sample PDFs from `/public/samples/` and uploads them
 * to the backend, kicking off the agent pipeline. Used by the "Try Demo"
 * button on the landing page.
 */
export function useDemoMode(): UseDemoModeReturn {
  const upload = useUploadInvoice()
  const [isRunning, setIsRunning] = useState(false)

  const runDemo = async (): Promise<boolean> => {
    if (isRunning) return false
    setIsRunning(true)

    const toastId = toast.loading("Running demo...", {
      description: "Uploading sample invoices for processing.",
    })

    try {
      let succeeded = 0
      for (const sample of SAMPLE_FILES) {
        const res = await fetch(sample.url)
        if (!res.ok) {
          throw new Error(`Could not load ${sample.name}`)
        }
        const blob = await res.blob()
        const file = new File([blob], sample.name, { type: "application/pdf" })
        await upload.mutateAsync(file)
        succeeded++
      }

      toast.success(`Demo started`, {
        id: toastId,
        description: `${succeeded} invoices uploaded. Watch them process in the inbox or pipeline view.`,
      })
      return true
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Demo failed"
      toast.error("Demo failed", { id: toastId, description: message })
      return false
    } finally {
      setIsRunning(false)
    }
  }

  return { runDemo, isRunning }
}
