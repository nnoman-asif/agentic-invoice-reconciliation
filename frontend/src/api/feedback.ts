import { useMutation } from "@tanstack/react-query"
import { apiClient } from "./client"

export type FeedbackCategory = "suggestion" | "bug" | "quota_increase" | "general"

export interface FeedbackPayload {
  category: FeedbackCategory
  subject: string
  message: string
  requested_limit?: number
}

export interface FeedbackResponse {
  status: string
  category: string
  message: string
  created_at: string
  discord_notified: boolean
}

export function useSubmitFeedback() {
  return useMutation({
    mutationFn: async (payload: FeedbackPayload) => {
      const { data } = await apiClient.post<FeedbackResponse>(
        "/api/feedback",
        payload
      )
      return data
    },
  })
}
