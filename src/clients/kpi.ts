import type { Job } from '../jobs/data';
import { chargeAmount, chequeAmount, clock, nextDeadline } from '../jobs/logic';
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
    // demurrage is counted from the clocks above, so skip a demurrage charge line to avoid double counting
    unpaidUsd += j.charges.filter((ch) => !ch.paid && ch.key !== 'demurrage').reduce((s, ch) => s + chargeAmount(j, ch, t, now), 0);
    if (j.collect && !j.collect.collected) unpaidUsd += j.collect.amount;
    for (const ch of j.cheques) if (ch.status === 'held') { chequesHeld++; chequesUsd += chequeAmount(j, ch, t); }
    const nd = nextDeadline(j, now, t);
    if (nd && (!next || rank(nd) < rank(next))) next = { job: j, level: nd.level, ms: nd.ms, kind: nd.kind };
  }
  const mine = quotes.filter((q) => q.clientId === c.id).sort((a, b) => b.at - a.at);
  return {
    jobs, inFreeTime, atRiskCntr, demurrageUsd, demurrageCntr, unpaidUsd, chequesHeld, chequesUsd,
    quotes: mine, sent: mine.length, won: mine.filter((q) => q.status === 'won').length, lost: mine.filter((q) => q.status === 'lost').length, next,
  };
}
const rank = (n: { kind: string; ms: number }) => (n.kind === 'over' ? -1e13 + n.ms : n.ms);
