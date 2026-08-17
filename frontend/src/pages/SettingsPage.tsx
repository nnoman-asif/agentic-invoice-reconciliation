import { useEffect, useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { format } from "date-fns"
import {
  Bug,
  CheckCircle2,
  Lightbulb,
  Loader2,
  Lock,
  MessageSquarePlus,
  Monitor,
  Moon,
  Send,
  Sun,
  TrendingUp,
} from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useSubmitFeedback, type FeedbackCategory } from "@/api/feedback"
import { useHealth } from "@/api/health"
import { useQuota, useRequestQuotaIncrease } from "@/api/quota"
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
  const { data: quota, isLoading: quotaLoading } = useQuota()
  const requestQuota = useRequestQuotaIncrease()
  const navigate = useNavigate()
  const location = useLocation()
  
  const currentTab = location.hash.replace("#", "") || "appearance"

  const handleTabChange = (val: string) => {
    navigate(`${ROUTES.settings}#${val}`, { replace: true })
  }

  const me = useAuthStore((s) => s.me)
  const ready = useAuthStore((s) => s.ready)
  const refreshMe = useAuthStore((s) => s.refreshMe)
  const signOut = useAuthStore((s) => s.signOut)
  const deleteAccount = useAuthStore((s) => s.deleteAccount)
  const isGuest = useAuthStore((s) => Boolean(s.guestToken) && !s.firebaseUser)
  const isSignedIn = useAuthStore((s) => !AUTH_ENABLED || Boolean(s.firebaseUser))
  const [deleting, setDeleting] = useState(false)
  const [requestedLimit, setRequestedLimit] = useState("")
  const [requestReason, setRequestReason] = useState("")
  const [requestSent, setRequestSent] = useState(false)

  const submitFeedbackMutation = useSubmitFeedback()
  const [feedbackCategory, setFeedbackCategory] = useState<FeedbackCategory>("suggestion")
  const [feedbackSubject, setFeedbackSubject] = useState("")
  const [feedbackMessage, setFeedbackMessage] = useState("")
  const [feedbackQuotaLimit, setFeedbackQuotaLimit] = useState("")
  const [feedbackSuccess, setFeedbackSuccess] = useState(false)

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!feedbackSubject.trim() || !feedbackMessage.trim()) {
      toast.error("Please enter both a subject and message.")
      return
    }
    let parsedLimit: number | undefined
    if (feedbackCategory === "quota_increase") {
      parsedLimit = Number.parseInt(feedbackQuotaLimit, 10)
      const curLimit = quota?.limit ?? me?.daily_invoice_limit ?? 15
      if (!Number.isFinite(parsedLimit) || parsedLimit <= curLimit) {
        toast.error(`Requested limit must be greater than your current daily limit (${curLimit})`)
        return
      }
    }

    try {
      await submitFeedbackMutation.mutateAsync({
        category: feedbackCategory,
        subject: feedbackSubject.trim(),
        message: feedbackMessage.trim(),
        requested_limit: parsedLimit,
      })
      setFeedbackSuccess(true)
      toast.success("Feedback submitted! Thank you for helping us improve.")
    } catch (err: unknown) {
      const errorMsg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : err instanceof Error
            ? err.message
            : "Failed to submit feedback."
      toast.error(errorMsg || "Failed to submit feedback.")
    }
  }

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

  const onRequestQuota = async () => {
    const limit = Number.parseInt(requestedLimit, 10)
    if (!Number.isFinite(limit) || limit <= (quota?.limit ?? 0)) {
      toast.error(
        `Enter a limit greater than your current allowance (${quota?.limit ?? 0})`
      )
      return
    }
    try {
      await requestQuota.mutateAsync({
        requested_limit: limit,
        reason: requestReason.trim() || undefined,
      })
      setRequestSent(true)
      toast.success("Quota request submitted")
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not submit quota request"
      )
    }
  }

  const quotaPct =
    quota && quota.limit > 0
      ? Math.min(100, Math.round((quota.used / quota.limit) * 100))
      : 0

  return (
    <div className="space-y-8 max-w-3xl">
      <PageHeader
        title="Settings"
        description="Configure your reconciliation experience."
      />

      <Tabs value={currentTab} onValueChange={handleTabChange}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="quota">Quota</TabsTrigger>
          <TabsTrigger value="feedback">Feedback & Requests</TabsTrigger>
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
              ) : isGuest ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
                    <div className="font-semibold text-foreground flex items-center gap-2">
                      <span className="size-2 rounded-full bg-blue-500 animate-pulse" />
                      Guest Demo Session
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      You are using a temporary guest session with 3 sample invoice reconciliations per day. No personal account or stored data is associated with this session.
                    </p>
                  </div>
                  <div className="pt-2">
                    <Button onClick={() => navigate(ROUTES.login)}>
                      Sign in or Create an Account
                    </Button>
                  </div>
                </div>
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
                        Account retention
                      </dt>
                      <dd className="mt-1 font-medium text-sm text-muted-foreground">
                        Demo - if account is inactive for 7 days it will be removed.
                      </dd>
                    </div>
                  </dl>

                  <div className="flex flex-wrap gap-2 pt-2">
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

        <TabsContent value="quota" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Daily invoice quota</CardTitle>
              <CardDescription>
                Usage is counted when an invoice reaches the LLM - PDFs
                rejected by the upload gate do not consume quota.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {quotaLoading && !quota ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading quota…
                </div>
              ) : quota ? (
                <>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <div className="text-3xl font-semibold tabular-nums tracking-tight">
                        {quota.used}
                        <span className="text-lg text-muted-foreground font-normal">
                          {" "}
                          / {quota.limit}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {quota.remaining} remaining today
                      </p>
                    </div>
                    <Badge
                      variant={
                        quota.system_status === "healthy"
                          ? "success"
                          : "warning"
                      }
                    >
                      System {quota.system_status}
                    </Badge>
                  </div>
                  <Progress value={quotaPct} />
                  <dl className="grid gap-3 sm:grid-cols-2 text-sm">
                    <div>
                      <dt className="text-muted-foreground text-xs uppercase tracking-wide">
                        Resets
                      </dt>
                      <dd className="mt-1 font-medium">
                        {format(new Date(quota.reset_at), "MMM d, yyyy HH:mm")}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-xs uppercase tracking-wide">
                        Operator pause
                      </dt>
                      <dd className="mt-1 font-medium">
                        {quota.llm_paused ? "Paused" : "Off"}
                      </dd>
                    </div>
                  </dl>
                  {quota.remaining === 0 && (
                    <div className="space-y-4 border border-border/60 rounded-lg p-4 bg-muted/20">
                      <p className="text-sm text-muted-foreground">
                        You have used today&apos;s invoice allowance. Uploads that
                        need the LLM will wait until the daily reset
                        {quota.system_status === "limited"
                          ? ", or until system capacity recovers"
                          : ""}
                        . Request a higher daily limit below.
                      </p>
                      {requestSent ? (
                        <p className="text-sm font-medium text-foreground">
                          Request received. We&apos;ll review it shortly.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <Label htmlFor="requested-limit">
                              Requested daily limit
                            </Label>
                            <Input
                              id="requested-limit"
                              type="number"
                              min={quota.limit + 1}
                              placeholder={String(quota.limit + 15)}
                              value={requestedLimit}
                              onChange={(e) => setRequestedLimit(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="request-reason">
                              Reason (optional)
                            </Label>
                            <Textarea
                              id="request-reason"
                              rows={3}
                              placeholder="What are you evaluating or building?"
                              value={requestReason}
                              onChange={(e) => setRequestReason(e.target.value)}
                            />
                          </div>
                          <Button
                            onClick={() => void onRequestQuota()}
                            disabled={requestQuota.isPending}
                          >
                            {requestQuota.isPending ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              "Request increase"
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                  {quota.remaining > 0 && (
                    <div className="flex items-center justify-between p-3.5 rounded-lg border border-border/70 bg-muted/20 text-xs text-muted-foreground">
                      <span>Need a higher daily allowance for enterprise workloads or high-volume trials?</span>
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 h-auto text-primary text-xs font-semibold"
                        onClick={() => handleTabChange("feedback")}
                      >
                        Request Quota Increase →
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Could not load quota. Try refreshing the page.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="feedback" className="space-y-6">
          {isGuest || (AUTH_ENABLED && !me) ? (
            <Card className="border-primary/20 bg-gradient-to-b from-primary/5 to-transparent">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
                  <Lock className="size-6" />
                </div>
                <CardTitle className="text-xl">Registered Account Required</CardTitle>
                <CardDescription className="max-w-md mx-auto">
                  Feedback submissions, feature suggestions, and quota increase requests are reserved for registered users.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center pt-2 pb-6">
                <Button onClick={() => navigate(ROUTES.login, { state: { from: `${ROUTES.settings}#feedback` } })}>
                  Sign in or Register
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Send Feedback & Requests</CardTitle>
                <CardDescription>
                  Have an idea, found an issue, or need more daily invoice processing capacity? Let our engineering team know directly.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {feedbackSuccess ? (
                  <div className="py-8 text-center space-y-4">
                    <div className="mx-auto size-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                      <CheckCircle2 className="size-6" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-semibold text-lg text-foreground">Feedback Received!</h3>
                      <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                        Thank you for your input. Our team has received your message and will review it shortly.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFeedbackSuccess(false)
                        setFeedbackSubject("")
                        setFeedbackMessage("")
                        setFeedbackQuotaLimit("")
                      }}
                    >
                      Send Another Request
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={(e) => void handleSubmitFeedback(e)} className="space-y-5">
                    {/* Category selector grid */}
                    <div className="space-y-2">
                      <Label>Request Type</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {[
                          { id: "suggestion", label: "Suggestion", icon: Lightbulb, desc: "Feature ideas" },
                          { id: "quota_increase", label: "Quota Increase", icon: TrendingUp, desc: "More invoices" },
                          { id: "bug", label: "Bug Report", icon: Bug, desc: "Found an issue" },
                          { id: "general", label: "General", icon: MessageSquarePlus, desc: "Other feedback" },
                        ].map((cat) => {
                          const Icon = cat.icon
                          const isSelected = feedbackCategory === cat.id
                          return (
                            <button
                              type="button"
                              key={cat.id}
                              onClick={() => setFeedbackCategory(cat.id as FeedbackCategory)}
                              className={cn(
                                "flex flex-col items-start p-3 rounded-lg border text-left transition-all",
                                isSelected
                                  ? "border-primary bg-primary/10 shadow-sm"
                                  : "border-border/70 hover:border-border hover:bg-muted/40"
                              )}
                            >
                              <div className={cn("size-7 rounded-md flex items-center justify-center mb-2", isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                                <Icon className="size-4" />
                              </div>
                              <span className="text-xs font-semibold text-foreground">{cat.label}</span>
                              <span className="text-[10px] text-muted-foreground mt-0.5">{cat.desc}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Subject */}
                    <div className="space-y-1.5">
                      <Label htmlFor="feedback-subject">Subject</Label>
                      <Input
                        id="feedback-subject"
                        placeholder={
                          feedbackCategory === "suggestion"
                            ? "e.g., Support for CSV line-item export"
                            : feedbackCategory === "quota_increase"
                            ? "e.g., Evaluating high volume batch processing"
                            : feedbackCategory === "bug"
                            ? "e.g., Discrepancy mismatch on currency conversion"
                            : "e.g., General thoughts on pipeline visualizer"
                        }
                        value={feedbackSubject}
                        onChange={(e) => setFeedbackSubject(e.target.value)}
                        required
                        maxLength={200}
                      />
                    </div>

                    {/* Conditional Quota Limit Input */}
                    {feedbackCategory === "quota_increase" && (
                      <div className="space-y-1.5 p-3.5 rounded-lg border border-primary/20 bg-primary/5">
                        <div className="flex items-center justify-between text-xs">
                          <Label htmlFor="feedback-quota-limit" className="font-semibold">
                            Requested Daily Limit
                          </Label>
                          <span className="text-muted-foreground">
                            Current limit: <strong className="text-foreground">{quota?.limit ?? me?.daily_invoice_limit ?? 15}</strong> / day
                          </span>
                        </div>
                        <Input
                          id="feedback-quota-limit"
                          type="number"
                          min={(quota?.limit ?? me?.daily_invoice_limit ?? 15) + 1}
                          max={10000}
                          placeholder={String((quota?.limit ?? me?.daily_invoice_limit ?? 15) + 20)}
                          value={feedbackQuotaLimit}
                          onChange={(e) => setFeedbackQuotaLimit(e.target.value)}
                          required
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Please enter the number of daily invoices you anticipate processing.
                        </p>
                      </div>
                    )}

                    {/* Message / Details */}
                    <div className="space-y-1.5">
                      <Label htmlFor="feedback-message">
                        {feedbackCategory === "quota_increase" ? "Use Case & Justification" : "Message / Details"}
                      </Label>
                      <Textarea
                        id="feedback-message"
                        rows={4}
                        placeholder={
                          feedbackCategory === "suggestion"
                            ? "Describe what you would like to see and why it would be helpful..."
                            : feedbackCategory === "quota_increase"
                            ? "Tell us about your team size, expected invoice volume, or trial timeframe..."
                            : feedbackCategory === "bug"
                            ? "Steps to reproduce, expected vs actual result, invoice format..."
                            : "Share your thoughts or questions..."
                        }
                        value={feedbackMessage}
                        onChange={(e) => setFeedbackMessage(e.target.value)}
                        required
                        maxLength={3000}
                      />
                    </div>

                    <Button
                      type="submit"
                      className="gap-2"
                      disabled={submitFeedbackMutation.isPending}
                    >
                      {submitFeedbackMutation.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Send className="size-4" />
                      )}
                      <span>Submit Request</span>
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          )}
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
                { label: "Database", value: health?.postgres },
                { label: "Cache", value: health?.redis },
                { label: "LLM Inference Engine", value: health?.chat_provider ? "healthy" : "unhealthy" },
                { label: "Semantic Search engine", value: health?.embedding_provider ? "healthy" : "unhealthy" },
                {
                  label: "Message Queue",
                  value: health?.queue_depth != null ? "healthy" : "unhealthy",
                },
                { label: "Quota Service", value: health?.quota_status },
              ].map((svc) => (
                <div
                  key={svc.label}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/60"
                >
                  <span className="font-medium">{svc.label}</span>
                  <Badge
                    variant={
                      svc.value === "healthy"
                        ? "success"
                        : svc.value === "limited" || svc.value === "degraded"
                          ? "warning"
                          : svc.value === "unhealthy"
                            ? "destructive"
                            : "muted"
                    }
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
                A production-grade, multi-agent AI system that automates 3-way
                invoice matching with human-in-the-loop for
                exceptions and full observability.
              </p>
              
              <div className="pt-4 mt-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                <span>© {new Date().getFullYear()} All Rights Reserved.</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
