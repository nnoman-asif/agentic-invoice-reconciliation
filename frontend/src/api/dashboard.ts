import { useQuery } from "@tanstack/react-query"
import { apiClient } from "./client"
import type { DashboardStats } from "./types"

export const dashboardKeys = {
  all: ["dashboard"] as const,
  stats: () => ["dashboard", "stats"] as const,
}

export function useDashboardStats() {
  return useQuery({
    queryKey: dashboardKeys.stats(),
    queryFn: async () => {
      const { data } = await apiClient.get<DashboardStats>(
        "/api/dashboard/stats"
      )
      return data
    },
    refetchInterval: 10_000,
  })
}
