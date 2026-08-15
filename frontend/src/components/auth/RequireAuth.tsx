import { useEffect } from "react"
import { Navigate, Outlet, useLocation } from "react-router-dom"

import { AUTH_ENABLED } from "@/lib/firebase"
import { ROUTES } from "@/lib/routes"
import { useAuthStore } from "@/store/auth"

/** Pages that require a signed-in (non-guest) account when auth is on. */
const WRITE_PATHS = [
  ROUTES.vendors,
  ROUTES.purchaseOrders,
  ROUTES.deliveryReceipts,
] as const

function isWritePath(pathname: string): boolean {
  return WRITE_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  )
}

/**
 * Gate for AppShell routes.
 *
 * - Auth off: always allow (local-dev backend).
 * - Auth on: Firebase user or guest token required; guests are redirected
 *   away from write-oriented pages (vendors / POs / receipts).
 */
export function RequireAuth() {
  const location = useLocation()
  const ready = useAuthStore((s) => s.ready)
  const firebaseUser = useAuthStore((s) => s.firebaseUser)
  const guestToken = useAuthStore((s) => s.guestToken)

  if (!AUTH_ENABLED) {
    return <Outlet />
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="size-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    )
  }

  if (!firebaseUser && !guestToken) {
    return (
      <Navigate
        to={ROUTES.login}
        replace
        state={{ from: location.pathname }}
      />
    )
  }

  if (!firebaseUser && guestToken && isWritePath(location.pathname)) {
    return (
      <Navigate
        to={ROUTES.login}
        replace
        state={{
          from: location.pathname,
          reason: "sign_in_required",
        }}
      />
    )
  }

  return <Outlet />
}
