import { AnimatePresence, motion } from "framer-motion"

import { useRouteLoading } from "@/hooks/useRouteLoading"

/**
 * Thin animated progress bar pinned to the top of the viewport.
 * Visible whenever a route is transitioning or queries are fetching.
 */
export function PageLoadingBar() {
  const loading = useRouteLoading()

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-[60] pointer-events-none h-0.5"
    >
      <AnimatePresence>
        {loading && (
          <motion.div
            key="bar"
            initial={{ scaleX: 0, opacity: 1, originX: 0 }}
            animate={{
              scaleX: [0, 0.4, 0.7, 0.85, 0.95],
              transition: {
                duration: 1.6,
                times: [0, 0.2, 0.45, 0.75, 1],
                ease: "easeOut",
              },
            }}
            exit={{
              scaleX: 1,
              opacity: 0,
              transition: { duration: 0.25, ease: "easeOut" },
            }}
            className="h-full origin-left bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]"
          />
        )}
      </AnimatePresence>
    </div>
  )
}
