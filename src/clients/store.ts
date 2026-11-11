import { useSyncExternalStore } from 'react';
import { sampleLanes, type LaneProfile } from './lanes';
import { listedNames } from '../agents/db';
import { bridge, type QuoteCosts } from '../backend/bridge';

export type CLang = 'en' | 'es' | 'fa' | 'ar';
export interface Person { name: string; phone: string }
export type AgentType = 'overseas' | 'line' | 'clearance';
export type AgentRank = 'preferred' | 'allowed' | 'avoid';
/** A partner the client prefers to work with (overseas agent I2/I4–I8, shipping line, clearance agent). */
export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  /** Ports / lanes covered, comma separated (e.g. "Nhava Sheva, Mundra"). */
  ports: string;
  contactName: string;
  phone: string;
  email: string;
  whatsapp: string;
  rank: AgentRank;
  notes: string;
  /** picked from the Agents database */
  dbId?: string;
}
export interface Client {
  id: string;
  name: string;
  /** Name used on job records (sample jobs say "Customer A"…). Defaults to name. */
  jobName?: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  /** E1/E10: the cargo owner's own customs clearance agent (ترخیص‌کار). */
  clearanceAgent: Person;
  /** E10/E11: who receives papers at the Bandar Abbas office. */
  bandarAbbas: Person;
  lang: CLang;
  incoterm: string;
  marginPct: number;
  /** Preferred / allowed shipping lines, e.g. "Line A". Empty = any. */
  lines: string[];
  freeTimeRequest: 10 | 14 | 21 | null;
  paymentTerms: string;
  notes: string;
  /** Preferred agents / partners, managed by us or by the client in the portal. */
  agents: Agent[];
  /** Lane / cargo profiles: POL, POD, commodity, HS, volume, payment, target rate. */
  lanes: LaneProfile[];
  sample?: boolean;
}
export interface Company {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  logo: string | null; // PNG data URL
  logoW?: number;
  logoH?: number;
}
export type QuoteStatus = 'sent' | 'won' | 'lost';
export interface QuoteRecord {
  id: string;
  clientId: string | null;
  at: number;
  route: string;
  mode: string;
  units: string;
  options: { carrier: string; sell: number; transit: number | null }[];
  currency: string;
  status: QuoteStatus;
  via: ('copy' | 'pdf')[];
  /** Option the customer accepted (portal), if any. */
  acceptedOption?: string;
  acceptedVia?: 'portal' | 'desk';
  /** When the option was accepted (ms). */
  acceptedAt?: number;
  sample?: boolean;
}

const K = { clients: 'fd.clients.v1', company: 'fd.company.v1', quotes: 'fd.quotes.v1', costs: 'fd.quoteCosts.v1' };
const DAY = 86400000;

