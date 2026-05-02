import { useEffect, useRef } from "react"

import { useInvoices } from "@/api/invoices"
import { useUIStore } from "@/store/ui"
import type { BusinessStatus, ProcessingStatus } from "@/api/types"

interface SnapshotEntry {
  processing_status: ProcessingStatus
  business_status: BusinessStatus
  invoice_number: string | null
}

/**
 * Watches invoice list for status transitions and dispatches notifications.
 * Mount once globally (e.g., inside <App /> or <AppShell />).
 */
export function useInvoiceNotifications() {
  const { data: invoices } = useInvoices()
  const addNotification = useUIStore((s) => s.addNotification)
  const snapshot = useRef<Map<string, SnapshotEntry>>(new Map())
  const seeded = useRef(false)

  useEffect(() => {
    if (!invoices) return

    // Seed initial snapshot - don't notify on first run
    if (!seeded.current) {
      for (const inv of invoices) {
        snapshot.current.set(inv.id, {
          processing_status: inv.processing_status,
          business_status: inv.business_status,
          invoice_number: inv.invoice_number,
        })
      }
      seeded.current = true
      return
    }

    for (const inv of invoices) {
      const prev = snapshot.current.get(inv.id)

      if (!prev) {
        // Newly seen invoice
        if (inv.processing_status === "queued") {
          addNotification({
            invoiceId: inv.id,
            invoiceNumber: inv.invoice_number,
            type: "uploaded",
            message: `Invoice ${inv.invoice_number ?? inv.id.slice(0, 8)} uploaded`,
          })
        }
      } else {
        // Status transition
        const procChanged = prev.processing_status !== inv.processing_status
        const bizChanged = prev.business_status !== inv.business_status

        if (procChanged && inv.processing_status === "completed") {
          if (inv.business_status === "approved") {
            addNotification({
              invoiceId: inv.id,
              invoiceNumber: inv.invoice_number,
              type: "approved",
              message: `${inv.invoice_number ?? inv.id.slice(0, 8)} auto-approved`,
            })
          } else if (inv.business_status === "pending_review") {
            addNotification({
              invoiceId: inv.id,
              invoiceNumber: inv.invoice_number,
              type: "needs_review",
              message: `${inv.invoice_number ?? inv.id.slice(0, 8)} needs review`,
            })
          }
        }

        if (procChanged && inv.processing_status === "failed") {
          addNotification({
            invoiceId: inv.id,
            invoiceNumber: inv.invoice_number,
            type: "failed",
            message: `${inv.invoice_number ?? inv.id.slice(0, 8)} processing failed`,
          })
        }

        if (
          bizChanged &&
          inv.business_status === "approved" &&
          prev.business_status === "pending_review"
        ) {
          addNotification({
            invoiceId: inv.id,
            invoiceNumber: inv.invoice_number,
            type: "approved",
            message: `${inv.invoice_number ?? inv.id.slice(0, 8)} approved by reviewer`,
          })
        }

        if (bizChanged && inv.business_status === "rejected") {
          addNotification({
            invoiceId: inv.id,
            invoiceNumber: inv.invoice_number,
            type: "rejected",
            message: `${inv.invoice_number ?? inv.id.slice(0, 8)} rejected`,
          })
        }
      }

      snapshot.current.set(inv.id, {
        processing_status: inv.processing_status,
        business_status: inv.business_status,
        invoice_number: inv.invoice_number,
      })
    }
  }, [invoices, addNotification])
}
