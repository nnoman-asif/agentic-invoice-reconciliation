import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "./client"
import type {
  ImportResponse,
  MatchedInvoiceForPO,
  PurchaseOrder,
  PurchaseOrderListItem,
} from "./types"

export const poKeys = {
  all: ["purchase-orders"] as const,
  list: () => [...poKeys.all, "list"] as const,
  detail: (id: string) => [...poKeys.all, "detail", id] as const,
  invoices: (id: string) => [...poKeys.all, "invoices", id] as const,
}

export function usePurchaseOrders() {
  return useQuery({
    queryKey: poKeys.list(),
    queryFn: async () => {
      const { data } = await apiClient.get<PurchaseOrderListItem[]>(
        "/api/purchase-orders"
      )
      return data
    },
  })
}

export function usePurchaseOrder(id: string | undefined | null) {
  return useQuery({
    queryKey: poKeys.detail(id ?? ""),
    queryFn: async () => {
      const { data } = await apiClient.get<PurchaseOrder>(
        `/api/purchase-orders/${id}`
      )
      return data
    },
    enabled: !!id,
  })
}

export function usePurchaseOrderInvoices(id: string | undefined | null) {
  return useQuery({
    queryKey: poKeys.invoices(id ?? ""),
    queryFn: async () => {
      const { data } = await apiClient.get<MatchedInvoiceForPO[]>(
        `/api/purchase-orders/${id}/invoices`
      )
      return data
    },
    enabled: !!id,
  })
}

/** Upload a CSV file to bulk-create purchase orders. */
export function useImportPOsCsv() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append("file", file)
      const { data } = await apiClient.post<ImportResponse>(
        "/api/purchase-orders/import",
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: poKeys.all })
    },
  })
}
