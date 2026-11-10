// Seed the 'demo' org in Firestore with the ForwardDesk SAMPLE data and create test accounts.
//
//   Emulator:  FIREBASE_EMULATOR=1 npx tsx scripts/seed.ts
//   Live:      FB_CONFIG='{"apiKey":…,"projectId":…}' npx tsx scripts/seed.ts
//
// Uses the normal client SDK, so every write goes through the deployed security rules.
// Test-account credentials are written to $ACCOUNTS_FILE (default /workspace/forwarddesk-test-accounts.txt, chmod 600).
// They are never printed and never committed.
import { readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const mem = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k),
};

const { initializeApp } = await import('firebase/app');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } = await import('firebase/auth');
const { initializeFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, writeBatch } = await import('firebase/firestore');
const { sampleClients, sampleQuotes, clientForJob } = await import('../src/clients/store');
const { sampleJobs } = await import('../src/jobs/data');
const { DEFAULT_TARIFFS } = await import('../src/jobs/tariffs');
const { DEFAULT_MSDS_RULES } = await import('../src/clients/msds');
const { csvToAgents } = await import('../src/agents/db');
const { splitJob, splitTariffs } = await import('../src/backend/split');

const EMU = process.env.FIREBASE_EMULATOR === '1';
const config = EMU ? { apiKey: 'demo-key', projectId: 'demo-forwarddesk', appId: 'demo-app' } : JSON.parse(process.env.FB_CONFIG || 'null');
if (!config) throw new Error('Set FB_CONFIG (web app config JSON) or FIREBASE_EMULATOR=1');
const ORG = 'demo';
const FILE = process.env.ACCOUNTS_FILE || '/workspace/forwarddesk-test-accounts.txt';

const app = initializeApp(config);
const auth = getAuth(app);
const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
if (EMU) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

interface Acct { label: string; email: string; password: string; role: 'staff' | 'client'; clientId?: string }
const pw = () => randomBytes(12).toString('base64url');
const prevAccts: Acct[] = (() => {
  if (!existsSync(FILE)) return [];
  try { return JSON.parse(readFileSync(FILE, 'utf8').split('--- json ---')[1] ?? '[]'); } catch { return []; }
})();
const acct = (label: string, email: string, role: Acct['role'], clientId?: string): Acct => prevAccts.find((a) => a.email === email) ?? { label, email, password: pw(), role, clientId };
const STAFF = acct('Staff (forwarder desk)', 'fd-staff-demo@example.com', 'staff');
const CLIENTS = [acct('Client — Customer C (exporter)', 'fd-client-c-demo@example.com', 'client', 'c-c'), acct('Client — Customer F (importer)', 'fd-client-f-demo@example.com', 'client', 'c-f')];

async function ensureUser(a: Acct) {
  try {
    return (await createUserWithEmailAndPassword(auth, a.email, a.password)).user;
  } catch (e) {
    if ((e as { code?: string }).code !== 'auth/email-already-in-use') throw e;
    return (await signInWithEmailAndPassword(auth, a.email, a.password)).user;
  }
}
const O = `orgs/${ORG}`;
async function commitAll(ops: [string, Record<string, unknown>][]) {
  for (let i = 0; i < ops.length; i += 400) {
    const b = writeBatch(db);
    for (const [p, v] of ops.slice(i, i + 400)) b.set(doc(db, p), v);
    await b.commit();
  }
}

// 1) staff + org bootstrap
const staff = await ensureUser(STAFF);
const orgRef = doc(db, O);
const org = await getDoc(orgRef).catch(() => null);
if (!org?.exists()) {
  await setDoc(orgRef, { name: 'ForwardDesk demo (SAMPLE)', ownerUid: staff.uid, demo: true, createdAt: Date.now(),
    company: { name: 'ForwardDesk demo forwarder (sample)', contactName: 'Sample desk', email: 'desk@example.com', phone: '+00 000 000 0000', address: 'Bandar Abbas (sample)', logo: null } });
  await setDoc(doc(db, `${O}/members/${staff.uid}`), { role: 'staff', email: STAFF.email, createdAt: Date.now() });
  await setDoc(doc(db, `userOrgs/${staff.uid}`), { orgId: ORG });
  console.log('org created');
} else console.log('org exists — reseeding data');

