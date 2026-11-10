// Firestore rules tests — run with:
//   npx firebase-tools emulators:exec --only firestore --project demo-forwarddesk "node scripts/rules-test.mjs"
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where, serverTimestamp } from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'demo-forwarddesk',
  firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
});
const O = 'orgs/demo';
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, O), { name: 'Demo', ownerUid: 'staff1' });
  await setDoc(doc(db, `${O}/members/staff1`), { role: 'staff', email: 's@x' });
  await setDoc(doc(db, `${O}/members/cliC`), { role: 'client', clientId: 'C', email: 'c@x' });
  await setDoc(doc(db, `${O}/members/cliD`), { role: 'client', clientId: 'D', email: 'd@x' });
  await setDoc(doc(db, `${O}/clients/C`), { name: 'Customer C', marginPct: 12 });
  await setDoc(doc(db, `${O}/clientPublic/C`), { name: 'Customer C' });
  await setDoc(doc(db, `${O}/clientPublic/D`), { name: 'Customer D' });
  await setDoc(doc(db, `${O}/jobs/J1`), { clientId: 'C', customer: 'Customer C', step: 'x' });
  await setDoc(doc(db, `${O}/jobs/J2`), { clientId: 'D', customer: 'Customer D', step: 'x' });
  await setDoc(doc(db, `${O}/quotes/Q1`), { clientId: 'C', status: 'sent', options: [{ carrier: 'A', sell: 1000 }] });
  await setDoc(doc(db, `${O}/quotes/Q1/private/costs`), { options: [{ carrier: 'A', buy: 800, margin: 200 }] });
  await setDoc(doc(db, `${O}/quotes/Q2`), { clientId: 'D', status: 'sent', options: [] });
  await setDoc(doc(db, `${O}/lanes/L1`), { id: 'L1', clientId: 'C', source: 'desk', pol: 'Bandar Abbas', pod: 'Jebel Ali',
    commodity: 'Bitumen', hs: '271320', volume: { amount: 10, unit: 'TEU', period: 'month' }, payment: 'Prepaid',
    target: { amount: 900, currency: 'USD', per: 'container' }, notes: '' });
  await setDoc(doc(db, `${O}/agents/A1`), { name: 'Agent' });
  await setDoc(doc(db, `${O}/settings/tariffsPrivate`), { data: { lineRebatePct: 2.5 } });
  await setDoc(doc(db, `${O}/settings/tariffs`), { data: {} });
  await setDoc(doc(db, `${O}/jobInternal/J1`), { rebateReceived: false });
  await setDoc(doc(db, `userOrgs/cliD`), { orgId: 'other' });
  await setDoc(doc(db, 'orgs/other'), { name: 'Other', ownerUid: 'x' });
});

const staff = env.authenticatedContext('staff1').firestore();
const c = env.authenticatedContext('cliC').firestore();
const d = env.authenticatedContext('cliD').firestore();
const anon = env.unauthenticatedContext().firestore();
const stranger = env.authenticatedContext('nobody').firestore();

let pass = 0, fail = 0;
async function t(name, p) {
  try { await p; pass++; console.log('  ok  ', name); }
  catch (e) { fail++; console.log('  FAIL', name, '-', e.message?.split('\n')[0]); }
}
const lane = (id, cid, extra = {}) => ({ id, clientId: cid, source: 'portal', pol: 'Bandar Abbas', pod: 'Mundra',
  commodity: 'Bitumen', hs: '271320', volume: { amount: 4, unit: 'TEU', period: 'month' }, payment: 'Prepaid',
  target: { amount: 800, currency: 'USD', per: 'container' }, notes: 'RFQ', dg: false, msds: null, submittedAt: 1, ...extra });

console.log('Staff');
await t('staff reads client margin', assertSucceeds(getDoc(doc(staff, `${O}/clients/C`))));
await t('staff reads buy rates', assertSucceeds(getDoc(doc(staff, `${O}/quotes/Q1/private/costs`))));
await t('staff creates job', assertSucceeds(setDoc(doc(staff, `${O}/jobs/J3`), { clientId: 'C', step: 'booking' })));
await t('staff lists all jobs', assertSucceeds(getDocs(collection(staff, `${O}/jobs`))));

console.log('Client C — own data');
await t('C reads own job', assertSucceeds(getDoc(doc(c, `${O}/jobs/J1`))));
await t('C lists own jobs (query by clientId)', assertSucceeds(getDocs(query(collection(c, `${O}/jobs`), where('clientId', '==', 'C')))));
await t('C reads own quote', assertSucceeds(getDoc(doc(c, `${O}/quotes/Q1`))));
await t('C reads own public profile', assertSucceeds(getDoc(doc(c, `${O}/clientPublic/C`))));
await t('C reads agents DB', assertSucceeds(getDoc(doc(c, `${O}/agents/A1`))));
await t('C accepts own sent quote', assertSucceeds(updateDoc(doc(c, `${O}/quotes/Q1`), {
  status: 'won', acceptedOption: 'A', acceptedVia: 'portal', acceptedAt: serverTimestamp(), acceptedBy: 'cliC' })));
await t('C approves draft B/L on own job', assertSucceeds(updateDoc(doc(c, `${O}/jobs/J1`), {
  portal: { draftBlApprovedAt: serverTimestamp(), by: 'cliC' } })));
await t('C submits RFQ lane', assertSucceeds(setDoc(doc(c, `${O}/lanes/L9`), lane('L9', 'C'))));
await t('C attaches MSDS meta to desk lane', assertSucceeds(updateDoc(doc(c, `${O}/lanes/L1`), {
  msds: { id: 'm1', name: 'a.pdf', size: 10, type: 'application/pdf', at: 1 }, updatedAt: 2 })));
