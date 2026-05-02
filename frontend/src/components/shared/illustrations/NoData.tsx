import { motion } from "framer-motion"

import { cn } from "@/lib/utils"

interface Props {
  className?: string
}

export function NoData({ className }: Props) {
  return (
    <svg
      viewBox="0 0 200 160"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-muted-foreground", className)}
      fill="none"
    >
      <defs>
        <radialGradient id="nd-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="100" cy="80" rx="90" ry="55" fill="url(#nd-glow)" />

      {/* Empty chart frame */}
      <motion.g
        initial={{ y: 6, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        {/* Chart base */}
        <line x1="50" y1="120" x2="160" y2="120" stroke="currentColor" strokeWidth="1.5" />
        <line x1="50" y1="120" x2="50" y2="40" stroke="currentColor" strokeWidth="1.5" />

        {/* Dashed gridlines */}
        {[0, 1, 2].map((i) => (
          <line
            key={i}
            x1="50"
            y1={100 - i * 20}
            x2="160"
            y2={100 - i * 20}
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="2 4"
            opacity="0.25"
          />
        ))}

        {/* Animated scanline shimmer */}
        <motion.line
          x1="50"
          y1="80"
          x2="160"
          y2="80"
          stroke="hsl(var(--primary))"
          strokeWidth="1.5"
          opacity="0.5"
          initial={{ y1: 120, y2: 120, opacity: 0 }}
          animate={{ y1: [120, 60, 120], y2: [120, 60, 120], opacity: [0, 0.5, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.g>

      {/* Floating sparkle dots indicating "data coming" */}
      {[
        { cx: 80, cy: 90, delay: 0 },
        { cx: 110, cy: 70, delay: 0.4 },
        { cx: 140, cy: 60, delay: 0.8 },
      ].map((p, i) => (
        <motion.circle
          key={i}
          cx={p.cx}
          cy={p.cy}
          r="3"
          fill="hsl(var(--primary))"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1, 0], opacity: [0, 0.8, 0] }}
          transition={{
            duration: 2.4,
            repeat: Infinity,
            delay: p.delay,
            repeatDelay: 0.6,
          }}
        />
      ))}
    </svg>
  )
}
