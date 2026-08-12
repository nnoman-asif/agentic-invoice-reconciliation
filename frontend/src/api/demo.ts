import { apiClient } from "@/api/client"

export interface DemoScenario {
  id: string
  title: string
  description: string
  po_number: string
  expected_outcome: string
  used: boolean
}

export interface DemoScenariosResponse {
  scenarios: DemoScenario[]
  remaining_today: number
  limit_per_day: number
}

export interface DemoRunResponse {
  invoice_id: string
  scenario: string
  guest_token: string | null
  remaining_today: number
}

export async function fetchDemoScenarios(): Promise<DemoScenariosResponse> {
  const { data } = await apiClient.get<DemoScenariosResponse>(
    "/api/demo/scenarios"
  )
  return data
}

export async function runDemoScenario(
  scenario: string
): Promise<DemoRunResponse> {
  const { data } = await apiClient.post<DemoRunResponse>("/api/demo/run", {
    scenario,
  })
  return data
}
