import { useRef, type ReactNode } from "react"
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"

import { cn } from "@/lib/utils"

interface Props {
  children: ReactNode
  className?: string
  strength?: number
}

export function MagneticButton({
  children,
  className,
  strength = 0.25,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const springConfig = { damping: 18, stiffness: 220, mass: 0.4 }
  const springX = useSpring(x, springConfig)
  const springY = useSpring(y, springConfig)
  const tx = useTransform(springX, (v) => `${v}px`)
  const ty = useTransform(springY, (v) => `${v}px`)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return
    if (window.matchMedia?.("(pointer: coarse)").matches) return // disable on touch
    const rect = ref.current.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    x.set((e.clientX - cx) * strength)
    y.set((e.clientY - cy) * strength)
  }

  const handleMouseLeave = () => {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ x: tx, y: ty }}
      className={cn("inline-block", className)}
    >
      {children}
    </motion.div>
  )
}
