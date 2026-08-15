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
import { bindAuthInterceptors } from "@/api/client"
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
        localStorage.removeItem(GUEST_TOKEN_KEY)
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
    await signInWithPopup(auth, googleProvider)
  },

  signInWithGitHub: async () => {
    const auth = getFirebaseAuth()
    await signInWithPopup(auth, githubProvider)
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
