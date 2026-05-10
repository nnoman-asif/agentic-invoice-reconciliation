import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "./client"
import {
  isInvoiceProcessing,
  type Invoice,
  type InvoiceListItem,
  type InvoiceUploadResponse,
} from "./types"

// Re-exported from the canonical reconciliation module. Older callsites
// imported `useInvoiceReconciliation` from here; keep that working but
// route them through the single shared hook so cache keys are unified.
export {
  useReconciliationByInvoice as useInvoiceReconciliation,
  reconciliationKeys,
} from "./reconciliations"

export const invoiceKeys = {
  all: ["invoices"] as const,
  lists: () => [...invoiceKeys.all, "list"] as const,
  list: (filters?: Record<string, string>) =>
    [...invoiceKeys.lists(), filters] as const,
  details: () => [...invoiceKeys.all, "detail"] as const,
  detail: (id: string) => [...invoiceKeys.details(), id] as const,
}

export function useInvoices(filters?: {
  processing_status?: string
  business_status?: string
  vendor_id?: string
}) {
  return useQuery({
    queryKey: invoiceKeys.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters?.processing_status)
        params.append("processing_status", filters.processing_status)
      if (filters?.business_status)
        params.append("business_status", filters.business_status)
      if (filters?.vendor_id) params.append("vendor_id", filters.vendor_id)

      const { data } = await apiClient.get<InvoiceListItem[]>(
        `/api/invoices${params.toString() ? `?${params}` : ""}`
      )
      return data
    },
    refetchInterval: (query) => {
      const data = query.state.data
      const hasProcessing = data?.some((inv) =>
        isInvoiceProcessing(inv.processing_status)
      )
      return hasProcessing ? 2000 : false
    },
  })
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: invoiceKeys.detail(id ?? ""),
    queryFn: async () => {
      const { data } = await apiClient.get<Invoice>(`/api/invoices/${id}`)
      return data
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data
      return isInvoiceProcessing(data?.processing_status) ? 1500 : false
    },
  })
}

export function useUploadInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append("file", file)
      const { data } = await apiClient.post<InvoiceUploadResponse>(
        "/api/invoices/upload",
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invoiceKeys.lists() })
    },
  })
}
