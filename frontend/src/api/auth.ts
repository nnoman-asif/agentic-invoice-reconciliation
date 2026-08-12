import { apiClient } from "@/api/client"

export interface AuthMe {
  id: string
  kind: string
  email: string | null
  display_name: string | null
  daily_invoice_limit: number
  max_upload_mb: number
  max_pdf_pages: number
  last_seen_at: string | null
  created_at: string | null
  scheduled_deletion_at: string | null
}

export interface GuestAuthResponse {
  guest_token: string
  user: AuthMe
}

export async function mintGuest(): Promise<GuestAuthResponse> {
  const { data } = await apiClient.post<GuestAuthResponse>("/api/auth/guest")
  return data
}

export async function fetchMe(): Promise<AuthMe> {
  const { data } = await apiClient.get<AuthMe>("/api/auth/me")
  return data
}

export async function deleteMe(): Promise<void> {
  await apiClient.delete("/api/auth/me")
}
