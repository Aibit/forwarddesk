// Firebase live mode. Loaded on demand (dynamic import) so demo visitors never download the SDK.
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut as fbSignOut, type Auth, type User } from 'firebase/auth';
import {
  collection, connectFirestoreEmulator, deleteDoc, deleteField, doc, getDoc, initializeFirestore, onSnapshot, query, serverTimestamp,
  setDoc, updateDoc, where, writeBatch, Timestamp, type DocumentData, type Firestore, type Unsubscribe,
} from 'firebase/firestore';
import { FIREBASE_CONFIG, ORG_ID, USE_EMULATOR } from './config';
import { bridge, type QuoteCosts, type Writer } from './bridge';
import { getSession, resetSession, setSession, friendly } from './session';
import { EMPTY_COMPANY, store, getStore, type Agent, type Client, type Company, type QuoteRecord } from '../clients/store';
import type { LaneProfile } from '../clients/lanes';
import { hydrateMsdsRules, reloadMsdsRules, type MsdsMeta } from '../clients/msds';
import { agentsDb, joinAgent, splitAgent } from '../agents/db';
import { activities, type AgentActivity } from '../agents/crm';
import { jobsStore } from '../jobs/store';
import type { Job } from '../jobs/data';
import { hydrateTariffs, reloadTariffs, type Tariffs } from '../jobs/tariffs';
import { splitJob, splitTariffs } from './split';
import { startBilling, stopBilling } from '../billing/live';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
function init() {
  if (app) return;
  if (!FIREBASE_CONFIG) throw new Error('backend-off');
  app = initializeApp(FIREBASE_CONFIG);
  auth = getAuth(app);
  db = initializeFirestore(app, { ignoreUndefinedProperties: true });
  if (USE_EMULATOR) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
}

// ── helpers ──
const ms = (v: unknown): number | undefined => (v instanceof Timestamp ? v.toMillis() : typeof v === 'number' ? v : undefined);
const O = () => `orgs/${getSession().orgId}`;
const d = (path: string) => doc(db!, `${O()}/${path}`);
const c = (path: string) => collection(db!, `${O()}/${path}`);
const fail = (e: unknown) => {
  console.warn('[ForwardDesk] backend write refused', e);
  setSession({ error: friendly(e) });
};
const run = (p: Promise<unknown>) => void p.catch(fail);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// Fields of a client the client itself may see (no margin, no internal notes).
const PRIVATE_CLIENT_KEYS = ['marginPct', 'notes', 'agents', 'lanes'] as const;
function clientDocs(cl: Client) {
  const { agents: _a, lanes: _l, ...full } = cl;
  const pub: Record<string, unknown> = { ...full };
  for (const k of PRIVATE_CLIENT_KEYS) delete pub[k];
  return { full, pub };
}

// ── snapshot state ──
let unsubs: Unsubscribe[] = [];
const raw = {
  clients: new Map<string, Client>(),
  lanes: [] as (LaneProfile & { clientId: string })[],
  prefs: new Map<string, Agent[]>(),
  quotes: [] as QuoteRecord[],
  jobs: [] as Job[],
  jobInternal: new Map<string, { rebateReceived?: boolean }>(),
};
function stripLane(l: DocumentData): LaneProfile {
  const { clientId: _c, updatedAt: _u, ...lane } = l;
  return lane as LaneProfile;
}
function composeClients() {
  const clients = [...raw.clients.values()].map((cl) => ({
    ...cl,
    agents: raw.prefs.get(cl.id) ?? [],
    lanes: raw.lanes.filter((l) => l.clientId === cl.id).map(stripLane),
  }));
  store.hydrate({ clients });
}
const portalClient = (id: string, p: DocumentData): Client => ({
  id, name: '', contactName: '', phone: '', email: '', address: '', clearanceAgent: { name: '', phone: '' }, bandarAbbas: { name: '', phone: '' },
  lang: 'en', incoterm: 'FOB', marginPct: 0, lines: [], freeTimeRequest: null, paymentTerms: '', notes: '', agents: [], lanes: [],
  ...(p as Partial<Client>),
});

