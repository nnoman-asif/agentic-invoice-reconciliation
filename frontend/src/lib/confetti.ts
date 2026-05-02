import confetti from "canvas-confetti"

export function celebrateApproval(originX = 0.5, originY = 0.5) {
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
  setTimeout(() => {
    confetti({
      ...defaults,
      particleCount: 25,
      origin: { x: originX, y: originY },
      scalar: 1.2,
    })
  }, 120)
}

export function celebrateFromElement(el: HTMLElement | null) {
  if (!el) return
  const rect = el.getBoundingClientRect()
  const x = (rect.left + rect.width / 2) / window.innerWidth
  const y = (rect.top + rect.height / 2) / window.innerHeight
  celebrateApproval(x, y)
}
