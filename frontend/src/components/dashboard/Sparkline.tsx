import { useId } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface Props {
  data: number[]
  color?: string
  width?: number
  height?: number
  strokeWidth?: number
  className?: string
}

export function Sparkline({
  data,
  color = "currentColor",
  width = 120,
  height = 32,
  strokeWidth = 1.5,
  className,
}: Props) {
  // Drop NaN / Infinity so a single bad point doesn't poison min/max
  // and produce an invalid SVG path.
  const cleaned = data.filter((v) => Number.isFinite(v))
  if (cleaned.length < 2) {
    return null
  }

  const min = Math.min(...cleaned)
  const max = Math.max(...cleaned)
  const range = max - min || 1
  const padX = strokeWidth
  const padY = strokeWidth + 1

  const points = cleaned.map((value, i) => {
    const x = padX + (i / (cleaned.length - 1)) * (width - padX * 2)
    const y =
      height - padY - ((value - min) / range) * (height - padY * 2)
    return [x, y] as const
  })

  // Smooth path using monotone-like interpolation (simple cardinal smoothing)
  const path = points
    .map((p, i, arr) => {
      if (i === 0) return `M ${p[0]} ${p[1]}`
      const prev = arr[i - 1]
      const cx = (prev[0] + p[0]) / 2
      return `Q ${cx} ${prev[1]} ${cx} ${(prev[1] + p[1]) / 2} T ${p[0]} ${p[1]}`
    })
    .join(" ")

  const fillPath = `${path} L ${points[points.length - 1][0]} ${height} L ${points[0][0]} ${height} Z`
  // Stable per-instance id (was `Math.random()` which produced a
  // different value every render and could collide across instances).
  const reactId = useId()
  const id = `spark-${reactId.replace(/:/g, "")}`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", className)}
      style={{ color }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        d={path}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <motion.path
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.4 }}
        d={fillPath}
        fill={`url(#${id})`}
      />
    </svg>
  )
}
