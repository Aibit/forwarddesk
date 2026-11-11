// Billing + documents store. Demo: SAMPLE ledgers + localStorage. Live: Firestore via `billingBackend`.
import { useSyncExternalStore } from 'react';
import { DAY, DEFAULT_CATALOG, balanceOf, releaseGate, releaseKind, releaseStep, invOpen, emptyLedger, migrateLegacy, zeroBalance, type ChargeCode, type JobBalance, type JobDoc, type Ledger } from './model';
import type { Job } from '../jobs/data';
import type { Tariffs } from '../jobs/tariffs';
import { stepIndex } from '../jobs/steps';

export interface BillingBackend {
  saveLedger(l: Ledger): void;
  saveDoc(d: JobDoc): Promise<void>;
  saveCatalog(c: ChargeCode[]): void;
  saveFile(jobId: string, clientId: string | null, file: File): Promise<{ id: string }>;
  loadFile(id: string): Promise<Blob | undefined>;
  deleteFile(id: string): Promise<void>;
}
export const billingBackend: { b: BillingBackend | null } = { b: null };

const KL = 'fd.billing.ledgers.v1';
const KD = 'fd.billing.docs.v1';
const KC = 'fd.billing.catalog.v1';
const read = <T,>(k: string, d: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : d;
  } catch {
    return d;
  }
};
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
    return true;
  } catch {
    return false;
  }
};

