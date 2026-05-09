import { cn } from "@/lib/utils"

/**
 * Highlights matched characters in `text` against `query`.
 * Subsequence-matched, case-insensitive (matches the way cmdk filters).
 */
export function HighlightedText({
  text,
  query,
  className,
  highlightClass,
}: {
  text: string
  query: string
  className?: string
  highlightClass?: string
}) {
  if (!query.trim()) {
    return <span className={className}>{text}</span>
  }

  // Iterate by code points, not UTF-16 code units. `text.split("")`
  // would split surrogate pairs (e.g. emoji) in half and render the
  // halves as two replacement characters.
  const chars = Array.from(text)
  const lowerChars = chars.map((c) => c.toLowerCase())
  const lowerQuery = query.toLowerCase().replace(/\s+/g, "")
  const indices: number[] = []

  let qi = 0
  for (let i = 0; i < lowerChars.length && qi < lowerQuery.length; i++) {
    if (lowerChars[i] === lowerQuery[qi]) {
      indices.push(i)
      qi++
    }
  }
  if (indices.length !== lowerQuery.length) {
    return <span className={className}>{text}</span>
  }

  const indexSet = new Set(indices)
  return (
    <span className={className}>
      {chars.map((ch, i) =>
        indexSet.has(i) ? (
          <span
            key={i}
            className={cn(
              "text-primary font-semibold",
              highlightClass
            )}
          >
            {ch}
          </span>
        ) : (
          <span key={i}>{ch}</span>
        )
      )}
    </span>
  )
}
