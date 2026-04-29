import { useQuery } from "@tanstack/react-query"
import { apiClient } from "./client"
import type { DashboardStats } from "./types"

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: async () => {
      const { data } = await apiClient.get<DashboardStats>(
        "/api/dashboard/stats"
      )
      return data
    },
    refetchInterval: 10_000,
  })
}
