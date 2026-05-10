import { useQuery } from "@tanstack/react-query"
import { apiClient } from "./client"
import type { DeliveryReceipt } from "./types"

export const drKeys = {
  all: ["delivery-receipts"] as const,
  list: (poId?: string) => [...drKeys.all, "list", poId ?? null] as const,
  detail: (id: string) => [...drKeys.all, "detail", id] as const,
}

interface UseDeliveryReceiptsOptions {
  poId?: string | null
  enabled?: boolean
}

export function useDeliveryReceipts(opts: UseDeliveryReceiptsOptions = {}) {
  const { poId, enabled = true } = opts
  return useQuery({
    queryKey: drKeys.list(poId ?? undefined),
    queryFn: async () => {
      const url = poId
        ? `/api/delivery-receipts?po_id=${encodeURIComponent(poId)}`
        : "/api/delivery-receipts"
      const { data } = await apiClient.get<DeliveryReceipt[]>(url)
      return data
    },
    enabled,
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
