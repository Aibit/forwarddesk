// Documents + billing data model (per job). Pure functions only — no React, no storage.
import type { Job } from '../jobs/data';
import { chargeAmount, CHARGE_LABEL } from '../jobs/logic';
import type { Tariffs } from '../jobs/tariffs';
import { stepIndex } from '../jobs/steps';

export const DAY = 86400000;
export type Terms = 'prepaid' | 'collect';

/** One charge row on the job: sell side (bill-to) and/or buy side (vendor), like a cost/revenue sheet. */
export interface Line {
  id: string;
  code: string;
  desc: string;
  qty: number;
  currency: string;
  /** Sell price per unit (to the payer). null = no revenue on this row. */
  sell: number | null;
  /** Buy cost per unit (from the vendor). null = no cost on this row. */
  buy: number | null;
  payer: string;
  vendor: string;
  terms: Terms;
  invoiceId?: string | null;
  billId?: string | null;
}
export type InvKind = 'invoice' | 'bill';
export interface Invoice {
  id: string;
  no: string;
  kind: InvKind;
  party: string;
  currency: string;
  lineIds: string[];
  issuedAt: number;
  dueDays: number;
  status: 'draft' | 'issued' | 'void';
  /** Vendor's own invoice number (bills). */
  ref?: string;
}
export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  at: number;
  method: string;
  ref: string;
}
export interface FileMeta {
  id: string;
  name: string;
  size: number;
  type: string;
  at: number;
  /** Inline data (demo mode only, localStorage). */
  data?: string;
}
export interface Ledger {
  jobId: string;
  clientId: string | null;
  customer: string;
  base: string;
  /** Manual FX: units of base currency per 1 unit of the key currency. Never fetched, never guessed. */
  fx: Record<string, number | null>;
  lines: Line[];
  invoices: Invoice[];
  payments: Payment[];
  files: FileMeta[];
  /** True once the job's legacy local charges / collect freight were moved onto invoice lines (single source of truth). */
  localMigrated?: boolean;
  /** Computed on save; Firestore rules read it to allow releasing the House B/L. */
  releaseOk?: boolean;
  clientOpen?: number;
  updatedAt?: number;
  sample?: boolean;
}

export type DocKind = 'hbl' | 'an' | 'do' | 'bc';
export type DocState = 'draft' | 'issued' | 'released';
export interface BlFields {
  shipper: string;
  consignee: string;
  notify: string;
  marks: string;
  packages: string;
  grossKg: string;
  cbm: string;
  freight: Terms;
  place: string;
}
export interface JobDoc {
  id: string; // `${jobId}-${kind}`
  jobId: string;
  clientId: string | null;
  kind: DocKind;
  no: string;
  status: DocState;
  fields: BlFields;
  issuedAt?: number | null;
  releasedAt?: number | null;
  updatedAt?: number;
}

export const CURRENCIES = ['USD', 'EUR', 'AED', 'CNY', 'INR', 'IRR'];

export interface ChargeCode { code: string; name: [string, string, string]; side: 'both' | 'sell' | 'buy' }
export const DEFAULT_CATALOG: ChargeCode[] = [
  { code: 'OFR', name: ['Ocean freight', 'Flete marítimo', 'کرایه حمل دریایی'], side: 'both' },
  { code: 'THC-O', name: ['Origin THC', 'THC origen', 'THC مبدأ'], side: 'both' },
  { code: 'THC-D', name: ['Destination THC', 'THC destino', 'THC مقصد'], side: 'both' },
  { code: 'BL', name: ['B/L fee', 'Tasa B/L', 'هزینه بارنامه'], side: 'both' },
  { code: 'DO', name: ['Delivery order fee', 'Tasa orden de entrega', 'هزینه ترخیصیه (دی‌او)'], side: 'both' },
  { code: 'SEAL', name: ['Seal', 'Precinto', 'پلمپ'], side: 'both' },
  { code: 'CUS', name: ['Customs clearance', 'Despacho de aduanas', 'ترخیص گمرکی'], side: 'both' },
  { code: 'HAUL', name: ['Trucking / haulage', 'Transporte terrestre', 'حمل جاده‌ای'], side: 'both' },
  { code: 'DEM', name: ['Demurrage', 'Demora', 'حق توقف (دموراژ)'], side: 'both' },
  { code: 'DET', name: ['Detention', 'Detención', 'دیتنشن'], side: 'both' },
  { code: 'STOR', name: ['Storage', 'Almacenaje', 'انبارداری'], side: 'both' },
  { code: 'INS', name: ['Cargo insurance', 'Seguro de carga', 'بیمه بار'], side: 'both' },
  { code: 'HAND', name: ['Handling fee', 'Gastos de gestión', 'هزینه خدمات'], side: 'sell' },
  { code: 'AGT', name: ['Agent fee', 'Comisión de agente', 'کارمزد نماینده'], side: 'buy' },
];

