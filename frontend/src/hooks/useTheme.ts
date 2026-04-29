import { useEffect } from "react"
import { useUIStore } from "@/store/ui"

export function useTheme() {
  const theme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)

  useEffect(() => {
    const root = document.documentElement
    const apply = (t: "light" | "dark") => {
      root.classList.remove("light", "dark")
      root.classList.add(t)
    }

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)")
      apply(mq.matches ? "dark" : "light")
      const handler = (e: MediaQueryListEvent) =>
        apply(e.matches ? "dark" : "light")
      mq.addEventListener("change", handler)
      return () => mq.removeEventListener("change", handler)
    }

    apply(theme)
  }, [theme])

  return { theme, setTheme }
}
