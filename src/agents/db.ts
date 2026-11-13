import { bridge } from '../backend/bridge';
import { useSyncExternalStore } from 'react';

// ── Agent CRM data model ────────────────────────────────────────────────────
// One record per agent / line / partner the forwarder account works with.
// Directory fields (name, coverage, public contact) can be shown to clients (preferred-agent picker);
// CRM fields (status, contacts, terms, credit, rating, KYC, notes, tags) are staff-only.
// Live mode stores them in two Firestore docs: orgs/{org}/agents/{id} and orgs/{org}/agentCrm/{id} (see splitAgent).

export type DbType = 'overseas' | 'line' | 'forwarder' | 'trucker' | 'clearance' | 'network' | 'other';
export const DB_TYPES: DbType[] = ['overseas', 'line', 'forwarder', 'trucker', 'clearance', 'network', 'other'];
export type AgentStatus = 'prospect' | 'active' | 'preferred' | 'on_hold' | 'blacklisted';
export const STATUSES: AgentStatus[] = ['preferred', 'active', 'prospect', 'on_hold', 'blacklisted'];
export type Svc = 'FCL' | 'LCL' | 'air' | 'road' | 'customs';
export const SVCS: Svc[] = ['FCL', 'LCL', 'air', 'road', 'customs'];
export type KycKind = 'license' | 'registration' | 'insurance' | 'agreement';
export const KYC_KINDS: KycKind[] = ['license', 'registration', 'insurance', 'agreement'];
export type KycStatus = 'missing' | 'requested' | 'received' | 'verified';
export const KYC_STATUSES: KycStatus[] = ['missing', 'requested', 'received', 'verified'];

export interface AgentContact { id: string; name: string; role: string; email: string; phone: string; whatsapp: string }
export interface LanePair { from: string; to: string }
export interface KycDoc { kind: KycKind; status: KycStatus; /** yyyy-mm-dd or '' */ expiry: string; note?: string }

