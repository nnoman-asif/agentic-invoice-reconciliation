import { create } from "zustand"
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile,
  type User,
} from "firebase/auth"
import { toast } from "sonner"

import { deleteMe, fetchMe, mintGuest, type AuthMe } from "@/api/auth"
import { bindAuthInterceptors, queryClient } from "@/api/client"
import { useUIStore } from "@/store/ui"
import {
  AUTH_ENABLED,
  getFirebaseAuth,
  githubProvider,
  googleProvider,
} from "@/lib/firebase"

const GUEST_TOKEN_KEY = "ira_guest_token"

interface AuthState {
  ready: boolean
  firebaseUser: User | null
  idToken: string | null
  guestToken: string | null
  me: AuthMe | null

  init: () => () => void
  setIdToken: (token: string | null) => void
  setGuestToken: (token: string | null) => void
  refreshMe: () => Promise<void>
  ensureGuest: () => Promise<string>
  signInWithGoogle: () => Promise<void>
  signInWithGitHub: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  registerWithEmail: (name: string, email: string, password: string) => Promise<void>
  resetPassword: (email: string) => Promise<void>
  signOut: () => Promise<void>
  deleteAccount: () => Promise<void>
  isGuest: () => boolean
  isSignedIn: () => boolean
  canWrite: () => boolean
}

async function syncIdToken(user: User | null): Promise<string | null> {
  if (!user) return null
  return user.getIdToken()
}

/**
 * Custom wrapper around signInWithPopup that races Firebase's SDK against a
 * 100ms popupWindow.closed watcher.
 *
 * Firebase's built-in SDK has a 15-20 second polling timeout before detecting
 * that a user closed an OAuth popup window. By intercepting window.open to grab
 * the popup handle directly, we detect window closure within 100ms while keeping
 * the loading state active as long as the popup window remains open.
 */
