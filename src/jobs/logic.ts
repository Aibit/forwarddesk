import type { Charge, Container, Job } from './data';
import { dur, num, tr, usd, type Key } from './i18n';
import { stepIndex, type Lang } from './steps';
import type { Tariffs } from './tariffs';

export const DAY = 86400000;
export const HOUR = 3600000;

export type Level = 'red' | 'amber' | 'ok' | 'idle';

export interface Clock {
  state: 'notStarted' | 'running' | 'stopped';
  level: Level;
  end: number | null;
  remainingMs: number; // negative = over
  daysOver: number;
  cost: number;
}

const is40 = (c: Container) => c.size !== '20';

export function demurrageCost(c: Container, daysOver: number, t: Tariffs): number {
  if (daysOver <= 0) return 0;
  const [r1, r2] = is40(c) ? [t.demurrage40Tier1, t.demurrage40Tier2] : [t.demurrage20Tier1, t.demurrage20Tier2];
  const d1 = Math.min(daysOver, t.tier1Days);
  return d1 * r1 + Math.max(0, daysOver - t.tier1Days) * r2;
}

export function clock(c: Container, now: number, t: Tariffs): Clock {
  if (c.freeDays == null || c.clockStart == null) return { state: 'notStarted', level: 'idle', end: null, remainingMs: 0, daysOver: 0, cost: 0 };
  const end = c.clockStart + c.freeDays * DAY;
  const ref = c.clockStop ?? now;
  const remainingMs = end - ref;
  const daysOver = remainingMs < 0 ? Math.ceil(-remainingMs / DAY) : 0;
  const cost = demurrageCost(c, daysOver, t);
  const running = c.clockStop == null;
  const level: Level = daysOver > 0 ? 'red' : running && remainingMs < 3 * DAY ? 'amber' : running ? 'ok' : 'idle';
  return { state: running ? 'running' : 'stopped', level, end, remainingMs, daysOver, cost };
}

export function chargeAmount(job: Job, ch: Charge, t: Tariffs, now: number): number {
  if (ch.amount != null) return ch.amount;
  const n = job.containers.length;
  switch (ch.key) {
    case 'bl': return t.blFee;
    case 'do': return t.doFee;
    case 'seal': return t.sealFee * n;
    case 'thc': return job.containers.reduce((s, c) => s + (is40(c) ? t.thc40 : t.thc20), 0);
    case 'demurrage': return job.containers.reduce((s, c) => s + clock(c, now, t).cost, 0);
    default: return 0;
  }
}

export const CHARGE_LABEL: Record<Charge['key'], [string, string, string, string]> = {
  bl: ['B/L fee', 'Tasa B/L', 'هزینه بارنامه', 'رسوم بوليصة الشحن'],
  thc: ['THC (port tariff)', 'THC (tarifa portuaria)', 'THC (تعرفه بندر)', 'THC (تعرفة الميناء)'],
  seal: ['Seal fee', 'Precintos', 'هزینه پلمپ', 'رسوم الختم'],
  extras: ['Small extras', 'Extras', 'هزینه‌های جزئی', 'إضافات صغيرة'],
  demurrage: ['Demurrage (line calculates)', 'Demora (la calcula la naviera)', 'حق توقف (محاسبه خط)', 'غرامة التأخير (يحسبها الخط)'],
  do: ['DO fee', 'Tasa DO', 'هزینه دی‌او', 'رسوم إذن التسليم'],
};

export function chequeAmount(job: Job, ch: Job['cheques'][number], t: Tariffs): number {
  if (ch.kind === 'demurrage') return t.chequeDemurrage;
  const c = job.containers.find((x) => x.no === ch.container);
  return c && is40(c) ? t.chequeContainer40 : t.chequeContainer20;
}

/** E18: papers due 48 h before the vessel arrives. Only while the job is at or before E18. */
export function cutoff(job: Job): number | null {
  if (job.dir !== 'export' || !job.vessel || job.vessel.sailed) return null;
  if (stepIndex(job.step) > 18) return null;
  const so = job.docs.find((d) => d.key === 'shippingOrder');
  if (so?.status === 'done') return null;
  return job.vessel.eta - 48 * HOUR;
}

export interface Alert {
  level: 'red' | 'amber' | 'info';
  text: string;
  at?: number;
  sortKey: number;
}

