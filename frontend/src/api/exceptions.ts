import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "./client"
import type { HumanReview, InvoiceListItem, ReviewRequest } from "./types"
import { invoiceKeys } from "./invoices"

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
    refetchInterval: 5000,
  })
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: exceptionKeys.list() })
      qc.invalidateQueries({ queryKey: invoiceKeys.all })
    },
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: exceptionKeys.list() })
      qc.invalidateQueries({ queryKey: invoiceKeys.all })
    },
  })
}