export interface DbAgent {
  id: string;
  name: string;
  type: DbType;
  country: string;
  city: string;
  ports: string;
  /** free-text lanes (from research / older data) */
  lanes: string;
  /** free-text services (from research / older data) */
  services: string;
  /** customer portal: free text from research (e.g. "Tracking box on homepage") */
  portal: string;
  website: string;
  /** company general contact */
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
  // ── CRM ──
  status?: AgentStatus;
  svc?: Svc[];
  lanePairs?: LanePair[];
  networks?: string[];
  contacts?: AgentContact[];
  paymentTerms?: string;
  creditLimit?: number | null;
  currency?: string;
  /** 0 = not rated, 1–5 */
  rating?: number;
  tags?: string[];
  kyc?: KycDoc[];
  archived?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export const statusOf = (a: Pick<DbAgent, 'status'>): AgentStatus => a.status ?? 'prospect';
export const STATUS_ORDER: Record<AgentStatus, number> = { preferred: 0, active: 1, prospect: 2, on_hold: 3, blacklisted: 4 };
/** Hidden from pickers (quote, client preferred agents): archived or blacklisted. */
export const isHidden = (a: Pick<DbAgent, 'status' | 'archived'>) => !!a.archived || a.status === 'blacklisted';

/** Fields stored in the member-readable agents doc. Everything else goes to the staff-only agentCrm doc. */
export const PUBLIC_KEYS = ['id', 'name', 'type', 'country', 'city', 'ports', 'lanes', 'services', 'portal', 'website', 'email', 'phone', 'whatsapp', 'sanctions', 'source', 'sample', 'publicInfo', 'svc', 'lanePairs', 'networks', 'hidden', 'updatedAt'] as const;
export const CRM_KEYS = ['status', 'contacts', 'paymentTerms', 'creditLimit', 'currency', 'rating', 'tags', 'kyc', 'archived', 'notes', 'createdAt', 'updatedAt'] as const;
export function splitAgent(a: DbAgent): { pub: Record<string, unknown>; crm: Record<string, unknown> } {
  const src = a as unknown as Record<string, unknown>;
  const pub: Record<string, unknown> = {};
  const crm: Record<string, unknown> = {};
  for (const k of PUBLIC_KEYS) if (k !== 'hidden' && src[k] !== undefined) pub[k] = src[k];
  pub.hidden = isHidden(a);
  for (const k of CRM_KEYS) if (src[k] !== undefined) crm[k] = src[k];
  return { pub, crm };
}
export function joinAgent(pub: Record<string, unknown>, crm: Record<string, unknown> | undefined, id: string): DbAgent {
  const { hidden: _h, ...p } = pub;
  return { ...EMPTY, ...(p as Partial<DbAgent>), ...((crm ?? {}) as Partial<DbAgent>), id };
}

const EMPTY: Omit<DbAgent, 'id'> = { name: '', type: 'overseas', country: '', city: '', ports: '', lanes: '', services: '', portal: '', website: '', email: '', phone: '', whatsapp: '', sanctions: '', source: '', notes: '' };
export const rid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const newContact = (): AgentContact => ({ id: rid('ct'), name: '', role: '', email: '', phone: '', whatsapp: '' });
export const emptyKyc = (): KycDoc[] => KYC_KINDS.map((kind) => ({ kind, status: 'missing', expiry: '' }));
export const newDbAgent = (): DbAgent => ({ ...EMPTY, id: rid('db'), source: 'Added by hand', status: 'prospect', svc: [], lanePairs: [], networks: [], contacts: [], tags: [], kyc: emptyKyc(), currency: 'USD', rating: 0, paymentTerms: '', creditLimit: null });

// ── SAMPLE agents (generic, not real companies; example.com / +00 numbers) ──
const DAY = 86400000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);
type SampleCrm = Partial<DbAgent>;
let n = 0;
const S = (name: string, type: DbType, country: string, city: string, ports: string, lanes: string, services: string, portalB: boolean | null, sanctions = '', crm: SampleCrm = {}): DbAgent => {
  const slug = name.toLowerCase().replace(/^sample /, '').replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
  return {
    id: `db-s${(n++).toString(36)}`, name, type, country, city, ports, lanes, services, portal: portalB == null ? '' : portalB ? 'yes' : 'no', website: '', email: `${slug}@example.com`, phone: '+00 000 000 000', whatsapp: '', sanctions, source: 'Sample data (generic, not a real company)', notes: '', sample: true,
    status: 'prospect', svc: [], lanePairs: [], networks: [], tags: [], kyc: emptyKyc(), currency: 'USD', rating: 0, paymentTerms: '', creditLimit: null,
    contacts: [{ id: `ct-${slug}-1`, name: 'Sample Contact', role: 'Sales', email: `sales.${slug}@example.com`, phone: '+00 000 000 001', whatsapp: '' }],
    ...crm,
  };
};
const K = (lic: KycStatus, licExp: number | null, reg: KycStatus, ins: KycStatus, insExp: number | null, agr: KycStatus, agrExp: number | null = null): KycDoc[] => [
  { kind: 'license', status: lic, expiry: licExp == null ? '' : iso(licExp) },
  { kind: 'registration', status: reg, expiry: '' },
  { kind: 'insurance', status: ins, expiry: insExp == null ? '' : iso(insExp) },
  { kind: 'agreement', status: agr, expiry: agrExp == null ? '' : iso(agrExp) },
];
export function sampleDb(): DbAgent[] {
  n = 0;
  return [
    S('Sample Line A', 'line', '—', '—', 'Jebel Ali, Dammam, Nhava Sheva', 'Gulf – India', 'FCL', true, 'Check current sanctions/compliance status before booking',
      { status: 'preferred', svc: ['FCL'], lanePairs: [{ from: 'Jebel Ali', to: 'Dammam' }, { from: 'Jebel Ali', to: 'Nhava Sheva' }], rating: 4, paymentTerms: 'Prepaid before B/L release', currency: 'USD', tags: ['weekly service'], kyc: K('verified', 200, 'verified', 'verified', 20, 'verified', 300) }),
    S('Sample Line B', 'line', '—', '—', 'Jebel Ali, Nhava Sheva, Mundra', 'Gulf – India', 'FCL', true, 'Check current sanctions/compliance status before booking',
      { status: 'active', svc: ['FCL'], lanePairs: [{ from: 'Jebel Ali', to: 'Nhava Sheva' }, { from: 'Jebel Ali', to: 'Shanghai' }], rating: 3, paymentTerms: 'Prepaid', currency: 'USD', kyc: K('verified', 400, 'verified', 'received', -5, 'requested') }),
    S('Sample Line C', 'line', '—', '—', 'Jebel Ali, Salalah, Shanghai', 'Gulf – Far East', 'FCL, feeder', false, 'Check current sanctions/compliance status before booking',
      { status: 'active', svc: ['FCL'], lanePairs: [{ from: 'Salalah', to: 'Jebel Ali' }], rating: 3, currency: 'USD' }),
    S('Sample Agent Nhava Sheva', 'overseas', 'India', 'Mumbai', 'Nhava Sheva, Mundra', 'India – Gulf', 'FCL, LCL, customs, trucking', false, '',
      { status: 'active', svc: ['FCL', 'LCL', 'customs', 'road'], lanePairs: [{ from: 'Nhava Sheva', to: 'Jebel Ali' }], networks: ['Sample network'], rating: 4, paymentTerms: '30 days after invoice', creditLimit: 15000, currency: 'USD', tags: ['reliable'], kyc: K('verified', 25, 'verified', 'verified', 180, 'received') }),
    S('Sample Agent Shanghai', 'overseas', 'China', 'Shanghai', 'Shanghai (Yangshan), Ningbo', 'Far East – Gulf', 'FCL, LCL, consolidation', true, '',
      { status: 'preferred', svc: ['FCL', 'LCL', 'air'], lanePairs: [{ from: 'Shanghai', to: 'Jebel Ali' }, { from: 'Ningbo', to: 'Jebel Ali' }], networks: ['Sample network'], rating: 5, paymentTerms: '15 days after invoice', creditLimit: 25000, currency: 'USD', tags: ['consolidation'], kyc: K('verified', 300, 'verified', 'verified', 120, 'verified', 240) }),
    S('Sample Agent Hamburg', 'overseas', 'Germany', 'Hamburg', 'Hamburg, Bremerhaven', 'N. Europe – Gulf', 'FCL, project cargo', true, 'EU export controls: screen cargo and parties before booking',
      { status: 'prospect', svc: ['FCL'], lanePairs: [{ from: 'Hamburg', to: 'Jebel Ali' }], currency: 'EUR', kyc: K('requested', null, 'missing', 'missing', null, 'missing') }),
    S('Sample Agent Salalah', 'overseas', 'Oman', 'Salalah', 'Salalah, Sohar', 'Gulf transhipment', 'FCL, re-export, warehousing', true, '',
      { status: 'active', svc: ['FCL', 'road'], lanePairs: [{ from: 'Salalah', to: 'Jebel Ali' }], rating: 4, paymentTerms: 'Prepaid', currency: 'AED', tags: ['transhipment'] }),
    S('Sample NVOCC Gulf', 'forwarder', 'United Arab Emirates', 'Dubai', 'Jebel Ali, Dammam', 'Gulf – Asia', 'NVOCC, own SOC boxes', false, '',
      { status: 'on_hold', svc: ['FCL'], rating: 2, currency: 'USD', tags: ['SOC boxes'] }),
    S('Sample Forwarder Barcelona', 'forwarder', 'Spain', 'Barcelona', 'Barcelona, Valencia', 'Med – Far East', 'FCL, LCL, customs', true, '',
      { status: 'prospect', svc: ['FCL', 'LCL', 'customs'], lanePairs: [{ from: 'Shanghai', to: 'Barcelona' }], currency: 'EUR' }),
    S('Sample Clearance Jebel Ali', 'clearance', 'United Arab Emirates', 'Dubai', 'Jebel Ali', '—', 'Customs clearance, import / export declarations', false, '',
      { status: 'active', svc: ['customs'], rating: 4, paymentTerms: 'Per booking', currency: 'USD' }),
    S('Sample Trucker Gulf', 'trucker', 'United Arab Emirates', 'Dubai', 'Jebel Ali', '—', 'FTL, container haulage', false, '',
      { status: 'prospect', svc: ['road'], currency: 'AED' }),
    S('Sample Broker Mumbai', 'clearance', 'India', 'Mumbai', 'Nhava Sheva', '—', 'Customs clearance (CHA)', false, '',
      { status: 'blacklisted', svc: ['customs'], rating: 1, notes: 'SAMPLE: example of a blacklisted partner — hidden from quote and client pickers.' }),
    S('Sample Network (agents alliance)', 'network', '—', '—', 'Worldwide', '—', 'Independent forwarder network, member directory', true, '', { status: 'prospect' }),
  ];
}

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
export const CSV_COLS = ['name', 'type', 'status', 'country', 'city', 'ports', 'lane_pairs', 'lanes', 'service_flags', 'services', 'networks', 'tags', 'payment_terms', 'credit_limit', 'currency', 'rating', 'contacts', 'portal', 'website', 'email', 'phone', 'whatsapp', 'sanctions_note', 'source', 'notes', 'archived'] as const;
const ALIAS: Record<string, string> = { sanctions: 'sanctions_note', sanctions_notes: 'sanctions_note', 'sanctions note': 'sanctions_note', port: 'ports', lane: 'lanes', service: 'services', web: 'website', url: 'website', tel: 'phone', telephone: 'phone', company: 'name', 'company name': 'name', agent: 'name', category: 'type', note: 'notes', has_portal: 'portal', 'portal (y/n)': 'portal', terms: 'payment_terms', 'payment terms': 'payment_terms', credit: 'credit_limit', 'credit limit': 'credit_limit', network: 'networks', memberships: 'networks', tag: 'tags', 'lane pairs': 'lane_pairs', 'service flags': 'service_flags' };
export function normType(t: string): DbType {
  const s = t.toLowerCase();
  if (DB_TYPES.includes(s as DbType)) return s as DbType;
  if (/port operator|terminal/.test(s)) return 'other';
  if (/truck|haul|road carrier|transport company/.test(s)) return 'trucker';
  if (/line|carrier|shipping/.test(s)) return 'line';
  if (/clear|customs|broker|cha/.test(s)) return 'clearance';
  if (/network|alliance|association/.test(s)) return 'network';
  if (/nvocc|forwarder|ff/.test(s)) return 'forwarder';
  if (/other/.test(s)) return 'other';
  return 'overseas';
}
function normStatus(s: string): AgentStatus | undefined {
  const v = s.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!v) return undefined;
  if ((STATUSES as string[]).includes(v)) return v as AgentStatus;
  if (/black|banned|do_not/.test(v)) return 'blacklisted';
  if (/hold|paus/.test(v)) return 'on_hold';
  if (/prefer/.test(v)) return 'preferred';
  if (/activ/.test(v)) return 'active';
  return 'prospect';
}
const list_ = (s: string) => s.split(/[;|]/).map((x) => x.trim()).filter(Boolean);
const lanePairsOf = (s: string): LanePair[] => list_(s).map((p) => p.split(/\s*(?:>|→|->)\s*/)).filter((x) => x.length === 2 && x[0] && x[1]).map(([from, to]) => ({ from, to }));
const svcOf = (s: string): Svc[] => {
  const t = s.toLowerCase();
  return SVCS.filter((v) => (v === 'road' ? /road|truck|ftl|ltl/.test(t) : v === 'customs' ? /customs|clearance|cha\b/.test(t) : v === 'air' ? /\bair\b/.test(t) : t.includes(v.toLowerCase())));
};
const contactsOf = (s: string): AgentContact[] => list_(s.replace(/\|/g, '¦')).map((c, i) => {
  const [name = '', role = '', email = '', phone = '', whatsapp = ''] = c.split('¦').map((x) => x.trim());
  return { id: `ct-i${i}-${Math.random().toString(36).slice(2, 6)}`, name, role, email, phone, whatsapp };
}).filter((c) => c.name || c.email || c.phone);
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
    const credit = g('credit_limit').replace(/[^\d.]/g, '');
    const rating = Math.max(0, Math.min(5, Math.round(Number(g('rating')) || 0)));
    // service flags column wins; otherwise derive from free-text services
    const flags = g('service_flags') ? svcOf(g('service_flags')) : svcOf(g('services'));
    list.push({
      id: `db-c${i.toString(36)}-${Math.random().toString(36).slice(2, 5)}`, name: g('name'), type: normType(g('type')), country: g('country'), city: g('city'), ports: g('ports'), lanes: g('lanes'), services: g('services'),
      portal: g('portal'),
      website: g('website'), email: g('email'), phone: g('phone'), whatsapp: g('whatsapp'), sanctions: g('sanctions_note'), source: g('source') || (publicInfo ? 'Public info' : 'CSV import'), notes: g('notes'), publicInfo: publicInfo || undefined,
      status: normStatus(g('status')) ?? 'prospect', svc: flags, lanePairs: lanePairsOf(g('lane_pairs')), networks: list_(g('networks')), tags: list_(g('tags')),
      contacts: contactsOf(g('contacts')), paymentTerms: g('payment_terms'), creditLimit: credit ? Number(credit) : null, currency: g('currency').toUpperCase().slice(0, 3) || 'USD', rating,
      kyc: emptyKyc(), archived: /^(1|y|yes|true)$/i.test(g('archived')) || undefined,
    });
  });
  return { list, skipped };
}
const esc = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
export function agentsToCsv(list: DbAgent[]): string {
  return [CSV_COLS.join(','), ...list.map((a) => [
    a.name, a.type, statusOf(a), a.country, a.city, a.ports, (a.lanePairs ?? []).map((p) => `${p.from} > ${p.to}`).join('; '), a.lanes, (a.svc ?? []).join('; '), a.services,
    (a.networks ?? []).join('; '), (a.tags ?? []).join('; '), a.paymentTerms ?? '', a.creditLimit == null ? '' : String(a.creditLimit), a.currency ?? '', a.rating ? String(a.rating) : '',
    (a.contacts ?? []).map((c) => [c.name, c.role, c.email, c.phone, c.whatsapp].join(' | ')).join('; '),
    a.portal, a.website, a.email, a.phone, a.whatsapp, a.sanctions, a.source, a.notes, a.archived ? 'yes' : '',
  ].map((v) => esc(v ?? '')).join(','))].join('\n');
}
/** Merge an import into the list: same name (case-insensitive) updates the existing record, new names are added. */
export function mergeAgents(base: DbAgent[], rows: DbAgent[]): { list: DbAgent[]; added: number; updated: number } {
  const out = [...base];
  let added = 0, updated = 0;
  for (const r of rows) {
    const i = out.findIndex((x) => x.name.trim().toLowerCase() === r.name.trim().toLowerCase());
    if (i >= 0) {
      const cur = out[i];
      const keep = Object.fromEntries(Object.entries(r).filter(([k, v]) => k !== 'id' && v !== '' && v != null && !(Array.isArray(v) && !v.length) && !(k === 'kyc')));
      out[i] = { ...cur, ...keep, sample: undefined, updatedAt: Date.now() };
      updated++;
    } else { out.push({ ...r, createdAt: Date.now() }); added++; }
  }
  return { list: out, added, updated };
}

