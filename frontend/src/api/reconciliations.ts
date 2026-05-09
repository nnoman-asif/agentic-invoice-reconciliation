import { useQuery } from "@tanstack/react-query"
import { apiClient } from "./client"
import type { ProcessingStatus, Reconciliation } from "./types"

// Single source of truth for the reconciliation cache key. Both the
// `useReconciliationByInvoice` hook and any mutation that wants to
// invalidate it must derive their keys from this factory so cache
// updates apply consistently.
export const reconciliationKeys = {
  all: ["reconciliation"] as const,
  byInvoice: (invoiceId: string) =>
    [...reconciliationKeys.all, "by-invoice", invoiceId] as const,
}

const PROCESSING_STATUSES: readonly ProcessingStatus[] = [
  "queued",
  "parsing",
  "matching",
  "resolving",
]

interface UseReconciliationOptions {
  /**
   * Pass the parent invoice's current processing status to enable live
   * polling for the reconciliation while the pipeline is still running.
   * Once processing finishes the hook stops polling automatically.
   */
  invoiceProcessingStatus?: ProcessingStatus
}

export function useReconciliationByInvoice(
  invoiceId: string | undefined,
  options: UseReconciliationOptions = {}
) {
  return useQuery({
    queryKey: reconciliationKeys.byInvoice(invoiceId ?? ""),
    queryFn: async () => {
      const { data } = await apiClient.get<Reconciliation>(
        `/api/invoices/${invoiceId}/reconciliation`
      )
      return data
    },
    enabled: !!invoiceId,
    retry: false,
    refetchInterval: () => {
      const status = options.invoiceProcessingStatus
      if (!status) return false
      return PROCESSING_STATUSES.includes(status) ? 2000 : false
    },
  })
}
