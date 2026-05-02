import { motion } from "framer-motion"

import { cn } from "@/lib/utils"

export type FeatureVariant =
  | "pipeline"
  | "visualizer"
  | "compare"
  | "human-loop"
  | "observability"
  | "local-llm"

interface Props {
  variant: FeatureVariant
  className?: string
}

export function FeatureMiniDiagram({ variant, className }: Props) {
  return (
    <div className={cn("h-20 w-full overflow-hidden", className)}>
      {variant === "pipeline" && <Pipeline />}
      {variant === "visualizer" && <Visualizer />}
      {variant === "compare" && <Compare />}
      {variant === "human-loop" && <HumanLoop />}
      {variant === "observability" && <Observability />}
      {variant === "local-llm" && <LocalLLM />}
    </div>
  )
}

/* Multi-agent pipeline: 4 dots with a flowing particle */
function Pipeline() {
  const stops = [20, 60, 100, 140]
  return (
    <svg viewBox="0 0 160 80" className="w-full h-full">
      <line
        x1={stops[0]}
        y1="40"
        x2={stops[stops.length - 1]}
        y2="40"
        stroke="hsl(var(--border))"
        strokeWidth="1.5"
        strokeDasharray="2 4"
      />
      {stops.map((x, i) => (
        <g key={x}>
          <motion.circle
            cx={x}
            cy="40"
            r="6"
            fill="hsl(var(--background))"
            stroke="hsl(var(--primary))"
            strokeWidth="1.5"
          />
          <motion.circle
            cx={x}
            cy="40"
            r="2.5"
            fill="hsl(var(--primary))"
            initial={{ opacity: 0.4 }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{
              duration: 1.6,
              repeat: Infinity,
              delay: i * 0.4,
            }}
          />
        </g>
      ))}
      {/* Flowing particle */}
      <motion.circle
        r="3.5"
        cy="40"
        fill="hsl(var(--primary))"
        initial={{ cx: stops[0], opacity: 0 }}
        animate={{
          cx: [stops[0], stops[3]],
          opacity: [0, 1, 1, 0],
        }}
        transition={{
          duration: 2.4,
          repeat: Infinity,
          repeatDelay: 0.5,
          times: [0, 0.1, 0.9, 1],
        }}
      />
    </svg>
  )
}

