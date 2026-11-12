// End to end over HTTP: real server + SQLite + console mailer (accounts, workspaces, invites, scoped data, waitlist).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { loadConfig } from '../src/config.js';
import { Store } from '../src/store.js';
import { createProvider } from '../src/provider.js';
import { Inbox } from '../src/service.js';
import { createApp } from '../src/app.js';
import { AccountsDb } from '../src/accounts/db.js';
import { Accounts } from '../src/accounts/service.js';
import { ConsoleMailer } from '../src/accounts/mailer.js';

let server: Server, base: string, dir: string, adb: AccountsDb, mail: ConsoleMailer, store: Store;
let clock = Date.parse('2026-11-12T10:00:00Z');
const APP = 'http://localhost:5299/forwarddesk/';

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'fdacc-'));
  const cfg = loadConfig({ WA_PROVIDER: 'mock', WA_DB_PATH: join(dir, 'wa.sqlite'), WA_MEDIA_DIR: join(dir, 'media'), ACCOUNTS: 'on', WA_CORS_ORIGINS: 'http://localhost:5299', WAITLIST_ORIGINS: 'https://aibit.github.io' });
  store = new Store(cfg.dbPath);
  adb = new AccountsDb(join(dir, 'fd.sqlite'));
  mail = new ConsoleMailer(() => undefined);
  const acc = new Accounts(adb, mail, { appUrl: APP, sessionDays: 30, adminEmails: ['admin@forwarddesk.test'], now: () => clock, limits: { signupIp: { limit: 100, windowMs: 3600_000 } } });
  server = createApp(cfg, new Inbox(cfg, store, createProvider(cfg)), acc);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => { server.close(); adb.close(); store.close(); rmSync(dir, { recursive: true, force: true }); });

type J = { status: number; body: any; headers: Headers };
async function call(method: string, path: string, body?: unknown, token?: string, headers: Record<string, string> = {}): Promise<J> {
  const r = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let b: any = text; try { b = JSON.parse(text); } catch { /* csv */ }
  return { status: r.status, body: b, headers: r.headers };
}
const signup = (email: string, password = 'harbour-crane-9', name = '') => call('POST', '/api/auth/signup', { email, password, name });

let owner = '', ownerWs = '';
test('sign up → session token, no workspace yet; duplicate email refused; weak password refused', async () => {
  const r = await signup('Owner@Acme.test', 'harbour-crane-9', 'Ana');
  assert.equal(r.status, 201);
  assert.ok(r.body.token.length >= 40);
  assert.deepEqual(r.body.me.user.email, 'owner@acme.test');
  assert.equal(r.body.me.workspace, null);
  owner = r.body.token;
  assert.equal((await signup('owner@acme.test')).body.error, 'email-already-in-use');
  assert.equal((await signup('weak@acme.test', 'short')).body.error, 'weak-password');
  assert.equal((await signup('not-an-email')).body.error, 'invalid-email');
});
test('the password is stored as argon2id, never in clear', () => {
  const row = adb.db.prepare('SELECT pw_hash FROM users WHERE email = ?').get('owner@acme.test') as { pw_hash: string };
  assert.match(row.pw_hash, /^\$argon2id\$/);
  assert.doesNotMatch(row.pw_hash, /harbour/);
  const s = adb.db.prepare('SELECT token_hash FROM sessions LIMIT 1').get() as { token_hash: string };
  assert.match(s.token_hash, /^[0-9a-f]{64}$/, 'only a hash of the session token is stored');
});
test('me requires a valid token', async () => {
  assert.equal((await call('GET', '/api/auth/me')).status, 401);
  assert.equal((await call('GET', '/api/auth/me', undefined, 'nope')).status, 401);
  assert.equal((await call('GET', '/api/auth/me', undefined, owner)).body.user.name, 'Ana');
});
test('create the company workspace (owner); a second one is refused', async () => {
  const r = await call('POST', '/api/workspace', { name: 'Acme Freight', country: 'Spain', baseCurrency: 'EUR', ports: ['Valencia', 'Barcelona'], lang: 'es' }, owner);
  assert.equal(r.status, 201);
  assert.equal(r.body.member.role, 'owner');
  assert.equal(r.body.workspace.name, 'Acme Freight');
  assert.match(r.body.workspace.id, /^[a-z0-9]{16}$/);
  ownerWs = r.body.workspace.id;
  assert.equal((await call('POST', '/api/workspace', { name: 'Second' }, owner)).body.error, 'already-member');
  const org = await call('GET', '/api/ws/doc?path=_org', undefined, owner);
  assert.equal(org.body.data.company.name, 'Acme Freight');
});