function subscribe(role: 'staff' | 'client', clientId: string | null) {
  const err = (e: unknown) => fail(e);
  const mine = <T,>(col: string) => (role === 'staff' ? c(col) : query(c(col), where('clientId', '==', clientId))) as ReturnType<typeof c> as T;
  unsubs.push(onSnapshot(doc(db!, O()), (s) => store.hydrate({ company: { ...EMPTY_COMPANY, ...((s.data()?.company as Partial<Company>) ?? {}) } }), err));
  if (role === 'staff') {
    unsubs.push(onSnapshot(c('clients'), (s) => {
      raw.clients = new Map(s.docs.map((x) => [x.id, { ...(x.data() as Client), id: x.id }]));
      composeClients();
    }, err));
    unsubs.push(onSnapshot(c('agentPrefs'), (s) => {
      raw.prefs = new Map(s.docs.map((x) => [x.id, (x.data().agents as Agent[]) ?? []]));
      composeClients();
    }, err));
  } else {
    unsubs.push(onSnapshot(d(`clientPublic/${clientId}`), (s) => {
      raw.clients = new Map([[clientId!, portalClient(clientId!, s.data() ?? {})]]);
      composeClients();
    }, err));
    unsubs.push(onSnapshot(d(`agentPrefs/${clientId}`), (s) => {
      raw.prefs = new Map([[clientId!, (s.data()?.agents as Agent[]) ?? []]]);
      composeClients();
    }, err));
  }
  unsubs.push(onSnapshot(mine<ReturnType<typeof c>>('lanes'), (s) => {
    raw.lanes = s.docs.map((x) => x.data() as LaneProfile & { clientId: string }).sort((a, b) => (a.id < b.id ? -1 : 1));
    composeClients();
  }, err));
  unsubs.push(onSnapshot(mine<ReturnType<typeof c>>('quotes'), (s) => {
    const quotes = s.docs.map((x) => {
      const q = x.data();
      return { ...(q as QuoteRecord), id: x.id, acceptedAt: ms(q.acceptedAt) };
    }).sort((a, b) => b.at - a.at);
    store.hydrate({ quotes });
  }, err));
  const composeJobs = () => jobsStore.hydrate(raw.jobs.map((j) => (j.collect ? { ...j, collect: { ...j.collect, rebateReceived: !!raw.jobInternal.get(j.id)?.rebateReceived } } : j)));
  unsubs.push(onSnapshot(mine<ReturnType<typeof c>>('jobs'), (s) => {
    raw.jobs = s.docs.map((x) => {
      const j = x.data() as Job & { createdAt?: number };
      return { ...j, id: x.id, portal: j.portal ? { ...j.portal, draftBlApprovedAt: ms(j.portal.draftBlApprovedAt) } : undefined };
    }).sort((a, b) => ((b as { createdAt?: number }).createdAt ?? 0) - ((a as { createdAt?: number }).createdAt ?? 0));
    composeJobs();
  }, err));
  if (role === 'staff') {
    unsubs.push(onSnapshot(c('jobInternal'), (s) => {
      raw.jobInternal = new Map(s.docs.map((x) => [x.id, x.data() as { rebateReceived?: boolean }]));
      composeJobs();
    }, err));
  }
  // Agents: directory doc (members) + CRM doc (staff only), joined by id.
  let agPub = new Map<string, DocumentData>();
  let agCrm = new Map<string, DocumentData>();
  const composeAgents = () => agentsDb.hydrate([...agPub.entries()]
    .filter(([id, p]) => role === 'staff' || (!p.hidden && id))
    .map(([id, p]) => joinAgent(p, agCrm.get(id), id)).sort((a, b) => a.name.localeCompare(b.name)));
  unsubs.push(onSnapshot(c('agents'), (s) => { agPub = new Map(s.docs.map((x) => [x.id, x.data()])); composeAgents(); }, err));
  if (role === 'staff') {
    unsubs.push(onSnapshot(c('agentCrm'), (s) => { agCrm = new Map(s.docs.map((x) => [x.id, x.data()])); composeAgents(); }, err));
    unsubs.push(onSnapshot(c('agentActivities'), (s) => activities.hydrate(s.docs.map((x) => {
      const a = x.data();
      return { ...(a as AgentActivity), id: x.id };
    })), err));
  }
  let pubT: Partial<Tariffs> = {};
  let privT: Partial<Tariffs> = {};
  unsubs.push(onSnapshot(d('settings/tariffs'), (s) => { pubT = (s.data()?.data as Partial<Tariffs>) ?? {}; hydrateTariffs({ ...pubT, ...privT }); }, err));
  if (role === 'staff') unsubs.push(onSnapshot(d('settings/tariffsPrivate'), (s) => { privT = (s.data()?.data as Partial<Tariffs>) ?? {}; hydrateTariffs({ ...pubT, ...privT }); }, err));
  unsubs.push(onSnapshot(d('settings/msdsRules'), (s) => hydrateMsdsRules((s.data()?.rules as never) ?? null), err));
  unsubs.push(...startBilling(db!, O(), role, clientId, auth!.currentUser?.uid ?? '', err));
}