const P = (name: string, phone: string): Person => ({ name, phone });
/** Older saved clients (before agents) get the sample agents (sample clients) or their old line list. */
function migrate(cs: Client[]): Client[] {
  return cs.map((c) => (Array.isArray(c.lanes) ? c : { ...c, lanes: c.sample ? sampleLanes(c.id) : [] })).map((c) =>
    Array.isArray(c.agents)
      ? c
      : { ...c, agents: c.sample ? sampleAgents(c.id) : (c.lines ?? []).map((l, i) => ({ id: `a-m${i}`, name: l, type: 'line' as const, ports: '', contactName: '', phone: '', email: '', whatsapp: '', rank: 'preferred' as const, notes: '' })) },
  );
}
export function sampleClients(): Client[] {
  const base = { sample: true, address: '', notes: '' };
  return [
    { ...base, id: 'c-a', name: 'Customer A', contactName: 'Sample contact A', phone: '+98 000 000 0001', email: 'customer-a@example.com', address: 'Tehran (sample)', clearanceAgent: P('Sample clearance agent 1', '+98 000 000 1001'), bandarAbbas: P('BA office · desk 1 (sample)', '+98 76 0000 0001'), lang: 'fa', incoterm: 'FOB', marginPct: 12, lines: ['Line A'], freeTimeRequest: 14, paymentTerms: 'Prepaid — B/L fee, THC, seals before original B/L', notes: 'Bitumen exporter. Heavy 20′ only. Always ask Line A first.' },
    { ...base, id: 'c-b', name: 'Customer B', contactName: 'Sample contact B', phone: '+98 000 000 0002', email: 'customer-b@example.com', address: 'Isfahan (sample)', clearanceAgent: P('Sample clearance agent 2', '+98 000 000 1002'), bandarAbbas: P('BA office · desk 2 (sample)', '+98 76 0000 0002'), lang: 'fa', incoterm: 'FOB', marginPct: 15, lines: ['Line B'], freeTimeRequest: 21, paymentTerms: 'Prepaid before original B/L', notes: 'Stone blocks (سنگ کوپ) to China. Heavy; ask for 21 days free time.' },
    { ...base, id: 'c-c', name: 'Customer C', contactName: 'Sample contact C', phone: '+98 000 000 0003', email: 'customer-c@example.com', address: 'Shiraz (sample)', clearanceAgent: P('Sample clearance agent 1', '+98 000 000 1001'), bandarAbbas: P('BA office · desk 1 (sample)', '+98 76 0000 0001'), lang: 'en', incoterm: 'FOB', marginPct: 15, lines: ['Line A', 'Line B', 'Line C'], freeTimeRequest: 14, paymentTerms: '50% on booking, 50% before B/L', notes: 'Bitumen to India. Compares several lines every time.' },
    { ...base, id: 'c-d', name: 'Customer D', contactName: 'Sample contact D', phone: '+98 000 000 0004', email: 'customer-d@example.com', address: 'Mashhad (sample)', clearanceAgent: P('Sample clearance agent 3', '+98 000 000 1003'), bandarAbbas: P('BA office · import desk (sample)', '+98 76 0000 0003'), lang: 'fa', incoterm: 'FOB', marginPct: 12, lines: [], freeTimeRequest: 14, paymentTerms: 'Collect freight at destination (I13)', notes: 'Rice importer. Collect freight + 2–3% handling.' },
    { ...base, id: 'c-e', name: 'Customer E', contactName: 'Sample contact E', phone: '+98 000 000 0005', email: 'customer-e@example.com', address: 'Tabriz (sample)', clearanceAgent: P('Sample clearance agent 2', '+98 000 000 1002'), bandarAbbas: P('BA office · import desk (sample)', '+98 76 0000 0003'), lang: 'en', incoterm: 'FOB', marginPct: 15, lines: [], freeTimeRequest: 10, paymentTerms: 'Prepaid', notes: 'Machinery spare parts from China.' },
    { ...base, id: 'c-f', name: 'Customer F', contactName: 'Sample contact F', phone: '+98 000 000 0006', email: 'customer-f@example.com', address: 'Tehran (sample)', clearanceAgent: P('Sample clearance agent 3', '+98 000 000 1003'), bandarAbbas: P('BA office · import desk (sample)', '+98 76 0000 0003'), lang: 'es', incoterm: 'CIF', marginPct: 18, lines: [], freeTimeRequest: 14, paymentTerms: '7 days after invoice', notes: 'European supplier side speaks Spanish. Spare parts ex Hamburg.' },
    { ...base, id: 'c-g', name: 'Customer G', contactName: 'Sample contact G', phone: '+98 000 000 0007', email: 'customer-g@example.com', address: 'Yazd (sample)', clearanceAgent: P('Sample clearance agent 1', '+98 000 000 1001'), bandarAbbas: P('BA office · import desk (sample)', '+98 76 0000 0003'), lang: 'fa', incoterm: 'FOB', marginPct: 14, lines: [], freeTimeRequest: 21, paymentTerms: 'Prepaid', notes: 'Ceramic tiles. Watch the 40–60 day document-delay case.' },
  ].map((c) => ({ ...c, jobName: c.name, agents: sampleAgents(c.id), lanes: sampleLanes(c.id) }) as Client);
}

