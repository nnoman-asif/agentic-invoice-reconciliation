import { useEffect, useState } from "react"
import { useLocation } from "react-router-dom"

/**
 * Returns true for ~400ms after each route change so the top-of-page
 * progress bar flashes during navigation transitions (query polling runs silently).
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
