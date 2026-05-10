/**
 * Platform-aware helpers for keyboard-shortcut hints.
 *
 * The handlers in `useShortcuts` and CommandPalette already accept
 * both `metaKey` (⌘ on macOS) and `ctrlKey` (Win/Linux), so this is
 * purely about *displaying* the right glyph to the user.
 */

let cached: boolean | null = null

/**
 * Best-effort macOS detection. Uses the modern `userAgentData` API
 * when present (Chromium) and falls back to the deprecated
 * `navigator.platform` string everywhere else. Result is memoised
 * because the platform doesn't change at runtime.
 */
export function isMacPlatform(): boolean {
  if (cached !== null) return cached
  if (typeof navigator === "undefined") {
    cached = false
    return cached
  }
  // Chromium (Chrome/Edge/Opera): "macOS", "Windows", "Linux", …
  const uaData = (
    navigator as Navigator & {
      userAgentData?: { platform?: string }
    }
  ).userAgentData
  if (uaData?.platform) {
    cached = uaData.platform.toLowerCase().includes("mac")
    return cached
  }
  // Fallback: "MacIntel", "iPhone", "Win32", "Linux x86_64", …
  const platform = navigator.platform || ""
  const ua = navigator.userAgent || ""
  cached =
    /mac|iphone|ipad|ipod/i.test(platform) || /Mac OS X/i.test(ua)
  return cached
}

/** Display label for the modifier (⌘ on macOS, "Ctrl" elsewhere). */
export function modKeyLabel(): string {
  return isMacPlatform() ? "⌘" : "Ctrl"
}
