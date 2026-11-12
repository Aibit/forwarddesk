// Bridge between the in-browser stores and the optional Firebase backend.
// In demo mode `bridge.w` is null and every store keeps using localStorage / IndexedDB.
// In live mode the stores are hydrated from Firestore snapshots and writes go through `bridge.w`.
import type { WaLogEntry } from '../whatsapp/log';
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
  /** Staff only: buy side of one quote (quotes/{id}/private/costs). */
  loadQuoteCosts?(id: string): Promise<QuoteCosts | null>;
  setQuoteStatus(id: string, status: QuoteStatus, acceptedOption?: string, via?: 'portal' | 'desk'): void;
  agentUpsert(a: DbAgent): void;
  agentRemove(id: string): void;
  agentReplace(list: DbAgent[]): void;
  activityUpsert(a: AgentActivity): void;
  activityRemove(id: string): void;
  /** WhatsApp click-to-chat log (staff only). */
  commLogAdd?(e: WaLogEntry): void;
  setMsdsRules(r: MsdsRule[]): void;
  setTariffs(t: Tariffs): void;
  saveMsds(file: File, clientId: string | null): Promise<MsdsMeta>;
  loadMsds(id: string): Promise<Blob | undefined>;
  deleteMsds(id: string): Promise<void>;
  createJob(j: Job): Promise<void>;
  setJobStep(jobId: string, step: string, entry: { at: number; text: string; kind?: 'info' | 'warn' | 'alert' }): Promise<void>;
  approveDraftBl(jobId: string): void;
}

export const bridge: { w: Writer | null; onError: (e: unknown) => void } = { w: null, onError: () => undefined };
export const isLive = () => bridge.w != null;
/** Max MSDS size when stored online (Firestore document limit is 1 MiB; base64 adds ~33 %). */
export const LIVE_MSDS_MAX = 640 * 1024;

// ── Accounts adapter (backend-agnostic) ──
// UI components (start screen, sign-up, onboarding, team) only talk to this interface via session.ts.
// Implemented by ./live.ts (Firebase) and ./serverLive.ts (the self-hosted Node + SQLite API in server/).
export interface AccountProfile { name: string; country: string; baseCurrency: string; ports: string[]; lang: 'en' | 'es' | 'fa' | 'ar' }
export interface Member { uid: string; role: 'owner' | 'staff' | 'client'; email: string; name?: string; clientId?: string }
export interface Invite { code: string; email: string; role: 'staff' | 'client'; clientId?: string; expiresAt: number; usedBy: string | null; join: string }
export interface TeamState { members: Member[]; invites: Invite[]; org: AccountProfile | null }
export interface AccountsAdapter {
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, name: string): Promise<void>;
  /** Optional provider; off unless config enables it. */
  googleSignIn?(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  resendVerification(): Promise<void>;
  /** True once the email is verified (the session then moves to onboarding or live). */
  recheckVerified(): Promise<boolean>;
  createAccount(p: AccountProfile): Promise<void>;
  joinWithCode(raw: string): Promise<void>;
  joinLink(orgId: string, code: string): string;
  watchTeam(cb: (t: TeamState) => void): () => void;
  createInvite(email: string, role: 'staff' | 'client', clientId: string | null): Promise<string>;
  revokeInvite(code: string): Promise<void>;
  removeMember(uid: string): Promise<void>;
  updateAccount(p: AccountProfile): Promise<void>;
  resume(): Promise<void>;
  signOut(): Promise<void>;
  /** Self-hosted server only: finish a password reset from the emailed link (#reset=…). */
  confirmReset?(token: string, password: string): Promise<void>;
  /** Self-hosted server only, ADMIN_EMAILS: landing-page waitlist sign-ups. */
  listWaitlist?(): Promise<WaitlistEntry[]>;
  setWaitlistStatus?(id: number, status: WaitlistStatus): Promise<void>;
  waitlistCsv?(): Promise<Blob>;
}
export type WaitlistStatus = 'new' | 'contacted' | 'invited' | 'archived';
export interface WaitlistEntry { id: number; email: string; company: string; role: string; country: string; shipments: string; note: string; source: string; lang: string; status: WaitlistStatus; createdAt: number; updatedAt: number; submissions: number }