/** Researched public list: drop a CSV at src/agents/seed/agents.csv and rebuild — it becomes the seed (marked "public info, verify before use"). */
let SEED_CSV: string | null = null;
try {
  SEED_CSV = Object.values(import.meta.glob('./seed/*.csv', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)[0] ?? null;
} catch { /* not running under Vite (seed script reads the CSV itself) */ }
export const hasCsvSeed = !!SEED_CSV;
/** Seed = SAMPLE agents (with sample CRM data) + the researched public CSV (no CRM data invented). */
export function seedFrom(csv: string | null): DbAgent[] {
  const pub = csv ? csvToAgents(csv, true).list : [];
  return [...sampleDb(), ...pub];
}
function seedList(): { list: DbAgent[]; seed: 'sample' | 'csv'; v: 2 } {
  return { list: seedFrom(SEED_CSV), seed: SEED_CSV ? 'csv' : 'sample', v: 2 };
}

const KEY = 'fd.agentsdb.v1';
type State = { list: DbAgent[]; seed: 'sample' | 'csv' | 'user'; v?: number };
/** v1 → v2: keep the user's list, add the SAMPLE CRM agents that are missing, give everyone CRM defaults. */
function migrate(r: State): State {
  if (r.v === 2) return r;
  const samples = sampleDb().filter((s) => !r.list.some((x) => x.name.toLowerCase() === s.name.toLowerCase()));
  const old = r.list.map((a) => {
    const s = a.sample ? sampleDb().find((x) => x.name === a.name) : undefined;
    return s ? { ...s, ...a, ...Object.fromEntries(CRM_KEYS.filter((k) => (s as unknown as Record<string, unknown>)[k] !== undefined).map((k) => [k, (s as unknown as Record<string, unknown>)[k]])), id: a.id } : { ...a, status: a.status ?? 'prospect' as AgentStatus, svc: a.svc ?? svcOf(a.services ?? ''), kyc: a.kyc ?? emptyKyc() };
  });
  return { list: [...samples, ...old], seed: r.seed, v: 2 };
}
function load(): State {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (r && Array.isArray(r.list)) return migrate(r);
  } catch { /* ignore */ }
  return seedList();
}
let state: State = typeof localStorage === 'undefined' ? { list: [], seed: 'sample', v: 2 } : load();
const subs = new Set<() => void>();
function set(next: State, persist = true) {
  state = { ...next, v: 2 };
  if (persist && !bridge.w) try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* full */ }
  subs.forEach((f) => f());
}
export const useAgentsDb = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => state);
export const agentsDb = {
  get: () => state,
  upsert(a: DbAgent) {
    const now = Date.now();
    const rec: DbAgent = { ...a, createdAt: a.createdAt ?? now, updatedAt: now };
    bridge.w?.agentUpsert(rec);
    const i = state.list.findIndex((x) => x.id === a.id);
    set({ list: i >= 0 ? state.list.map((x) => (x.id === a.id ? rec : x)) : [rec, ...state.list], seed: 'user' });
  },
  patch(id: string, p: Partial<DbAgent>) {
    const a = state.list.find((x) => x.id === id);
    if (a) agentsDb.upsert({ ...a, ...p });
  },
  archive(id: string, archived: boolean) { agentsDb.patch(id, { archived: archived || undefined }); },
  /** Hard delete (only offered for archived agents). */
  remove(id: string) { bridge.w?.agentRemove(id); set({ list: state.list.filter((x) => x.id !== id), seed: 'user' }); },
  replace(list: DbAgent[], seed: 'sample' | 'csv' | 'user') { bridge.w?.agentReplace(list); set({ list, seed }); },
  reset() {
    if (bridge.w) { const s = seedList(); bridge.w.agentReplace(s.list); set(s, false); return; }
    localStorage.removeItem(KEY); set(seedList(), false);
  },
  /** Live mode: replace from Firestore snapshots (not persisted locally). */
  hydrate(list: DbAgent[]) { set({ list, seed: 'user' }, false); },
  /** Back to this browser's own copy (after sign-out). */
  reload() { set(load(), false); },
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
/** Names of sanctions-listed or blacklisted agents (kept out of quote options by default). */
export const listedNames = () => new Set(state.list.filter((a) => isListed(a) || a.status === 'blacklisted').map((a) => a.name.toLowerCase()));
/** Agents usable in pickers: not archived, not blacklisted, not sanctions-listed; preferred → active → prospect → on hold. */
export const pickable = (list: DbAgent[]) => list.filter((a) => !isHidden(a) && !isListed(a)).sort((a, b) => STATUS_ORDER[statusOf(a)] - STATUS_ORDER[statusOf(b)] || a.name.localeCompare(b.name));
