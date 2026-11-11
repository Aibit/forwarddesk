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
  await setDoc(doc(db, 'orgs/other/members/staffX'), { role: 'staff', email: 'x@x' });
  await setDoc(doc(db, `${O}/agentCrm/A1`), { status: 'active', contacts: [{ name: 'Ops', email: 'ops@example.com' }], creditLimit: 5000, notes: 'internal' });
  await setDoc(doc(db, `${O}/agentActivities/act1`), { agentId: 'A1', kind: 'call', at: 1, text: 'called', by: 'staff1' });
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

console.log('Documents + billing');
const ledger = (jobId, releaseOk, extra = {}) => ({ jobId, clientId: 'C', customer: 'Customer C', base: 'USD', fx: {}, lines: [{ id: 'l1', sell: 100, buy: 80 }],
  invoices: [], payments: [], files: [], localPaid: {}, releaseOk, clientOpen: 0, updatedAt: 1, ...extra });
const jdoc = (id, jobId, kind, status, extra = {}) => ({ id, jobId, clientId: 'C', kind, no: 'HBL-2026-0001', status, fields: { shipper: 'x' }, issuedAt: 1, releasedAt: null, updatedAt: 1, ...extra });
await t('staff writes ledger', assertSucceeds(setDoc(doc(staff, `${O}/ledgers/J1`), ledger('J1', false))));
await t('staff ledger with unknown field denied', assertFails(setDoc(doc(staff, `${O}/ledgers/J1`), ledger('J1', false, { hack: 1 }))));
await t('staff ledger with wrong jobId denied', assertFails(setDoc(doc(staff, `${O}/ledgers/J1`), ledger('J2', false))));
await t('C cannot read own job ledger (buy rates)', assertFails(getDoc(doc(c, `${O}/ledgers/J1`))));
await t('C cannot write ledger', assertFails(setDoc(doc(c, `${O}/ledgers/J1`), ledger('J1', true))));
await t('staff creates draft House B/L', assertSucceeds(setDoc(doc(staff, `${O}/jobDocs/J1-hbl`), jdoc('J1-hbl', 'J1', 'hbl', 'draft'))));
await t('staff issues House B/L', assertSucceeds(updateDoc(doc(staff, `${O}/jobDocs/J1-hbl`), { status: 'issued' })));
await t('release blocked while charges unpaid', assertFails(updateDoc(doc(staff, `${O}/jobDocs/J1-hbl`), { status: 'released', releasedAt: 2 })));
await t('release blocked with no ledger at all', assertFails(setDoc(doc(staff, `${O}/jobDocs/J3-hbl`), jdoc('J3-hbl', 'J3', 'hbl', 'released'))));
await t('arrival notice cannot be "released"', assertFails(setDoc(doc(staff, `${O}/jobDocs/J1-an`), jdoc('J1-an', 'J1', 'an', 'released'))));
await t('staff marks all paid', assertSucceeds(setDoc(doc(staff, `${O}/ledgers/J1`), ledger('J1', true))));
await t('release allowed once paid', assertSucceeds(updateDoc(doc(staff, `${O}/jobDocs/J1-hbl`), { status: 'released', releasedAt: 2 })));
await t('cannot repoint doc to another job', assertFails(updateDoc(doc(staff, `${O}/jobDocs/J1-hbl`), { jobId: 'J2' })));
await t('C reads own job docs', assertSucceeds(getDoc(doc(c, `${O}/jobDocs/J1-hbl`))));
await t('C lists own job docs (query)', assertSucceeds(getDocs(query(collection(c, `${O}/jobDocs`), where('clientId', '==', 'C')))));
await t('D cannot read C job docs', assertFails(getDoc(doc(d, `${O}/jobDocs/J1-hbl`))));
await t('C cannot release / edit a doc', assertFails(updateDoc(doc(c, `${O}/jobDocs/J1-hbl`), { status: 'draft' })));
await t('staff attaches job file', assertSucceeds(setDoc(doc(staff, `${O}/jobFiles/f1`), { jobId: 'J1', clientId: 'C', name: 'bl.pdf', type: 'application/pdf', size: 3, dataB64: 'AAAA', uid: 'staff1', at: serverTimestamp() })));
await t('job file over 640 KB denied', assertFails(setDoc(doc(staff, `${O}/jobFiles/f2`), { jobId: 'J1', clientId: 'C', name: 'big.pdf', type: 'application/pdf', size: 700000, dataB64: 'AAAA', uid: 'staff1', at: serverTimestamp() })));
await t('C cannot attach job file', assertFails(setDoc(doc(c, `${O}/jobFiles/f3`), { jobId: 'J1', clientId: 'C', name: 'x', type: 'x', size: 1, dataB64: 'A', uid: 'cliC', at: serverTimestamp() })));
await t('D cannot read C job file', assertFails(getDoc(doc(d, `${O}/jobFiles/f1`))));
await t('staff saves charge catalog', assertSucceeds(setDoc(doc(staff, `${O}/settings/chargeCatalog`), { codes: [{ code: 'OFR' }] })));
await t('C reads charge catalog', assertSucceeds(getDoc(doc(c, `${O}/settings/chargeCatalog`))));
await t('C cannot write charge catalog', assertFails(setDoc(doc(c, `${O}/settings/chargeCatalog`), { codes: [] })));
await t('stranger cannot read ledgers', assertFails(getDoc(doc(stranger, `${O}/ledgers/J1`))));

