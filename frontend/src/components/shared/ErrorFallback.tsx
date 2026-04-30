import { useState } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  RefreshCcw,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ROUTES } from "@/lib/routes"
import { cn } from "@/lib/utils"

interface ErrorFallbackProps {
  error: Error
  resetError: () => void
}

export function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
  const [showDetails, setShowDetails] = useState(false)

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 gradient-mesh opacity-50 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-lg"
      >
        <Card className="p-8 sm:p-10 text-center">
          <motion.div
            initial={{ scale: 0.5, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 15,
              delay: 0.1,
            }}
            className="size-16 mx-auto rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mb-6"
          >
            <AlertTriangle className="size-8 text-destructive" />
          </motion.div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
            Something went wrong
          </h1>
          <p className="text-muted-foreground text-balance max-w-sm mx-auto mb-6">
            We hit an unexpected error. The fix is usually as simple as
            reloading the page.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mb-6">
            <Button onClick={resetError} className="w-full sm:w-auto">
              <RefreshCcw className="size-4" />
              Try again
            </Button>
            <Button
              variant="outline"
              asChild
              className="w-full sm:w-auto"
            >
              <Link to={ROUTES.dashboard}>
                <ArrowLeft className="size-4" />
                Back to dashboard
              </Link>
            </Button>
          </div>

          {error.message && (
            <div className="border-t border-border/60 pt-5 text-left">
              <button
                onClick={() => setShowDetails((s) => !s)}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {showDetails ? (
                  <ChevronDown className="size-3.5" />
                ) : (
                  <ChevronRight className="size-3.5" />
                )}
                {showDetails ? "Hide" : "Show"} error details
              </button>
              <motion.div
                initial={false}
                animate={{
                  height: showDetails ? "auto" : 0,
                  opacity: showDetails ? 1 : 0,
                }}
                transition={{ duration: 0.2 }}
                className={cn("overflow-hidden", showDetails && "mt-3")}
              >
                <pre className="rounded-lg bg-muted/40 border border-border/60 p-3 text-xs font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap break-words">
                  {error.message}
                  {error.stack && (
                    <>
                      {"\n\n"}
                      {error.stack.split("\n").slice(0, 5).join("\n")}
                    </>
                  )}
                </pre>
              </motion.div>
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  )
}