let staffTok = '', clientTok = '', staffUid = '';
test('invite by link: staff joins with the link; used, wrong-email and bad codes are refused', async () => {
  const inv = await call('POST', '/api/workspace/invites', { email: 'staff@acme.test', role: 'staff' }, owner);
  assert.equal(inv.status, 201);
  assert.ok(inv.body.link.startsWith(`${APP}#join=${ownerWs}.`));
  const other = await signup('intruder@else.test');
  assert.equal((await call('POST', '/api/invites/accept', { join: inv.body.link }, other.body.token)).body.error, 'wrong-email');
  const s = await signup('staff@acme.test');
  staffTok = s.body.token;
  const j = await call('POST', '/api/invites/accept', { join: inv.body.link }, staffTok);
  assert.equal(j.status, 200);
  assert.equal(j.body.member.role, 'staff');
  assert.equal(j.body.workspace.id, ownerWs);
  staffUid = j.body.user.id;
  assert.equal((await call('POST', '/api/invites/accept', { join: inv.body.link }, other.body.token)).body.error, 'used-code');
  assert.equal((await call('POST', '/api/invites/accept', { join: 'nonsense' }, other.body.token)).body.error, 'bad-code');
  // open link without an email: anyone with the link can join once
  const open = await call('POST', '/api/workspace/invites', { role: 'client', clientId: 'c1' }, owner);
  const c = await signup('buyer@customer.test');
  clientTok = c.body.token;
  const cj = await call('POST', '/api/invites/accept', { join: open.body.join }, clientTok);
  assert.equal(cj.body.member.role, 'client'); assert.equal(cj.body.member.clientId, 'c1');
});
test('only the owner invites staff (staff may invite client logins); staff can read the team, clients cannot', async () => {
  assert.equal((await call('POST', '/api/workspace/invites', { role: 'staff' }, staffTok)).status, 403);
  const ci = await call('POST', '/api/workspace/invites', { role: 'client', clientId: 'c2' }, staffTok);
  assert.equal(ci.status, 201);
  assert.equal((await call('DELETE', `/api/workspace/invites/${ci.body.join.split('.')[1]}`, undefined, staffTok)).status, 200);
  assert.equal((await call('POST', '/api/workspace/invites', { role: 'client', clientId: 'c1' }, clientTok)).status, 403);
  const t = await call('GET', '/api/workspace/team', undefined, staffTok);
  assert.equal(t.status, 200);
  assert.deepEqual(t.body.members.map((m: any) => m.role).sort(), ['client', 'owner', 'staff']);
  assert.equal(t.body.invites.length, 2);
  assert.equal((await call('GET', '/api/workspace/team', undefined, clientTok)).status, 403);
  assert.equal((await call('PUT', '/api/workspace', { name: 'Hijack' }, staffTok)).status, 403);
  const up = await call('PUT', '/api/workspace', { name: 'Acme Freight SL', baseCurrency: 'EUR', lang: 'en' }, owner);
  assert.equal(up.body.workspace.name, 'Acme Freight SL');
});
test('expired invites are refused', async () => {
  const inv = await call('POST', '/api/workspace/invites', { role: 'staff' }, owner);
  const late = await signup('late@acme.test');
  clock += 15 * 864e5;
  assert.equal((await call('POST', '/api/invites/accept', { join: inv.body.join }, late.body.token)).body.error, 'expired-code');
  clock -= 15 * 864e5;
  assert.equal((await call('DELETE', `/api/workspace/invites/${inv.body.join.split('.')[1]}`, undefined, owner)).status, 200);
});

