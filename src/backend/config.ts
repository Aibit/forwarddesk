import type { FirebaseOptions } from 'firebase/app';

/**
 * Firebase web config. This is public by design (it identifies the project; access is enforced by
 * Firestore security rules + Firebase Auth), so it can live in the build.
 * Set it here or with VITE_FB_CONFIG='{"apiKey":…}' at build time. Null = demo mode only.
 */
const BUILT_IN: FirebaseOptions | null = null;

function fromEnv(): FirebaseOptions | null {
  const raw = import.meta.env.VITE_FB_CONFIG as string | undefined;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FirebaseOptions;
  } catch {
    return null;
  }
}
/** Local development against the Firebase emulators (npm run emulators). */
export const USE_EMULATOR = import.meta.env.VITE_FB_EMULATOR === '1';
export const FIREBASE_CONFIG: FirebaseOptions | null = USE_EMULATOR
  ? { apiKey: 'demo-key', projectId: 'demo-forwarddesk', authDomain: 'demo-forwarddesk.firebaseapp.com', appId: 'demo-app' }
  : fromEnv() ?? BUILT_IN;
/**
 * Self-hosted ForwardDesk API (server/, Node + SQLite), e.g. VITE_API_URL=https://api.example.com at build time.
 * When set it replaces Firebase for accounts and data. Unset (the public GitHub Pages build) = demo only.
 */
export const API_URL: string | null = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').trim().replace(/\/+$/, '') || null;
export const BACKEND: 'server' | 'firebase' | null = API_URL ? 'server' : FIREBASE_CONFIG ? 'firebase' : null;
export const backendAvailable = BACKEND != null;
/** Optional Google sign-in button (off by default; email + password is the main path). */
export const GOOGLE_SIGNIN = BACKEND === 'firebase' && import.meta.env.VITE_GOOGLE_SIGNIN === '1';
export const ORG_ID = 'demo';