let aid = 0;
const A = (name: string, type: AgentType, ports: string, rank: AgentRank, notes = '', contactName = 'Sample contact'): Agent => ({
  id: `a-${(aid++).toString(36)}`, name, type, ports, contactName, phone: '+00 000 000 0000', email: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')}@example.com`, whatsapp: '+00 000 000 0000', rank, notes,
});
export function sampleAgents(clientId: string): Agent[] {
  const clearance = (n: string) => A(`Sample clearance agent ${n}`, 'clearance', 'Bandar Abbas (Shahid Rajaee)', 'preferred', 'Collects release order + seals (E12), files the export declaration (E15).');
  switch (clientId) {
    case 'c-a': return [A('Line A', 'line', 'Bandar Abbas → Jebel Ali, Nhava Sheva', 'preferred', 'Heavy 20′ OK'), A('Line C', 'line', 'Bandar Abbas → Nhava Sheva', 'avoid', 'Late release orders last year'), A('Sample agent Jebel Ali', 'overseas', 'Jebel Ali', 'preferred'), clearance('1')];
    case 'c-b': return [A('Line B', 'line', 'Bandar Abbas → Shanghai', 'preferred', 'Gives 21 days free time on stone'), A('Line A', 'line', 'Bandar Abbas → Shanghai', 'allowed'), A('Sample agent Shanghai', 'overseas', 'Shanghai (Yangshan), Shanghai (Waigaoqiao)', 'preferred', 'Draft B/L rounds go through them (E19)'), clearance('2')];
    case 'c-c': return [A('Line B', 'line', 'Bandar Abbas → Nhava Sheva', 'preferred'), A('Line A', 'line', 'Bandar Abbas → Nhava Sheva', 'allowed'), A('Line C', 'line', 'Bandar Abbas → Nhava Sheva', 'allowed'), A('Sample agent Nhava Sheva', 'overseas', 'Nhava Sheva, Mundra', 'preferred'), A('Sample agent Mundra B', 'overseas', 'Mundra', 'allowed'), clearance('1')];
    case 'c-d': return [A('Sample agent Nhava Sheva', 'overseas', 'Nhava Sheva', 'preferred', 'Origin agent for rice (I2, I4–I8)'), A('Line A', 'line', 'Nhava Sheva → Bandar Abbas', 'preferred'), clearance('3')];
    case 'c-e': return [A('Sample agent Shanghai', 'overseas', 'Shanghai (Yangshan), Ningbo', 'preferred'), A('Sample agent Ningbo B', 'overseas', 'Ningbo', 'avoid', 'Slow on documents'), A('Line B', 'line', 'Shanghai → Bandar Abbas', 'preferred'), clearance('2')];
    case 'c-f': return [A('Sample agent Hamburg', 'overseas', 'Hamburg, Bremerhaven', 'preferred', 'Speaks Spanish with the supplier'), A('Line D', 'line', 'Hamburg → Bandar Abbas', 'allowed'), clearance('3')];
    case 'c-g': return [A('Sample agent Shanghai', 'overseas', 'Shanghai (Yangshan)', 'preferred'), A('Line A', 'line', 'Shanghai → Bandar Abbas', 'allowed'), clearance('1')];
    default: return [];
  }
}
export function sampleQuotes(now = Date.now()): QuoteRecord[] {
  return [
    { id: 'FD-Q-SAMPLE-101', clientId: 'c-c', at: now - 2 * DAY, route: 'Bandar Abbas → Nhava Sheva', mode: 'Ocean FCL', units: '2×20GP', options: [{ carrier: 'Sample Line B', sell: 2047, transit: 8 }, { carrier: 'Sample Line A', sell: 2388, transit: 5 }, { carrier: 'Sample Line C', sell: 2399, transit: 4 }], currency: 'USD', status: 'sent', via: ['pdf'], sample: true },
    { id: 'FD-Q-SAMPLE-094', clientId: 'c-a', at: now - 12 * DAY, route: 'Bandar Abbas → Jebel Ali', mode: 'Ocean FCL', units: '2×20GP', options: [{ carrier: 'Sample Line A', sell: 1180, transit: 2 }], currency: 'USD', status: 'won', via: ['copy'], sample: true },
    { id: 'FD-Q-SAMPLE-088', clientId: 'c-b', at: now - 20 * DAY, route: 'Bandar Abbas → Shanghai', mode: 'Ocean FCL', units: '3×20GP', options: [{ carrier: 'Sample Line B', sell: 4950, transit: 24 }], currency: 'USD', status: 'won', via: ['pdf'], sample: true },
    { id: 'FD-Q-SAMPLE-097', clientId: 'c-b', at: now - 6 * DAY, route: 'Bandar Abbas → Shanghai', mode: 'Ocean FCL', units: '2×20GP', options: [{ carrier: 'Sample Line B', sell: 3300, transit: 24 }, { carrier: 'Sample Line A', sell: 3420, transit: 22 }], currency: 'USD', status: 'lost', via: ['copy'], sample: true },
    { id: 'FD-Q-SAMPLE-099', clientId: 'c-e', at: now - 4 * DAY, route: 'Shanghai → Bandar Abbas', mode: 'Ocean FCL', units: '1×40HC', options: [{ carrier: 'Sample Line A', sell: 2650, transit: 21 }], currency: 'USD', status: 'sent', via: ['pdf'], sample: true },
  ];
}
export const EMPTY_COMPANY: Company = { name: '', contactName: '', email: '', phone: '', address: '', logo: null };

