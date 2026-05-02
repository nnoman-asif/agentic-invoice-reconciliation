import { create } from "zustand"
import { persist } from "zustand/middleware"

export type Theme = "light" | "dark" | "system"

export type NotificationType =
  | "uploaded"
  | "approved"
  | "needs_review"
  | "rejected"
  | "failed"

export interface AppNotification {
  id: string
  invoiceId: string
  invoiceNumber: string | null
  type: NotificationType
  message: string
  timestamp: number
  read: boolean
}

interface UIState {
  theme: Theme
  sidebarCollapsed: boolean
  commandPaletteOpen: boolean

  // Notifications
  notifications: AppNotification[]
  unreadCount: number

  // Actions
  setTheme: (theme: Theme) => void
  toggleSidebar: () => void
  setCommandPaletteOpen: (open: boolean) => void
  addNotification: (
    notification: Omit<AppNotification, "id" | "timestamp" | "read">
  ) => void
  markAllRead: () => void
  clearNotifications: () => void
}

const MAX_NOTIFICATIONS = 30

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: "light",
      sidebarCollapsed: false,
      commandPaletteOpen: false,
      notifications: [],
      unreadCount: 0,

      setTheme: (theme) => set({ theme }),
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setCommandPaletteOpen: (commandPaletteOpen) =>
        set({ commandPaletteOpen }),

      addNotification: (n) =>
        set((state) => {
          const next: AppNotification = {
            ...n,
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp: Date.now(),
            read: false,
          }
          const notifications = [next, ...state.notifications].slice(
            0,
            MAX_NOTIFICATIONS
          )
          return {
            notifications,
            unreadCount: notifications.filter((x) => !x.read).length,
          }
        }),

      markAllRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        })),

      clearNotifications: () =>
        set({ notifications: [], unreadCount: 0 }),
    }),
    {
      name: "ira-ui-store",
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
)