function writer(user: User, role: 'staff' | 'client', clientId: string | null): Writer {
  const staffOnly = (what: string) => {
    if (role !== 'staff') {
      fail({ code: 'permission-denied', message: what });
      return false;
    }
    return true;
  };
  const laneWrites = (cid: string, lanes: LaneProfile[], prev: LaneProfile[]) => {
    const b = writeBatch(db!);
    for (const l of lanes) {
      const p = prev.find((x) => x.id === l.id);
      if (p && same(p, l)) continue;
      const source = role === 'client' ? (p ? p.source ?? 'desk' : 'portal') : l.source ?? 'desk';
      b.set(d(`lanes/${l.id}`), { ...l, msds: l.msds ?? null, dg: !!l.dg, clientId: cid, source, updatedAt: Date.now() });
    }
    for (const p of prev) if (!lanes.some((l) => l.id === p.id)) b.delete(d(`lanes/${p.id}`));
    return b;
  };
  return {
    role,
    clientId,
    upsertClient(cl) {
      if (!staffOnly('client')) return;
      const { full, pub } = clientDocs(cl);
      const prev = getStore().clients.find((x) => x.id === cl.id);
      const b = laneWrites(cl.id, cl.lanes, prev?.lanes ?? []);
      b.set(d(`clients/${cl.id}`), full);
      b.set(d(`clientPublic/${cl.id}`), pub);
      b.set(d(`agentPrefs/${cl.id}`), { clientId: cl.id, agents: cl.agents, updatedAt: Date.now() });
      run(b.commit());
    },
    removeClient(id) {
      if (!staffOnly('client')) return;
      const b = writeBatch(db!);
      b.delete(d(`clients/${id}`));
      b.delete(d(`clientPublic/${id}`));
      b.delete(d(`agentPrefs/${id}`));
      for (const l of raw.lanes.filter((x) => x.clientId === id)) b.delete(d(`lanes/${l.id}`));
      run(b.commit());
    },
    setAgents(cid, agents) {
      run(setDoc(d(`agentPrefs/${cid}`), { clientId: cid, agents, updatedAt: Date.now() }));
    },
    setLanes(cid, lanes, prev) {
      run(laneWrites(cid, lanes, prev).commit());
    },
    setCompany(co) {
      if (!staffOnly('company')) return;
      run(updateDoc(doc(db!, O()), { company: co }));
    },
    recordQuote(rec: QuoteRecord, costs?: QuoteCosts) {
      if (!staffOnly('quote')) return;
      const b = writeBatch(db!);
      b.set(d(`quotes/${rec.id}`), { ...rec });
      if (costs) b.set(d(`quotes/${rec.id}/private/costs`), costs);
      run(b.commit());
    },
    setQuoteStatus(id, status, acceptedOption, via = 'desk') {
      if (role === 'client') {
        run(updateDoc(d(`quotes/${id}`), { status: 'won', acceptedOption: acceptedOption ?? '', acceptedVia: 'portal', acceptedAt: serverTimestamp(), acceptedBy: user.uid }));
        return;
      }
      const won = status === 'won';
      run(updateDoc(d(`quotes/${id}`), {
        status,
        acceptedOption: won ? acceptedOption ?? deleteField() : deleteField(),
        acceptedVia: won ? via : deleteField(),
        acceptedAt: won ? serverTimestamp() : deleteField(),
        acceptedBy: won ? user.uid : deleteField(),
      }));
    },
    agentUpsert(a) {
      if (!staffOnly('agents')) return;
      const { pub, crm } = splitAgent(a);
      const b = writeBatch(db!);
      b.set(d(`agents/${a.id}`), pub);
      b.set(d(`agentCrm/${a.id}`), crm);
      run(b.commit());
    },
    agentRemove(id) {
      if (!staffOnly('agents')) return;
      const b = writeBatch(db!);
      b.delete(d(`agents/${id}`));
      b.delete(d(`agentCrm/${id}`));
      run(b.commit());
    },
    agentReplace(list) {
      if (!staffOnly('agents')) return;
      type B = ReturnType<typeof writeBatch>;
      const ops: ((b: B) => void)[] = [
        ...list.flatMap((a) => { const { pub, crm } = splitAgent(a); return [(b: B) => b.set(d(`agents/${a.id}`), pub), (b: B) => b.set(d(`agentCrm/${a.id}`), crm)]; }),
        ...agentsDb.get().list.filter((x) => !list.some((a) => a.id === x.id)).flatMap((x) => [(b: B) => b.delete(d(`agents/${x.id}`)), (b: B) => b.delete(d(`agentCrm/${x.id}`))]),
      ];
      for (let i = 0; i < ops.length; i += 400) {
        const b = writeBatch(db!);
        ops.slice(i, i + 400).forEach((f) => f(b));
        run(b.commit());
      }
    },
    activityUpsert(a) {
      if (!staffOnly('agentActivities')) return;
      const { id, sample: _s, ...rest } = a;
      run(setDoc(d(`agentActivities/${id}`), { ...rest, by: user.uid }));
    },
    activityRemove(id) {
      if (staffOnly('agentActivities')) run(deleteDoc(d(`agentActivities/${id}`)));
    },
    setMsdsRules(r) {
      if (staffOnly('msdsRules')) run(setDoc(d('settings/msdsRules'), { rules: r }));
    },
    setTariffs(t) {
      if (!staffOnly('tariffs')) return;
      const { pub, priv } = splitTariffs(t);
      const b = writeBatch(db!);
      b.set(d('settings/tariffs'), { data: pub });
      b.set(d('settings/tariffsPrivate'), { data: priv });
      run(b.commit());
    },
    async saveMsds(file, cid): Promise<MsdsMeta> {
      const buf = new Uint8Array(await file.arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      const id = `msds-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const type = file.type || 'application/octet-stream';
      await setDoc(d(`msds/${id}`), { clientId: cid ?? clientId ?? 'desk', name: file.name, type, size: file.size, dataB64: btoa(bin), uid: user.uid, at: serverTimestamp() });
      return { id, name: file.name, size: file.size, type, at: Date.now() };
    },
    async loadMsds(id) {
      const s = await getDoc(d(`msds/${id}`));
      const v = s.data();
      if (!v) return undefined;
      const bin = atob(v.dataB64 as string);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return new Blob([out], { type: v.type as string });
    },
    async deleteMsds(id) {
      await deleteDoc(d(`msds/${id}`));
    },
    async createJob(j) {
      if (!staffOnly('job')) return;
      const { job, internal } = splitJob(j);
      const b = writeBatch(db!);
      b.set(d(`jobs/${j.id}`), { ...job, createdAt: Date.now() });
      if (internal) b.set(d(`jobInternal/${j.id}`), internal);
      await b.commit();
    },
    approveDraftBl(jobId) {
      run(updateDoc(d(`jobs/${jobId}`), { portal: { draftBlApprovedAt: serverTimestamp(), by: user.uid } }));
    },
  };
}

function stop() {
  unsubs.forEach((u) => u());
  unsubs = [];
  bridge.w = null;
  raw.clients = new Map();
  raw.lanes = [];
  raw.prefs = new Map();
  raw.jobs = [];
  raw.jobInternal = new Map();
  store.reload();
  jobsStore.reload();
  agentsDb.reload();
  activities.reload();
  reloadTariffs();
  reloadMsdsRules();
  stopBilling();
}

async function start(user: User) {
  const link = await getDoc(doc(db!, `userOrgs/${user.uid}`)).catch(() => null);
  const orgId = (link?.data()?.orgId as string | undefined) ?? ORG_ID;
  const m = await getDoc(doc(db!, `orgs/${orgId}/members/${user.uid}`)).catch(() => null);
  const mem = m?.data();
  if (!mem) throw Object.assign(new Error('no-org'), { code: 'no-org' });
  const role = mem.role as 'staff' | 'client';
  const clientId = role === 'client' ? (mem.clientId as string) : null;
  stop();
  setSession({ orgId });
  bridge.w = writer(user, role, clientId);
  bridge.onError = fail;
  subscribe(role, clientId);
  setSession({ mode: 'live', uid: user.uid, email: user.email, role, clientId, orgId, error: null });
}

let watching = false;
function watch() {
  if (watching) return;
  watching = true;
  onAuthStateChanged(auth!, (u) => {
    if (!u && getSession().mode === 'live') {
      stop();
      resetSession();
    }
  });
}

export async function signIn(email: string, password: string) {
  init();
  watch();
  const cred = await signInWithEmailAndPassword(auth!, email.trim(), password);
  try {
    await start(cred.user);
  } catch (e) {
    await fbSignOut(auth!);
    throw e;
  }
}
export async function resume() {
  init();
  await auth!.authStateReady();
  watch();
  if (!auth!.currentUser) {
    resetSession();
    localStorage.removeItem('fd.live');
    return;
  }
  await start(auth!.currentUser);
}
export async function signOut() {
  stop();
  if (auth) await fbSignOut(auth);
}
