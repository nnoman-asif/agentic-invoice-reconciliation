import { useEffect, useState } from "react"
import { useLocation } from "react-router-dom"

/**
 * Returns true for ~400ms after each route change so the top-of-page
 * progress bar flashes during navigation.
 *
 * Important: this used to also follow `useIsFetching()` from TanStack
 * Query, which made the bar visible whenever ANY query was in flight.
 * With the inbox / detail pages polling every couple of seconds during
 * processing, that meant the loading bar was on almost continuously --
 * not what a navigation indicator should signal. Polling now stays
 * silent; the bar only reflects route transitions.
 */
export function useRouteLoading(): boolean {
  const location = useLocation()
  const [routeLoading, setRouteLoading] = useState(false)

  useEffect(() => {
    setRouteLoading(true)
    const t = window.setTimeout(() => setRouteLoading(false), 400)
    return () => window.clearTimeout(t)
  }, [location.pathname])

  return routeLoading
}
