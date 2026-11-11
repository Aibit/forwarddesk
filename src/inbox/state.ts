// Inbox state shared by the sidebar badge, the Inbox page and the job drawer.
import { useSyncExternalStore } from 'react';
import { serverBackend, sampleBackend, type Conv, type InboxBackend } from './backend';
import { getSession } from '../backend/session';

const CFG_KEY = 'fd.wa.server';
export interface ServerCfg { url: string; key: string }
export const readServerCfg = (): ServerCfg | null => {
  const envUrl = import.meta.env.VITE_WA_API_URL as string | undefined;
  try { const raw = localStorage.getItem(CFG_KEY); if (raw) { const c = JSON.parse(raw); if (c?.url && c?.key) return c; } } catch { /* */ }
  return envUrl ? { url: envUrl, key: (import.meta.env.VITE_WA_API_KEY as string | undefined) ?? '' } : null;
};
export const saveServerCfg = (c: ServerCfg | null) => {
  try { if (c) localStorage.setItem(CFG_KEY, JSON.stringify(c)); else localStorage.removeItem(CFG_KEY); } catch { /* */ }
  refreshBackend();
};

interface State { backend: InboxBackend | null; mode: 'sample' | 'server' | 'none'; convs: Conv[]; error: string | null; loaded: boolean; nav: { id: number; n: number; draft?: string } | null }
let st: State = { backend: null, mode: 'none', convs: [], error: null, loaded: false, nav: null };
const subs = new Set<() => void>();
const set = (p: Partial<State>) => { st = { ...st, ...p }; subs.forEach((f) => f()); };
export const useInbox = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => st);
export const getInbox = () => st;

function pickBackend(): { backend: InboxBackend | null; mode: State['mode'] } {
  const cfg = readServerCfg();
  if (cfg) return { backend: serverBackend(cfg.url, cfg.key), mode: 'server' };
  if (getSession().mode !== 'live') return { backend: sampleBackend(), mode: 'sample' };
  return { backend: null, mode: 'none' };
}

let timer: ReturnType<typeof setInterval> | null = null;
export function refreshBackend() {
  const { backend, mode } = pickBackend();
  set({ backend, mode, convs: [], loaded: false, error: null });
  void reloadConvs();
  if (timer) clearInterval(timer);
  if (mode === 'server') timer = setInterval(() => { if (document.visibilityState !== 'hidden') void reloadConvs(); }, 5000);
}
export async function reloadConvs() {
  const b = st.backend;
  if (!b) return;
  try {
    const convs = await b.list();
    if (b === st.backend) set({ convs, loaded: true, error: null });
  } catch (e) {
    if (b === st.backend) set({ loaded: true, error: String((e as Error).message ?? e) });
  }
}
export const patchConv = (c: Conv) => set({ convs: st.convs.map((x) => (x.id === c.id ? { ...x, ...c } : x)) });
export const totalUnread = (convs: Conv[]) => convs.reduce((a, c) => a + (c.unread || 0), 0);
/** Ask the app to show the Inbox with this conversation open. */
export const openInInbox = (id: number, draft?: string) => set({ nav: { id, n: (st.nav?.n ?? 0) + 1, draft } });
