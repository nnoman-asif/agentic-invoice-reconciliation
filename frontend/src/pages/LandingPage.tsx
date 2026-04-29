import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import {
  ArrowRight,
  Sparkles,
  Workflow,
  GitCompare,
  Bot,
  Zap,
  ShieldCheck,
  LineChart,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ROUTES } from "@/lib/routes"

const FEATURES = [
  {
    icon: Bot,
    title: "Multi-agent pipeline",
    desc: "4 specialized LangGraph agents work together to parse, match, detect anomalies, and resolve.",
  },
  {
    icon: Workflow,
    title: "Live visualizer",
    desc: "Watch each agent execute in real-time with timing per stage and inspect their outputs.",
  },
  {
    icon: GitCompare,
    title: "Side-by-side compare",
    desc: "See the invoice next to matched PO and delivery data with animated match lines.",
  },
  {
    icon: ShieldCheck,
    title: "Human-in-the-loop",
    desc: "Auto-approve clean matches, route exceptions to humans with agent recommendations.",
  },
  {
    icon: LineChart,
    title: "Full observability",
    desc: "Every agent step traced via Langfuse with processing time and cost metrics.",
  },
  {
    icon: Zap,
    title: "Local LLM",
    desc: "Runs entirely on your hardware via Ollama and Qwen 2.5. Zero API costs.",
  },
]

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Background mesh */}
      <div className="fixed inset-0 gradient-mesh pointer-events-none" />

      {/* Top nav */}
      <header className="relative z-10">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-glow">
              <Sparkles className="size-4 text-white" />
            </div>
            <span className="font-semibold">Reconciliation</span>
          </div>
          <nav className="flex items-center gap-4">
            <a
              href="https://github.com/nnoman-asif/agentic-invoice-reconciliation"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              GitHub
            </a>
            <Button asChild size="sm">
              <Link to={ROUTES.dashboard}>
                Open dashboard
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-24 sm:pt-24 sm:pb-32 text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight text-balance">
            Autonomous invoice
            <br />
            <span className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 bg-clip-text text-transparent">
              reconciliation
            </span>
            , in seconds.
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-lg text-muted-foreground text-balance">
            Multi-agent pipeline that parses invoices, matches purchase orders
            and delivery receipts, detects anomalies, and routes exceptions to
            humans. Built with LangGraph, FastAPI, and local LLMs.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link to={ROUTES.dashboard}>
                Launch dashboard
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to={ROUTES.flow}>See 3D flow</Link>
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mt-16 sm:mt-24 relative"
        >
          <div className="relative mx-auto max-w-4xl rounded-2xl border border-border/60 bg-card/50 backdrop-blur-2xl shadow-elevated overflow-hidden">
            <div className="aspect-[16/9] relative">
              <div className="absolute top-0 left-1/4 size-96 bg-blue-500/30 rounded-full blur-3xl animate-float" />
              <div
                className="absolute bottom-0 right-1/4 size-96 bg-purple-500/30 rounded-full blur-3xl animate-float"
                style={{ animationDelay: "1.5s" }}
              />
              <div className="relative h-full flex items-center justify-center">
                <div className="grid grid-cols-4 gap-8">
                  {["Parser", "Matcher", "Anomaly", "Resolution"].map(
                    (label, i) => (
                      <motion.div
                        key={label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 + i * 0.1 }}
                        className="flex flex-col items-center"
                      >
                        <div
                          className={`size-14 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border-2 border-primary/30 flex items-center justify-center shadow-glow ${i === 1 ? "animate-pulse-glow" : ""}`}
                        >
                          <div className="size-2.5 rounded-full bg-primary" />
                        </div>
                        <div className="mt-2 text-xs font-medium">{label}</div>
                      </motion.div>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features grid */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Built for production.
          </h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            Not a demo. Every component you'd expect from a real-world AI
            system.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.4 }}
            >
              <Card className="p-6 h-full hover:shadow-elevated transition-shadow">
                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <f.icon className="size-5 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {f.desc}
                </p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 pb-24 text-center">
        <Card className="p-12 relative overflow-hidden">
          <div className="absolute inset-0 gradient-mesh opacity-60 pointer-events-none" />
          <div className="relative">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Ready to see it run?
            </h2>
            <p className="mt-3 text-muted-foreground">
              Upload an invoice and watch the agents work.
            </p>
            <Button size="lg" asChild className="mt-8">
              <Link to={ROUTES.inbox}>
                Open the inbox
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </Card>
      </section>

      <footer className="relative z-10 max-w-7xl mx-auto px-6 py-8 border-t border-border/60 text-center text-xs text-muted-foreground">
        Built with LangGraph, FastAPI, PostgreSQL+pgvector, Redis, Ollama, and
        React.
      </footer>
    </div>
  )
}
