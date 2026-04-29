import { useQuery } from "@tanstack/react-query"
import { apiClient } from "./client"
import type { Reconciliation } from "./types"

export function useReconciliationByInvoice(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ["reconciliation", "by-invoice", invoiceId],
    queryFn: async () => {
      const { data } = await apiClient.get<Reconciliation>(
        `/api/invoices/${invoiceId}/reconciliation`
      )
      return data
    },
    enabled: !!invoiceId,
    retry: false,
  })
}
