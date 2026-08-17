import { useEffect, useRef } from "react"

import { useInvoices } from "@/api/invoices"
import { useUIStore } from "@/store/ui"
import { useAuthStore } from "@/store/auth"
import type { BusinessStatus, ProcessingStatus } from "@/api/types"

interface SnapshotEntry {
  processing_status: ProcessingStatus
  business_status: BusinessStatus
  invoice_number: string | null
}

// Only treat a `!prev` row as a real upload event if its created_at
// is recent. This protects against the case where the first fetch
// returns [] (so the snapshot seeds empty), and a later fetch returns
// a bunch of pre-existing invoices that aren't actually freshly
// uploaded by the user.
const FRESH_UPLOAD_WINDOW_MS = 60_000

/**
 * Watches invoice list for status transitions and dispatches notifications.
 * Mount once globally (e.g., inside <App /> or <AppShell />).
 */
export function useInvoiceNotifications() {
  const { data: invoices } = useInvoices()
  const addNotification = useUIStore((s) => s.addNotification)
  const userKey = useAuthStore((s) => s.firebaseUser?.uid ?? s.guestToken ?? "anon")
  const prevUserKey = useRef(userKey)
  const snapshot = useRef<Map<string, SnapshotEntry>>(new Map())
  const seeded = useRef(false)

  useEffect(() => {
    if (prevUserKey.current !== userKey) {
      prevUserKey.current = userKey
      snapshot.current.clear()
      seeded.current = false
    }
  }, [userKey])

  useEffect(() => {
    if (!invoices) return

    // Seed the initial snapshot from the first non-undefined fetch.
    // Empty list still seeds (so we know "we've seen the truth once")
    // but won't fire notifications. Subsequent !prev rows are checked
    // against `FRESH_UPLOAD_WINDOW_MS` so an empty-then-populated
    // refetch sequence doesn't storm notifications for stale rows.
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

    const liveIds = new Set<string>()

    for (const inv of invoices) {
      liveIds.add(inv.id)
      const prev = snapshot.current.get(inv.id)

      if (!prev) {
        // Newly seen invoice -- only notify if it's both queued AND
        // young enough to plausibly be a fresh upload, not a stale
        // row that just became visible to this client.
        const ageMs = Date.now() - new Date(inv.created_at).getTime()
        if (
          inv.processing_status === "queued" &&
          ageMs < FRESH_UPLOAD_WINDOW_MS
        ) {
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

    // Prune snapshot entries for invoices that disappeared from the
    // list (e.g., deleted upstream). Otherwise the map would grow
    // forever, and a recycled UUID would be treated as "already seen".
    if (snapshot.current.size > liveIds.size) {
      for (const id of snapshot.current.keys()) {
        if (!liveIds.has(id)) snapshot.current.delete(id)
      }
    }
  }, [invoices, addNotification])
}
