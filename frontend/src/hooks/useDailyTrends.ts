import { useMemo } from "react"
import { useInvoices } from "@/api/invoices"
import type { InvoiceListItem } from "@/api/types"

const DAYS = 7

// Build a YYYY-MM-DD key from a Date in *local* timezone so an invoice
// uploaded "today" buckets under today regardless of the user's TZ.
// (Using `toISOString()` here would convert to UTC and shift the bucket.)
function dayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function lastNDays(n: number): string[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - (n - 1 - i))
    return dayKey(d)
  })
}

interface Trends {
  total: number[]
  approved: number[]
  pendingReview: number[]
  completed: number[]
}

export function useDailyTrends(): Trends {
  const { data: invoices } = useInvoices()
  return useMemo(() => {
    const days = lastNDays(DAYS)
    const empty = days.map(() => 0)
    if (!invoices) {
      return {
        total: empty,
        approved: empty,
        pendingReview: empty,
        completed: empty,
      }
    }

    const buckets = new Map<
      string,
      { total: number; approved: number; pendingReview: number; completed: number }
    >()
    for (const day of days) {
      buckets.set(day, {
        total: 0,
        approved: 0,
        pendingReview: 0,
        completed: 0,
      })
    }

    for (const inv of invoices as InvoiceListItem[]) {
      const created = new Date(inv.created_at)
      const key = dayKey(created)
      const bucket = buckets.get(key)
      if (!bucket) continue

      bucket.total += 1
      if (inv.business_status === "approved") bucket.approved += 1
      if (inv.business_status === "pending_review") bucket.pendingReview += 1
      if (inv.processing_status === "completed") bucket.completed += 1
    }

    return {
      total: days.map((d) => buckets.get(d)!.total),
      approved: days.map((d) => buckets.get(d)!.approved),
      pendingReview: days.map((d) => buckets.get(d)!.pendingReview),
      completed: days.map((d) => buckets.get(d)!.completed),
    }
  }, [invoices])
}