await t('C writes own preferred agents', assertSucceeds(setDoc(doc(c, `${O}/agentPrefs/C`), { clientId: 'C', agents: [{ name: 'X' }], updatedAt: 1 })));
await t('C uploads MSDS', assertSucceeds(setDoc(doc(c, `${O}/msds/m1`), { clientId: 'C', name: 'a.pdf', type: 'application/pdf',
  size: 3, dataB64: 'AAAA', uid: 'cliC', at: serverTimestamp() })));

console.log('Client C — must be denied');
await t('C cannot read buy rates', assertFails(getDoc(doc(c, `${O}/quotes/Q1/private/costs`))));
await t('C cannot read client margin record', assertFails(getDoc(doc(c, `${O}/clients/C`))));
await t('C cannot read D job', assertFails(getDoc(doc(c, `${O}/jobs/J2`))));
await t('C cannot list all jobs', assertFails(getDocs(collection(c, `${O}/jobs`))));
await t('C cannot query D jobs', assertFails(getDocs(query(collection(c, `${O}/jobs`), where('clientId', '==', 'D')))));
await t('C cannot read D quote', assertFails(getDoc(doc(c, `${O}/quotes/Q2`))));
await t('C cannot read D profile', assertFails(getDoc(doc(c, `${O}/clientPublic/D`))));
await t('C cannot accept D quote', assertFails(updateDoc(doc(c, `${O}/quotes/Q2`), {
  status: 'won', acceptedOption: 'A', acceptedVia: 'portal', acceptedAt: serverTimestamp(), acceptedBy: 'cliC' })));
await t('C cannot change job step', assertFails(updateDoc(doc(c, `${O}/jobs/J1`), { step: 'released' })));
await t('C cannot move job to own clientId hijack', assertFails(updateDoc(doc(c, `${O}/jobs/J2`), { portal: { draftBlApprovedAt: serverTimestamp(), by: 'cliC' } })));
await t('C cannot create job', assertFails(setDoc(doc(c, `${O}/jobs/J9`), { clientId: 'C' })));
await t('C cannot create lane for D', assertFails(setDoc(doc(c, `${O}/lanes/L8`), lane('L8', 'D'))));
await t('C cannot create desk-sourced lane', assertFails(setDoc(doc(c, `${O}/lanes/L7`), lane('L7', 'C', { source: 'desk' }))));
await t('C cannot add unknown field to lane', assertFails(setDoc(doc(c, `${O}/lanes/L6`), lane('L6', 'C', { marginPct: 1 }))));
await t('C cannot edit desk lane target', assertFails(updateDoc(doc(c, `${O}/lanes/L1`), { target: { amount: 1, currency: 'USD', per: 'container' } })));
await t('C cannot self-promote to staff', assertFails(updateDoc(doc(c, `${O}/members/cliC`), { role: 'staff' })));
await t('C cannot switch own clientId', assertFails(setDoc(doc(c, `${O}/members/cliC`), { role: 'client', clientId: 'D' })));
await t('C cannot write D preferred agents', assertFails(setDoc(doc(c, `${O}/agentPrefs/D`), { clientId: 'D', agents: [], updatedAt: 1 })));
await t('C cannot write agents DB', assertFails(setDoc(doc(c, `${O}/agents/A2`), { name: 'Fake' })));
await t('C cannot write tariffs', assertFails(setDoc(doc(c, `${O}/settings/tariffs`), { x: 1 })));
await t('C cannot upload MSDS for D', assertFails(setDoc(doc(c, `${O}/msds/m2`), { clientId: 'D', name: 'a', type: 'x', size: 1, dataB64: 'A', uid: 'cliC', at: serverTimestamp() })));
await t('C cannot accept already-won quote again (re-open)', assertFails(updateDoc(doc(c, `${O}/quotes/Q1`), { status: 'sent' })));
await t('C cannot link self to org', assertFails(setDoc(doc(c, `userOrgs/cliC`), { orgId: 'demo' })));

await t('C cannot read rebate % (tariffsPrivate)', assertFails(getDoc(doc(c, `${O}/settings/tariffsPrivate`))));
await t('C can read customer-facing tariffs', assertSucceeds(getDoc(doc(c, `${O}/settings/tariffs`))));
await t('C cannot read jobInternal', assertFails(getDoc(doc(c, `${O}/jobInternal/J1`))));
await t('staff of demo cannot pull a user from another org', assertFails(setDoc(doc(staff, 'userOrgs/cliD'), { orgId: 'demo' })));
console.log('Client D');
await t('D reads own job', assertSucceeds(getDoc(doc(d, `${O}/jobs/J2`))));
await t('D cannot read C job', assertFails(getDoc(doc(d, `${O}/jobs/J1`))));
await t('D cannot read C MSDS', assertFails(getDoc(doc(d, `${O}/msds/m1`))));

console.log('Outsiders');
await t('anon cannot read org', assertFails(getDoc(doc(anon, O))));
await t('stranger cannot read jobs', assertFails(getDoc(doc(stranger, `${O}/jobs/J1`))));
await t('stranger cannot join org as staff', assertFails(setDoc(doc(stranger, `${O}/members/nobody`), { role: 'staff' })));
await t('stranger cannot create a second org', assertFails(setDoc(doc(stranger, 'orgs/evil'), { name: 'x', ownerUid: 'nobody' })));
await t('stranger cannot take over demo org', assertFails(setDoc(doc(stranger, O), { name: 'x', ownerUid: 'nobody' })));

console.log(`\n${pass} passed, ${fail} failed`);
await env.cleanup();
process.exit(fail ? 1 : 0);
