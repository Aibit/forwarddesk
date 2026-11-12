import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, needsRehash } from '../src/accounts/password.js';
import { canRead, canWrite } from '../src/accounts/rules.js';
import { RateLimiter } from '../src/accounts/ratelimit.js';
import * as v from '../src/accounts/validate.js';
import { HttpError } from '../src/service.js';
import { ConsoleMailer } from '../src/accounts/mailer.js';

const code = (f: () => unknown) => { try { f(); return 'ok'; } catch (e) { return (e as HttpError).body?.error; } };

test('password: argon2id PHC string, verifies, rejects wrong password and garbage', async () => {
  const h = await hashPassword('correct horse battery');
  assert.match(h, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  assert.equal(await verifyPassword('correct horse battery', h), true);
  assert.equal(await verifyPassword('correct horse batterY', h), false);
  assert.equal(await verifyPassword('x', 'not-a-hash'), false);
  assert.notEqual(await hashPassword('same'), await hashPassword('same'), 'random salt');
});
test('password: unicode is normalised (NFKC) and weaker params ask for a re-hash', async () => {
  const h = await hashPassword('ｐａｓｓｗｏｒｄ１２３');
  assert.equal(await verifyPassword('password123', h), true);
  const weak = await hashPassword('pw', { m: 4096, t: 1, p: 1 });
  assert.equal(needsRehash(weak), true);
  assert.equal(needsRehash(h), false);
});

test('validate: email, password, profile, paths, waitlist', () => {
  assert.equal(v.email('  Ana@Example.COM '), 'ana@example.com');
  assert.equal(code(() => v.email('ana@')), 'invalid-email');
  assert.equal(code(() => v.password('short')), 'weak-password');
  assert.equal(code(() => v.password('x'.repeat(201))), 'password-too-long');
  assert.deepEqual(v.profile({ name: ' Acme Freight ', ports: ['Valencia', '', 'Jebel Ali'], lang: 'ar' }), { name: 'Acme Freight', country: '', baseCurrency: 'USD', ports: ['Valencia', 'Jebel Ali'], lang: 'ar' });
  assert.equal(code(() => v.profile({ name: '' })), 'required');
  assert.equal(code(() => v.profile({ name: 'A', baseCurrency: 'usd' })), 'invalid');
  assert.equal(code(() => v.profile({ name: 'A', lang: 'de' })), 'invalid');
  assert.equal(v.docPath('jobs/FD-E-1042'), 'jobs/FD-E-1042');
  assert.equal(v.docPath('quotes/q1/private/costs'), 'quotes/q1/private/costs');
  for (const bad of ['jobs', '../x/y', 'jobs/../../etc', 'a/b/c/d/e', 'jobs/a b', '/jobs/x']) assert.equal(code(() => v.docPath(bad)), 'invalid', bad);
  assert.equal(code(() => v.docData([1])), 'invalid');
  assert.equal(code(() => v.docData({ s: 'x'.repeat(1000) }, 100)), 'too_large');
  assert.equal(code(() => v.waitlist({ email: 'a@b.co', consent: false })), 'consent-required');
  assert.equal(code(() => v.waitlist({ email: 'a@b.co', consent: true, admin: true })), 'unknown-field');
  assert.equal(code(() => v.waitlist({ email: 'a@b.co', consent: true, shipments: 'lots' })), 'invalid');
  assert.equal(code(() => v.waitlist({ email: 'a@b.co', consent: true, note: 'x'.repeat(1001) })), 'too-long');
  assert.equal(v.waitlist({ email: 'A@B.co', consent: true, shipments: '10-50', source: 'hero' }).email, 'a@b.co');
});

const staff = { role: 'staff' as const, clientId: null };
const client = { role: 'client' as const, clientId: 'c1' };
test('rules: staff read/write everything in their workspace', () => {
  for (const p of ['clients/c1', 'agentCrm/a1', 'quotes/q1/private/costs', 'settings/tariffsPrivate', 'ledgers/j1']) {
    assert.equal(canRead(staff, p, {}), true, p);
    assert.equal(canWrite(staff, p, null, {}), true, p);
  }
});
test('rules: a client reads only its own documents, never buy side or CRM', () => {
  assert.equal(canRead(client, 'jobs/j1', { clientId: 'c1' }), true);
  assert.equal(canRead(client, 'jobs/j2', { clientId: 'c2' }), false);
  assert.equal(canRead(client, 'quotes/q1', { clientId: 'c1' }), true);
  assert.equal(canRead(client, 'quotes/q1/private/costs', { clientId: 'c1' }), false);
  assert.equal(canRead(client, 'clientPublic/c1', {}), true);
  assert.equal(canRead(client, 'clientPublic/c2', {}), false);
  assert.equal(canRead(client, 'clients/c1', { clientId: 'c1' }), false, 'full client record has margin/notes');
  for (const p of ['agentCrm/a1', 'agentActivities/x', 'commLog/x', 'jobInternal/j1', 'ledgers/j1', 'settings/tariffsPrivate']) assert.equal(canRead(client, p, { clientId: 'c1' }), false, p);
  assert.equal(canRead(client, 'agents/a1', { hidden: true }), false);
  assert.equal(canRead(client, 'agents/a2', { name: 'x' }), true);
  assert.equal(canRead(client, 'settings/tariffs', {}), true);
  assert.equal(canRead(client, '_org', {}), true);
  assert.equal(canRead({ role: 'client', clientId: null }, 'jobs/j1', { clientId: null }), false);
});
test('rules: a client may accept its quote, approve a draft B/L and edit its lanes — nothing else', () => {
  const q = { clientId: 'c1', status: 'sent', sell: 100 };
  assert.equal(canWrite(client, 'quotes/q1', q, { ...q, status: 'won', acceptedOption: 'A', acceptedVia: 'portal', acceptedAt: 1, acceptedBy: 'u' }), true);
  assert.equal(canWrite(client, 'quotes/q1', q, { ...q, status: 'won', acceptedVia: 'portal', sell: 1 }), false, 'cannot change price');
  assert.equal(canWrite(client, 'quotes/q1', q, { ...q, status: 'lost', acceptedVia: 'portal' }), false);
  assert.equal(canWrite(client, 'quotes/q1', null, { ...q }), false, 'cannot create quotes');
  const j = { clientId: 'c1', step: 'E5' };
  assert.equal(canWrite(client, 'jobs/j1', j, { ...j, portal: { draftBlApprovedAt: 1 } }), true);
  assert.equal(canWrite(client, 'jobs/j1', j, { ...j, step: 'E9' }), false);
  assert.equal(canWrite(client, 'lanes/l1', null, { clientId: 'c1' }), true);
  assert.equal(canWrite(client, 'lanes/l1', null, { clientId: 'c2' }), false);
  assert.equal(canWrite(client, 'lanes/l1', { clientId: 'c2' }, null), false);
  assert.equal(canWrite(client, 'agentPrefs/c1', null, { clientId: 'c1', agents: [] }), true);
  assert.equal(canWrite(client, 'agentPrefs/c2', null, { clientId: 'c1', agents: [] }), false);
  for (const p of ['clients/c1', 'agents/a1', 'settings/tariffs', '_org', 'ledgers/j1']) assert.equal(canWrite(client, p, null, { clientId: 'c1' }), false, p);
});

test('rate limiter: fixed window, blocked() peeks, clear() resets', () => {
  let t = 0;
  const rl = new RateLimiter(() => t);
  const r = { limit: 2, windowMs: 1000 };
  assert.equal(rl.hit('k', r), 0); assert.equal(rl.hit('k', r), 0);
  assert.equal(rl.blocked('k', r), 1);
  assert.ok(rl.hit('k', r) > 0);
  t = 1001;
  assert.equal(rl.hit('k', r), 0);
  rl.clear('k'); assert.equal(rl.blocked('k', r), 0);
});
test('console mailer keeps the last messages and logs them', async () => {
  const lines: string[] = [];
  const m = new ConsoleMailer((s) => lines.push(s), 2);
  for (const n of [1, 2, 3]) await m.send({ to: `a${n}@b.co`, subject: 's', text: 't', kind: 'reset' });
  assert.equal(m.sent.length, 2); assert.equal(m.sent[0].to, 'a2@b.co');
  assert.match(lines[2], /to=a3@b.co kind=reset/);
});
