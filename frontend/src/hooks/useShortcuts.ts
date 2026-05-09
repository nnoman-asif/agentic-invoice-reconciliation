import { useEffect, useRef } from "react"

export interface Shortcut {
  /**
   * Either a single key like "?" or "n", or a sequence like "g d", "g i".
   * Sequences are space-separated.
   */
  keys: string
  description: string
  category?: string
  handler: () => void
  /** When true, runs even if a modifier (Ctrl/Cmd) is pressed. */
  allowInInputs?: boolean
}

const SEQUENCE_TIMEOUT_MS = 1200

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  if (tag === "input" || tag === "textarea" || tag === "select") return true
  if (target.isContentEditable) return true
  return false
}

export function useShortcuts(shortcuts: Shortcut[], enabled = true) {
  const shortcutsRef = useRef(shortcuts)
  shortcutsRef.current = shortcuts

  useEffect(() => {
    if (!enabled) return

    let buffer: string[] = []
    let bufferTimer: number | null = null

    const clearBuffer = () => {
      buffer = []
      if (bufferTimer) {
        window.clearTimeout(bufferTimer)
        bufferTimer = null
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // ignore meta/ctrl combinations - those are the OS / app shortcuts
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const inEditable = isEditableTarget(e.target)
      const key = e.key

      // Single-key shortcuts. Honor `allowInInputs` so a shortcut
      // explicitly opted in to can still fire while a text field is
      // focused (e.g. Esc closing a dialog).
      const singleMatch = shortcutsRef.current.find(
        (s) => !s.keys.includes(" ") && s.keys.toLowerCase() === key.toLowerCase()
      )
      if (singleMatch && buffer.length === 0) {
        if (inEditable && !singleMatch.allowInInputs) return
        e.preventDefault()
        singleMatch.handler()
        return
      }

      // Sequence (multi-key) shortcuts -- never fire from inside an
      // editable field; nobody types "g d" intending navigation.
      if (inEditable) return

      buffer.push(key.toLowerCase())
      if (bufferTimer) window.clearTimeout(bufferTimer)
      bufferTimer = window.setTimeout(clearBuffer, SEQUENCE_TIMEOUT_MS)

      const seqString = buffer.join(" ")

      const seqMatch = shortcutsRef.current.find(
        (s) => s.keys.toLowerCase() === seqString
      )
      if (seqMatch) {
        e.preventDefault()
        seqMatch.handler()
        clearBuffer()
        return
      }

      // If the buffer doesn't match a prefix of any sequence, reset
      const hasPrefix = shortcutsRef.current.some(
        (s) =>
          s.keys.toLowerCase().startsWith(seqString) && s.keys.includes(" ")
      )
      if (!hasPrefix) clearBuffer()
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      if (bufferTimer) window.clearTimeout(bufferTimer)
    }
  }, [enabled])
}
