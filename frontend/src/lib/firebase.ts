/**
 * Firebase client init. Uses VITE_FIREBASE_* build-time vars.
 * When VITE_FIREBASE_EMULATOR=true, Auth points at the local emulator.
 */

import { initializeApp, type FirebaseApp } from "firebase/app"
import {
  connectAuthEmulator,
  getAuth,
  GithubAuthProvider,
  GoogleAuthProvider,
  type Auth,
} from "firebase/auth"

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "localhost",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-project",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "demo-app",
}

let app: FirebaseApp | null = null
let auth: Auth | null = null
let emulatorConnected = false

export function getFirebaseAuth(): Auth {
  if (!app) {
    app = initializeApp(firebaseConfig)
    auth = getAuth(app)

    if (import.meta.env.VITE_FIREBASE_EMULATOR === "true" && !emulatorConnected) {
      connectAuthEmulator(auth, "http://127.0.0.1:9099", {
        disableWarnings: true,
      })
      emulatorConnected = true
    }
  }
  return auth!
}

export const googleProvider = new GoogleAuthProvider()
export const githubProvider = new GithubAuthProvider()

/** True when the frontend should enforce Firebase / guest identity. */
export const AUTH_ENABLED =
  (import.meta.env.VITE_AUTH_ENABLED || "false").toLowerCase() === "true"
