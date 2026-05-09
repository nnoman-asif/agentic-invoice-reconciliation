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
  markRead: (id: string) => void
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
          // crypto.randomUUID() is collision-free; the previous
          // `${Date.now()}-${Math.random()...}` could (rarely) collide
          // when notifications burst-add in the same millisecond.
          const id =
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
          const next: AppNotification = {
            ...n,
            id,
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

      // Mark a single notification read on click. Used instead of
      // mark-all-on-dropdown-open so unread state actually means
      // "the user hasn't acknowledged this one yet".
      markRead: (id) =>
        set((state) => {
          let changed = false
          const notifications = state.notifications.map((n) => {
            if (n.id === id && !n.read) {
              changed = true
              return { ...n, read: true }
            }
            return n
          })
          if (!changed) return state
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
      // Persist notifications + unreadCount across reloads so the user
      // doesn't lose them on refresh. Bounded by MAX_NOTIFICATIONS in
      // addNotification so localStorage never grows unbounded.
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
        notifications: state.notifications,
        unreadCount: state.unreadCount,
      }),
    }
  )
)
