import axios, { AxiosError } from "axios"
import { QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { AUTH_ENABLED } from "@/lib/firebase"

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000"

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
})

type AuthTokens = { idToken: string | null; guestToken: string | null }

let readAuthTokens: () => AuthTokens = () => ({
  idToken: null,
  guestToken: null,
})
let onUnauthorized: (() => void) | null = null

/** Wired from the auth store to avoid an import cycle with api/client. */
export function bindAuthInterceptors(options: {
  readTokens: () => AuthTokens
  onUnauthorized?: () => void
}) {
  readAuthTokens = options.readTokens
  onUnauthorized = options.onUnauthorized ?? null
}

apiClient.interceptors.request.use((config) => {
  if (!AUTH_ENABLED) return config

  const { idToken, guestToken } = readAuthTokens()
  if (idToken) {
    config.headers.Authorization = `Bearer ${idToken}`
  } else if (guestToken) {
    config.headers["X-Guest-Token"] = guestToken
  }
  return config
})

function detailMessage(
  error: AxiosError<{ detail?: string | { message?: string } }>
): string | undefined {
  const detail = error.response?.data?.detail
  if (typeof detail === "string") return detail
  if (detail && typeof detail === "object" && "message" in detail) {
    return detail.message
  }
  return undefined
}

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: string | { message?: string } }>) => {
    const status = error.response?.status
    const detail = detailMessage(error)
    if (detail) {
      error.message = detail
    }

    if (status === 401) {
      toast.error(detail || "Session expired — please sign in again")
      if (AUTH_ENABLED) {
        onUnauthorized?.()
      }
    } else if (status === 403) {
      toast.error(detail || "You do not have permission for that action")
    } else if (status === 429) {
      const retry = error.response?.headers?.["retry-after"]
      toast.error(
        detail ||
          (retry
            ? `Too many requests — retry after ${retry}s`
            : "Too many requests — please slow down")
      )
    } else if (status === 503) {
      toast.error(
        detail || "Service temporarily unavailable — try again shortly"
      )
    }

    return Promise.reject(error)
  }
)

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30 * 1000,
    },
    mutations: {
      retry: 0,
    },
  },
})
