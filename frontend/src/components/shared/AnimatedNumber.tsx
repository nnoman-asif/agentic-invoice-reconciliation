import { useEffect, useRef, useState } from "react"

interface AnimatedNumberProps {
  value: number
  duration?: number
  decimals?: number
  format?: (n: number) => string
  className?: string
}

export function AnimatedNumber({
  value,
  duration = 800,
  decimals = 0,
  format,
  className,
}: AnimatedNumberProps) {
  // Initialize from the actual value so the first paint already shows
  // the correct number. Previously we initialized from 0 and animated
  // up, which made formatted metrics flash "0ms" / "0.0s" briefly.
  const [display, setDisplay] = useState(value)
  const startRef = useRef<number | null>(null)
  const fromRef = useRef(value)
  const isFirstRun = useRef(true)

  useEffect(() => {
    if (isFirstRun.current) {
      // Skip the animation on first mount; the display already matches.
      isFirstRun.current = false
      fromRef.current = value
      return
    }
    fromRef.current = display
    startRef.current = null
    let raf: number

    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t
      const progress = Math.min((t - startRef.current) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // easeOutCubic
      const next = fromRef.current + (value - fromRef.current) * eased
      setDisplay(next)
      if (progress < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration])

  const formatted = format
    ? format(display)
    : display.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })

  return <span className={className}>{formatted}</span>
}
