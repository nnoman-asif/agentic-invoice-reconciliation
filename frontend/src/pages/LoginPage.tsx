import { useState, type FormEvent } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Github, Loader2, Sparkles, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MagneticButton } from "@/components/shared/MagneticButton"
import { AUTH_ENABLED } from "@/lib/firebase"
import { ROUTES } from "@/lib/routes"
import { useAuthStore } from "@/store/auth"

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from =
    (location.state as { from?: string; reason?: string } | null)?.from ||
    ROUTES.dashboard
  const reason = (location.state as { reason?: string } | null)?.reason

  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle)
  const signInWithGitHub = useAuthStore((s) => s.signInWithGitHub)
  const signInWithEmail = useAuthStore((s) => s.signInWithEmail)
  const registerWithEmail = useAuthStore((s) => s.registerWithEmail)

  const [mode, setMode] = useState<"signin" | "register">("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [busy, setBusy] = useState(false)

  const afterAuth = () => {
    navigate(from, { replace: true })
  }

  const mapAuthError = (err: any): string => {
    const code = err?.code || ""
    if (code === "auth/invalid-credential" || code === "auth/user-not-found" || code === "auth/wrong-password") {
      return "Invalid email or password"
    }
    if (code === "auth/email-already-in-use") return "An account with this email already exists"
    if (code === "auth/weak-password") return "Password should be at least 6 characters"
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
      return "CANCELLED"
    }
    if (code === "auth/configuration-not-found") return "This sign-in method is not enabled in the Firebase Console. Please enable it in Authentication > Sign-in method."
    if (code === "auth/indexed-db-unavailable" || err?.message?.includes("Database is closing")) {
      return "Browser storage connection interrupted. Please refresh the page and try again."
    }
    if (err instanceof Error) {
      return err.message.replace(/Firebase:\s*/, "").replace(/\(auth\/.*\)\.?/, "").trim() || "Authentication failed"
    }
    return "Authentication failed"
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
      afterAuth()
    } catch (err) {
      const msg = mapAuthError(err)
      if (msg !== "CANCELLED") {
        toast.error(msg)
      }
    } finally {
      setBusy(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (mode === "register" && password !== confirmPassword) {
      toast.error("Passwords do not match")
      return
    }
    if (mode === "signin") {
      void run(() => signInWithEmail(email.trim(), password))
    } else {
      void run(() => registerWithEmail(email.trim(), password))
    }
  }

  if (!AUTH_ENABLED) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="fixed inset-0 gradient-mesh pointer-events-none" />
        <div className="relative max-w-md text-center space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            Auth is disabled
          </h1>
          <p className="text-muted-foreground text-sm">
            Set <code className="text-xs">VITE_AUTH_ENABLED=true</code> and
            configure Firebase to use sign-in.
          </p>
          <Button asChild>
            <Link to={ROUTES.dashboard}>Continue to app</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <div className="fixed inset-0 gradient-mesh pointer-events-none" />
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 50% at 50% -20%, hsl(217 91% 60% / 0.25), transparent)",
        }}
      />

      <div className="absolute top-6 right-6 z-50">
        <MagneticButton>
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="size-11 rounded-full bg-white/70 hover:bg-blue-50 border-2 border-white hover:border-blue-200 shadow-[0_4px_20px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_20px_rgba(37,99,235,0.2)] backdrop-blur-xl text-muted-foreground hover:text-blue-600 transition-all duration-300 flex items-center justify-center group"
          >
            <Link to={ROUTES.landing}>
              <X className="size-5 stroke-[2.5] group-hover:scale-110 transition-transform duration-300" />
              <span className="sr-only">Close</span>
            </Link>
          </Button>
        </MagneticButton>
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md space-y-8"
        >
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2.5">
              <div className="size-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-[0_0_24px_-4px_hsl(217_91%_60%/0.55)]">
                <Sparkles className="size-5 text-white" />
              </div>
            </div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              {mode === "signin" ? "Welcome back" : "Create an account"}
            </h1>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              {mode === "register"
                ? "Sign up to start processing your invoices automatically."
                : reason === "sign_in_required"
                  ? "Sign in to create or edit vendors and purchase orders."
                  : "Sign in to upload invoices and manage your own data."}
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.4 }}
            className="space-y-4"
          >
            <div className="grid gap-2">
              <MagneticButton className="w-full">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11"
                  disabled={busy}
                  onClick={() => void run(() => signInWithGoogle())}
                >
                  <GoogleGlyph className="size-4 mr-2" />
                  Continue with Google
                </Button>
              </MagneticButton>
              <MagneticButton className="w-full">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11"
                  disabled={busy}
                  onClick={() => void run(() => signInWithGitHub())}
                >
                  <Github className="size-4 mr-2" />
                  Continue with GitHub
                </Button>
              </MagneticButton>
            </div>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/70" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-wide">
                <span className="bg-background px-3 text-muted-foreground">
                  or email
                </span>
              </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={
                    mode === "signin" ? "current-password" : "new-password"
                  }
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                />
              </div>
              {mode === "register" && (
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={busy}
                  />
                </div>
              )}
              <MagneticButton className="w-full mt-2">
                <Button type="submit" className="w-full h-11" disabled={busy}>
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : mode === "signin" ? (
                    "Sign in"
                  ) : (
                    "Create account"
                  )}
                </Button>
              </MagneticButton>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              {mode === "signin" ? (
                <>
                  No account?{" "}
                  <button
                    type="button"
                    className="text-foreground underline-offset-4 hover:underline"
                    onClick={() => {
                      setMode("register")
                      setPassword("")
                      setConfirmPassword("")
                    }}
                  >
                    Register
                  </button>
                </>
              ) : (
                <>
                  Already registered?{" "}
                  <button
                    type="button"
                    className="text-foreground underline-offset-4 hover:underline"
                    onClick={() => {
                      setMode("signin")
                      setPassword("")
                      setConfirmPassword("")
                    }}
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="space-y-2 text-xs text-muted-foreground text-center leading-relaxed"
          >
            <p>
              Demo accounts and their data are removed after 7 days of
              inactivity.
            </p>
            <p>
              Public demo — do not upload confidential documents.
            </p>

          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.6h5.1c-.2 1.2-1.5 3.6-5.1 3.6-3.1 0-5.6-2.5-5.6-5.6S8.9 6.2 12 6.2c1.8 0 3 .7 3.7 1.4l2.5-2.4C16.7 3.7 14.5 2.7 12 2.7 6.9 2.7 2.7 6.9 2.7 12S6.9 21.3 12 21.3c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12z"
      />
    </svg>
  )
}