console.log('Outsiders');
await t('anon cannot read org', assertFails(getDoc(doc(anon, O))));
await t('stranger cannot read jobs', assertFails(getDoc(doc(stranger, `${O}/jobs/J1`))));
await t('stranger cannot join org as staff', assertFails(setDoc(doc(stranger, `${O}/members/nobody`), { role: 'staff' })));
await t('stranger cannot create a second org', assertFails(setDoc(doc(stranger, 'orgs/evil'), { name: 'x', ownerUid: 'nobody' })));
await t('stranger cannot take over demo org', assertFails(setDoc(doc(stranger, O), { name: 'x', ownerUid: 'nobody' })));

console.log('Agent CRM');
const staffX = env.authenticatedContext('staffX').firestore();
const crm = { status: 'preferred', contacts: [{ id: 'c1', name: 'Ops', role: 'Ops', email: 'ops@example.com', phone: '', whatsapp: '' }],
  paymentTerms: '30 days', creditLimit: 10000, currency: 'USD', rating: 4, tags: ['reliable'], kyc: [{ kind: 'license', status: 'verified', expiry: '2027-01-01' }],
  notes: 'internal', createdAt: 1, updatedAt: 1 };
await t('staff adds agent directory doc', assertSucceeds(setDoc(doc(staff, `${O}/agents/A3`), { id: 'A3', name: 'Sample Agent', type: 'trucker', country: 'X', svc: ['road'], lanePairs: [{ from: 'A', to: 'B' }], hidden: false })));
await t('staff adds agent CRM doc', assertSucceeds(setDoc(doc(staff, `${O}/agentCrm/A3`), crm)));
await t('staff edits agent CRM status', assertSucceeds(updateDoc(doc(staff, `${O}/agentCrm/A3`), { status: 'on_hold', archived: true })));
await t('staff reads agent CRM', assertSucceeds(getDoc(doc(staff, `${O}/agentCrm/A1`))));
await t('staff lists agent CRM', assertSucceeds(getDocs(collection(staff, `${O}/agentCrm`))));
await t('staff logs activity', assertSucceeds(setDoc(doc(staff, `${O}/agentActivities/act2`), { agentId: 'A3', kind: 'rate_request', at: 2, text: 'asked rate', by: 'staff1' })));
await t('staff lists activities', assertSucceeds(getDocs(collection(staff, `${O}/agentActivities`))));
await t('staff deletes activity', assertSucceeds(deleteDoc(doc(staff, `${O}/agentActivities/act2`))));
await t('staff cannot put contacts/credit in member-readable agents doc', assertFails(setDoc(doc(staff, `${O}/agents/A4`), { name: 'Leak', contacts: [], creditLimit: 1 })));
await t('staff cannot put notes in member-readable agents doc', assertFails(setDoc(doc(staff, `${O}/agents/A4`), { name: 'Leak', notes: 'internal' })));
await t('staff cannot save agent with unknown type', assertFails(setDoc(doc(staff, `${O}/agents/A4`), { name: 'X', type: 'spy' })));
await t('staff cannot save CRM with bad status', assertFails(setDoc(doc(staff, `${O}/agentCrm/A4`), { status: 'vip' })));
await t('staff cannot save CRM with rating 9', assertFails(setDoc(doc(staff, `${O}/agentCrm/A4`), { rating: 9 })));
await t('staff cannot save CRM with unknown field', assertFails(setDoc(doc(staff, `${O}/agentCrm/A4`), { status: 'active', marginPct: 3 })));
await t('staff cannot log activity as someone else', assertFails(setDoc(doc(staff, `${O}/agentActivities/act3`), { agentId: 'A3', kind: 'note', at: 3, text: 'x', by: 'cliC' })));
await t('staff cannot log activity of unknown kind', assertFails(setDoc(doc(staff, `${O}/agentActivities/act3`), { agentId: 'A3', kind: 'bribe', at: 3, text: 'x', by: 'staff1' })));
await t('C cannot read agent CRM', assertFails(getDoc(doc(c, `${O}/agentCrm/A1`))));
await t('C cannot list agent CRM', assertFails(getDocs(collection(c, `${O}/agentCrm`))));
await t('C cannot write agent CRM', assertFails(setDoc(doc(c, `${O}/agentCrm/A1`), { status: 'blacklisted' })));
await t('C cannot read activities', assertFails(getDoc(doc(c, `${O}/agentActivities/act1`))));
await t('C cannot list activities', assertFails(getDocs(collection(c, `${O}/agentActivities`))));
await t('C cannot log activity', assertFails(setDoc(doc(c, `${O}/agentActivities/act4`), { agentId: 'A1', kind: 'note', at: 1, text: 'x', by: 'cliC' })));
await t('staff of another account cannot read agents', assertFails(getDoc(doc(staffX, `${O}/agents/A1`))));
await t('staff of another account cannot read agent CRM', assertFails(getDoc(doc(staffX, `${O}/agentCrm/A1`))));
await t('staff of another account cannot write agent CRM', assertFails(setDoc(doc(staffX, `${O}/agentCrm/A9`), { status: 'active' })));
await t('staff of another account cannot read activities', assertFails(getDoc(doc(staffX, `${O}/agentActivities/act1`))));
await t('stranger cannot read agent CRM', assertFails(getDoc(doc(stranger, `${O}/agentCrm/A1`))));
await t('anon cannot list agents', assertFails(getDocs(collection(anon, `${O}/agents`))));