function load<T>(key: string, fallback: () => T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch { /* ignore */ }
  return fallback();
}
function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch (e) {
    console.warn('Could not save to this browser', e);
  }
}

/** costs: buy side per quote id (staff only — demo: this browser; live: read on demand from quotes/{id}/private/costs). */
interface State { clients: Client[]; company: Company; quotes: QuoteRecord[]; costs: Record<string, QuoteCosts | null> }
let state: State = {
  clients: migrate(load(K.clients, sampleClients)),
  company: { ...EMPTY_COMPANY, ...load<Partial<Company>>(K.company, () => ({})) },
  quotes: load(K.quotes, () => sampleQuotes()),
  costs: load<Record<string, QuoteCosts | null>>(K.costs, () => ({})),
};
const subs = new Set<() => void>();
function set(next: Partial<State>) {
  state = { ...state, ...next };
  if (bridge.w) { subs.forEach((f) => f()); return; }
  if (next.clients) save(K.clients, state.clients);
  if (next.company) save(K.company, state.company);
  if (next.quotes) save(K.quotes, state.quotes);
  if (next.costs) save(K.costs, state.costs);
  subs.forEach((f) => f());
}
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};
export function useStore(): State {
  return useSyncExternalStore(subscribe, () => state);
}
export const getStore = () => state;

export const store = {
  /** Live mode: replace state from Firestore snapshots (never written to localStorage). */
  hydrate(next: Partial<State>) {
    set(next);
  },
  /** Back to this browser's own demo copy (after sign-out). */
  reload() {
    state = {
      clients: migrate(load(K.clients, sampleClients)),
      company: { ...EMPTY_COMPANY, ...load<Partial<Company>>(K.company, () => ({})) },
      quotes: load(K.quotes, () => sampleQuotes()),
      costs: load<Record<string, QuoteCosts | null>>(K.costs, () => ({})),
    };
    subs.forEach((f) => f());
  },
  upsertClient(c: Client) {
    bridge.w?.upsertClient(c);
    const exists = state.clients.some((x) => x.id === c.id);
    set({ clients: exists ? state.clients.map((x) => (x.id === c.id ? c : x)) : [...state.clients, c] });
  },
  removeClient(id: string) {
    bridge.w?.removeClient(id);
    set({ clients: state.clients.filter((c) => c.id !== id) });
  },
  setAgents(clientId: string, agents: Agent[]) {
    bridge.w?.setAgents(clientId, agents);
    set({ clients: state.clients.map((c) => (c.id === clientId ? { ...c, agents } : c)) });
  },
  setLanes(clientId: string, lanes: LaneProfile[]) {
    bridge.w?.setLanes(clientId, lanes, state.clients.find((c) => c.id === clientId)?.lanes ?? []);
    set({ clients: state.clients.map((c) => (c.id === clientId ? { ...c, lanes } : c)) });
  },
  setCompany(c: Company) {
    bridge.w?.setCompany(c);
    set({ company: c });
  },
  recordQuote(q: Omit<QuoteRecord, 'status' | 'via'> & { via: 'copy' | 'pdf' }, costs?: QuoteCosts) {
    const prev = state.quotes.find((x) => x.id === q.id);
    const rec: QuoteRecord = { ...q, status: prev?.status ?? 'sent', via: [...new Set([...(prev?.via ?? []), q.via])] };
    bridge.w?.recordQuote(rec, costs);
    set({ quotes: prev ? state.quotes.map((x) => (x.id === q.id ? rec : x)) : [rec, ...state.quotes], ...(costs ? { costs: { ...state.costs, [q.id]: costs } } : {}) });
  },
  /** Staff: make sure the buy side of these quotes is loaded (live mode reads the staff-only sub-document once). */
  async loadCosts(ids: string[]) {
    const w = bridge.w;
    if (!w || w.role !== 'staff' || !w.loadQuoteCosts) return;
    const missing = ids.filter((id) => !(id in state.costs));
    if (!missing.length) return;
    const got = await Promise.all(missing.map((id) => w.loadQuoteCosts!(id).catch(() => null)));
    set({ costs: { ...state.costs, ...Object.fromEntries(missing.map((id, i) => [id, got[i]])) } });
  },
  setQuoteStatus(id: string, status: QuoteStatus, acceptedOption?: string, acceptedVia: 'portal' | 'desk' = 'desk') {
    bridge.w?.setQuoteStatus(id, status, acceptedOption, acceptedVia);
    set({ quotes: state.quotes.map((q) => (q.id === id ? { ...q, status, acceptedOption: status === 'won' ? acceptedOption ?? q.acceptedOption : undefined, acceptedVia: status === 'won' ? acceptedVia : undefined } : q)) });
  },
  resetSample() {
    if (bridge.w) return;
    set({ clients: sampleClients(), quotes: sampleQuotes() });
  },
};

