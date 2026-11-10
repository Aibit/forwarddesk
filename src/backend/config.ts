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
export const backendAvailable = FIREBASE_CONFIG != null;
export const ORG_ID = 'demo';
