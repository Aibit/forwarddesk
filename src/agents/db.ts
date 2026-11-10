import { useSyncExternalStore } from 'react';

export type DbType = 'overseas' | 'forwarder' | 'line' | 'clearance' | 'network' | 'other';
export const DB_TYPES: DbType[] = ['overseas', 'forwarder', 'line', 'clearance', 'network', 'other'];
export interface DbAgent {
  id: string;
  name: string;
  type: DbType;
  country: string;
  city: string;
  ports: string;
  lanes: string;
  services: string;
  /** customer portal: free text from research (e.g. "Tracking box on homepage") */
  portal: string;
  website: string;
  email: string;
  phone: string;
  whatsapp: string;
  sanctions: string;
  source: string;
  notes: string;
  /** generic sample row (not a real company) */
  sample?: boolean;
  /** loaded from the researched CSV — public info, verify before use */
  publicInfo?: boolean;
}
export const CSV_COLS = ['name', 'type', 'country', 'city', 'ports', 'lanes', 'services', 'portal', 'website', 'email', 'phone', 'whatsapp', 'sanctions_note', 'source', 'notes'] as const;

const KEY = 'fd.agentsdb.v1';
let n = 0;
const S = (name: string, type: DbType, country: string, city: string, ports: string, lanes: string, services: string, portalB: boolean | null, sanctions = ''): DbAgent => ({
  id: `db-s${(n++).toString(36)}`, name, type, country, city, ports, lanes, services, portal: portalB == null ? '' : portalB ? 'yes' : 'no', website: '', email: `${name.toLowerCase().replace(/^sample /, '').replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')}@example.com`, phone: '+00 000 000 000', whatsapp: '', sanctions, source: 'Sample data (generic, not a real company)', notes: '', sample: true,
});
export function sampleDb(): DbAgent[] {
  n = 0;
  return [
    S('Sample Line A', 'line', '—', '—', 'Bandar Abbas, Jebel Ali, Nhava Sheva', 'Gulf – India', 'FCL', true, 'Check current sanctions/compliance status for Iran calls before booking'),
    S('Sample Line B', 'line', '—', '—', 'Bandar Abbas, Nhava Sheva, Mundra', 'Gulf – India', 'FCL', true, 'Check current sanctions/compliance status for Iran calls before booking'),
    S('Sample Line C', 'line', '—', '—', 'Jebel Ali, Bandar Abbas, Shanghai', 'Gulf – Far East', 'FCL, feeder', false, 'Check current sanctions/compliance status for Iran calls before booking'),
    S('Sample Agent Nhava Sheva', 'overseas', 'India', 'Mumbai', 'Nhava Sheva, Mundra', 'India – Gulf', 'FCL, LCL, customs, trucking', false),
    S('Sample Agent Shanghai', 'overseas', 'China', 'Shanghai', 'Shanghai (Yangshan), Ningbo', 'Far East – Gulf', 'FCL, LCL, consolidation', true),
    S('Sample Agent Hamburg', 'overseas', 'Germany', 'Hamburg', 'Hamburg, Bremerhaven', 'N. Europe – Gulf', 'FCL, project cargo', true, 'EU export controls: screen cargo and parties for Iran shipments'),
    S('Sample Agent Jebel Ali', 'overseas', 'UAE', 'Dubai', 'Jebel Ali', 'Gulf transhipment', 'FCL, re-export, warehousing', true),
    S('Sample NVOCC Gulf', 'forwarder', 'UAE', 'Dubai', 'Jebel Ali, Bandar Abbas', 'Gulf – Asia', 'NVOCC, own SOC boxes', false),
    S('Sample Forwarder Barcelona', 'forwarder', 'Spain', 'Barcelona', 'Barcelona, Valencia', 'Med – Far East', 'FCL, LCL, customs', true),
    S('Sample Clearance BND', 'clearance', 'Iran', 'Bandar Abbas', 'Bandar Abbas (Shahid Rajaee)', '—', 'Customs clearance, E1/E10 docs', false),
    S('Sample Clearance Mumbai', 'clearance', 'India', 'Mumbai', 'Nhava Sheva', '—', 'Customs clearance (CHA)', false),
    S('Sample Network (agents alliance)', 'network', '—', '—', 'Worldwide', '—', 'Independent forwarder network, member directory', true),
  ];
}

