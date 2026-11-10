import { useSyncExternalStore } from 'react';
import { backendAvailable } from './config';

export type Mode = 'demo' | 'connecting' | 'live';
export interface Session {
  mode: Mode;
  uid: string | null;
  email: string | null;
  role: 'staff' | 'client' | null;
  clientId: string | null;
  orgId: string | null;
  /** Last error (amber notice), e.g. a write the security rules refused. */
  error: string | null;
}
const DEMO: Session = { mode: 'demo', uid: null, email: null, role: null, clientId: null, orgId: null, error: null };
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
type LiveMod = typeof import('./live');
let mod: Promise<LiveMod> | null = null;
const live = () => (mod ??= import('./live'));

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
  if (/invalid-credential|wrong-password|user-not-found|invalid-email/.test(code)) return 'bad-login';
  if (/permission-denied/.test(code)) return 'denied';
  if (/no-org/.test(code)) return 'no-org';
  if (/network|unavailable/.test(code)) return 'offline';
  return code.slice(0, 160);
}