/** SAMPLE ledgers for the sample jobs — illustrative numbers only, clearly labelled in the UI. */
function sampleLedgers(now = Date.now()): Record<string, Ledger> {
  const t = (d: number) => now + d * DAY;
  const L = (jobId: string, customer: string, x: Partial<Ledger>): Ledger => ({ ...emptyLedger({ id: jobId, customer }), localMigrated: false, sample: true, ...x });
  const y = new Date(now).getFullYear();
  return {
    'FD-E-1042': L('FD-E-1042', 'Customer A', {
      lines: [
        { id: 's1', code: 'OFR', desc: 'Ocean freight Bandar Abbas → Jebel Ali, 20′', qty: 2, currency: 'USD', sell: 650, buy: 520, payer: 'Customer A', vendor: 'Line A (sample)', terms: 'prepaid', invoiceId: 'si1', billId: 'sb1' },
        { id: 's2', code: 'HAND', desc: 'Handling and documentation', qty: 1, currency: 'USD', sell: 120, buy: null, payer: 'Customer A', vendor: '', terms: 'prepaid', invoiceId: 'si1' },
        { id: 's3', code: 'THC-D', desc: 'Destination THC (collect at destination)', qty: 2, currency: 'AED', sell: 600, buy: 600, payer: 'Consignee', vendor: 'Destination agent (sample)', terms: 'collect' },
      ],
      invoices: [
        { id: 'si1', no: `INV-${y}-0101`, kind: 'invoice', party: 'Customer A', currency: 'USD', lineIds: ['s1', 's2'], issuedAt: t(-6), dueDays: 15, status: 'issued' },
        { id: 'sb1', no: `BILL-${y}-0044`, kind: 'bill', party: 'Line A (sample)', currency: 'USD', lineIds: ['s1'], issuedAt: t(-5), dueDays: 30, status: 'issued', ref: 'LA-SAMPLE-7781' },
      ],
    }),
    'FD-E-1038': L('FD-E-1038', 'Customer B', {
      lines: [
        { id: 's1', code: 'OFR', desc: 'Ocean freight Bandar Abbas → Shanghai, 20′', qty: 4, currency: 'USD', sell: 980, buy: 840, payer: 'Customer B', vendor: 'Line B (sample)', terms: 'prepaid', invoiceId: 'si1', billId: 'sb1' },
        { id: 's2', code: 'HAND', desc: 'Handling and documentation', qty: 1, currency: 'USD', sell: 150, buy: null, payer: 'Customer B', vendor: '', terms: 'prepaid', invoiceId: 'si1' },
        { id: 's3', code: 'AGT', desc: 'Agent fee at Shanghai', qty: 1, currency: 'USD', sell: null, buy: 75, payer: '', vendor: 'Shanghai agent (sample)', terms: 'prepaid' },
      ],
      invoices: [
        { id: 'si1', no: `INV-${y}-0094`, kind: 'invoice', party: 'Customer B', currency: 'USD', lineIds: ['s1', 's2'], issuedAt: t(-44), dueDays: 7, status: 'issued' },
        { id: 'sb1', no: `BILL-${y}-0039`, kind: 'bill', party: 'Line B (sample)', currency: 'USD', lineIds: ['s1'], issuedAt: t(-40), dueDays: 30, status: 'issued', ref: 'LB-SAMPLE-1290' },
      ],
      payments: [
        { id: 'sp1', invoiceId: 'si1', amount: 2000, at: t(-30), method: 'Bank transfer', ref: 'SAMPLE' },
        { id: 'sp2', invoiceId: 'sb1', amount: 3360, at: t(-12), method: 'Bank transfer', ref: 'SAMPLE' },
      ],
    }),
    'FD-I-0877': L('FD-I-0877', 'Customer D', {
      lines: [
        { id: 's1', code: 'CUS', desc: 'Customs clearance Bandar Abbas', qty: 1, currency: 'USD', sell: 380, buy: 300, payer: 'Customer D', vendor: 'Clearance agent (sample)', terms: 'prepaid', invoiceId: 'si1', billId: 'sb1' },
        { id: 's2', code: 'HAUL', desc: 'Trucking to warehouse', qty: 3, currency: 'USD', sell: 260, buy: 210, payer: 'Customer D', vendor: 'Haulier (sample)', terms: 'prepaid', invoiceId: 'si1' },
      ],
      invoices: [
        { id: 'si1', no: `INV-${y}-0071`, kind: 'invoice', party: 'Customer D', currency: 'USD', lineIds: ['s1', 's2'], issuedAt: t(-50), dueDays: 15, status: 'issued' },
        { id: 'sb1', no: `BILL-${y}-0028`, kind: 'bill', party: 'Clearance agent (sample)', currency: 'USD', lineIds: ['s1'], issuedAt: t(-48), dueDays: 30, status: 'issued', ref: 'CA-SAMPLE-0031' },
      ],
      payments: [{ id: 'sp1', invoiceId: 'si1', amount: 1160, at: t(-41), method: 'Bank transfer', ref: 'SAMPLE' }],
    }),
    'FD-I-0921': L('FD-I-0921', 'Customer F', {
      lines: [
        { id: 's1', code: 'AGT', desc: 'Origin agent handling, Hamburg', qty: 1, currency: 'EUR', sell: null, buy: 180, payer: '', vendor: 'Hamburg agent (sample)', terms: 'collect', billId: 'sb1' },
        { id: 's2', code: 'CUS', desc: 'Customs clearance Bandar Abbas', qty: 1, currency: 'USD', sell: 420, buy: 330, payer: 'Customer F', vendor: 'Clearance agent (sample)', terms: 'prepaid' },
      ],
      invoices: [{ id: 'sb1', no: `BILL-${y}-0051`, kind: 'bill', party: 'Hamburg agent (sample)', currency: 'EUR', lineIds: ['s1'], issuedAt: t(-3), dueDays: 30, status: 'issued', ref: 'HH-SAMPLE-22' }],
    }),
  };
}

let ledgers: Record<string, Ledger> = {};
let docs: Record<string, JobDoc> = {};
let catalog: ChargeCode[] = DEFAULT_CATALOG;
/** Client-readable balances (live mode, client role): written by staff next to each ledger. */
let balances: Record<string, JobBalance> = {};
let live = false;
const subs = new Set<() => void>();
let snap = { ledgers, docs, catalog, balances };
const emit = () => {
  snap = { ledgers, docs, catalog, balances };
  subs.forEach((f) => f());
};
function loadDemo() {
  ledgers = { ...sampleLedgers(), ...read<Record<string, Ledger>>(KL, {}) };
  docs = read<Record<string, JobDoc>>(KD, {});
  catalog = read<ChargeCode[] | null>(KC, null) ?? DEFAULT_CATALOG;
  balances = {};
  live = false;
  snap = { ledgers, docs, catalog, balances };
}
if (typeof localStorage !== 'undefined') loadDemo();

