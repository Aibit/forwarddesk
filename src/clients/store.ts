import { useSyncExternalStore } from 'react';

export type CLang = 'en' | 'es' | 'fa';
export interface Person { name: string; phone: string }
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
  sample?: boolean;
}

const K = { clients: 'fd.clients.v1', company: 'fd.company.v1', quotes: 'fd.quotes.v1' };
const DAY = 86400000;

const P = (name: string, phone: string): Person => ({ name, phone });
export function sampleClients(): Client[] {
  const base = { sample: true, address: '', notes: '' };
  return [
    { ...base, id: 'c-a', name: 'Customer A', contactName: 'Sample contact A', phone: '+98 000 000 0001', email: 'customer-a@example.com', address: 'Tehran (sample)', clearanceAgent: P('Sample clearance agent 1', '+98 000 000 1001'), bandarAbbas: P('BA office · desk 1 (sample)', '+98 76 0000 0001'), lang: 'fa', incoterm: 'FOB', marginPct: 12, lines: ['Line A'], freeTimeRequest: 14, paymentTerms: 'Prepaid — B/L fee, THC, seals before original B/L', notes: 'Bitumen exporter. Heavy 20′ only. Always ask Line A first.' },
    { ...base, id: 'c-b', name: 'Customer B', contactName: 'Sample contact B', phone: '+98 000 000 0002', email: 'customer-b@example.com', address: 'Isfahan (sample)', clearanceAgent: P('Sample clearance agent 2', '+98 000 000 1002'), bandarAbbas: P('BA office · desk 2 (sample)', '+98 76 0000 0002'), lang: 'fa', incoterm: 'FOB', marginPct: 15, lines: ['Line B'], freeTimeRequest: 21, paymentTerms: 'Prepaid before original B/L', notes: 'Stone blocks (سنگ کوپ) to China. Heavy; ask for 21 days free time.' },
    { ...base, id: 'c-c', name: 'Customer C', contactName: 'Sample contact C', phone: '+98 000 000 0003', email: 'customer-c@example.com', address: 'Shiraz (sample)', clearanceAgent: P('Sample clearance agent 1', '+98 000 000 1001'), bandarAbbas: P('BA office · desk 1 (sample)', '+98 76 0000 0001'), lang: 'en', incoterm: 'FOB', marginPct: 15, lines: ['Line A', 'Line B', 'Line C'], freeTimeRequest: 14, paymentTerms: '50% on booking, 50% before B/L', notes: 'Bitumen to India. Compares several lines every time.' },
    { ...base, id: 'c-d', name: 'Customer D', contactName: 'Sample contact D', phone: '+98 000 000 0004', email: 'customer-d@example.com', address: 'Mashhad (sample)', clearanceAgent: P('Sample clearance agent 3', '+98 000 000 1003'), bandarAbbas: P('BA office · import desk (sample)', '+98 76 0000 0003'), lang: 'fa', incoterm: 'CFR', marginPct: 12, lines: [], freeTimeRequest: 14, paymentTerms: 'Collect freight at destination (I13)', notes: 'Rice importer. Collect freight + 2–3% handling.' },
    { ...base, id: 'c-e', name: 'Customer E', contactName: 'Sample contact E', phone: '+98 000 000 0005', email: 'customer-e@example.com', address: 'Tabriz (sample)', clearanceAgent: P('Sample clearance agent 2', '+98 000 000 1002'), bandarAbbas: P('BA office · import desk (sample)', '+98 76 0000 0003'), lang: 'en', incoterm: 'CFR', marginPct: 15, lines: [], freeTimeRequest: 10, paymentTerms: 'Prepaid', notes: 'Machinery spare parts from China.' },
    { ...base, id: 'c-f', name: 'Customer F', contactName: 'Sample contact F', phone: '+98 000 000 0006', email: 'customer-f@example.com', address: 'Tehran (sample)', clearanceAgent: P('Sample clearance agent 3', '+98 000 000 1003'), bandarAbbas: P('BA office · import desk (sample)', '+98 76 0000 0003'), lang: 'es', incoterm: 'CIF', marginPct: 18, lines: [], freeTimeRequest: 14, paymentTerms: '7 days after invoice', notes: 'European supplier side speaks Spanish. Spare parts ex Hamburg.' },
    { ...base, id: 'c-g', name: 'Customer G', contactName: 'Sample contact G', phone: '+98 000 000 0007', email: 'customer-g@example.com', address: 'Yazd (sample)', clearanceAgent: P('Sample clearance agent 1', '+98 000 000 1001'), bandarAbbas: P('BA office · import desk (sample)', '+98 76 0000 0003'), lang: 'fa', incoterm: 'CFR', marginPct: 14, lines: [], freeTimeRequest: 21, paymentTerms: 'Prepaid', notes: 'Ceramic tiles. Watch the 40–60 day document-delay case.' },
  ].map((c) => ({ ...c, jobName: c.name }) as Client);
}
function sampleQuotes(now = Date.now()): QuoteRecord[] {
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

interface State { clients: Client[]; company: Company; quotes: QuoteRecord[] }
let state: State = {
  clients: load(K.clients, sampleClients),
  company: { ...EMPTY_COMPANY, ...load<Partial<Company>>(K.company, () => ({})) },
  quotes: load(K.quotes, () => sampleQuotes()),
};
const subs = new Set<() => void>();
function set(next: Partial<State>) {
  state = { ...state, ...next };
  if (next.clients) save(K.clients, state.clients);
  if (next.company) save(K.company, state.company);
  if (next.quotes) save(K.quotes, state.quotes);
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
  upsertClient(c: Client) {
    const exists = state.clients.some((x) => x.id === c.id);
    set({ clients: exists ? state.clients.map((x) => (x.id === c.id ? c : x)) : [...state.clients, c] });
  },
  removeClient(id: string) {
    set({ clients: state.clients.filter((c) => c.id !== id) });
  },
  setCompany(c: Company) {
    set({ company: c });
  },
  recordQuote(q: Omit<QuoteRecord, 'status' | 'via'> & { via: 'copy' | 'pdf' }) {
    const prev = state.quotes.find((x) => x.id === q.id);
    const rec: QuoteRecord = { ...q, status: prev?.status ?? 'sent', via: [...new Set([...(prev?.via ?? []), q.via])] };
    set({ quotes: prev ? state.quotes.map((x) => (x.id === q.id ? rec : x)) : [rec, ...state.quotes] });
  },
  setQuoteStatus(id: string, status: QuoteStatus) {
    set({ quotes: state.quotes.map((q) => (q.id === id ? { ...q, status } : q)) });
  },
  resetSample() {
    set({ clients: sampleClients(), quotes: sampleQuotes() });
  },
};

export const newClient = (): Client => ({
  id: `c-${Date.now().toString(36)}`, name: '', contactName: '', phone: '', email: '', address: '',
  clearanceAgent: P('', ''), bandarAbbas: P('', ''), lang: 'en', incoterm: 'FOB', marginPct: 15, lines: [], freeTimeRequest: 14, paymentTerms: '', notes: '',
});

export const clientForJob = (clients: Client[], customer: string) => clients.find((c) => (c.jobName ?? c.name) === customer || c.name === customer) ?? null;

/** Does a rate-sheet carrier ("Sample Line A") match one of the client's lines ("Line A")? */
export const lineMatches = (carrier: string | null, lines: string[]) =>
  !lines.length || (carrier != null && lines.some((l) => l.trim() && carrier.toLowerCase().replace(/\s*\(sample\)/, '').endsWith(l.trim().toLowerCase())));
