import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "./client"
import type {
  ImportResponse,
  InvoiceListItem,
  PurchaseOrderListItem,
} from "./types"

export interface Vendor {
  id: string
  name: string
  code: string
  tax_id: string | null
  address: string | null
  contact_email: string | null
  created_at: string
  updated_at: string
}

export interface VendorStats {
  vendor_id: string
  po_count: number
  po_total: number
  invoice_count: number
  invoice_total: number
  approved_count: number
  avg_processing_time_ms: number | null
}

export const vendorKeys = {
  all: ["vendors"] as const,
  list: () => [...vendorKeys.all, "list"] as const,
  detail: (id: string) => [...vendorKeys.all, "detail", id] as const,
  pos: (id: string) => [...vendorKeys.all, "pos", id] as const,
  invoices: (id: string) => [...vendorKeys.all, "invoices", id] as const,
  stats: (id: string) => [...vendorKeys.all, "stats", id] as const,
}

export function useVendors() {
  return useQuery({
    queryKey: vendorKeys.list(),
    queryFn: async () => {
      const { data } = await apiClient.get<Vendor[]>("/api/vendors")
      return data
    },
  })
}

export function useVendor(id: string | undefined | null) {
  return useQuery({
    queryKey: vendorKeys.detail(id ?? ""),
    queryFn: async () => {
      const { data } = await apiClient.get<Vendor>(`/api/vendors/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useVendorPOs(id: string | undefined | null) {
  return useQuery({
    queryKey: vendorKeys.pos(id ?? ""),
    queryFn: async () => {
      const { data } = await apiClient.get<PurchaseOrderListItem[]>(
        `/api/vendors/${id}/purchase-orders`
      )
      return data
    },
    enabled: !!id,
  })
}

export function useVendorInvoices(id: string | undefined | null) {
  return useQuery({
    queryKey: vendorKeys.invoices(id ?? ""),
    queryFn: async () => {
      const { data } = await apiClient.get<InvoiceListItem[]>(
        `/api/vendors/${id}/invoices`
      )
      return data
    },
    enabled: !!id,
  })
}

export function useVendorStats(id: string | undefined | null) {
  return useQuery({
    queryKey: vendorKeys.stats(id ?? ""),
    queryFn: async () => {
      const { data } = await apiClient.get<VendorStats>(
        `/api/vendors/${id}/stats`
      )
      return data
    },
    enabled: !!id,
  })
}

/** Upload a CSV file to bulk-create vendors. */
export function useImportVendorsCsv() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append("file", file)
      const { data } = await apiClient.post<ImportResponse>(
        "/api/vendors/import",
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vendorKeys.all })
    },
  })
}