let otherOwner = '';
test('workspace data is scoped: another company never sees or overwrites it', async () => {
  const w = await call('POST', '/api/ws/write', { ops: [
    { path: 'jobs/FD-E-1042', data: { id: 'FD-E-1042', clientId: 'c1', step: 'E5', customer: 'Customer A' } },
    { path: 'jobs/FD-E-1043', data: { id: 'FD-E-1043', clientId: 'c2', step: 'E2' } },
    { path: 'quotes/q1', data: { id: 'q1', clientId: 'c1', status: 'sent', sell: 1200 } },
    { path: 'quotes/q1/private/costs', data: { marginPct: 18 } },
    { path: 'clients/c1', data: { id: 'c1', name: 'Customer A', marginPct: 18 } },
  ] }, staffTok);
  assert.equal(w.status, 200);
  const o = await signup('boss@othercargo.test');
  otherOwner = o.body.token;
  await call('POST', '/api/workspace', { name: 'Other Cargo' }, otherOwner);
  const l = await call('GET', '/api/ws/docs', undefined, otherOwner);
  assert.deepEqual(l.body.docs.map((d: any) => d.path), ['_org']);
  assert.equal((await call('GET', '/api/ws/doc?path=jobs/FD-E-1042', undefined, otherOwner)).body.data, null);
  // same path in the other workspace is a different document
  await call('POST', '/api/ws/write', { ops: [{ path: 'jobs/FD-E-1042', data: { id: 'FD-E-1042', step: 'X' } }] }, otherOwner);
  assert.equal((await call('GET', '/api/ws/doc?path=jobs/FD-E-1042', undefined, owner)).body.data.step, 'E5');
  // no workspace yet → no data at all
  const lone = await signup('lonely@nowhere.test');
  assert.equal((await call('GET', '/api/ws/docs', undefined, lone.body.token)).body.error, 'no-org');
});
test('client account sees only its own bookings/quotes and may only accept a quote or approve a draft B/L', async () => {
  const l = await call('GET', '/api/ws/docs', undefined, clientTok);
  assert.deepEqual(l.body.docs.map((d: any) => d.path).sort(), ['_org', 'jobs/FD-E-1042', 'quotes/q1']);
  assert.equal((await call('GET', '/api/ws/doc?path=quotes/q1/private/costs', undefined, clientTok)).status, 403);
  assert.equal((await call('GET', '/api/ws/doc?path=clients/c1', undefined, clientTok)).status, 403);
  const accept = await call('POST', '/api/ws/write', { ops: [{ path: 'quotes/q1', data: { id: 'q1', clientId: 'c1', status: 'won', sell: 1200, acceptedOption: 'A', acceptedVia: 'portal', acceptedAt: clock, acceptedBy: 'x' } }] }, clientTok);
  assert.equal(accept.status, 200);
  const cheat = await call('POST', '/api/ws/write', { ops: [{ path: 'quotes/q1', data: { id: 'q1', clientId: 'c1', status: 'won', sell: 1, acceptedVia: 'portal' } }] }, clientTok);
  assert.equal(cheat.status, 403);
  // batches are all-or-nothing
  const mixed = await call('POST', '/api/ws/write', { ops: [{ path: 'lanes/l1', data: { clientId: 'c1', pol: 'Valencia' } }, { path: 'clients/c1', data: { marginPct: 0 } }] }, clientTok);
  assert.equal(mixed.status, 403);
  assert.equal((await call('GET', '/api/ws/doc?path=lanes/l1', undefined, owner)).body.data, null);
});
test('incremental sync: since returns changes and delete tombstones', async () => {
  const first = await call('GET', '/api/ws/docs', undefined, owner);
  const at = first.body.at;
  await call('POST', '/api/ws/write', { ops: [{ path: 'jobs/FD-E-1043', data: null }, { path: 'jobs/FD-I-2001', data: { id: 'FD-I-2001', step: 'I1' } }] }, owner);
  const next = await call('GET', `/api/ws/docs?since=${at}`, undefined, staffTok);
  assert.deepEqual(next.body.docs.map((d: any) => [d.path, d.data === null]), [['jobs/FD-E-1043', true], ['jobs/FD-I-2001', false]]);
});
test('removed members lose access immediately', async () => {
  assert.equal((await call('DELETE', `/api/workspace/members/${staffUid}`, undefined, owner)).status, 200);
  assert.equal((await call('GET', '/api/ws/docs', undefined, staffTok)).status, 401, 'their sessions were ended');
  assert.equal((await call('DELETE', '/api/workspace/members/' + 'u_self', undefined, owner)).status, 404);
});