export const emptyLedger = (job: Pick<Job, 'id' | 'clientId' | 'customer' | 'sample'>): Ledger => ({
  jobId: job.id, clientId: job.clientId ?? null, customer: job.customer, base: 'USD', fx: {}, lines: [], invoices: [], payments: [], files: [], localMigrated: true,
});

export const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Base-currency value, or null when the FX rate has not been entered. */
export function toBase(l: Ledger, amount: number, ccy: string): number | null {
  if (ccy === l.base) return amount;
  const r = l.fx[ccy];
  return r != null && r > 0 ? amount * r : null;
}
export const lineSell = (x: Line) => (x.sell ?? 0) * x.qty;
export const lineBuy = (x: Line) => (x.buy ?? 0) * x.qty;

export function invTotal(l: Ledger, inv: Invoice): number {
  return round2(l.lines.filter((x) => inv.lineIds.includes(x.id)).reduce((s, x) => s + (inv.kind === 'invoice' ? lineSell(x) : lineBuy(x)), 0));
}
export const invPaid = (l: Ledger, inv: Invoice) => round2(l.payments.filter((p) => p.invoiceId === inv.id).reduce((s, p) => s + p.amount, 0));
export const invOpen = (l: Ledger, inv: Invoice) => (inv.status === 'void' ? 0 : Math.max(0, round2(invTotal(l, inv) - invPaid(l, inv))));
export const invDue = (inv: Invoice) => inv.issuedAt + inv.dueDays * DAY;
/** Overdue once the due date has passed; 'due on receipt' (0 days) gets the rest of that day. */
export const isOverdue = (inv: Invoice, now: number) => now > invDue(inv) + (inv.dueDays === 0 ? DAY : 0);
export function invState(l: Ledger, inv: Invoice, now: number): 'draft' | 'void' | 'paid' | 'partial' | 'overdue' | 'open' {
  if (inv.status === 'void' || inv.status === 'draft') return inv.status;
  const open = invOpen(l, inv);
  if (open <= 0.005) return 'paid';
  if (isOverdue(inv, now)) return 'overdue';
  return invPaid(l, inv) > 0 ? 'partial' : 'open';
}

/** Charge code used when a legacy job charge becomes an invoice line. */
const LEGACY_CODE: Record<Job['charges'][number]['key'], (job: Job) => string> = {
  bl: () => 'BL', thc: (j) => (j.dir === 'export' ? 'THC-O' : 'THC-D'), seal: () => 'SEAL', extras: () => 'HAND', demurrage: () => 'DEM', do: () => 'DO',
};

/**
 * One-time move of a job's legacy local charges (B/L fee, THC, seal, DO fee, demurrage…) and collect freight
 * onto ledger lines + client invoices, so the ledger is the only place an unpaid amount lives.
 * Paid charges land on a paid invoice, unpaid ones on an open invoice due now (they block the B/L / DO).
 */
