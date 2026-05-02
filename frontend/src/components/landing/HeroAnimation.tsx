import { motion } from "framer-motion"
import {
  Search,
  Layers,
  AlertTriangle,
  Brain,
  CheckCircle2,
  FileText,
} from "lucide-react"

import { cn } from "@/lib/utils"

const STAGES = [
  { id: "parser", label: "Parser", icon: Search },
  { id: "matcher", label: "Matcher", icon: Layers },
  { id: "anomaly", label: "Anomaly", icon: AlertTriangle },
  { id: "resolution", label: "Resolution", icon: Brain },
] as const

const VIEW_W = 880
const VIEW_H = 360
const STAGE_X = [140, 340, 540, 740] // x-positions of agent stations
const STAGE_Y = 180
const TRAVEL_DURATION = 8 // seconds for one full pass

// Helper: each invoice card starts with this delay
const INVOICES = [
  { id: "INV-001", delay: 0, status: "approved" as const },
  { id: "INV-002", delay: 2.6, status: "review" as const },
  { id: "INV-003", delay: 5.2, status: "approved" as const },
]

export function HeroAnimation() {
  return (
    <div className="relative mx-auto max-w-5xl rounded-2xl border border-border/60 bg-card/50 backdrop-blur-2xl shadow-elevated overflow-hidden">
      <div className="relative aspect-[22/9]">
        {/* Background gradient orbs */}
        <div className="absolute top-0 left-1/4 size-96 bg-blue-500/25 rounded-full blur-3xl animate-float" />
        <div
          className="absolute bottom-0 right-1/4 size-96 bg-purple-500/25 rounded-full blur-3xl animate-float"
          style={{ animationDelay: "1.5s" }}
        />

        {/* Subtle grid */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.06]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern
              id="hero-grid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hero-grid)" />
        </svg>

        {/* Pipeline scene */}
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          xmlns="http://www.w3.org/2000/svg"
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Path connecting stations */}
          <line
            x1={STAGE_X[0]}
            y1={STAGE_Y}
            x2={STAGE_X[STAGE_X.length - 1]}
            y2={STAGE_Y}
            stroke="hsl(var(--border))"
            strokeWidth="2"
            strokeDasharray="4 6"
          />

          {/* Agent stations */}
          {STAGES.map((stage, i) => (
            <g key={stage.id} transform={`translate(${STAGE_X[i]}, ${STAGE_Y})`}>
              {/* Pulse ring */}
              <motion.circle
                r="36"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="1.5"
                opacity="0.5"
                initial={{ scale: 1, opacity: 0.5 }}
                animate={{ scale: 1.4, opacity: 0 }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.4,
                  ease: "easeOut",
                }}
                style={{ transformOrigin: "center" }}
              />
              {/* Station circle */}
              <circle
                r="32"
                fill="hsl(var(--background))"
                stroke="hsl(var(--primary))"
                strokeWidth="2"
              />
              <circle
                r="6"
                fill="hsl(var(--primary))"
                opacity="0.9"
              />

              {/* Station label */}
              <text
                y="58"
                textAnchor="middle"
                className="fill-foreground text-[14px] font-semibold"
              >
                {stage.label}
              </text>
            </g>
          ))}

          {/* Floating invoice cards traveling along the path */}
          {INVOICES.map((inv, i) => (
            <FloatingInvoice
              key={inv.id}
              label={inv.id}
              status={inv.status}
              delay={inv.delay}
              orderIndex={i}
            />
          ))}
        </svg>

        {/* Foreground icon overlay (HTML, positioned on top of SVG stations) */}
        <div className="absolute inset-0 pointer-events-none">
          {STAGES.map((stage, i) => {
            const Icon = stage.icon
            const leftPct = (STAGE_X[i] / VIEW_W) * 100
            const topPct = (STAGE_Y / VIEW_H) * 100
            return (
              <div
                key={stage.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${leftPct}%`, top: `${topPct}%` }}
              >
                <Icon className="size-5 text-primary" />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function FloatingInvoice({
  label,
  status,
  delay,
  orderIndex,
}: {
  label: string
  status: "approved" | "review"
  delay: number
  orderIndex: number
}) {
  const w = 70
  const h = 56

  // Build a path: fly in from left, ride the line, fly off at the end
  // x positions over time:
  const xs = [
    -w, // start off-screen left
    STAGE_X[0],
    STAGE_X[1],
    STAGE_X[2],
    STAGE_X[3],
    VIEW_W + w, // exit right
  ]
  // y positions: subtle bob above the line, then dip / rise at end based on status
  const ridingY = STAGE_Y - 50 // hover above the line
  const exitY = status === "approved" ? STAGE_Y - 130 : STAGE_Y + 100
  const ys = [ridingY, ridingY, ridingY, ridingY, ridingY, exitY]

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{
        opacity: [0, 1, 1, 1, 1, 0],
        x: xs,
        y: ys,
      }}
      transition={{
        duration: TRAVEL_DURATION,
        repeat: Infinity,
        repeatDelay: INVOICES.length * 2.6 - TRAVEL_DURATION + 1,
        delay,
        ease: "easeInOut",
        times: [0, 0.12, 0.36, 0.6, 0.84, 1],
      }}
    >
      {/* Card */}
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx="6"
        fill="hsl(var(--background))"
        stroke="hsl(var(--primary))"
        strokeWidth="1.5"
        opacity="0.95"
      />
      {/* Doc icon */}
      <g transform={`translate(${-w / 2 + 8}, ${-h / 2 + 8})`}>
        <FileTextIconSvg />
      </g>
      {/* Card lines */}
      <line
        x1={-w / 2 + 26}
        y1={-h / 2 + 14}
        x2={w / 2 - 8}
        y2={-h / 2 + 14}
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.4"
      />
      <line
        x1={-w / 2 + 8}
        y1={2}
        x2={w / 2 - 8}
        y2={2}
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.3"
      />
      <line
        x1={-w / 2 + 8}
        y1={9}
        x2={w / 2 - 18}
        y2={9}
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.3"
      />
      {/* Footer label */}
      <text
        x={0}
        y={h / 2 - 4}
        textAnchor="middle"
        className={cn(
          "text-[10px] font-mono font-semibold",
          status === "approved" ? "fill-emerald-500" : "fill-amber-500"
        )}
      >
        {label}
      </text>
    </motion.g>
  )
}

function FileTextIconSvg() {
  return (
    <g transform="scale(0.7)">
      <path
        d="M 4 0 L 12 0 L 16 4 L 16 18 Q 16 20 14 20 L 4 20 Q 2 20 2 18 L 2 2 Q 2 0 4 0 Z"
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M 12 0 L 12 4 L 16 4"
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </g>
  )
}

// Avoid unused-import noise from lucide
void FileText
void CheckCircle2
