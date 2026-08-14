import { Link, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowRight, Play, Sparkles } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { MagneticButton } from "@/components/shared/MagneticButton"
import { ScenarioPicker } from "@/components/demo/ScenarioPicker"
import { HeroAnimation } from "@/components/landing/HeroAnimation"
import {
  FeatureMiniDiagram,
  type FeatureVariant,
} from "@/components/landing/FeatureMiniDiagram"
import { GITHUB_URL } from "@/lib/config"
import { ROUTES } from "@/lib/routes"

interface Feature {
  variant: FeatureVariant
  title: string
  desc: string
}

const FEATURES: Feature[] = [
  {
    variant: "pipeline",
    title: "Multi-agent pipeline",
    desc: "4 specialized AI agents work together to parse, match, detect anomalies, and resolve.",
  },
  {
    variant: "visualizer",
    title: "Live visualizer",
    desc: "Watch each agent execute in real-time with timing per stage and inspect their outputs.",
  },
  {
    variant: "compare",
    title: "Side-by-side compare",
    desc: "See the invoice next to matched PO and delivery data with animated match lines.",
  },
  {
    variant: "human-loop",
    title: "Human-in-the-loop",
    desc: "Auto-approve clean matches, route exceptions to humans with agent recommendations.",
  },
  {
    variant: "analytics",
    title: "Real-time Analytics",
    desc: "Monitor reconciliation health, match rates, and top discrepancies through a comprehensive live dashboard.",
  },
  {
    variant: "semantic-rag",
    title: "Semantic Memory",
    desc: "Maintains a semantic memory of past resolutions for intelligent recommendations and decisions.",
  },
]

export function LandingPage() {
  const navigate = useNavigate()
  const [pickerOpen, setPickerOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <ScenarioPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onStarted={() => navigate(ROUTES.inbox)}
      />
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
              href={GITHUB_URL}
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
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-20 sm:pt-24 sm:pb-28 text-center">
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
            Drop in an invoice PDF - agents parse it, three-way match against
            your purchase orders and delivery receipts, surface only the
            exceptions worth your time, and learn from every decision you
            make.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <MagneticButton>
              <Button size="lg" asChild>
                <Link to={ROUTES.dashboard}>
                  Launch dashboard
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </MagneticButton>
            <MagneticButton>
              <Button
                size="lg"
                variant="outline"
                onClick={() => setPickerOpen(true)}
              >
                <Play className="size-4" />
                Try a live demo
              </Button>
            </MagneticButton>
            <MagneticButton>
              <Button size="lg" variant="ghost" asChild>
                <Link to={ROUTES.flow}>See 3D flow</Link>
              </Button>
            </MagneticButton>
          </div>
        </motion.div>

        {/* Animated hero showing live mini pipeline */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mt-14 sm:mt-20 relative"
        >
          <HeroAnimation />
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
              <Card className="p-6 h-full hover:shadow-elevated transition-all hover:-translate-y-0.5 group">
                <div className="rounded-xl bg-muted/40 border border-border/40 mb-5 p-3 group-hover:border-primary/30 transition-colors">
                  <FeatureMiniDiagram variant={f.variant} />
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
            <MagneticButton className="mt-8">
              <Button size="lg" asChild>
                <Link to={ROUTES.inbox}>
                  Open the inbox
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </MagneticButton>
          </div>
        </Card>
      </section>

    </div>
  )
}