async function signInWithPopupFast(
  auth: ReturnType<typeof getFirebaseAuth>,
  provider: import("firebase/auth").AuthProvider
) {
  let popupWindow: Window | null = null
  const originalOpen = window.open

  try {
    // Intercept window.open temporarily to capture the popup window handle
    window.open = function (...args: any[]) {
      // @ts-expect-error - pass through args to native window.open
      popupWindow = originalOpen.apply(window, args)
      return popupWindow
    }

    let pollInterval: ReturnType<typeof setInterval> | null = null

    const popupClosedPromise = new Promise<never>((_, reject) => {
      pollInterval = setInterval(() => {
        try {
          if (popupWindow && popupWindow.closed) {
            reject({
              code: "auth/popup-closed-by-user",
              message: "The popup was closed by the user.",
            })
          }
        } catch {
          // Cross-origin checks don't block .closed property, but guard just in case
        }
      }, 100)
    })

    try {
      return await Promise.race([
        signInWithPopup(auth, provider),
        popupClosedPromise,
      ])
    } finally {
      if (pollInterval) clearInterval(pollInterval)
    }
  } finally {
    window.open = originalOpen
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  ready: !AUTH_ENABLED,
  firebaseUser: null,
  idToken: null,
  guestToken:
    typeof localStorage !== "undefined"
      ? localStorage.getItem(GUEST_TOKEN_KEY)
      : null,
  me: null,

  init: () => {
    if (!AUTH_ENABLED) {
      set({ ready: true })
      return () => undefined
    }

    const auth = getFirebaseAuth()
    const unsub = onAuthStateChanged(auth, async (user) => {
      const idToken = await syncIdToken(user)
      if (user && idToken) {
        // Signed-in users supersede guest identity.
        const prevGuest = get().guestToken
        const prevUser = get().firebaseUser
        localStorage.removeItem(GUEST_TOKEN_KEY)

        // If newly signing in or switching accounts, clear stale demo/prior notifications & query cache
        if (prevGuest || !prevUser || prevUser.uid !== user.uid) {
          useUIStore.getState().clearNotifications()
          queryClient.clear()
        }

        set({
          firebaseUser: user,
          idToken,
          guestToken: null,
          ready: true,
        })
        try {
          const me = await fetchMe()
          set({ me })
        } catch {
          set({ me: null })
        }
        return
      }

      // Transitioned to unauthenticated state
      if (get().firebaseUser) {
        useUIStore.getState().clearNotifications()
        queryClient.clear()
      }

      const guestToken = localStorage.getItem(GUEST_TOKEN_KEY)
      set({
        firebaseUser: null,
        idToken: null,
        guestToken,
        ready: true,
      })
      if (guestToken) {
        try {
          const me = await fetchMe()
          set({ me })
        } catch {
          localStorage.removeItem(GUEST_TOKEN_KEY)
          set({ guestToken: null, me: null })
        }
      } else {
        set({ me: null })
      }
    })

    return unsub
  },

  setIdToken: (token) => set({ idToken: token }),

  setGuestToken: (token) => {
    if (token) localStorage.setItem(GUEST_TOKEN_KEY, token)
    else localStorage.removeItem(GUEST_TOKEN_KEY)
    set({ guestToken: token })
  },

  refreshMe: async () => {
    if (!AUTH_ENABLED) return
    if (!get().idToken && !get().guestToken) {
      set({ me: null })
      return
    }
    const me = await fetchMe()
    set({ me })
  },

  ensureGuest: async () => {
    const existing = get().guestToken
    if (existing) return existing
    const res = await mintGuest()
    get().setGuestToken(res.guest_token)
    set({ me: res.user, firebaseUser: null, idToken: null })
    return res.guest_token
  },

  signInWithGoogle: async () => {
    const auth = getFirebaseAuth()
    await signInWithPopupFast(auth, googleProvider)
  },

  signInWithGitHub: async () => {
    const auth = getFirebaseAuth()
    await signInWithPopupFast(auth, githubProvider)
  },

  signInWithEmail: async (email, password) => {
    const auth = getFirebaseAuth()
    await signInWithEmailAndPassword(auth, email, password)
  },

  registerWithEmail: async (name, email, password) => {
    const auth = getFirebaseAuth()
    const { user } = await createUserWithEmailAndPassword(auth, email, password)
    if (name.trim()) {
      await updateProfile(user, { displayName: name.trim() })
      await user.getIdToken(true) // Force token refresh to include the new name
      await get().refreshMe() // Sync the new name to the backend database
    }
  },

  resetPassword: async (email) => {
    const auth = getFirebaseAuth()
    await sendPasswordResetEmail(auth, email)
  },

  signOut: async () => {
    if (get().firebaseUser) {
      await firebaseSignOut(getFirebaseAuth())
    }
    localStorage.removeItem(GUEST_TOKEN_KEY)
    useUIStore.getState().clearNotifications()
    queryClient.clear()
    set({
      firebaseUser: null,
      idToken: null,
      guestToken: null,
      me: null,
    })
  },

  deleteAccount: async () => {
    await deleteMe()
    if (get().firebaseUser) {
      try {
        await get().firebaseUser!.delete()
      } catch {
        // Backend already removed the row; Firebase client delete may need reauth.
      }
      await firebaseSignOut(getFirebaseAuth()).catch(() => undefined)
    }
    localStorage.removeItem(GUEST_TOKEN_KEY)
    useUIStore.getState().clearNotifications()
    queryClient.clear()
    set({
      firebaseUser: null,
      idToken: null,
      guestToken: null,
      me: null,
    })
    toast.success("Account deleted")
  },

  isGuest: () => Boolean(get().guestToken) && !get().firebaseUser,

  isSignedIn: () => Boolean(get().firebaseUser),

  canWrite: () => {
    if (!AUTH_ENABLED) return true
    return Boolean(get().firebaseUser)
  },
}))

bindAuthInterceptors({
  readTokens: () => {
    const s = useAuthStore.getState()
    return { idToken: s.idToken, guestToken: s.guestToken }
  },
  onUnauthorized: () => {
    void useAuthStore.getState().signOut()
  },
})
