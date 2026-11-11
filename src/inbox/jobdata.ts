// Job-derived data for the inbox: template values and attachable PDFs (invoices, B/L and other job documents).
import type { Job } from '../jobs/data';
import type { Tariffs } from '../jobs/tariffs';
import { getStore, type Company } from '../clients/store';
import { getBilling, ledgerFor } from '../billing/store';
import { docsFor } from '../billing/model';
import { invoicePdf, jobDocPdf } from '../billing/pdf';
import { jobCtx } from '../whatsapp/context';
import { waMoney } from '../whatsapp/templates';
import type { WaTemplate, TplLang } from '../../server/src/templates';
import type { Conv } from './backend';

const LOC: Record<TplLang, string> = { en: 'en-GB', es: 'es-ES', fa: 'fa-IR', ar: 'ar-EG' };
const day = (l: TplLang, ms: number) => new Date(ms).toLocaleDateString(LOC[l], { day: 'numeric', month: 'long' });
const dayTime = (l: TplLang, ms: number) => new Date(ms).toLocaleString(LOC[l], { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

export function templateValues(t: WaTemplate, lang: TplLang, conv: Conv, job: Job | null, tariffs: Tariffs, now = Date.now()): string[] {
  const s = getStore();
  const ledger = job ? getBilling().ledgers[job.id] ?? ledgerFor(job) : null;
  const c = job ? jobCtx(job, { company: s.company as Company | null, ledger, tariffs, now }) : null;
  const v: Record<string, string> = {
    name: conv.contactName ?? conv.profileName ?? conv.name ?? '',
    job: job?.id ?? conv.jobId ?? '',
    containers: c?.containers?.join(', ') ?? '',
    freeEnd: c?.freeEnd ? day(lang, c.freeEnd) : '',
    vessel: c?.vessel ?? '',
    cutoff: c?.cutoff ? dayTime(lang, c.cutoff) : '',
    amount: c?.amount != null ? waMoney(lang, c.amount, c.currency) : '',
    invoiceNo: c?.invoiceNo ?? '',
    due: c?.due ? day(lang, c.due) : '',
    pod: c?.pod ?? '',
    eta: c?.eta ? day(lang, c.eta) : '',
  };
  return t.params.map((p) => v[p] ?? '');
}

export interface JobFile { id: string; label: string; no: string; make: (lang: 'en' | 'es') => Promise<{ blob: Blob; filename: string }> }

export function jobFiles(job: Job | null, sample: boolean): JobFile[] {
  if (!job) return [];
  const b = getBilling();
  const ledger = b.ledgers[job.id] ?? ledgerFor(job);
  const co = getStore().company;
  const out: JobFile[] = [];
  for (const inv of ledger.invoices.filter((i) => i.kind === 'invoice' && i.status === 'issued')) {
    out.push({ id: `inv-${inv.id}`, label: 'invoice', no: inv.no, make: (pl) => invoicePdf(job, ledger, inv, co, pl, sample) });
  }
  for (const k of docsFor(job)) {
    const d = b.docs[`${job.id}-${k}`];
    if (d) out.push({ id: `doc-${d.id}`, label: k, no: d.no, make: (pl) => jobDocPdf(job, d, co, pl, sample) });
  }
  return out;
}
