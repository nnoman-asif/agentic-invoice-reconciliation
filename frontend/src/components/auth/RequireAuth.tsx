import { useEffect } from "react"
import { Outlet } from "react-router-dom"

import { AUTH_ENABLED } from "@/lib/firebase"
import { useAuthStore } from "@/store/auth"

/**
 * Gate for AppShell routes.
 *
 * - Auth off: always allow (local-dev backend).
 * - Auth on: Firebase user or guest token required; automatically mints a guest
 *   token for new visitors so demo mode is immediately accessible.
 */
export function RequireAuth() {
  const ready = useAuthStore((s) => s.ready)
  const firebaseUser = useAuthStore((s) => s.firebaseUser)
  const guestToken = useAuthStore((s) => s.guestToken)
  const ensureGuest = useAuthStore((s) => s.ensureGuest)

  useEffect(() => {
    if (AUTH_ENABLED && ready && !firebaseUser && !guestToken) {
      void ensureGuest()
    }
  }, [ready, firebaseUser, guestToken, ensureGuest])

  if (!AUTH_ENABLED) {
    return <Outlet />
  }

  if (!ready || (!firebaseUser && !guestToken)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="size-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    )
  }

  return <Outlet />
}
