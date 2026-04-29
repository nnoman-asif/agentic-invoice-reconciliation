import { useQuery } from "@tanstack/react-query"
import { apiClient } from "./client"
import type { DeliveryReceipt } from "./types"

export const drKeys = {
  all: ["delivery-receipts"] as const,
  list: () => [...drKeys.all, "list"] as const,
  detail: (id: string) => [...drKeys.all, "detail", id] as const,
}

export function useDeliveryReceipts() {
  return useQuery({
    queryKey: drKeys.list(),
    queryFn: async () => {
      const { data } = await apiClient.get<DeliveryReceipt[]>(
        "/api/delivery-receipts"
      )
      return data
    },
  })
}

export function useDeliveryReceipt(id: string | undefined) {
  return useQuery({
    queryKey: drKeys.detail(id ?? ""),
    queryFn: async () => {
      const { data } = await apiClient.get<DeliveryReceipt>(
        `/api/delivery-receipts/${id}`
      )
      return data
    },
    enabled: !!id,
  })
}
