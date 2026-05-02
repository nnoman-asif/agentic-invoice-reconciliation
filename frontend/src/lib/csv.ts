/**
 * Generic CSV serializer + browser download trigger.
 *
 * Usage:
 *   const columns: CsvColumn<Invoice>[] = [
 *     { header: "ID", accessor: (i) => i.id },
 *     { header: "Number", accessor: (i) => i.invoice_number ?? "" },
 *   ]
 *   downloadCsv("invoices.csv", invoices, columns)
 */

export interface CsvColumn<T> {
  header: string
  accessor: (row: T) => string | number | null | undefined
}

function escapeField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ""
  const str = String(value)
  // RFC 4180: quote if contains comma, quote, CR or LF
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const headerLine = columns.map((c) => escapeField(c.header)).join(",")
  const dataLines = rows.map((row) =>
    columns.map((c) => escapeField(c.accessor(row))).join(",")
  )
  return [headerLine, ...dataLines].join("\r\n")
}

export function downloadCsv<T>(
  filename: string,
  rows: T[],
  columns: CsvColumn<T>[]
): void {
  const csv = toCsv(rows, columns)
  // BOM for Excel compatibility
  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  })
  const url = URL.createObjectURL(blob)

  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.style.display = "none"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function timestampedFilename(prefix: string): string {
  // Local-time stamp so the filename matches the user's wall clock,
  // not UTC. Format: prefix-YYYY-MM-DD-HH-MM-SS.csv
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  const stamp =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
  return `${prefix}-${stamp}.csv`
}
