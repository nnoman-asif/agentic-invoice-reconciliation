import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "./client"
import type {
  DeliveryReceipt,
  DeliveryReceiptCreate,
  DeliveryReceiptUpdate,
  ImportResponse,
} from "./types"

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

export function useDeliveryReceipt(id: string | undefined | null) {
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

export function useImportReceiptsCsv() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append("file", file)
      const { data } = await apiClient.post<ImportResponse>(
        "/api/delivery-receipts/import",
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: drKeys.all })
    },
  })
}

export function useCreateReceipt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: DeliveryReceiptCreate) => {
      const { data } = await apiClient.post<DeliveryReceipt>(
        "/api/delivery-receipts",
        payload
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: drKeys.all })
    },
  })
}

export function useUpdateReceipt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string
      payload: DeliveryReceiptUpdate
    }) => {
      const { data } = await apiClient.put<DeliveryReceipt>(
        `/api/delivery-receipts/${id}`,
        payload
      )
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: drKeys.all })
      qc.invalidateQueries({ queryKey: drKeys.detail(variables.id) })
    },
  })
}

export function useDeleteReceipt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      force = false,
    }: {
      id: string
      force?: boolean
    }) => {
      await apiClient.delete(
        `/api/delivery-receipts/${id}${force ? "?force=true" : ""}`
      )
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: drKeys.all })
      qc.removeQueries({ queryKey: drKeys.detail(variables.id) })
    },
  })
}
