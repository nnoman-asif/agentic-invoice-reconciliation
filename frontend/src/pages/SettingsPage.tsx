import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { format } from "date-fns"
import { Loader2, Monitor, Moon, Sun } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useHealth } from "@/api/health"
import { useTheme } from "@/hooks/useTheme"
import { AUTH_ENABLED } from "@/lib/firebase"
import { ROUTES } from "@/lib/routes"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/store/auth"
import type { Theme } from "@/store/ui"

const THEMES: {
  value: Theme
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
]

export function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { data: health } = useHealth()
  const navigate = useNavigate()

  const me = useAuthStore((s) => s.me)
  const ready = useAuthStore((s) => s.ready)
  const refreshMe = useAuthStore((s) => s.refreshMe)
  const signOut = useAuthStore((s) => s.signOut)
  const deleteAccount = useAuthStore((s) => s.deleteAccount)
  const isGuest = useAuthStore((s) => s.isGuest)
  const isSignedIn = useAuthStore((s) => s.isSignedIn)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (AUTH_ENABLED && ready) {
      void refreshMe().catch(() => undefined)
    }
  }, [ready, refreshMe])

  const onDelete = async () => {
    setDeleting(true)
    try {
      await deleteAccount()
      navigate(ROUTES.landing, { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <PageHeader
        title="Settings"
        description="Configure your reconciliation experience."
      />

      <Tabs defaultValue="appearance">
        <TabsList>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
        </TabsList>

        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Theme</CardTitle>
              <CardDescription>
                Choose how the app looks. System matches your OS preference.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {THEMES.map((t) => {
                  const Icon = t.icon
                  const active = theme === t.value
                  return (
                    <button
                      key={t.value}
                      onClick={() => setTheme(t.value)}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 transition-all",
                        active
                          ? "border-primary bg-primary/5 shadow-glow"
                          : "border-border hover:border-border/80 hover:bg-accent/30"
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-6 transition-colors",
                          active ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      <span className="text-sm font-medium">{t.label}</span>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
              <CardDescription>
                Identity, retention window, and account deletion.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {!AUTH_ENABLED ? (
                <p className="text-muted-foreground">
                  Auth is disabled for local development. Enable{" "}
                  <code className="text-xs">VITE_AUTH_ENABLED</code> and
                  matching backend <code className="text-xs">AUTH_ENABLED</code>{" "}
                  to use profiles.
                </p>
              ) : !me ? (
                <p className="text-muted-foreground">
                  No session loaded.{" "}
                  <button
                    type="button"
                    className="underline underline-offset-4"
                    onClick={() => navigate(ROUTES.login)}
                  >
                    Sign in
                  </button>
                </p>
              ) : (
                <>
                  <dl className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <dt className="text-muted-foreground text-xs uppercase tracking-wide">
                        Kind
                      </dt>
                      <dd className="mt-1 font-medium capitalize">{me.kind}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-xs uppercase tracking-wide">
                        Display name
                      </dt>
                      <dd className="mt-1 font-medium">
                        {me.display_name || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-xs uppercase tracking-wide">
                        Email
                      </dt>
                      <dd className="mt-1 font-medium">{me.email || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-xs uppercase tracking-wide">
                        Daily invoice limit
                      </dt>
                      <dd className="mt-1 font-medium">
                        {me.daily_invoice_limit}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-muted-foreground text-xs uppercase tracking-wide">
                        Scheduled deletion
                      </dt>
                      <dd className="mt-1 font-medium">
                        {me.scheduled_deletion_at
                          ? format(
                              new Date(me.scheduled_deletion_at),
                              "MMM d, yyyy HH:mm"
                            )
                          : "—"}
                      </dd>
                    </div>
                  </dl>

                  <div className="flex flex-wrap gap-2 pt-2">
                    {(isSignedIn() || isGuest()) && (
                      <Button
                        variant="outline"
                        onClick={() =>
                          void signOut().then(() =>
                            navigate(ROUTES.landing, { replace: true })
                          )
                        }
                      >
                        Sign out
                      </Button>
                    )}

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive">
                          Delete my account and all my data
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Delete account permanently?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This removes your account, invoices, uploads, and
                            related records. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={deleting}>
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            disabled={deleting}
                            onClick={(e) => {
                              e.preventDefault()
                              void onDelete()
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {deleting ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              "Delete everything"
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Service Health</CardTitle>
              <CardDescription>
                Backend service connectivity status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "PostgreSQL", value: health?.postgres },
                { label: "Redis", value: health?.redis },
                { label: "Ollama", value: health?.ollama },
              ].map((svc) => (
                <div
                  key={svc.label}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/60"
                >
                  <span className="font-medium">{svc.label}</span>
                  <Badge
                    variant={svc.value === "healthy" ? "success" : "destructive"}
                  >
                    {svc.value ?? "unknown"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="about" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Agentic Invoice Reconciliation</CardTitle>
              <CardDescription>v1.0.0</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p className="text-muted-foreground leading-relaxed">
                A production-grade, multi-agent system that automates 3-way
                invoice matching using LangGraph, with human-in-the-loop for
                exceptions and full observability via Langfuse.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                {[
                  "LangGraph",
                  "FastAPI",
                  "PostgreSQL + pgvector",
                  "Redis",
                  "Ollama (Qwen 2.5 7B)",
                  "Langfuse",
                  "React + Vite",
                  "Tailwind + shadcn/ui",
                ].map((tech) => (
                  <div
                    key={tech}
                    className="px-3 py-2 rounded-lg bg-muted/30 border border-border/60 text-xs font-mono"
                  >
                    {tech}
                  </div>
                ))}
              </div>
              <Button variant="outline" asChild className="mt-2">
                <a
                  href="https://github.com/nnoman-asif/agentic-invoice-reconciliation"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on GitHub →
                </a>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