/* Live visualizer: animated bar chart */
function Visualizer() {
  const heights = [16, 32, 22, 40, 28, 36]
  return (
    <svg viewBox="0 0 160 80" className="w-full h-full">
      {heights.map((h, i) => (
        <motion.rect
          key={i}
          x={20 + i * 20}
          width="10"
          rx="2"
          fill="hsl(var(--primary))"
          opacity="0.7"
          initial={{ height: 0, y: 60 }}
          animate={{ height: [0, h, h * 0.7, h], y: [60, 60 - h, 60 - h * 0.7, 60 - h] }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
      <line x1="15" y1="61" x2="145" y2="61" stroke="hsl(var(--border))" strokeWidth="1" />
    </svg>
  )
}

/* Side-by-side compare: 2 pages connected by animated lines */
function Compare() {
  return (
    <svg viewBox="0 0 160 80" className="w-full h-full">
      {/* Left card */}
      <rect x="14" y="14" width="44" height="52" rx="3" fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="1.4" />
      {[22, 30, 38, 46, 54].map((y) => (
        <line key={y} x1="20" y1={y} x2="52" y2={y} stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.35" />
      ))}
      {/* Right card */}
      <rect x="102" y="14" width="44" height="52" rx="3" fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="1.4" />
      {[22, 30, 38, 46, 54].map((y) => (
        <line key={y} x1="108" y1={y} x2="140" y2={y} stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.35" />
      ))}
      {/* Animated bezier match lines */}
      {[26, 38, 50].map((y, i) => (
        <motion.path
          key={y}
          d={`M 58 ${y} C 75 ${y}, 85 ${y}, 102 ${y}`}
          stroke="hsl(var(--primary))"
          strokeWidth="1.2"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{
            duration: 0.8,
            delay: i * 0.3,
            repeat: Infinity,
            repeatType: "reverse",
            repeatDelay: 0.3,
          }}
        />
      ))}
    </svg>
  )
}

/* Human-in-the-loop: agent → ? → human */
function HumanLoop() {
  return (
    <svg viewBox="0 0 160 80" className="w-full h-full">
      {/* Agent (left circle) */}
      <circle cx="32" cy="40" r="14" fill="hsl(var(--primary)/0.1)" stroke="hsl(var(--primary))" strokeWidth="1.5" />
      <circle cx="32" cy="36" r="3.5" fill="hsl(var(--primary))" />
      <path d="M 24 46 Q 32 52 40 46" stroke="hsl(var(--primary))" strokeWidth="1.5" fill="none" />
      {/* Question mark badge */}
      <motion.g
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: "80px 32px" }}
      >
        <circle cx="80" cy="32" r="10" fill="hsl(var(--warning)/0.15)" stroke="hsl(var(--warning))" strokeWidth="1.5" />
        <text x="80" y="36" textAnchor="middle" className="fill-warning font-bold text-[12px]">?</text>
      </motion.g>
      {/* Human (right) */}
      <circle cx="128" cy="40" r="14" fill="hsl(var(--success)/0.1)" stroke="hsl(var(--success))" strokeWidth="1.5" />
      <circle cx="128" cy="36" r="3.5" fill="hsl(var(--success))" />
      <path d="M 120 46 Q 128 50 136 46" stroke="hsl(var(--success))" strokeWidth="1.5" fill="none" />
      {/* Arrows */}
      <line x1="50" y1="40" x2="68" y2="36" stroke="hsl(var(--border))" strokeWidth="1.4" markerEnd="url(#hl-arrow)" />
      <line x1="92" y1="36" x2="110" y2="40" stroke="hsl(var(--border))" strokeWidth="1.4" markerEnd="url(#hl-arrow)" />
      <defs>
        <marker id="hl-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 z" fill="hsl(var(--border))" />
        </marker>
      </defs>
    </svg>
  )
}

/* Observability: trace spans */
function Observability() {
  const spans = [
    { y: 18, x: 16, w: 38 },
    { y: 32, x: 18, w: 60 },
    { y: 46, x: 40, w: 42 },
    { y: 60, x: 78, w: 50 },
  ]
  return (
    <svg viewBox="0 0 160 80" className="w-full h-full">
      {spans.map((s, i) => (
        <motion.rect
          key={i}
          x={s.x}
          y={s.y}
          height="6"
          rx="3"
          fill="hsl(var(--primary))"
          opacity="0.6"
          initial={{ width: 0 }}
          animate={{ width: s.w }}
          transition={{
            duration: 1,
            delay: i * 0.2,
            repeat: Infinity,
            repeatType: "reverse",
            repeatDelay: 0.3,
          }}
        />
      ))}
      {/* Time axis */}
      <line x1="14" y1="72" x2="146" y2="72" stroke="hsl(var(--border))" strokeWidth="1" />
      {[14, 50, 86, 122].map((x) => (
        <line key={x} x1={x} y1="72" x2={x} y2="76" stroke="hsl(var(--border))" strokeWidth="1" />
      ))}
    </svg>
  )
}

/* Local LLM: chip with neural net pulse */
function LocalLLM() {
  return (
    <svg viewBox="0 0 160 80" className="w-full h-full">
      {/* Chip body */}
      <rect x="60" y="20" width="40" height="40" rx="4" fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="1.5" />
      {/* Pins */}
      {[0, 1, 2, 3].map((i) => (
        <line key={`t${i}`} x1={68 + i * 8} y1="20" x2={68 + i * 8} y2="14" stroke="hsl(var(--primary))" strokeWidth="1.5" />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <line key={`b${i}`} x1={68 + i * 8} y1="60" x2={68 + i * 8} y2="66" stroke="hsl(var(--primary))" strokeWidth="1.5" />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <line key={`l${i}`} x1="60" y1={28 + i * 8} x2="54" y2={28 + i * 8} stroke="hsl(var(--primary))" strokeWidth="1.5" />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <line key={`r${i}`} x1="100" y1={28 + i * 8} x2="106" y2={28 + i * 8} stroke="hsl(var(--primary))" strokeWidth="1.5" />
      ))}
      {/* Inner pulse circle */}
      <motion.circle
        cx="80"
        cy="40"
        r="6"
        fill="hsl(var(--primary))"
        initial={{ opacity: 0.5 }}
        animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.4, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: "80px 40px" }}
      />
      <text x="80" y="44" textAnchor="middle" className="fill-background text-[6px] font-bold pointer-events-none">
        LLM
      </text>
    </svg>
  )
}