// 2) data
const now = Date.now();
const clients = sampleClients();
const ops: [string, Record<string, unknown>][] = [];
for (const c of clients) {
  const { agents, lanes, ...full } = c;
  const { marginPct: _m, notes: _n, ...pub } = full;
  ops.push([`${O}/clients/${c.id}`, full]);
  ops.push([`${O}/clientPublic/${c.id}`, pub]);
  ops.push([`${O}/agentPrefs/${c.id}`, { clientId: c.id, agents, updatedAt: now }]);
  for (const l of lanes) ops.push([`${O}/lanes/${l.id}`, { ...l, msds: l.msds ?? null, dg: !!l.dg, clientId: c.id, source: l.source ?? 'desk', updatedAt: now }]);
}
sampleJobs(now).forEach((j, i) => {
  const c = clientForJob(clients, j.customer);
  const { job, internal } = splitJob(j);
  ops.push([`${O}/jobs/${j.id}`, { ...job, clientId: c?.id ?? 'unassigned', sample: true, createdAt: now - i * 1000 }]);
  if (internal) ops.push([`${O}/jobInternal/${j.id}`, internal]);
});
for (const q of sampleQuotes(now)) {
  ops.push([`${O}/quotes/${q.id}`, { ...q }]);
  const m = clients.find((c) => c.id === q.clientId)?.marginPct ?? 15;
  ops.push([`${O}/quotes/${q.id}/private/costs`, {
    sample: true, marginPct: m,
    options: q.options.map((o) => { const buy = Math.round(o.sell / (1 + m / 100)); return { carrier: o.carrier, buy, margin: o.sell - buy, marginPct: m }; }),
  }]);
}
const { list: agents } = csvToAgents(readFileSync('src/agents/seed/agents.csv', 'utf8'), true);
agents.forEach((a, i) => ops.push([`${O}/agents/db-s${String(i).padStart(2, '0')}`, { ...a, id: `db-s${String(i).padStart(2, '0')}` }]));
const tt = splitTariffs(DEFAULT_TARIFFS);
ops.push([`${O}/settings/tariffs`, { data: tt.pub }]);
ops.push([`${O}/settings/tariffsPrivate`, { data: tt.priv }]);
ops.push([`${O}/settings/msdsRules`, { rules: DEFAULT_MSDS_RULES }]);
await commitAll(ops);
console.log(`seeded ${clients.length} clients, ${sampleJobs(now).length} jobs, ${sampleQuotes(now).length} quotes, ${agents.length} agents`);

// 3) client accounts (creating a user signs in as them; switch back to staff to link them)
for (const a of CLIENTS) {
  const u = await ensureUser(a);
  await signOut(auth);
  await signInWithEmailAndPassword(auth, STAFF.email, STAFF.password);
  await setDoc(doc(db, `${O}/members/${u.uid}`), { role: 'client', clientId: a.clientId, email: a.email, createdAt: Date.now() });
  await setDoc(doc(db, `userOrgs/${u.uid}`), { orgId: ORG });
}
await signOut(auth);

// 4) credentials file (owner-only)
const all = [STAFF, ...CLIENTS];
const txt = [
  `ForwardDesk test accounts — ${EMU ? 'EMULATOR (local only)' : `project ${config.projectId}`} · org "${ORG}" · SAMPLE data only`,
  'Keep private. Do not paste in chat or commit.',
  '',
  ...all.map((a) => `${a.label}\n  email:    ${a.email}\n  password: ${a.password}${a.clientId ? `\n  clientId: ${a.clientId}` : ''}`),
  '',
  '--- json ---',
  JSON.stringify(all),
].join('\n');
writeFileSync(FILE, txt, { mode: 0o600 });
chmodSync(FILE, 0o600);
console.log(`accounts written to ${FILE} (chmod 600)`);
process.exit(0);
