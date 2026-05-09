import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "./client"
import type { HumanReview, InvoiceListItem, ReviewRequest } from "./types"
import { invoiceKeys } from "./invoices"
import { reconciliationKeys } from "./reconciliations"

export const exceptionKeys = {
  all: ["exceptions"] as const,
  list: () => [...exceptionKeys.all, "list"] as const,
}

export function useExceptions() {
  return useQuery({
    queryKey: exceptionKeys.list(),
    queryFn: async () => {
      const { data } = await apiClient.get<InvoiceListItem[]>("/api/exceptions")
      return data
    },
    // Only poll while there's actually something to watch. An empty
    // exceptions queue does not change without an explicit user action,
    // so polling it every 5s wastes bandwidth and CPU. We also refetch
    // when the tab regains focus to catch out-of-band updates.
    refetchInterval: (query) => {
      const data = query.state.data
      return data && data.length > 0 ? 5000 : false
    },
    refetchOnWindowFocus: true,
  })
}

function invalidateReviewedRecon(qc: ReturnType<typeof useQueryClient>) {
  // After a human review the exception leaves the queue, the invoice's
  // business_status flips, and the reconciliation gains a human_reviews
  // entry -- so invalidate all three caches.
  qc.invalidateQueries({ queryKey: exceptionKeys.list() })
  qc.invalidateQueries({ queryKey: invoiceKeys.all })
  qc.invalidateQueries({ queryKey: reconciliationKeys.all })
}

export function useApproveException() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      reconciliationId,
      body,
    }: {
      reconciliationId: string
      body: ReviewRequest
    }) => {
      const { data } = await apiClient.post<HumanReview>(
        `/api/exceptions/${reconciliationId}/approve`,
        body
      )
      return data
    },
    onSuccess: () => invalidateReviewedRecon(qc),
  })
}

export function useRejectException() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      reconciliationId,
      body,
    }: {
      reconciliationId: string
      body: ReviewRequest
    }) => {
      const { data } = await apiClient.post<HumanReview>(
        `/api/exceptions/${reconciliationId}/reject`,
        body
      )
      return data
    },
    onSuccess: () => invalidateReviewedRecon(qc),
  })
}