export function migrateLegacy(job: Job, base: Ledger | undefined, t: Tariffs, now: number, takenNos: string[]): Ledger | null {
  const l0 = base ?? emptyLedger(job);
  if (base?.localMigrated) return null;
  const legacyPaid = (base as (Ledger & { localPaid?: Record<string, boolean> }) | undefined)?.localPaid ?? {};
  const rows = job.charges
    .map((c) => ({ c, amount: chargeAmount(job, c, t, now), paid: c.paid || !!legacyPaid[c.key] }))
    .filter((x) => x.amount > 0);
  const lines: Line[] = rows.map(({ c, amount }) => ({
    id: `loc-${c.key}`, code: LEGACY_CODE[c.key](job), desc: CHARGE_LABEL[c.key][0] + (c.key === 'demurrage' ? ' — tariff estimate, line confirms' : ''),
    qty: 1, currency: 'USD', sell: amount, buy: amount, payer: job.customer, vendor: job.line, terms: 'prepaid' as Terms,
  }));
  const paidIds = rows.filter((x) => x.paid).map((x) => `loc-${x.c.key}`);
  const openIds = rows.filter((x) => !x.paid).map((x) => `loc-${x.c.key}`);
  if (job.collect) {
    lines.push({ id: 'loc-collect', code: 'OFR', desc: 'Ocean freight, collect (I13)', qty: 1, currency: 'USD', sell: job.collect.amount, buy: job.collect.amount, payer: job.customer, vendor: job.line, terms: 'collect' });
    (job.collect.collected ? paidIds : openIds).push('loc-collect');
  }
  if (!lines.length) return { ...l0, localMigrated: true };
  // Local charges are invoiced once known: export from the draft B/L (E19), import from the arrival notice (I10).
  // Earlier, the unpaid ones wait on a DRAFT invoice (not counted as unpaid, but it still holds the release).
  const chargesDue = stepIndex(job.step) >= (job.dir === 'export' ? 19 : 10);
  const nos = [...takenNos];
  const invoices: Invoice[] = [];
  const payments: Payment[] = [];
  const mk = (ids: string[], paid: boolean) => {
    if (!ids.length) return;
    const no = nextNo('INV', nos);
    nos.push(no);
    const id = `inv-loc-${job.id}-${paid ? 'p' : 'o'}`;
    const inv: Invoice = { id, no, kind: 'invoice', party: job.customer, currency: 'USD', lineIds: ids, issuedAt: now, dueDays: 0, status: paid || chargesDue ? 'issued' : 'draft' };
    invoices.push(inv);
    for (const x of lines) if (ids.includes(x.id)) x.invoiceId = id;
    if (paid) payments.push({ id: `pay-loc-${job.id}`, invoiceId: id, amount: round2(lines.filter((x) => ids.includes(x.id)).reduce((s, x) => s + lineSell(x), 0)), at: now, method: 'Recorded before invoicing', ref: '' });
  };
  mk(paidIds, true);
  mk(openIds, false);
  return { ...l0, lines: [...l0.lines, ...lines], invoices: [...l0.invoices, ...invoices], payments: [...l0.payments, ...payments], localMigrated: true };
}

/** What a client owes on one job: issued client invoices with an open balance. The ONLY unpaid figure in the app. */
export interface JobBalance {
  jobId: string;
  clientId: string | null;
  customer: string;
  currency: string;
  /** Open amount in `currency` (base); amounts with no FX rate are in `missing`, never guessed. */
  open: number;
  missing: Record<string, number>;
  invoices: { no: string; currency: string; total: number; open: number; due: number; overdue: boolean }[];
  releaseOk?: boolean;
  updatedAt?: number;
}
export function balanceOf(l: Ledger, now: number): JobBalance {
  const missing: Record<string, number> = {};
  let open = 0;
  const invoices: JobBalance['invoices'] = [];
  for (const inv of l.invoices) {
    if (inv.kind !== 'invoice' || inv.status !== 'issued') continue;
    const o = invOpen(l, inv);
    if (o <= 0.005) continue;
    invoices.push({ no: inv.no, currency: inv.currency, total: invTotal(l, inv), open: o, due: invDue(inv), overdue: isOverdue(inv, now) });
    const v = toBase(l, o, inv.currency);
    if (v == null) missing[inv.currency] = round2((missing[inv.currency] ?? 0) + o);
    else open += v;
  }
  return { jobId: l.jobId, clientId: l.clientId, customer: l.customer, currency: l.base, open: round2(open), missing, invoices };
}
export const zeroBalance = (job: Pick<Job, 'id' | 'clientId' | 'customer'>): JobBalance => ({ jobId: job.id, clientId: job.clientId ?? null, customer: job.customer, currency: 'USD', open: 0, missing: {}, invoices: [] });
export function sumBalances(bs: JobBalance[]): { open: number; missing: Record<string, number> } {
  const missing: Record<string, number> = {};
  let open = 0;
  for (const b of bs) {
    open += b.open;
    for (const [c, v] of Object.entries(b.missing)) missing[c] = round2((missing[c] ?? 0) + v);
  }
  return { open: round2(open), missing };
}