export const newClient = (): Client => ({
  id: `c-${Date.now().toString(36)}`, name: '', contactName: '', phone: '', email: '', address: '',
  clearanceAgent: P('', ''), bandarAbbas: P('', ''), lang: 'en', incoterm: 'FOB', marginPct: 15, lines: [], freeTimeRequest: 14, paymentTerms: '', notes: '', agents: [], lanes: [],
});
export const newAgent = (type: AgentType = 'overseas'): Agent => ({ id: `a-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, name: '', type, ports: '', contactName: '', phone: '', email: '', whatsapp: '', rank: 'preferred', notes: '' });

const norm = (s: string) => s.toLowerCase().replace(/\s*\(sample\)/g, '').replace(/^sample\s+/, '').trim();
/** Rank of a rate-sheet carrier ("Sample Line A") in the client's list of line agents, or null. */
export function lineRank(c: Client | null, carrier: string | null): AgentRank | null {
  if (!carrier) return null;
  if (listedNames().has(carrier.trim().toLowerCase())) return 'avoid';
  if (!c) return null;
  const a = c.agents.find((x) => x.type === 'line' && x.name.trim() && norm(carrier).endsWith(norm(x.name)));
  return a?.rank ?? null;
}
const portHit = (ports: string, port: string | null) => {
  if (!port) return false;
  const p = norm(port);
  const base = p.replace(/\s*\(.*\)$/, '');
  return ports.split(',').map((x) => norm(x)).some((x) => x && (x === p || x.replace(/\s*\(.*\)$/, '') === base || p.includes(x)));
};
/** Best overseas agent from the client's list for a port (preferred > allowed, never avoid). */
export function agentForPort(c: Client | null, port: string | null): Agent | null {
  if (!c) return null;
  const hits = c.agents.filter((a) => a.type === 'overseas' && a.rank !== 'avoid' && portHit(a.ports, port));
  return hits.sort((a, b) => (a.rank === b.rank ? 0 : a.rank === 'preferred' ? -1 : 1))[0] ?? null;
}

export const clientForJob = (clients: Client[], customer: string) => clients.find((c) => (c.jobName ?? c.name) === customer || c.name === customer) ?? null;

/** Does a rate-sheet carrier ("Sample Line A") match one of the client's lines ("Line A")? */
export const lineMatches = (carrier: string | null, lines: string[]) =>
  !lines.length || (carrier != null && lines.some((l) => l.trim() && carrier.toLowerCase().replace(/\s*\(sample\)/, '').endsWith(l.trim().toLowerCase())));