/** `block`: open client invoices that hold the release document (from the billing ledger — the only unpaid figure). */
export function jobAlerts(job: Job, now: number, t: Tariffs, lang: Lang, block?: { amount: number; kind: 'hbl' | 'do' } | null): Alert[] {
  const out: Alert[] = [];
  const L = (k: Key) => tr(lang, k);
  const cks = job.containers.map((c) => ({ c, k: clock(c, now, t) }));
  const red = cks.filter((x) => x.k.daysOver > 0);
  if (red.length) {
    const cost = red.reduce((s, x) => s + x.k.cost, 0);
    const maxOver = Math.max(...red.map((x) => x.k.daysOver));
    const running = red.some((x) => x.k.state === 'running');
    out.push({
      level: 'red',
      sortKey: -1e6 - maxOver,
      text: `${L('demurrage')}: ${num(lang, red.length)} ${L('cntr')} · ${num(lang, maxOver)} ${lang === 'fa' ? 'روز' : lang === 'ar' ? 'يوم' : 'd'} ${L('over')} · ${usd(lang, cost)} ${L('estDemurrage')}${running ? '' : ` (${job.dir === 'export' ? L('loaded') : L('returnedEmpty')})`}`,
    });
  }
  const amber = cks.filter((x) => x.k.level === 'amber');
  if (amber.length) {
    const min = Math.min(...amber.map((x) => x.k.remainingMs));
    out.push({ level: 'amber', sortKey: min, text: `${L('freeTime')}: ${num(lang, amber.length)} ${L('cntr')} · ${dur(lang, min, false)} ${L('daysLeft')}` });
  }
  const co = cutoff(job);
  if (co != null && co - now < 72 * HOUR) {
    out.push({ level: co < now ? 'red' : 'amber', sortKey: co - now, text: `${L('docCutoff')} (E18): ${dur(lang, co - now)} — ${L('shippingOrder')} ${L('waiting')}` });
  }
  if (block && block.amount > 0) out.push({ level: 'amber', sortKey: 5 * DAY, text: `${usd(lang, block.amount)} ${L('unpaid')} — ${L(block.kind === 'hbl' ? 'blocksBl' : 'blocksDo')}` });
  if (job.docDelay) out.push({ level: 'amber', sortKey: 7 * DAY, text: L('docDelay') });
  const dr = job.docs.find((d) => d.key === 'draftBl' && d.status === 'waiting');
  if (dr) out.push({ level: 'info', sortKey: 8 * DAY, text: `${L('draftBl')}: ${num(lang, dr.rounds ?? 1)} ${L('rounds')} — ${L('waiting')}` });
  return out.sort((a, b) => a.sortKey - b.sortKey);
}

export interface Summary {
  jobsLive: number;
  inFreeTime: number;
  atRisk: number;
  inDemurrage: number;
  cutoffs72: number;
  unpaidBl: number;
  chequesHeld: number;
  chequesValue: number;
}

/** `blocked(job)`: open client invoices holding that job's B/L / DO (billing ledger). */
export function summarize(jobs: Job[], now: number, t: Tariffs, blocked: (j: Job) => number = () => 0): Summary {
  let inFreeTime = 0, atRisk = 0, inDemurrage = 0, cutoffs72 = 0, unpaidBl = 0, chequesHeld = 0, chequesValue = 0;
  for (const j of jobs) {
    for (const c of j.containers) {
      const k = clock(c, now, t);
      if (k.state === 'running' && k.daysOver === 0) inFreeTime++;
      if (k.state === 'running' && (k.level === 'amber' || k.level === 'red')) atRisk++;
      if (k.daysOver > 0 && k.state === 'running') inDemurrage++;
    }
    const co = cutoff(j);
    if (co != null && co - now < 72 * HOUR) cutoffs72++;
    unpaidBl += blocked(j);
    for (const ch of j.cheques) if (ch.status === 'held') { chequesHeld++; chequesValue += chequeAmount(j, ch, t); }
  }
  return { jobsLive: jobs.length, inFreeTime, atRisk, inDemurrage, cutoffs72, unpaidBl, chequesHeld, chequesValue };
}

/** Most urgent deadline for the board column. */
export function nextDeadline(job: Job, now: number, t: Tariffs): { level: Level; label: string; ms: number; kind: 'cutoff' | 'free' | 'over' } | null {
  const co = cutoff(job);
  const cks = job.containers.map((c) => clock(c, now, t)).filter((k) => k.state === 'running');
  const over = cks.filter((k) => k.daysOver > 0);
  if (over.length) return { level: 'red', label: 'over', ms: Math.min(...over.map((k) => k.remainingMs)), kind: 'over' };
  const cands: { level: Level; label: string; ms: number; kind: 'cutoff' | 'free' }[] = [];
  if (co != null) cands.push({ level: co < now ? 'red' : co - now < 72 * HOUR ? 'amber' : 'ok', label: 'cutoff', ms: co - now, kind: 'cutoff' });
  if (cks.length) {
    const min = Math.min(...cks.map((k) => k.remainingMs));
    cands.push({ level: min < 3 * DAY ? 'amber' : 'ok', label: 'free', ms: min, kind: 'free' });
  }
  cands.sort((a, b) => a.ms - b.ms);
  return cands[0] ?? null;
}
