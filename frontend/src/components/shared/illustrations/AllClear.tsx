import { motion } from "framer-motion"

import { cn } from "@/lib/utils"

interface Props {
  className?: string
}

export function AllClear({ className }: Props) {
  return (
    <svg
      viewBox="0 0 200 160"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-emerald-500", className)}
      fill="none"
    >
      <defs>
        <radialGradient id="ac-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="100" cy="80" rx="90" ry="55" fill="url(#ac-glow)" />

      {/* Outer ring pulse */}
      <motion.circle
        cx="100"
        cy="80"
        r="44"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.3"
        initial={{ scale: 1, opacity: 0.3 }}
        animate={{ scale: 1.18, opacity: 0 }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeOut",
        }}
        style={{ transformOrigin: "100px 80px" }}
      />
      <motion.circle
        cx="100"
        cy="80"
        r="44"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.2"
        initial={{ scale: 1, opacity: 0.2 }}
        animate={{ scale: 1.3, opacity: 0 }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeOut",
          delay: 0.6,
        }}
        style={{ transformOrigin: "100px 80px" }}
      />

      {/* Main circle */}
      <motion.circle
        cx="100"
        cy="80"
        r="38"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="2"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          type: "spring",
          stiffness: 240,
          damping: 16,
          delay: 0.1,
        }}
        style={{ transformOrigin: "100px 80px" }}
      />

      {/* Check mark */}
      <motion.path
        d="M 84 80 L 96 92 L 118 70"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.6, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* Sparkles */}
      {[
        { cx: 50, cy: 40, delay: 0.8 },
        { cx: 150, cy: 50, delay: 1.0 },
        { cx: 60, cy: 120, delay: 1.2 },
        { cx: 145, cy: 115, delay: 1.4 },
      ].map((s, i) => (
        <motion.circle
          key={i}
          cx={s.cx}
          cy={s.cy}
          r="2"
          fill="currentColor"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            delay: s.delay,
            repeatDelay: 1.5,
          }}
        />
      ))}
    </svg>
  )
}
