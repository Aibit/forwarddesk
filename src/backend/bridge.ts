// Bridge between the in-browser stores and the optional Firebase backend.
// In demo mode `bridge.w` is null and every store keeps using localStorage / IndexedDB.
// In live mode the stores are hydrated from Firestore snapshots and writes go through `bridge.w`.
import type { Agent, Client, Company, QuoteRecord, QuoteStatus } from '../clients/store';
import type { LaneProfile } from '../clients/lanes';
import type { MsdsMeta, MsdsRule } from '../clients/msds';
import type { DbAgent } from '../agents/db';
import type { AgentActivity } from '../agents/crm';
import type { Job } from '../jobs/data';
import type { Tariffs } from '../jobs/tariffs';

/** Buy side of a quote — stored in a staff-only sub-document, never sent to the client portal. */
export interface QuoteCosts {
  options: { carrier: string; buy: number | null; margin: number | null; marginPct: number | null }[];
  marginPct: number | null;
  sample?: boolean;
}

export interface Writer {
  role: 'staff' | 'client';
  clientId: string | null;
  upsertClient(c: Client): void;
  removeClient(id: string): void;
  setAgents(clientId: string, agents: Agent[]): void;
  setLanes(clientId: string, lanes: LaneProfile[], prev: LaneProfile[]): void;
  setCompany(c: Company): void;
  recordQuote(rec: QuoteRecord, costs?: QuoteCosts): void;
  setQuoteStatus(id: string, status: QuoteStatus, acceptedOption?: string, via?: 'portal' | 'desk'): void;
  agentUpsert(a: DbAgent): void;
  agentRemove(id: string): void;
  agentReplace(list: DbAgent[]): void;
  activityUpsert(a: AgentActivity): void;
  activityRemove(id: string): void;
  setMsdsRules(r: MsdsRule[]): void;
  setTariffs(t: Tariffs): void;
  saveMsds(file: File, clientId: string | null): Promise<MsdsMeta>;
  loadMsds(id: string): Promise<Blob | undefined>;
  deleteMsds(id: string): Promise<void>;
  createJob(j: Job): Promise<void>;
  approveDraftBl(jobId: string): void;
}

export const bridge: { w: Writer | null; onError: (e: unknown) => void } = { w: null, onError: () => undefined };
export const isLive = () => bridge.w != null;
/** Max MSDS size when stored online (Firestore document limit is 1 MiB; base64 adds ~33 %). */
export const LIVE_MSDS_MAX = 640 * 1024;
