// Billing + documents store. Demo: SAMPLE ledgers + localStorage. Live: Firestore via `billingBackend`.
import { useSyncExternalStore } from 'react';
import { DAY, DEFAULT_CATALOG, emptyLedger, type ChargeCode, type JobDoc, type Ledger } from './model';
import type { Job } from '../jobs/data';

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
  const L = (jobId: string, customer: string, x: Partial<Ledger>): Ledger => ({ ...emptyLedger({ id: jobId, customer }), sample: true, ...x });
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
let live = false;
const subs = new Set<() => void>();
let snap = { ledgers, docs, catalog };
const emit = () => {
  snap = { ledgers, docs, catalog };
  subs.forEach((f) => f());
};
function loadDemo() {
  ledgers = { ...sampleLedgers(), ...read<Record<string, Ledger>>(KL, {}) };
  docs = read<Record<string, JobDoc>>(KD, {});
  catalog = read<ChargeCode[] | null>(KC, null) ?? DEFAULT_CATALOG;
  live = false;
  snap = { ledgers, docs, catalog };
}
if (typeof localStorage !== 'undefined') loadDemo();

export const useBilling = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => snap);
export const getBilling = () => snap;
export const ledgerFor = (job: Pick<Job, 'id' | 'clientId' | 'customer'>): Ledger => ledgers[job.id] ?? emptyLedger(job);

export const billingStore = {
  isLive: () => live,
  hydrate(p: { ledgers?: Ledger[]; docs?: JobDoc[]; catalog?: ChargeCode[] | null }) {
    live = true;
    if (p.ledgers) ledgers = Object.fromEntries(p.ledgers.map((l) => [l.jobId, l]));
    if (p.docs) docs = Object.fromEntries(p.docs.map((d) => [d.id, d]));
    if (p.catalog !== undefined) catalog = p.catalog?.length ? p.catalog : DEFAULT_CATALOG;
    emit();
  },
  reload() {
    loadDemo();
    emit();
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
