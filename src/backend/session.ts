import { useSyncExternalStore } from 'react';
import { backendAvailable, BACKEND } from './config';
import type { AccountsAdapter } from './bridge';

export type Mode = 'demo' | 'connecting' | 'live' | 'verify' | 'onboard';
export interface Session {
  mode: Mode;
  uid: string | null;
  email: string | null;
  role: 'staff' | 'client' | null;
  clientId: string | null;
  orgId: string | null;
  /** Account owner (manages team, invites, account settings). */
  owner: boolean;
  orgName: string | null;
  /** Last error (amber notice), e.g. a write the security rules refused. */
  error: string | null;
  /** Self-hosted server: this email is in ADMIN_EMAILS (may see the waitlist). */
  admin?: boolean;
}
const DEMO: Session = { mode: 'demo', uid: null, email: null, role: null, clientId: null, orgId: null, owner: false, orgName: null, error: null, admin: false };
let s: Session = DEMO;
const subs = new Set<() => void>();
export function setSession(p: Partial<Session>) {
  s = { ...s, ...p };
  subs.forEach((f) => f());
}
export const resetSession = (error: string | null = null) => setSession({ ...DEMO, error });
export const useSession = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => s);
export const getSession = () => s;

const LIVE_FLAG = 'fd.live';
interface LiveMod { signIn(email: string, password: string): Promise<void>; resume(): Promise<void>; signOut(): Promise<void>; adapter: AccountsAdapter }
let mod: Promise<LiveMod> | null = null;
/** Self-hosted API when VITE_API_URL is set, otherwise Firebase. Each is a separate lazy chunk. */
const live = () => (mod ??= BACKEND === 'server' ? import('./serverLive') : import('./live'));

/** Sign in with a real Firebase account (staff or client). Loads the Firebase SDK on demand. */
export async function signIn(email: string, password: string): Promise<void> {
  if (!backendAvailable) throw new Error('backend-off');
  setSession({ mode: 'connecting', error: null });
  try {
    const m = await live();
    await m.signIn(email, password);
    localStorage.setItem(LIVE_FLAG, '1');
  } catch (e) {
    resetSession(friendly(e));
    throw e;
  }
}
/** Run a live-module action (sign up, Google, create / join account …) with the friendly error mapping. */
export async function act<T>(f: (a: AccountsAdapter) => Promise<T>, keepMode = false): Promise<T> {
  if (!backendAvailable) throw new Error('backend-off');
  const prev = s.mode;
  if (!keepMode) setSession({ mode: 'connecting', error: null });
  try {
    const r = await f(await accounts());
    localStorage.setItem(LIVE_FLAG, '1');
    return r;
  } catch (e) {
    if (keepMode) setSession({ error: friendly(e) });
    else if (prev === 'verify' || prev === 'onboard') setSession({ mode: prev, error: friendly(e) });
    else resetSession(friendly(e));
    throw e;
  }
}
/** The accounts backend (loaded on demand). UI code uses only this + act(); never a backend SDK. */
export const accounts = (): Promise<AccountsAdapter> => live().then((m) => m.adapter);
export async function signOut(): Promise<void> {
  localStorage.removeItem(LIVE_FLAG);
  if (mod) await (await mod).signOut();
  resetSession();
}
/** On page load: resume a live session only if this browser signed in before (visitors stay in demo mode). */
export function boot() {
  if (!backendAvailable || localStorage.getItem(LIVE_FLAG) !== '1') return;
  setSession({ mode: 'connecting' });
  void live().then((m) => m.resume()).catch((e) => resetSession(friendly(e)));
}
export function friendly(e: unknown): string {
  const code = (e as { code?: string })?.code ?? String((e as Error)?.message ?? e);
  if (/invalid-credential|wrong-password|user-not-found/.test(code)) return 'bad-login';
  if (/invalid-email/.test(code)) return 'invalid-email';
  if (/rate-limited|too-many-requests/.test(code)) return 'rate-limited';
  if (/expired-code/.test(code)) return 'expired-code';
  if (/already-member/.test(code)) return 'already-member';
  if (/session-ended|unauthenticated/.test(code)) return 'session-ended';
  if (/permission-denied/.test(code)) return 'denied';
  if (/no-org/.test(code)) return 'no-org';
  if (/email-already-in-use/.test(code)) return 'email-used';
  if (/weak-password/.test(code)) return 'weak-password';
  if (/popup-closed|cancelled-popup|popup-blocked/.test(code)) return 'popup';
  if (/operation-not-allowed/.test(code)) return 'provider-off';
  if (/bad-code|used-code|wrong-email/.test(code)) return code.match(/bad-code|used-code|wrong-email/)![0];
  if (/network|unavailable/.test(code)) return 'offline';
  return code.slice(0, 160);
}
