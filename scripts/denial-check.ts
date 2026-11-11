// Live (or emulator) check that the deployed rules block cross-client and buy-rate reads.
//   FIREBASE_EMULATOR=1 npx tsx scripts/denial-check.ts      |      FB_CONFIG='{…}' npx tsx scripts/denial-check.ts
// Reads test accounts from $ACCOUNTS_FILE; prints only pass/fail, never credentials.
import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator, doc, getDoc, getDocs, collection, query, where, updateDoc, setDoc } from 'firebase/firestore';

const EMU = process.env.FIREBASE_EMULATOR === '1';
const config = EMU ? { apiKey: 'demo-key', projectId: 'demo-forwarddesk', appId: 'demo-app' } : JSON.parse(process.env.FB_CONFIG || 'null');
const accts = JSON.parse(readFileSync(process.env.ACCOUNTS_FILE || '/workspace/forwarddesk-test-accounts.txt', 'utf8').split('--- json ---')[1]);
const app = initializeApp(config);
const auth = getAuth(app);
const db = initializeFirestore(app, {});
if (EMU) { connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true }); connectFirestoreEmulator(db, '127.0.0.1', 8080); }
const O = 'orgs/demo';
let bad = 0;
async function expect(name: string, allow: boolean, p: () => Promise<unknown>) {
  let ok: boolean;
  try { await p(); ok = true; } catch (e) { ok = false; if (allow) console.log('   ', (e as Error).message); }
  const pass = ok === allow;
  if (!pass) bad++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${allow ? 'allowed' : 'denied '}  ${name}`);
}
const as = async (clientId: string | null) => {
  await signOut(auth);
  const a = accts.find((x: { role: string; clientId?: string }) => (clientId ? x.clientId === clientId : x.role === 'staff'));
  await signInWithEmailAndPassword(auth, a.email, a.password);
};
await as(null);
await expect('staff reads buy rates (quotes/…/private/costs)', true, () => getDoc(doc(db, `${O}/quotes/FD-Q-SAMPLE-101/private/costs`)));
await expect('staff reads client margin record', true, () => getDoc(doc(db, `${O}/clients/c-c`)));
await expect('staff lists agent CRM', true, () => getDocs(collection(db, `${O}/agentCrm`)));
await expect('staff lists agent activities', true, () => getDocs(collection(db, `${O}/agentActivities`)));
await as('c-c');
await expect('client C reads own job FD-E-1047', true, () => getDoc(doc(db, `${O}/jobs/FD-E-1047`)));
await expect('client C lists own jobs (clientId == c-c)', true, () => getDocs(query(collection(db, `${O}/jobs`), where('clientId', '==', 'c-c'))));
await expect('client C reads buy rates of own quote', false, () => getDoc(doc(db, `${O}/quotes/FD-Q-SAMPLE-101/private/costs`)));
await expect('client C reads own margin record (clients/c-c)', false, () => getDoc(doc(db, `${O}/clients/c-c`)));
await expect('client C reads Customer F job FD-I-0921', false, () => getDoc(doc(db, `${O}/jobs/FD-I-0921`)));
await expect('client C queries Customer F jobs', false, () => getDocs(query(collection(db, `${O}/jobs`), where('clientId', '==', 'c-f'))));
await expect('client C lists all jobs', false, () => getDocs(collection(db, `${O}/jobs`)));
await expect('client C reads Customer E quote', false, () => getDoc(doc(db, `${O}/quotes/FD-Q-SAMPLE-099`)));
await expect('client C reads Customer F profile', false, () => getDoc(doc(db, `${O}/clientPublic/c-f`)));
await expect('client C reads line-rebate % (settings/tariffsPrivate)', false, () => getDoc(doc(db, `${O}/settings/tariffsPrivate`)));
await expect('client C reads rebate status (jobInternal)', false, () => getDoc(doc(db, `${O}/jobInternal/FD-E-1047`)));
await expect('client C reads customer-facing tariffs', true, () => getDoc(doc(db, `${O}/settings/tariffs`)));
await expect('client C reads agent directory', true, () => getDocs(collection(db, `${O}/agents`)));
await expect('client C reads agent CRM (contacts, credit, notes)', false, () => getDoc(doc(db, `${O}/agentCrm/db-s0`)));
await expect('client C lists agent CRM', false, () => getDocs(collection(db, `${O}/agentCrm`)));
await expect('client C reads agent activities', false, () => getDocs(collection(db, `${O}/agentActivities`)));
await expect('client C blacklists an agent', false, () => setDoc(doc(db, `${O}/agentCrm/db-s0`), { status: 'blacklisted' }));
await expect('client C changes job step', false, () => updateDoc(doc(db, `${O}/jobs/FD-E-1047`), { step: 'E23' }));
await expect('client C promotes self to staff', false, async () => setDoc(doc(db, `${O}/members/${auth.currentUser!.uid}`), { role: 'staff' }));
await as('c-f');
await expect('client F reads Customer C job FD-E-1047', false, () => getDoc(doc(db, `${O}/jobs/FD-E-1047`)));
await expect('client F reads C quote', false, () => getDoc(doc(db, `${O}/quotes/FD-Q-SAMPLE-101`)));
await signOut(auth);
await expect('signed-out user reads org', false, () => getDoc(doc(db, O)));
console.log(bad ? `\n${bad} FAILED` : '\nall checks passed');
process.exit(bad ? 1 : 0);
