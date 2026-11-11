import type { Job } from '../jobs/data';
import { chequeAmount, clock, nextDeadline } from '../jobs/logic';
import { balanceFor, getBilling } from '../billing/store';
import type { Tariffs } from '../jobs/tariffs';
import type { Client, QuoteRecord } from './store';

export interface ClientKpi {
  jobs: Job[];
  inFreeTime: number;
  atRiskCntr: number;
  demurrageUsd: number;
  demurrageCntr: number;
  unpaidUsd: number;
  chequesHeld: number;
  chequesUsd: number;
  quotes: QuoteRecord[];
  sent: number;
  won: number;
  lost: number;
  next: { job: Job; level: 'red' | 'amber' | 'ok' | 'idle'; ms: number; kind: 'cutoff' | 'free' | 'over' } | null;
}

export function clientKpi(c: Client, allJobs: Job[], quotes: QuoteRecord[], now: number, t: Tariffs): ClientKpi {
  const key = c.jobName ?? c.name;
  const jobs = allJobs.filter((j) => j.customer === key);
  let inFreeTime = 0, atRiskCntr = 0, demurrageUsd = 0, demurrageCntr = 0, unpaidUsd = 0, chequesHeld = 0, chequesUsd = 0;
  let next: ClientKpi['next'] = null;
  for (const j of jobs) {
    for (const box of j.containers) {
      const k = clock(box, now, t);
      if (k.state === 'running' && k.daysOver === 0) inFreeTime++;
      if (k.state === 'running' && k.level === 'amber') atRiskCntr++;
      if (k.daysOver > 0) {
        demurrageCntr++;
        demurrageUsd += k.cost;
      }
    }
    // Unpaid = open client invoices on the job's billing ledger (same figure as Jobs, Finance and the portal).
    unpaidUsd += balanceFor(j, getBilling(), now).open;
    for (const ch of j.cheques) if (ch.status === 'held') { chequesHeld++; chequesUsd += chequeAmount(j, ch, t); }
    const nd = nextDeadline(j, now, t);
    if (nd && (!next || rank(nd) < rank(next))) next = { job: j, level: nd.level, ms: nd.ms, kind: nd.kind };
  }
  const mine = quotes.filter((q) => q.clientId === c.id).sort((a, b) => b.at - a.at);
  unpaidUsd = Math.round(unpaidUsd * 100) / 100;
  return {
    jobs, inFreeTime, atRiskCntr, demurrageUsd, demurrageCntr, unpaidUsd, chequesHeld, chequesUsd,
    quotes: mine, sent: mine.length, won: mine.filter((q) => q.status === 'won').length, lost: mine.filter((q) => q.status === 'lost').length, next,
  };
}
const rank = (n: { kind: string; ms: number }) => (n.kind === 'over' ? -1e13 + n.ms : n.ms);
