import confetti from "canvas-confetti"

/**
 * Fire a celebratory confetti burst at the given normalized origin.
 *
 * Returns a cleanup function that cancels the queued second burst.
 * Callers in React effects should hold on to it and invoke it in
 * the cleanup, otherwise the second burst can fire after the
 * component has unmounted.
 */
export function celebrateApproval(originX = 0.5, originY = 0.5): () => void {
  const defaults = {
    spread: 60,
    ticks: 80,
    gravity: 0.9,
    decay: 0.94,
    startVelocity: 25,
    colors: ["#10b981", "#3b82f6", "#6366f1", "#8b5cf6", "#22d3ee"],
  }

  confetti({
    ...defaults,
    particleCount: 30,
    origin: { x: originX, y: originY },
    scalar: 0.9,
  })
  const handle = window.setTimeout(() => {
    confetti({
      ...defaults,
      particleCount: 25,
      origin: { x: originX, y: originY },
      scalar: 1.2,
    })
  }, 120)
  return () => window.clearTimeout(handle)
}

export function celebrateFromElement(el: HTMLElement | null): () => void {
  if (!el) return () => {}
  const rect = el.getBoundingClientRect()
  const x = (rect.left + rect.width / 2) / window.innerWidth
  const y = (rect.top + rect.height / 2) / window.innerHeight
  return celebrateApproval(x, y)
}