// ───────── Self-serve accounts: sign-up, onboarding, invites, cross-tenant ─────────
console.log('Accounts');
const tok = (email, v = true) => ({ email, email_verified: v });
const ownA = env.authenticatedContext('ownA', tok('owner.a@example.com')).firestore();
const ownB = env.authenticatedContext('ownB', tok('owner.b@example.com')).firestore();
const unver = env.authenticatedContext('unver', tok('new@example.com', false)).firestore();
const inviteeOk = env.authenticatedContext('invS', tok('staff.a@example.com')).firestore();
const inviteeUnver = env.authenticatedContext('invU', tok('staff.a@example.com', false)).firestore();
const wrongEmail = env.authenticatedContext('invW', tok('someone.else@example.com')).firestore();
const clientInv = env.authenticatedContext('invC', tok('client.a@example.com')).firestore();
const A = 'orgs/acctaaaaaaaaaa', B = 'orgs/acctbbbbbbbbbb';
const org = (uid, extra = {}) => ({ name: 'Acme Forwarding', ownerUid: uid, country: 'AE', baseCurrency: 'USD', ports: ['Jebel Ali'], lang: 'en', company: { name: 'Acme Forwarding' }, createdAt: 1, ...extra });
await t('unverified user cannot create an account', assertFails(setDoc(doc(unver, 'orgs/acctuuuuuuuuuu'), org('unver'))));
await t('cannot create an account owned by someone else', assertFails(setDoc(doc(ownA, A), org('ownB'))));
await t('cannot create a real account flagged demo', assertFails(setDoc(doc(ownA, A), org('ownA', { demo: true }))));
await t('cannot create an account with a bad id', assertFails(setDoc(doc(ownA, 'orgs/Bad-Id'), org('ownA'))));
await t('signed-out cannot create an account', assertFails(setDoc(doc(anon, A), org('ownA'))));
await t('verified user creates own account', assertSucceeds(setDoc(doc(ownA, A), org('ownA'))));
await t('owner adds self as owner', assertSucceeds(setDoc(doc(ownA, `${A}/members/ownA`), { role: 'owner', email: 'owner.a@example.com', createdAt: 1 })));
await t('owner links self to account', assertSucceeds(setDoc(doc(ownA, 'userOrgs/ownA'), { orgId: 'acctaaaaaaaaaa' })));
await t('linked user cannot create a second account', assertFails(setDoc(doc(ownA, 'orgs/acctcccccccccc'), org('ownA'))));
await t('owner B creates own account', assertSucceeds(setDoc(doc(ownB, B), org('ownB'))));
await t('owner B adds self as owner', assertSucceeds(setDoc(doc(ownB, `${B}/members/ownB`), { role: 'owner', email: 'owner.b@example.com' })));
await t('owner B cannot add self to account A', assertFails(setDoc(doc(ownB, `${A}/members/ownB`), { role: 'owner' })));
await t('owner B cannot add self to A as staff', assertFails(setDoc(doc(ownB, `${A}/members/ownB`), { role: 'staff' })));
await t('owner adds first agent', assertSucceeds(setDoc(doc(ownA, `${A}/agents/AG1`), { name: 'Gulf Agent' })));
await t('owner adds agent CRM', assertSucceeds(setDoc(doc(ownA, `${A}/agentCrm/AG1`), { status: 'active', notes: 'n' })));
await t('owner reads billing ledger path (staff rights)', assertSucceeds(getDocs(collection(ownA, `${A}/ledgers`))));
await t('owner updates company settings', assertSucceeds(updateDoc(doc(ownA, A), { name: 'Acme Forwarding LLC', baseCurrency: 'AED' })));
await t('owner cannot hand ownership away', assertFails(updateDoc(doc(ownA, A), { ownerUid: 'ownB' })));
// cross-tenant
await t('B cannot read account A', assertFails(getDoc(doc(ownB, A))));
await t('B cannot read A agents', assertFails(getDocs(collection(ownB, `${A}/agents`))));
await t('B cannot read A agent CRM', assertFails(getDoc(doc(ownB, `${A}/agentCrm/AG1`))));
await t('B cannot write A agents', assertFails(setDoc(doc(ownB, `${A}/agents/X`), { name: 'x' })));
await t('B cannot list A members', assertFails(getDocs(collection(ownB, `${A}/members`))));
await t('B cannot read A ledgers', assertFails(getDocs(collection(ownB, `${A}/ledgers`))));
await t('B cannot list A invites', assertFails(getDocs(collection(ownB, `${A}/invites`))));
await t('B cannot read A userOrgs link', assertFails(getDoc(doc(ownB, 'userOrgs/ownA'))));
await t('A owner cannot read demo org', assertFails(getDoc(doc(ownA, O))));
await t('demo staff cannot read account A', assertFails(getDoc(doc(staff, A))));
// invites
const exp = new Date(Date.now() + 7 * 864e5);
const inv = (email, role, extra = {}) => ({ email, role, createdBy: 'ownA', createdAt: serverTimestamp(), expiresAt: exp, usedBy: null, ...extra });
const CODE = 'InviteStaffA0000001', CCODE = 'InviteClientA000001';
await t('owner creates staff invite', assertSucceeds(setDoc(doc(ownA, `${A}/invites/${CODE}`), inv('staff.a@example.com', 'staff'))));
await t('owner creates client invite', assertSucceeds(setDoc(doc(ownA, `${A}/invites/${CCODE}`), inv('client.a@example.com', 'client', { clientId: 'C1' }))));
await t('invite with uppercase email refused', assertFails(setDoc(doc(ownA, `${A}/invites/InviteBad000000001`), inv('Staff@Example.com', 'staff'))));
await t('invite cannot grant owner', assertFails(setDoc(doc(ownA, `${A}/invites/InviteBad000000002`), inv('x@example.com', 'owner'))));
await t('owner B cannot invite into A', assertFails(setDoc(doc(ownB, `${A}/invites/InviteBad000000003`), { ...inv('x@example.com', 'staff'), createdBy: 'ownB' })));
await t('owner lists invites', assertSucceeds(getDocs(collection(ownA, `${A}/invites`))));
await t('invitee reads invite by code', assertSucceeds(getDoc(doc(inviteeOk, `${A}/invites/${CODE}`))));
await t('invitee cannot list invites', assertFails(getDocs(collection(inviteeOk, `${A}/invites`))));
await t('unverified invitee cannot join', assertFails(setDoc(doc(inviteeUnver, `${A}/members/invU`), { role: 'staff', email: 'staff.a@example.com', invite: CODE })));
await t('other email cannot use invite', assertFails(setDoc(doc(wrongEmail, `${A}/members/invW`), { role: 'staff', email: 'someone.else@example.com', invite: CODE })));
await t('invitee cannot upgrade to owner', assertFails(setDoc(doc(inviteeOk, `${A}/members/invS`), { role: 'owner', invite: CODE })));
await t('invitee joins as staff', assertSucceeds(setDoc(doc(inviteeOk, `${A}/members/invS`), { role: 'staff', email: 'staff.a@example.com', invite: CODE })));
await t('invitee marks invite used', assertSucceeds(updateDoc(doc(inviteeOk, `${A}/invites/${CODE}`), { usedBy: 'invS', usedAt: serverTimestamp() })));
await t('invitee links self to account', assertSucceeds(setDoc(doc(inviteeOk, 'userOrgs/invS'), { orgId: 'acctaaaaaaaaaa' })));
await t('owner reads a member link (for removal)', assertSucceeds(getDoc(doc(ownA, 'userOrgs/invS'))));
await t('owner B cannot read A member link', assertFails(getDoc(doc(ownB, 'userOrgs/invS'))));
await t('used invite cannot be reused', assertFails(setDoc(doc(wrongEmail, `${A}/members/invW`), { role: 'staff', invite: CODE })));
await t('new staff reads agent CRM', assertSucceeds(getDoc(doc(inviteeOk, `${A}/agentCrm/AG1`))));
await t('staff cannot create staff invites', assertFails(setDoc(doc(inviteeOk, `${A}/invites/InviteBad000000004`), { ...inv('y@example.com', 'staff'), createdBy: 'invS' })));
await t('staff cannot remove the owner', assertFails(deleteDoc(doc(inviteeOk, `${A}/members/ownA`))));
await t('staff cannot promote self to owner', assertFails(updateDoc(doc(inviteeOk, `${A}/members/invS`), { role: 'owner' })));
await t('client invite needs matching clientId', assertFails(setDoc(doc(clientInv, `${A}/members/invC`), { role: 'client', clientId: 'C2', invite: CCODE })));
await t('client joins with invite', assertSucceeds(setDoc(doc(clientInv, `${A}/members/invC`), { role: 'client', clientId: 'C1', email: 'client.a@example.com', invite: CCODE })));
await t('joined client cannot read agent CRM', assertFails(getDoc(doc(clientInv, `${A}/agentCrm/AG1`))));
await t('joined client cannot read ledgers', assertFails(getDocs(collection(clientInv, `${A}/ledgers`))));
await t('joined client reads agent directory', assertSucceeds(getDoc(doc(clientInv, `${A}/agents/AG1`))));
await t('owner cannot remove self', assertFails(deleteDoc(doc(ownA, `${A}/members/ownA`))));
await t('owner removes staff member', assertSucceeds(deleteDoc(doc(ownA, `${A}/members/invS`))));
await t('removed staff loses agent CRM', assertFails(getDoc(doc(inviteeOk, `${A}/agentCrm/AG1`))));
await t('owner revokes invite', assertSucceeds(deleteDoc(doc(ownA, `${A}/invites/${CCODE}`))));

console.log(`\n${pass} passed, ${fail} failed`);
await env.cleanup();
process.exit(fail ? 1 : 0);
