import { useEffect, useState } from "react"
import { useLocation } from "react-router-dom"
import { useIsFetching } from "@tanstack/react-query"

/**
 * Returns true while a route transition is in progress or queries are
 * actively fetching. Used to drive the top-of-page progress bar.
 *
 * Strategy:
 * - On every pathname change, briefly enter "loading" for ~400ms
 * - Also reflect TanStack Query's global fetch counter (any active fetch)
 * - This produces a satisfying progress bar without coupling to any
 *   specific data layer
 */
export function useRouteLoading(): boolean {
  const location = useLocation()
  const fetchingCount = useIsFetching()
  const [routeLoading, setRouteLoading] = useState(false)

  useEffect(() => {
    setRouteLoading(true)
    const t = window.setTimeout(() => setRouteLoading(false), 400)
    return () => window.clearTimeout(t)
  }, [location.pathname])

  return routeLoading || fetchingCount > 0
}
