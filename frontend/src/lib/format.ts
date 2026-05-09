import { format, formatDistanceToNow, parseISO } from "date-fns"

// Matches YYYY-MM-DD (no time component). API date-only fields like
// invoice_date / issue_date come in this shape and must be parsed in
// the local timezone, otherwise users west of UTC see the previous day.
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

function parseInput(input: string | Date): Date {
  if (input instanceof Date) return input
  if (DATE_ONLY_RE.test(input)) {
    const [y, m, d] = input.split("-").map(Number)
    return new Date(y, m - 1, d)
  }
  return parseISO(input)
}

export function formatCurrency(amount: number | null | undefined, currency = "USD"): string {
  if (amount === null || amount === undefined) return "—"
  // `Intl.NumberFormat` throws on invalid currency codes (e.g., a typo
  // in seed data, or a vendor returning something we don't recognize).
  // Fall back to the raw number rather than crashing the caller.
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined) return "—"
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined) return "—"
  return `${value.toFixed(decimals)}%`
}

export function formatDate(input: string | Date | null | undefined, fmt = "MMM d, yyyy"): string {
  if (!input) return "—"
  return format(parseInput(input), fmt)
}

export function formatDateTime(input: string | Date | null | undefined): string {
  return formatDate(input, "MMM d, yyyy h:mm a")
}

export function formatRelative(input: string | Date | null | undefined): string {
  if (!input) return "—"
  return formatDistanceToNow(parseInput(input), { addSuffix: true })
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—"
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60_000).toFixed(1)}m`
}

export function truncate(text: string | null | undefined, max = 60): string {
  if (!text) return ""
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

export function shortId(id: string | null | undefined, length = 8): string {
  if (!id) return "—"
  return id.slice(0, length)
}
