/**
 * Build-time configuration constants. Values are sourced from Vite
 * environment variables (`VITE_*` in `.env` / `.env.local`) with safe
 * defaults so the app still builds and runs in a fresh checkout.
 */

const DEFAULT_GITHUB_URL =
  "https://github.com/nnoman-asif/agentic-invoice-reconciliation"

export const GITHUB_URL: string =
  import.meta.env.VITE_GITHUB_URL?.trim() || DEFAULT_GITHUB_URL
