import { Link, useLocation } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Compass, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ROUTES } from "@/lib/routes"
import { useUIStore } from "@/store/ui"

export function NotFoundPage() {
  const location = useLocation()
  const setCommandOpen = useUIStore((s) => s.setCommandPaletteOpen)

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 gradient-mesh opacity-60 pointer-events-none" />

      {/* Decorative blurred orbs */}
      <div className="absolute top-1/4 -left-24 size-96 rounded-full bg-blue-500/20 blur-3xl pointer-events-none animate-float" />
      <div
        className="absolute bottom-1/4 -right-24 size-96 rounded-full bg-purple-500/20 blur-3xl pointer-events-none animate-float"
        style={{ animationDelay: "1.5s" }}
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-xl text-center"
      >
        {/* Animated 404 */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 18,
            delay: 0.1,
          }}
          className="mb-2"
        >
          <div className="inline-flex items-baseline gap-1 font-bold tracking-tighter">
            <motion.span
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-8xl sm:text-9xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 bg-clip-text text-transparent"
            >
              4
            </motion.span>
            <motion.span
              initial={{ y: 12, opacity: 0, rotate: -180 }}
              animate={{ y: 0, opacity: 1, rotate: 0 }}
              transition={{
                delay: 0.3,
                type: "spring",
                stiffness: 150,
                damping: 14,
              }}
              className="text-8xl sm:text-9xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 bg-clip-text text-transparent"
            >
              0
            </motion.span>
            <motion.span
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-8xl sm:text-9xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 bg-clip-text text-transparent"
            >
              4
            </motion.span>
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-2xl sm:text-3xl font-bold tracking-tight mb-2 text-balance"
        >
          This page doesn&apos;t exist
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="text-muted-foreground text-balance max-w-md mx-auto mb-2"
        >
          We couldn&apos;t find anything at
        </motion.p>
        <motion.code
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="inline-block text-xs font-mono px-2 py-1 rounded bg-muted text-muted-foreground mb-8"
        >
          {location.pathname}
        </motion.code>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-2 mb-8"
        >
          <Button asChild>
            <Link to={ROUTES.dashboard}>
              <ArrowLeft className="size-4" />
              Back to dashboard
            </Link>
          </Button>
          <Button variant="outline" onClick={() => setCommandOpen(true)}>
            <Search className="size-4" />
            Search the app
          </Button>
        </motion.div>

        {/* Helpful destinations */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 }}
        >
          <Card className="p-5 text-left">
            <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Compass className="size-3.5" />
              Try one of these
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { to: ROUTES.dashboard, label: "Dashboard" },
                { to: ROUTES.inbox, label: "Invoice Inbox" },
                { to: ROUTES.exceptions, label: "Exceptions" },
                { to: ROUTES.purchaseOrders, label: "Purchase Orders" },
                { to: ROUTES.deliveryReceipts, label: "Delivery Receipts" },
                { to: ROUTES.pipeline, label: "Pipeline Visualizer" },
                { to: ROUTES.flow, label: "3D Flow" },
                { to: ROUTES.settings, label: "Settings" },
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="px-3 py-2 rounded-lg text-sm hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  )
}
