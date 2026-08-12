import { useQuery } from "@tanstack/react-query"
import { apiClient } from "./client"

export interface QuotaResponse {
  used: number
  remaining: number
  limit: number
  reset_at: string
  system_status: "healthy" | "limited" | string
  llm_paused: boolean
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
