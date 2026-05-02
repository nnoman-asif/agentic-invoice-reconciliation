import { motion } from "framer-motion"

import { cn } from "@/lib/utils"

interface Props {
  className?: string
}

export function NoMatches({ className }: Props) {
  return (
    <svg
      viewBox="0 0 200 160"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-muted-foreground", className)}
      fill="none"
    >
      <defs>
        <radialGradient id="nm-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.12" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="100" cy="80" rx="90" ry="55" fill="url(#nm-glow)" />

      {/* Left card */}
      <motion.g
        initial={{ x: -8, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <rect
          x="32"
          y="44"
          width="56"
          height="72"
          rx="6"
          fill="hsl(var(--background))"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <line x1="40" y1="58" x2="80" y2="58" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        <line x1="40" y1="68" x2="74" y2="68" stroke="currentColor" strokeWidth="1.2" opacity="0.3" />
        <line x1="40" y1="76" x2="80" y2="76" stroke="currentColor" strokeWidth="1.2" opacity="0.3" />
        <line x1="40" y1="84" x2="68" y2="84" stroke="currentColor" strokeWidth="1.2" opacity="0.3" />
        <rect x="40" y="98" width="22" height="8" rx="2" fill="currentColor" opacity="0.2" />
      </motion.g>

      {/* Right card */}
      <motion.g
        initial={{ x: 8, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <rect
          x="112"
          y="44"
          width="56"
          height="72"
          rx="6"
          fill="hsl(var(--background))"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <line x1="120" y1="58" x2="160" y2="58" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        <line x1="120" y1="68" x2="154" y2="68" stroke="currentColor" strokeWidth="1.2" opacity="0.3" />
        <line x1="120" y1="76" x2="160" y2="76" stroke="currentColor" strokeWidth="1.2" opacity="0.3" />
        <line x1="120" y1="84" x2="148" y2="84" stroke="currentColor" strokeWidth="1.2" opacity="0.3" />
        <rect x="120" y="98" width="22" height="8" rx="2" fill="currentColor" opacity="0.2" />
      </motion.g>

      {/* Broken connection line in middle */}
      <motion.g
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <path
          d="M 88 80 L 96 80"
          stroke="hsl(var(--destructive))"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M 104 80 L 112 80"
          stroke="hsl(var(--destructive))"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        {/* X mark */}
        <circle cx="100" cy="80" r="8" fill="hsl(var(--background))" stroke="hsl(var(--destructive))" strokeWidth="1.5" />
        <path
          d="M 96 76 L 104 84 M 104 76 L 96 84"
          stroke="hsl(var(--destructive))"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </motion.g>
    </svg>
  )
}
