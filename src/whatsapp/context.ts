// Builds WhatsApp recipients and template data from the existing stores (jobs, clients, agents, billing).
import type { Agent, Client, Company } from '../clients/store';
import type { DbAgent } from '../agents/db';
import type { Job } from '../jobs/data';
import { clock, cutoff } from '../jobs/logic';
import type { Tariffs } from '../jobs/tariffs';
import { invDue, invOpen, invTotal, releaseKind, type Ledger } from '../billing/model';
import { normalizePhone, waNumberOf } from './phone';
import type { TplCtx, WaLang } from './templates';
import type { WKey } from './i18n';

export interface WaRecipient {
  id: string;
  /** role label key (translated in the dialog) */
  role: WKey;
  name: string;
  /** as stored; may be invalid (then the dialog asks to fix it) */
  number: string;
  lang: WaLang;
  /** log links */
  clientId?: string | null;
  agentId?: string | null;
}

export function clientRecipients(c: Client | null): WaRecipient[] {
  if (!c) return [];
  const out: WaRecipient[] = [];
  const add = (id: string, role: WKey, name: string, num: string) => {
    if (num && num.trim()) out.push({ id, role, name: name || c.name, number: normalizePhone(num), lang: c.lang, clientId: c.id });
  };
  add(`c-${c.id}-contact`, 'rContact', c.contactName ? `${c.contactName} · ${c.name}` : c.name, waNumberOf(c));
  add(`c-${c.id}-broker`, 'rBroker', c.clearanceAgent?.name ?? '', waNumberOf(c.clearanceAgent ?? { phone: '' }));
  add(`c-${c.id}-office`, 'rOffice', c.bandarAbbas?.name ?? '', waNumberOf(c.bandarAbbas ?? { phone: '' }));
  return out;
}

/** The job's overseas agent: the client's preferred agent record (+ its contacts in the agent CRM when linked). */
export function agentRecipients(a: Agent | null, db: DbAgent[], lang: WaLang = 'en'): WaRecipient[] {
  if (!a) return [];
  const out: WaRecipient[] = [];
  const crm = a.dbId ? db.find((x) => x.id === a.dbId) ?? null : null;
  const num = waNumberOf(a);
  if (num.trim()) out.push({ id: `a-${a.id}`, role: 'rAgent', name: a.contactName && a.contactName !== 'Sample contact' ? `${a.contactName} · ${a.name}` : a.name, number: normalizePhone(num), lang, agentId: crm?.id ?? null });
  if (crm) out.push(...dbAgentRecipients(crm, lang).filter((r) => !out.some((o) => o.number === r.number)));
  return out;
}

export function dbAgentRecipients(a: DbAgent, lang: WaLang = 'en'): WaRecipient[] {
  const out: WaRecipient[] = [];
  const g = waNumberOf(a);
  if (g.trim()) out.push({ id: `g-${a.id}`, role: 'rGeneral', name: a.name, number: normalizePhone(g), lang, agentId: a.id });
  for (const c of a.contacts ?? []) {
    const n = waNumberOf(c);
    if (n.trim()) out.push({ id: `ct-${c.id}`, role: 'rAgent', name: `${c.name || '—'} · ${a.name}`, number: normalizePhone(n), lang, agentId: a.id });
  }
  return out;
}

/** Template data for one job: containers on the clock, cut-off, vessel, open balance, latest customer invoice. */
export function jobCtx(job: Job, opts: { company?: Company | null; ledger?: Ledger | null; tariffs: Tariffs; now: number; openBalance?: number }): TplCtx {
  const running = job.containers.map((c) => ({ c, k: clock(c, opts.now, opts.tariffs) })).filter((x) => x.k.state === 'running' && x.k.end != null);
  const freeEnd = running.length ? Math.min(...running.map((x) => x.k.end!)) : null;
  const soon = running.filter((x) => x.k.end! - (freeEnd ?? 0) < 86400000);
  const l = opts.ledger ?? null;
  const invs = (l?.invoices ?? []).filter((i) => i.kind === 'invoice' && i.status === 'issued').sort((a, b) => b.issuedAt - a.issuedAt);
  const openInv = l ? invs.find((i) => invOpen(l, i) > 0.005) ?? null : null;
  const inv = openInv ?? invs[0] ?? null;
  return {
    company: opts.company?.name ?? '',
    job: job.id,
    route: `${job.pol} → ${job.pod}`,
    dir: job.dir,
    vessel: job.vessel?.name,
    pod: job.pod,
    containers: (soon.length ? soon.map((x) => x.c.no) : job.containers.map((c) => c.no)),
    freeEnd,
    cutoff: cutoff(job),
    eta: job.vessel && !job.vessel.sailed ? job.vessel.eta : job.vessel?.eta ?? null,
    amount: opts.openBalance ?? (l && openInv ? invOpen(l, openInv) : null),
    currency: inv?.currency ?? l?.base ?? 'USD',
    invoiceNo: inv?.no,
    invoiceAmount: l && inv ? invTotal(l, inv) : null,
    due: inv ? invDue(inv) : null,
    release: releaseKind(job),
    now: opts.now,
  };
}
