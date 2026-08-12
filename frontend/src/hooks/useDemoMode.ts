import { useCallback, useState } from "react"
import { toast } from "sonner"

import {
  fetchDemoScenarios,
  runDemoScenario,
  type DemoScenariosResponse,
} from "@/api/demo"
import { useAuthStore } from "@/store/auth"

interface UseDemoModeReturn {
  loadScenarios: () => Promise<DemoScenariosResponse | null>
  runScenario: (scenarioId: string) => Promise<boolean>
  isRunning: boolean
}

/**
 * Server-side demo flow: list scenarios and enqueue a sample invoice
 * via /api/demo/* (no client-side PDF upload).
 */
export function useDemoMode(): UseDemoModeReturn {
  const setGuestToken = useAuthStore((s) => s.setGuestToken)
  const [isRunning, setIsRunning] = useState(false)

  const loadScenarios = useCallback(async () => {
    try {
      return await fetchDemoScenarios()
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Could not load demo scenarios"
      toast.error("Demo unavailable", { description: message })
      return null
    }
  }, [])

  const runScenario = useCallback(
    async (scenarioId: string): Promise<boolean> => {
      if (isRunning) return false
      setIsRunning(true)

      const toastId = toast.loading("Starting demo…", {
        description: "Enqueueing a sample invoice on the server.",
      })

      try {
        const result = await runDemoScenario(scenarioId)
        if (result.guest_token) {
          setGuestToken(result.guest_token)
        }
        toast.success("Demo started", {
          id: toastId,
          description: `${result.remaining_today} demo run(s) remaining today. Watch it in the inbox.`,
        })
        return true
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Demo failed"
        toast.error("Demo failed", { id: toastId, description: message })
        return false
      } finally {
        setIsRunning(false)
      }
    },
    [isRunning, setGuestToken]
  )

  return { loadScenarios, runScenario, isRunning }
}
