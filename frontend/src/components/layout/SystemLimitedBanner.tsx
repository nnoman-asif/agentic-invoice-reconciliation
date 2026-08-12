import { AlertTriangle } from "lucide-react"
import { Link } from "react-router-dom"

import { useQuota } from "@/api/quota"
import { ROUTES } from "@/lib/routes"

/** Global banner when the system is limited or the LLM kill switch is on. */
export function SystemLimitedBanner() {
  const { data } = useQuota({ refetchInterval: 20_000 })

  if (!data || data.system_status !== "limited") {
    return null
  }

  const message = data.llm_paused
    ? "Invoice processing is temporarily paused by the operator. Browsing stays available."
    : "System is at daily capacity. New uploads are paused until UTC midnight; browsing stays available."

  return (
    <div
      role="status"
      className="border-b border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100"
    >
      <div className="flex items-start gap-3 px-4 py-2.5 sm:px-6 text-sm">
        <AlertTriangle className="size-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="flex-1 leading-relaxed">
          {message}{" "}
          <Link
            to={ROUTES.settings}
            className="underline underline-offset-4 font-medium"
          >
            View quota
          </Link>
        </p>
      </div>
    </div>
  )
}