/** Release document per direction: export → House B/L, import → delivery order (DO). */
export const releaseKind = (job: Pick<Job, 'dir'>): 'hbl' | 'do' => (job.dir === 'export' ? 'hbl' : 'do');
/** Step at which the release document is handed over: E22 Original B/L (export), I11 Pay, get DO (import). */
export const releaseStep = (job: Pick<Job, 'dir'>) => (job.dir === 'export' ? 22 : 11);

export interface Pnl {
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number | null;
  missingFx: string[];
  /** Sell lines with no invoice yet. */
  uninvoiced: number;
  /** Open client receivable (issued invoices), base currency. */
  receivable: number;
  /** Open vendor payable (issued bills), base currency. */
  payable: number;
}
export function pnl(l: Ledger): Pnl {
  const missing = new Set<string>();
  let revenue = 0, cost = 0, receivable = 0, payable = 0;
  for (const x of l.lines) {
    const s = toBase(l, lineSell(x), x.currency);
    const b = toBase(l, lineBuy(x), x.currency);
    if ((s == null && x.sell) || (b == null && x.buy)) missing.add(x.currency);
    revenue += s ?? 0;
    cost += b ?? 0;
  }
  for (const inv of l.invoices) {
    if (inv.status !== 'issued') continue;
    const v = toBase(l, invOpen(l, inv), inv.currency);
    if (v == null) { if (invOpen(l, inv) > 0) missing.add(inv.currency); continue; }
    if (inv.kind === 'invoice') receivable += v; else payable += v;
  }
  const uninvoiced = l.lines.filter((x) => (x.sell ?? 0) > 0 && !x.invoiceId).length;
  return { revenue: round2(revenue), cost: round2(cost), profit: round2(revenue - cost), marginPct: revenue > 0 ? round2(((revenue - cost) / revenue) * 100) : null, missingFx: [...missing], uninvoiced, receivable: round2(receivable), payable: round2(payable) };
}

export interface Gate { ok: boolean; reasons: ('uninvoiced' | 'unpaidInvoice' | 'draftInvoice')[] }
/** House B/L (export) / DO (import) release: every sell line invoiced and every client invoice paid. */
export function releaseGate(_job: Job, l: Ledger): Gate {
  const reasons: Gate['reasons'] = [];
  if (l.lines.some((x) => (x.sell ?? 0) > 0 && !x.invoiceId)) reasons.push('uninvoiced');
  const invs = l.invoices.filter((i) => i.kind === 'invoice' && i.status !== 'void');
  if (invs.some((i) => i.status === 'draft')) reasons.push('draftInvoice');
  if (invs.some((i) => i.status === 'issued' && invOpen(l, i) > 0.005)) reasons.push('unpaidInvoice');
  return { ok: reasons.length === 0, reasons };
}

export type Bucket = 'current' | 'd30' | 'd60' | 'd90' | 'd90p';
export const BUCKETS: Bucket[] = ['current', 'd30', 'd60', 'd90', 'd90p'];
export function bucketOf(inv: Invoice, now: number): Bucket {
  if (!isOverdue(inv, now)) return 'current';
  const late = Math.floor((now - invDue(inv)) / DAY);
  if (late <= 0) return 'current';
  if (late <= 30) return 'd30';
  if (late <= 60) return 'd60';
  if (late <= 90) return 'd90';
  return 'd90p';
}

export function nextNo(prefix: string, existing: string[]): string {
  const y = new Date().getFullYear();
  const n = existing.filter((x) => x.startsWith(`${prefix}-${y}-`)).map((x) => Number(x.split('-').pop()) || 0);
  return `${prefix}-${y}-${String((n.length ? Math.max(...n) : 0) + 1).padStart(4, '0')}`;
}

export const DOC_KINDS: DocKind[] = ['bc', 'hbl', 'an', 'do'];
/** Which documents apply to a job direction. */
export const docsFor = (job: Job): DocKind[] => (job.dir === 'export' ? ['bc', 'hbl'] : ['an', 'do']);
export const docPrefix: Record<DocKind, string> = { hbl: 'HBL', an: 'AN', do: 'DO', bc: 'BC' };

export function defaultFields(job: Job): BlFields {
  return {
    shipper: job.dir === 'export' ? job.customer : '',
    consignee: job.dir === 'import' ? job.customer : '',
    notify: '',
    marks: '',
    packages: '',
    grossKg: '',
    cbm: '',
    freight: 'prepaid',
    place: job.pol,
  };
}
