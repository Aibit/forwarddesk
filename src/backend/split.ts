import type { Job } from '../jobs/data';
import type { Tariffs } from '../jobs/tariffs';

/** Staff-only parts are stored apart so the security rules can keep them from client accounts. */
export function splitTariffs(t: Tariffs) {
  const { lineRebatePct, ...pub } = t;
  return { pub, priv: { lineRebatePct } };
}
export function splitJob(j: Job) {
  if (!j.collect) return { job: j, internal: null };
  const { rebateReceived, ...collect } = j.collect;
  return { job: { ...j, collect }, internal: { rebateReceived } };
}
