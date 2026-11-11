import { useSyncExternalStore } from 'react';
import { bridge } from '../backend/bridge';
import type { QuoteRecord } from '../clients/store';
import type { Job } from '../jobs/data';
import type { DbAgent, KycDoc } from './db';

// ── Activity timeline (notes, calls, emails, meetings, rate requests / replies — logged by hand) ──
export type ActKind = 'note' | 'call' | 'email' | 'meeting' | 'rate_request' | 'rate_reply';
export const ACT_KINDS: ActKind[] = ['note', 'call', 'email', 'meeting', 'rate_request', 'rate_reply'];
export interface AgentActivity {
  id: string;
  agentId: string;
  kind: ActKind;
  /** when it happened (ms, user-entered date) */
  at: number;
  text: string;
  /** who logged it (uid in live mode, 'demo' in this browser) */
  by: string;
  sample?: boolean;
}

const DAY = 86400000;
const KEY = 'fd.agentact.v1';
export function sampleActivities(now = Date.now()): AgentActivity[] {
  const A = (id: string, agentId: string, kind: ActKind, daysAgo: number, text: string): AgentActivity => ({ id, agentId, kind, at: now - daysAgo * DAY, text, by: 'demo', sample: true });
  return [
    A('act-s1', 'db-s4', 'rate_request', 9, 'SAMPLE: asked for 2×40HC Shanghai → Bandar Abbas, ready end of month.'),
    A('act-s2', 'db-s4', 'rate_reply', 8.5, 'SAMPLE: rate received, valid 14 days.'),
    A('act-s3', 'db-s4', 'call', 3, 'SAMPLE: weekly call — space tight on next two sailings.'),
    A('act-s4', 'db-s3', 'rate_request', 6, 'SAMPLE: LCL rate request Nhava Sheva → Bandar Abbas.'),
    A('act-s5', 'db-s3', 'rate_reply', 4, 'SAMPLE: rate received.'),
    A('act-s6', 'db-s3', 'email', 2, 'SAMPLE: sent updated agency agreement draft.'),
    A('act-s7', 'db-s0', 'meeting', 12, 'SAMPLE: annual rate review with line sales.'),
    A('act-s8', 'db-s5', 'rate_request', 5, 'SAMPLE: first rate request (project cargo).'),
  ];
}
function load(): AgentActivity[] {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (Array.isArray(r)) return r;
  } catch { /* ignore */ }
  return sampleActivities();
}
let acts: AgentActivity[] = typeof localStorage === 'undefined' ? [] : load();
const subs = new Set<() => void>();
function set(next: AgentActivity[], persist = true) {
  acts = next;
  if (persist && !bridge.w) try { localStorage.setItem(KEY, JSON.stringify(acts)); } catch { /* full */ }
  subs.forEach((f) => f());
}
export const useActivities = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => acts);
export const activities = {
  get: () => acts,
  add(a: AgentActivity) { bridge.w?.activityUpsert(a); set([a, ...acts.filter((x) => x.id !== a.id)]); },
  remove(id: string) { bridge.w?.activityRemove(id); set(acts.filter((x) => x.id !== id)); },
  reset() { if (!bridge.w) { localStorage.removeItem(KEY); set(sampleActivities(), false); } },
  hydrate(list: AgentActivity[]) { set(list, false); },
  reload() { set(load(), false); },
};
export const forAgent = (list: AgentActivity[], id: string) => list.filter((a) => a.agentId === id).sort((a, b) => b.at - a.at);

// ── Links to quotes / jobs (by name: quote options and job lines carry carrier / agent names) ──
/** "Sample Line A", "Line A (sample)" → "line a" */
export const normName = (s: string) => s.toLowerCase().replace(/\(sample\)|\bsample\b/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const hit = (agent: DbAgent, name: string | undefined | null) => !!name && !!normName(agent.name) && normName(name) === normName(agent.name);

export interface AgentStats {
  quotes: QuoteRecord[];
  jobs: Job[];
  quoted: number;
  decided: number;
  won: number;
  winRate: number | null;
  requests: number;
  replies: number;
  responseRate: number | null;
  avgReplyHours: number | null;
  lastActivity: number | null;
}
export function agentStats(agent: DbAgent, quotes: QuoteRecord[], jobs: Job[], acts: AgentActivity[]): AgentStats {
  const qs = quotes.filter((q) => q.options.some((o) => hit(agent, o.carrier)));
  const wonQ = qs.filter((q) => q.status === 'won' && (q.acceptedOption ? hit(agent, q.acceptedOption) : q.options.length === 1 || hit(agent, q.options[0]?.carrier)));
  const decided = qs.filter((q) => q.status === 'won' || q.status === 'lost').length;
  const js = jobs.filter((j) => hit(agent, j.line));
  const mine = forAgent(acts, agent.id).slice().reverse();
  let requests = 0, replies = 0, totalH = 0, paired = 0;
  const open: number[] = [];
  for (const a of mine) {
    if (a.kind === 'rate_request') { requests++; open.push(a.at); }
    if (a.kind === 'rate_reply') { replies++; const t = open.shift(); if (t != null && a.at >= t) { totalH += (a.at - t) / 3600000; paired++; } }
  }
  return {
    quotes: qs, jobs: js, quoted: qs.length, decided, won: wonQ.length, winRate: decided ? wonQ.length / decided : null,
    requests, replies: Math.min(replies, requests || replies), responseRate: requests ? Math.min(1, replies / requests) : null, avgReplyHours: paired ? totalH / paired : null,
    lastActivity: mine.length ? mine[mine.length - 1].at : null,
  };
}

// ── KYC / documents ──
export type KycFlag = 'expired' | 'expiring' | 'tbc' | 'ok' | 'missing';
export const EXPIRING_DAYS = 30;
export function daysTo(iso: string, now = Date.now()): number | null {
  if (!iso) return null;
  const t = Date.parse(`${iso}T00:00:00`);
  return Number.isNaN(t) ? null : Math.ceil((t - now) / DAY);
}
export function kycFlag(d: KycDoc, now = Date.now()): KycFlag {
  const days = daysTo(d.expiry, now);
  if ((d.status === 'received' || d.status === 'verified') && days != null && days < 0) return 'expired';
  if ((d.status === 'received' || d.status === 'verified') && days != null && days <= EXPIRING_DAYS) return 'expiring';
  if (d.status === 'verified' || d.status === 'received') return 'ok';
  if (d.status === 'requested') return 'tbc';
  return 'missing';
}
export function kycSummary(a: DbAgent, now = Date.now()) {
  const docs = a.kyc ?? [];
  const flags = docs.map((d) => kycFlag(d, now));
  return { ok: flags.filter((f) => f === 'ok' || f === 'expiring').length, total: Math.max(4, docs.length), expired: flags.includes('expired'), expiring: flags.includes('expiring') };
}
