import { Sun, Moon, Monitor } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTheme } from "@/hooks/useTheme"
import { useHealth } from "@/api/health"
import type { Theme } from "@/store/ui"
import { cn } from "@/lib/utils"

const THEMES: { value: Theme; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
]

export function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { data: health } = useHealth()

  return (
    <div className="space-y-8 max-w-3xl">
      <PageHeader
        title="Settings"
        description="Configure your reconciliation experience."
      />

      <Tabs defaultValue="appearance">
        <TabsList>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
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
