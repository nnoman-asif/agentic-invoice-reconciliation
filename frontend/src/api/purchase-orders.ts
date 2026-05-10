import { useQuery } from "@tanstack/react-query"
import { apiClient } from "./client"
import type {
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