test('password reset: console mail carries a one-time link; old sessions end; unknown emails get the same answer', async () => {
  assert.equal((await call('POST', '/api/auth/reset', { email: 'ghost@nowhere.test' })).status, 200);
  assert.equal(mail.sent.filter((m) => m.to === 'ghost@nowhere.test').length, 0);
  assert.equal((await call('POST', '/api/auth/reset', { email: 'owner@acme.test' })).status, 200);
  const m = mail.sent.at(-1)!;
  assert.equal(m.to, 'owner@acme.test');
  const token = m.text.match(/#reset=([A-Za-z0-9_-]+)/)![1];
  assert.equal((await call('POST', '/api/auth/reset/confirm', { token, password: 'short' })).body.error, 'weak-password');
  const ok = await call('POST', '/api/auth/reset/confirm', { token, password: 'new-quay-password-7' });
  assert.equal(ok.status, 200); assert.ok(ok.body.token);
  assert.equal((await call('GET', '/api/auth/me', undefined, owner)).status, 401, 'old session revoked');
  assert.equal((await call('POST', '/api/auth/reset/confirm', { token, password: 'again-again-1' })).body.error, 'bad-code', 'one use');
  assert.equal((await call('POST', '/api/auth/signin', { email: 'owner@acme.test', password: 'harbour-crane-9' })).status, 401);
  const s = await call('POST', '/api/auth/signin', { email: 'OWNER@acme.test', password: 'new-quay-password-7' });
  assert.equal(s.status, 200); owner = s.body.token;
  assert.equal(s.body.me.workspace.id, ownerWs);
});
test('reset links expire after an hour', async () => {
  await call('POST', '/api/auth/reset', { email: 'buyer@customer.test' });
  const token = mail.sent.at(-1)!.text.match(/#reset=([A-Za-z0-9_-]+)/)![1];
  clock += 61 * 60_000;
  assert.equal((await call('POST', '/api/auth/reset/confirm', { token, password: 'whatever-123' })).body.error, 'expired-code');
});
test('sign-in failures are rate limited per email (5 per 15 min) with Retry-After', async () => {
  for (let i = 0; i < 5; i++) assert.equal((await call('POST', '/api/auth/signin', { email: 'boss@othercargo.test', password: 'wrong' })).status, 401);
  const r = await call('POST', '/api/auth/signin', { email: 'boss@othercargo.test', password: 'harbour-crane-9' });
  assert.equal(r.status, 429); assert.equal(r.body.error, 'rate-limited'); assert.ok(Number(r.headers.get('retry-after')) > 0);
  clock += 16 * 60_000;
  assert.equal((await call('POST', '/api/auth/signin', { email: 'boss@othercargo.test', password: 'harbour-crane-9' })).status, 200);
});
test('sign out ends the session', async () => {
  const s = await call('POST', '/api/auth/signin', { email: 'boss@othercargo.test', password: 'harbour-crane-9' });
  assert.equal((await call('POST', '/api/auth/signout', undefined, s.body.token)).status, 200);
  assert.equal((await call('GET', '/api/auth/me', undefined, s.body.token)).status, 401);
});
test('sessions expire after SESSION_DAYS without use', async () => {
  const s = await call('POST', '/api/auth/signin', { email: 'buyer@customer.test', password: 'harbour-crane-9' });
  clock += 31 * 864e5;
  assert.equal((await call('GET', '/api/auth/me', undefined, s.body.token)).status, 401);
});

test('waitlist: public POST from the landing origin, validated, de-duplicated, honeypot dropped; admin-only list + CSV', async () => {
  const pre = await fetch(`${base}/api/waitlist`, { method: 'OPTIONS', headers: { Origin: 'https://aibit.github.io' } });
  assert.equal(pre.status, 204); assert.equal(pre.headers.get('access-control-allow-origin'), 'https://aibit.github.io');
  const evil = await fetch(`${base}/api/auth/signin`, { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } });
  assert.equal(evil.status, 403);
  const e = { email: 'ops@forwarder.test', company: '=HYPERLINK("x")', role: 'Ops', country: 'UAE', shipments: '10-50', note: 'Jebel Ali lanes', consent: true, source: 'hero', page: '/forwarddesk-site/', lang: 'en', website: '' };
  assert.equal((await call('POST', '/api/waitlist', e, undefined, { Origin: 'https://aibit.github.io' })).status, 200);
  assert.equal((await call('POST', '/api/waitlist', { ...e, note: '' })).status, 200);
  assert.equal((await call('POST', '/api/waitlist', { ...e, email: 'bot@spam.test', website: 'http://spam' })).status, 200);
  assert.equal((await call('POST', '/api/waitlist', { ...e, consent: false })).body.error, 'consent-required');
  const rows = adb.waitlist();
  assert.equal(rows.length, 1, 'honeypot not stored; same email merged');
  assert.equal(rows[0].submissions, 2); assert.equal(rows[0].note, 'Jebel Ali lanes', 'empty fields do not wipe earlier answers');
  owner = (await call('POST', '/api/auth/signin', { email: 'owner@acme.test', password: 'new-quay-password-7' })).body.token;
  assert.equal((await call('GET', '/api/admin/waitlist', undefined, owner)).status, 403);
  const admin = await signup('admin@forwarddesk.test');
  const list = await call('GET', '/api/admin/waitlist', undefined, admin.body.token);
  assert.equal(list.body.entries[0].email, 'ops@forwarder.test');
  assert.equal(admin.body.me.admin, true);
  const csv = await call('GET', '/api/admin/waitlist?format=csv', undefined, admin.body.token);
  assert.match(csv.headers.get('content-type')!, /text\/csv/);
  assert.match(String(csv.body), /ops@forwarder.test,"'=HYPERLINK\(""x""\)",Ops/);
  assert.equal((await call('PATCH', `/api/admin/waitlist/${rows[0].id}`, { status: 'contacted' }, admin.body.token)).status, 200);
  for (let i = 0; i < 4; i++) await call('POST', '/api/waitlist', { ...e, email: `w${i}@x.test` });
  assert.equal((await call('POST', '/api/waitlist', { ...e, email: 'w9@x.test' })).status, 429, '5 per 10 min per IP');
});
test('sign-ups are rate limited per IP (default 5 per hour)', async () => {
  const acc = new Accounts(adb, mail, { appUrl: APP, sessionDays: 30, adminEmails: [], now: () => clock });
  const ctx = { ip: '203.0.113.9', ua: 't' };
  for (let i = 0; i < 5; i++) await acc.signUp({ email: `rl${i}@x.test`, password: 'harbour-crane-9' }, ctx);
  await assert.rejects(acc.signUp({ email: 'rl9@x.test', password: 'harbour-crane-9' }, ctx), (e: any) => e.status === 429);
});
test('the WhatsApp API is untouched by the accounts layer', async () => {
  assert.equal((await fetch(`${base}/api/wa/status`)).status, 503);
  assert.deepEqual(await (await fetch(`${base}/healthz`)).json(), { ok: true, accounts: true });
});
