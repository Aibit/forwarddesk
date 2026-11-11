import { useSyncExternalStore } from 'react';
import { bridge } from '../backend/bridge';
import type { TplKey, WaLang } from './templates';

/**
 * Communication log for WhatsApp click-to-chat. An entry means "staff opened WhatsApp with this text";
 * ForwardDesk cannot see whether it was sent or delivered, so the UI always says "opened in WhatsApp".
 * Demo: this browser (localStorage). Live: orgs/{org}/commLog/{id}, staff only.
 */
export interface WaLogEntry {
  id: string;
  channel: 'whatsapp';
  at: number;
  by: string;
  jobId?: string | null;
  clientId?: string | null;
  agentId?: string | null;
  /** recipient name / role as shown to staff */
  toName: string;
  /** E.164 number the link was opened for */
  toNumber: string;
  template: TplKey;
  lang: WaLang;
  /** the text as it was when WhatsApp was opened (staff may still edit it in WhatsApp) */
  text: string;
}

const KEY = 'fd.walog.v1';
function load(): WaLogEntry[] {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(r) ? r : [];
  } catch {
    return [];
  }
}
let list: WaLogEntry[] = typeof localStorage === 'undefined' ? [] : load();
const subs = new Set<() => void>();
function set(next: WaLogEntry[], persist = true) {
  list = next;
  if (persist && !bridge.w) try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 500))); } catch { /* full */ }
  subs.forEach((f) => f());
}
export const useWaLog = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => list);
export const waLog = {
  get: () => list,
  add(e: Omit<WaLogEntry, 'id' | 'at' | 'by' | 'channel'>): WaLogEntry {
    const full: WaLogEntry = { ...e, id: `wa-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, channel: 'whatsapp', at: Date.now(), by: 'demo', text: e.text.slice(0, 4000) };
    bridge.w?.commLogAdd?.(full);
    set([full, ...list]);
    return full;
  },
  hydrate(next: WaLogEntry[]) { set([...next].sort((a, b) => b.at - a.at), false); },
  reload() { set(load(), false); },
};
export const waFor = (l: WaLogEntry[], k: 'jobId' | 'clientId' | 'agentId', id: string | null | undefined) => (id ? l.filter((e) => e[k] === id) : []);
