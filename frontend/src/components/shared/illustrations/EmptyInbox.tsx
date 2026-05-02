import { motion } from "framer-motion"

import { cn } from "@/lib/utils"

interface Props {
  className?: string
}

export function EmptyInbox({ className }: Props) {
  return (
    <svg
      viewBox="0 0 200 160"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-muted-foreground", className)}
      fill="none"
    >
      {/* Soft gradient background blob */}
      <defs>
        <radialGradient id="ei-glow" cx="50%" cy="40%" r="50%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.15" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ei-paper" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.15" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      <ellipse cx="100" cy="80" rx="90" ry="50" fill="url(#ei-glow)" />

      {/* Inbox tray */}
      <motion.g
        initial={{ y: 6, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <path
          d="M 40 100 L 40 122 Q 40 130 48 130 L 152 130 Q 160 130 160 122 L 160 100 L 130 100 L 122 112 L 78 112 L 70 100 Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          fill="url(#ei-paper)"
        />
        {/* Tray ribbed top */}
        <path
          d="M 40 100 L 70 100"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M 130 100 L 160 100"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </motion.g>

      {/* Floating doc 1 (light) */}
      <motion.g
        initial={{ y: -2, opacity: 0 }}
        animate={{ y: [0, -6, 0], opacity: 1 }}
        transition={{
          y: { duration: 4, repeat: Infinity, ease: "easeInOut" },
          opacity: { duration: 0.5, delay: 0.1 },
        }}
      >
        <rect
          x="78"
          y="40"
          width="44"
          height="56"
          rx="3"
          fill="hsl(var(--background))"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <line x1="84" y1="50" x2="116" y2="50" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />
        <line x1="84" y1="58" x2="110" y2="58" stroke="currentColor" strokeWidth="1.2" opacity="0.3" />
        <line x1="84" y1="66" x2="116" y2="66" stroke="currentColor" strokeWidth="1.2" opacity="0.3" />
        <line x1="84" y1="74" x2="100" y2="74" stroke="currentColor" strokeWidth="1.2" opacity="0.3" />
        <line x1="84" y1="84" x2="116" y2="84" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.7" />
      </motion.g>

      {/* Subtle drop hint */}
      <motion.g
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.4, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      >
        <path
          d="M 100 18 L 100 30 M 95 25 L 100 30 L 105 25"
          stroke="hsl(var(--primary))"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </motion.g>
    </svg>
  )
}