export const newDbAgent = (): DbAgent => ({ id: `db-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, name: '', type: 'overseas', country: '', city: '', ports: '', lanes: '', services: '', portal: '', website: '', email: '', phone: '', whatsapp: '', sanctions: '', source: 'Added by hand', notes: '' });

// ── CSV ──
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cur = '', q = false;
  const t = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}
const ALIAS: Record<string, string> = { sanctions: 'sanctions_note', sanctions_notes: 'sanctions_note', 'sanctions note': 'sanctions_note', port: 'ports', lane: 'lanes', service: 'services', web: 'website', url: 'website', tel: 'phone', telephone: 'phone', company: 'name', agent: 'name', category: 'type', note: 'notes', has_portal: 'portal', 'portal (y/n)': 'portal' };
function normType(t: string): DbType {
  const s = t.toLowerCase();
  if (/port operator|terminal/.test(s)) return 'other';
  if (/line|carrier|shipping/.test(s)) return 'line';
  if (/clear|customs|broker|cha/.test(s)) return 'clearance';
  if (/network|alliance|association/.test(s)) return 'network';
  if (/nvocc|forwarder|ff/.test(s)) return 'forwarder';
  return 'overseas';
}
export function csvToAgents(text: string, publicInfo: boolean): { list: DbAgent[]; skipped: number } {
  const rows = parseCsv(text);
  if (rows.length < 2) return { list: [], skipped: 0 };
  const head = rows[0].map((h) => { const k = h.trim().toLowerCase(); return ALIAS[k] ?? k.replace(/\s+/g, '_'); });
  const idx = (k: string) => head.indexOf(k);
  let skipped = 0;
  const list: DbAgent[] = [];
  rows.slice(1).forEach((r, i) => {
    const g = (k: string) => (idx(k) >= 0 ? (r[idx(k)] ?? '').trim() : '');
    if (!g('name')) { skipped++; return; }
    list.push({
      id: `db-c${i.toString(36)}-${Math.random().toString(36).slice(2, 5)}`, name: g('name'), type: normType(g('type')), country: g('country'), city: g('city'), ports: g('ports'), lanes: g('lanes'), services: g('services'),
      portal: g('portal'),
      website: g('website'), email: g('email'), phone: g('phone'), whatsapp: g('whatsapp'), sanctions: g('sanctions_note'), source: g('source') || (publicInfo ? 'Public info' : 'CSV import'), notes: g('notes'), publicInfo,
    });
  });
  return { list, skipped };
}
const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
export function agentsToCsv(list: DbAgent[]): string {
  return [CSV_COLS.join(','), ...list.map((a) => [a.name, a.type, a.country, a.city, a.ports, a.lanes, a.services, a.portal, a.website, a.email, a.phone, a.whatsapp, a.sanctions, a.source, a.notes].map((v) => esc(v ?? '')).join(','))].join('\n');
}

/** Researched public list: drop a CSV at src/agents/seed/agents.csv and rebuild — it becomes the seed (marked "public info, verify before use"). */
const SEED_CSV = Object.values(import.meta.glob('./seed/*.csv', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)[0] ?? null;
export const hasCsvSeed = !!SEED_CSV;
function seedList(): { list: DbAgent[]; seed: 'sample' | 'csv' } {
  if (SEED_CSV) {
    const { list } = csvToAgents(SEED_CSV, true);
    if (list.length) return { list, seed: 'csv' };
  }
  return { list: sampleDb(), seed: 'sample' };
}

function load(): { list: DbAgent[]; seed: 'sample' | 'csv' | 'user' } {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (r && Array.isArray(r.list)) return r;
  } catch { /* ignore */ }
  return seedList();
}
let state = load();
const subs = new Set<() => void>();
function set(next: typeof state, persist = true) {
  state = next;
  if (persist) try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* full */ }
  subs.forEach((f) => f());
}
export const useAgentsDb = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => state);
export const agentsDb = {
  get: () => state,
  upsert(a: DbAgent) {
    const i = state.list.findIndex((x) => x.id === a.id);
    set({ list: i >= 0 ? state.list.map((x) => (x.id === a.id ? a : x)) : [...state.list, a], seed: 'user' });
  },
  remove(id: string) { set({ list: state.list.filter((x) => x.id !== id), seed: 'user' }); },
  replace(list: DbAgent[], seed: 'sample' | 'csv' | 'user') { set({ list, seed }); },
  reset() { localStorage.removeItem(KEY); set(seedList(), false); },
};

/** Sanctions screening note → 'listed' (OFAC SDN / EU listed / high risk: do not use), 'note' (screen first) or none. */
export function sanctionsLevel(note: string | undefined | null): 'listed' | 'note' | null {
  if (!note?.trim()) return null;
  if (/OFAC SDN \(ent|HIGH RISK|appears on the EU consolidated list|\b(EU|UN)[- ]listed\b|^listed\b|do not use/i.test(note)) return 'listed';
  return 'note';
}
export const isListed = (a: Pick<DbAgent, 'sanctions'>) => sanctionsLevel(a.sanctions) === 'listed';
/** Portal column → yes / no / ? (heuristic over the research text; full text in the drawer). */
export function portalYn(p: string): 'yes' | 'no' | '?' {
  const s = p.trim().toLowerCase();
  if (!s || /not verified|did not load/.test(s)) return '?';
  if (/^(yes|y|true)$/.test(s)) return 'yes';
  if (/^(no|n|false)$/.test(s)) return 'no';
  if (/(no (public )?(customer[- ](style )?)?login (url )?(was )?(found|confirmed))|^none found|no login found|form only|^no /.test(s) && !/live .* login|login\/portal on|track & trace box|tracking form|track-a-shipment/.test(s)) return 'no';
  return 'yes';
}
/** Names of sanctions-listed agents (used to keep them out of quote options by default). */
export const listedNames = () => new Set(state.list.filter(isListed).map((a) => a.name.toLowerCase()));