export const useBilling = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => snap);
export const getBilling = () => snap;
/** The one unpaid figure per job (open client invoices). Staff/demo: from the ledger; client portal (live): from jobBalances. */
export function balanceFor(job: Pick<Job, 'id' | 'clientId' | 'customer'>, s = snap, now = Date.now()): JobBalance {
  const l = s.ledgers[job.id];
  if (l) return balanceOf(l, now);
  return s.balances[job.id] ?? zeroBalance(job);
}
export interface ReleaseBlock { kind: 'hbl' | 'do'; open: number; missing: Record<string, number>; released: boolean; blocking: boolean; balance: JobBalance }
/** Export: open client invoices hold the original B/L (until E22). Import: they hold the delivery order (until I11). */
export function releaseBlockFor(job: Pick<Job, 'id' | 'clientId' | 'customer' | 'dir' | 'step'>, s = snap, now = Date.now()): ReleaseBlock {
  const balance = balanceFor(job, s, now);
  const kind = releaseKind(job);
  const released = s.docs[`${job.id}-${kind}`]?.status === 'released';
  const due = balance.open > 0.005 || Object.keys(balance.missing).length > 0;
  return { kind, open: balance.open, missing: balance.missing, released, blocking: due && !released && stepIndex(job.step) <= releaseStep(job), balance };
}
/** Collect freight (I13) status, read from its invoice line on the ledger. */
export function collectState(jobId: string, s = snap): { amount: number; collected: boolean } | null {
  const l = s.ledgers[jobId];
  const line = l?.lines.find((x) => x.id === 'loc-collect' || (x.terms === 'collect' && x.code === 'OFR' && x.invoiceId));
  if (!l || !line) return null;
  const inv = l.invoices.find((i) => i.id === line.invoiceId);
  return { amount: (line.sell ?? 0) * line.qty, collected: !!inv && inv.status === 'issued' && invOpen(l, inv) <= 0.005 };
}
export const ledgerFor = (job: Pick<Job, 'id' | 'clientId' | 'customer'>): Ledger => ledgers[job.id] ?? emptyLedger(job);

export const billingStore = {
  isLive: () => live,
  hydrate(p: { ledgers?: Ledger[]; docs?: JobDoc[]; catalog?: ChargeCode[] | null; balances?: JobBalance[] }) {
    live = true;
    if (p.balances) balances = Object.fromEntries(p.balances.map((b) => [b.jobId, b]));
    if (p.ledgers) ledgers = Object.fromEntries(p.ledgers.map((l) => [l.jobId, l]));
    if (p.docs) docs = Object.fromEntries(p.docs.map((d) => [d.id, d]));
    if (p.catalog !== undefined) catalog = p.catalog?.length ? p.catalog : DEFAULT_CATALOG;
    emit();
  },
  reload() {
    loadDemo();
    emit();
  },
  /**
   * Move legacy job charges / collect freight onto invoice lines (once per job). Demo: in memory only, so the
   * SAMPLE dates stay relative to today; live (staff): saved to Firestore together with the client balance.
   */
  syncLegacy(jobs: Job[], t: Tariffs, now = Date.now()) {
    let changed = false;
    const nos = () => Object.values(ledgers).flatMap((l) => l.invoices.map((i) => i.no));
    for (const job of jobs) {
      const next = migrateLegacy(job, ledgers[job.id], t, now, nos());
      if (!next) continue;
      if (!ledgers[job.id] && !next.lines.length) continue;
      changed = true;
      next.releaseOk = releaseGate(job, next).ok;
      if (live && billingBackend.b) this.saveLedger(next);
      else ledgers = { ...ledgers, [job.id]: next };
    }
    if (changed) emit();
  },
  saveLedger(l: Ledger) {
    const next = { ...l, updatedAt: Date.now() };
    ledgers = { ...ledgers, [l.jobId]: next };
    emit();
    if (billingBackend.b) billingBackend.b.saveLedger(next);
    else write(KL, Object.fromEntries(Object.entries(ledgers).filter(([, v]) => !v.sample || v.updatedAt)));
  },
  async saveDoc(d: JobDoc) {
    const next = { ...d, updatedAt: Date.now() };
    if (billingBackend.b) await billingBackend.b.saveDoc(next);
    docs = { ...docs, [d.id]: next };
    emit();
    if (!billingBackend.b) write(KD, docs);
  },
  saveCatalog(c: ChargeCode[]) {
    catalog = c;
    emit();
    if (billingBackend.b) billingBackend.b.saveCatalog(c);
    else write(KC, c);
  },
};
