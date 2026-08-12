import { useMutation, useQuery } from "@tanstack/react-query"
import { apiClient } from "./client"

export interface QuotaResponse {
  used: number
  remaining: number
  limit: number
  reset_at: string
  system_status: "healthy" | "limited" | string
  llm_paused: boolean
}

export interface QuotaRequestPayload {
  requested_limit: number
  reason?: string
}

export interface QuotaRequestResult {
  id: string
  requested_limit: number
  reason: string | null
  status: string
  created_at: string
  discord_notified: boolean
}

export function useQuota(options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: ["quota"],
    queryFn: async () => {
      const { data } = await apiClient.get<QuotaResponse>("/api/quota")
      return data
    },
    refetchInterval: options?.refetchInterval ?? 30_000,
  })
}

export function useRequestQuotaIncrease() {
  return useMutation({
    mutationFn: async (payload: QuotaRequestPayload) => {
      const { data } = await apiClient.post<QuotaRequestResult>(
        "/api/quota/request",
        payload
      )
      return data
    },
  })
}
