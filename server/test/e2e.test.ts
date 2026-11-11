// End to end: real HTTP server + SQLite + provider adapter against the mock Cloud API.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { loadConfig, type Config } from '../src/config.js';
import { Store } from '../src/store.js';
import { createProvider } from '../src/provider.js';
import { Inbox } from '../src/service.js';
import { createApp } from '../src/app.js';
import { sign } from '../src/signature.js';
import { WINDOW_MS } from '../src/window.js';
import { startMockCloud, type MockCloud } from './mock-cloud.js';
import { textMsg, imageMsg, documentMsg, statusMsg, PNID } from './fixtures.js';

const SECRET = 'app-secret', KEY = 'staff-key', VERIFY = 'verify-me', TOKEN = 'EAAG-test';
let mock: MockCloud, server: Server, base: string, inbox: Inbox, cfg: Config, dir: string;
let clock = Date.now();

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'fdwa-'));
  mock = await startMockCloud({ token: TOKEN });
  cfg = loadConfig({ WA_PROVIDER: 'meta', WA_TOKEN: TOKEN, WA_PHONE_NUMBER_ID: PNID, WA_APP_SECRET: SECRET, WA_VERIFY_TOKEN: VERIFY, WA_API_KEY: KEY, WA_API_BASE: `${mock.url}/v26.0`, WA_DB_PATH: join(dir, 'wa.sqlite'), WA_MEDIA_DIR: join(dir, 'media') });
  inbox = new Inbox(cfg, new Store(cfg.dbPath), createProvider(cfg), () => clock);
  server = createApp(cfg, inbox);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => { server.close(); inbox.store.close(); await mock.close(); rmSync(dir, { recursive: true, force: true }); });

const hook = (body: unknown, secret = SECRET) => { const raw = JSON.stringify(body); return fetch(`${base}/webhooks/whatsapp`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': `sha256=${sign(raw, secret)}` }, body: raw }); };
const api = (path: string, init: RequestInit = {}) => fetch(`${base}${path}`, { ...init, headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
const json = async (r: Response) => ({ status: r.status, body: await r.json() as any });

test('webhook GET: verify-token handshake echoes the challenge; wrong token → 403', async () => {
  const ok = await fetch(`${base}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${VERIFY}&hub.challenge=12345`);
  assert.equal(ok.status, 200); assert.equal(await ok.text(), '12345');
  assert.equal((await fetch(`${base}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=1`)).status, 403);
});

test('webhook POST: bad or missing signature → 401, nothing stored', async () => {
  assert.equal((await hook(textMsg('971501234567', 'wamid.bad', 'x'), 'wrong')).status, 401);
  assert.equal((await fetch(`${base}/webhooks/whatsapp`, { method: 'POST', body: '{}' })).status, 401);
  assert.equal(inbox.store.listConvs().length, 0);
});

test('api: requires the staff bearer key', async () => {
  assert.equal((await fetch(`${base}/api/wa/conversations`)).status, 401);
  assert.equal((await api('/api/wa/conversations')).status, 200);
});

test('directory sync + inbound text auto-links client (phone) and job (reference in text); duplicates ignored', async () => {
  const d = await json(await api('/api/wa/directory', { method: 'PUT', body: JSON.stringify({ entries: [{ kind: 'client', id: 'c-a', name: 'Customer A', contact: 'Ana', phones: ['+971 50 123 4567'] }, { kind: 'agent', id: 'ag-1', name: 'Agent One', phones: ['+44 7700 900123'] }], jobs: ['FD-E-1042', 'FD-I-0877'] }) }));
  assert.equal(d.status, 200);
  const body = textMsg('971501234567', 'wamid.IN1', 'Hi, any news on fd-e-1042?', Math.floor(clock / 1000));
  assert.equal((await hook(body)).status, 200);
  assert.equal((await hook(body)).status, 200); // Meta retries: same wamid
  const { body: list } = await json(await api('/api/wa/conversations'));
  assert.equal(list.conversations.length, 1);
  const c = list.conversations[0];
  assert.equal(c.clientId, 'c-a'); assert.equal(c.name, 'Customer A'); assert.equal(c.contactName, 'Ana'); assert.equal(c.profileName, 'Ana');
  assert.equal(c.jobId, 'FD-E-1042'); assert.equal(c.jobLinkedBy, 'text');
  assert.equal(c.unread, 1); assert.equal(c.window.open, true);
  const { body: th } = await json(await api(`/api/wa/conversations/${c.id}/messages`));
  assert.equal(th.messages.length, 1); assert.equal(th.messages[0].direction, 'in'); assert.equal(th.messages[0].jobId, 'FD-E-1042');
});

test('unknown job references are not linked when the job list is known', async () => {
  await hook(textMsg('447700900123', 'wamid.AG1', 'ref XX-E-9999 is ours?'));
  const c = inbox.store.convByWaId('447700900123')!;
  assert.equal(c.agentId, 'ag-1'); assert.equal(c.jobId, null);
});

test('inbound image and document: media downloaded to local storage', async () => {
  await hook(imageMsg('971501234567', 'wamid.IMG'));
  await hook(documentMsg('971501234567', 'wamid.DOC'));
  await inbox.flush();
  const img = inbox.store.messageByWamid('wamid.IMG')!, doc = inbox.store.messageByWamid('wamid.DOC')!;
  assert.ok(img.mediaPath && existsSync(img.mediaPath)); assert.equal(img.mediaMime, 'image/jpeg'); assert.equal(img.size, 7);
  assert.ok(doc.mediaPath!.endsWith('packing_list.pdf')); assert.match(readFileSync(doc.mediaPath!, 'utf8'), /%PDF/);
  assert.ok(mock.requests.some((r) => r.path.startsWith('/v26.0/DOC1?phone_number_id=') && r.headers.authorization === `Bearer ${TOKEN}`));
  const r = await api(`/api/wa/messages/${doc.id}/media`);
  assert.equal(r.status, 200); assert.equal(r.headers.get('content-type'), 'application/pdf');
  const { body } = await json(await api(`/api/wa/conversations/${doc.conversationId}/messages`));
  assert.ok(body.messages.every((m: any) => !('mediaPath' in m)), 'local paths never exposed');
});

test('send text inside the 24 h window → Cloud API text message, then statuses update ticks', async () => {
  const c = inbox.store.convByWaId('971501234567')!;
  const { status, body } = await json(await api('/api/wa/send', { method: 'POST', body: JSON.stringify({ conversationId: c.id, text: 'Container gated in today.', sentBy: 'staff-1' }) }));
  assert.equal(status, 200); assert.equal(body.message.status, 'queued'); assert.equal(body.message.jobId, 'FD-E-1042');
  const sent = mock.requests.at(-1)!;
  assert.equal(sent.path, `/v26.0/${PNID}/messages`);
  assert.deepEqual(sent.json, { messaging_product: 'whatsapp', recipient_type: 'individual', to: '971501234567', type: 'text', text: { body: 'Container gated in today.', preview_url: false } });
  const w = body.message.wamid;
  await hook(statusMsg(w, 'delivered', '971501234567'));
  await hook(statusMsg(w, 'sent', '971501234567')); // late "sent" must not downgrade
  assert.equal(inbox.store.messageByWamid(w)!.status, 'delivered');
  await hook(statusMsg(w, 'read', '971501234567'));
  assert.equal(inbox.store.messageByWamid(w)!.status, 'read');
});

test('PDF document: upload (≤100 MB) then send as document inside the window', async () => {
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF');
  const up = await json(await fetch(`${base}/api/wa/media`, { method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/pdf', 'X-Filename': encodeURIComponent('INV-1042 invoice.pdf') }, body: pdf }));
  assert.equal(up.status, 200); assert.equal(up.body.size, pdf.length);
  const c = inbox.store.convByWaId('971501234567')!;
  const r = await json(await api('/api/wa/send', { method: 'POST', body: JSON.stringify({ conversationId: c.id, uploadId: up.body.id, caption: 'Invoice INV-1042' }) }));
  assert.equal(r.status, 200); assert.equal(r.body.message.type, 'document'); assert.equal(r.body.message.filename, 'INV-1042 invoice.pdf');
  const media = mock.requests.find((x) => x.path.endsWith('/media') && x.method === 'POST')!;
  assert.equal(media.form!.messaging_product, 'whatsapp'); assert.deepEqual(media.form!.file, { name: 'INV-1042 invoice.pdf', size: pdf.length, type: 'application/pdf' });
  assert.deepEqual(mock.requests.at(-1)!.json!.document, { id: (mock.requests.at(-1)!.json!.document as any).id, filename: 'INV-1042 invoice.pdf', caption: 'Invoice INV-1042' });
  const bad = await fetch(`${base}/api/wa/media`, { method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/x-msdownload' }, body: 'MZ' });
  assert.equal(bad.status, 415);
});

test('upload over the size limit is refused', async () => {
  const small = { ...cfg, maxMediaBytes: 10 };
  const s2 = createApp(small, inbox); await new Promise<void>((r) => s2.listen(0, '127.0.0.1', r));
  const r = await fetch(`http://127.0.0.1:${(s2.address() as AddressInfo).port}/api/wa/media`, { method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/pdf' }, body: Buffer.alloc(64) });
  assert.equal(r.status, 413); s2.close();
});

test('24 h window closed: free text refused (409), template accepted, fallback template used automatically', async () => {
  clock += WINDOW_MS + 60_000;
  const c = inbox.store.convByWaId('971501234567')!;
  const before = mock.requests.length;
  const r1 = await json(await api('/api/wa/send', { method: 'POST', body: JSON.stringify({ conversationId: c.id, text: 'Hello again' }) }));
  assert.equal(r1.status, 409); assert.equal(r1.body.error, 'window_closed'); assert.equal(r1.body.window.open, false);
  assert.equal(mock.requests.length, before, 'nothing sent to the provider');
  const tpl = { key: 'freeTime', lang: 'es', values: ['Ana', 'MSKU1234567', 'FD-E-1042', '14 nov'] };
  const r2 = await json(await api('/api/wa/send', { method: 'POST', body: JSON.stringify({ conversationId: c.id, template: tpl }) }));
  assert.equal(r2.status, 200); assert.equal(r2.body.usedTemplate, true); assert.equal(r2.body.message.template, 'fd_free_time_ending'); assert.equal(r2.body.message.lang, 'es');
  assert.match(r2.body.message.text, /^Hola Ana, el tiempo libre/);
  assert.deepEqual((mock.requests.at(-1)!.json as any).template.language, { code: 'es' });
  const r3 = await json(await api('/api/wa/send', { method: 'POST', body: JSON.stringify({ conversationId: c.id, text: 'Free text', fallbackTemplate: { key: 'arrival', lang: 'en', values: ['FD-I-0877', 'SAMPLE VESSEL', 'Port Two', '18 Nov'] } }) }));
  assert.equal(r3.status, 200); assert.equal(r3.body.reason, 'window_closed_fallback'); assert.equal(r3.body.message.template, 'fd_arrival_notice');
  const r4 = await json(await api('/api/wa/send', { method: 'POST', body: JSON.stringify({ conversationId: c.id, template: { key: 'freeTime', lang: 'en', values: ['only one'] } }) }));
  assert.equal(r4.status, 400); assert.equal(r4.body.error, 'template_values');
});

test('customer replies → window re-opens; template with document header outside the window', async () => {
  const c0 = inbox.store.convByWaId('971501234567')!;
  assert.equal(inbox.view(c0).window.open, false);
  await hook(textMsg('971501234567', 'wamid.IN2', 'ok thanks', Math.floor(clock / 1000)));
  assert.equal(inbox.view(inbox.store.convByWaId('971501234567')!).window.open, true);
  clock += WINDOW_MS + 1;
  const up = await json(await fetch(`${base}/api/wa/media`, { method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/pdf', 'X-Filename': 'INV-1.pdf' }, body: Buffer.from('%PDF-1.4') }));
  const r = await json(await api('/api/wa/send', { method: 'POST', body: JSON.stringify({ conversationId: c0.id, uploadId: up.body.id, template: { key: 'invoiceIssued', lang: 'ar', values: ['INV-1', 'FD-E-1042', 'USD 1,420', '20 Nov'] } }) }));
  assert.equal(r.status, 200); assert.equal(r.body.message.type, 'template+document');
  assert.equal((mock.requests.at(-1)!.json as any).template.components[0].parameters[0].type, 'document');
  const doc = await json(await api('/api/wa/send', { method: 'POST', body: JSON.stringify({ conversationId: c0.id, uploadId: up.body.id }) }));
  assert.equal(doc.status, 409, 'plain document outside the window is refused');
});

test('provider error is stored as failed (with code), status webhook failed is recorded', async () => {
  clock = Date.now();
  await hook(textMsg('971501234567', 'wamid.IN3', 'still there?', Math.floor(clock / 1000)));
  const c = inbox.store.convByWaId('971501234567')!;
  mock.failNext(131026, 'Message undeliverable');
  const r = await json(await api('/api/wa/send', { method: 'POST', body: JSON.stringify({ conversationId: c.id, text: 'x' }) }));
  assert.equal(r.status, 502); assert.equal(r.body.code, 131026);
  const failed = inbox.store.messages(c.id).find((m) => m.errorCode === 131026)!;
  assert.equal(failed.status, 'failed'); assert.equal(failed.errorCode, 131026);
  const ok = await json(await api('/api/wa/send', { method: 'POST', body: JSON.stringify({ conversationId: c.id, text: 'retry' }) }));
  await hook(statusMsg(ok.body.message.wamid, 'failed', '971501234567', [{ code: 131047, title: 'Re-engagement message' }]));
  const m = inbox.store.messageByWamid(ok.body.message.wamid)!;
  assert.equal(m.status, 'failed'); assert.equal(m.errorCode, 131047);
});

test('staff link-to-job overrides text linking and tags earlier messages; job thread endpoint', async () => {
  const c = inbox.store.convByWaId('447700900123')!;
  const r = await json(await api(`/api/wa/conversations/${c.id}/link`, { method: 'POST', body: JSON.stringify({ jobId: 'fd-i-0877' }) }));
  assert.equal(r.body.conversation.jobId, 'FD-I-0877'); assert.equal(r.body.conversation.jobLinkedBy, 'staff');
  await hook(textMsg('447700900123', 'wamid.AG2', 'also about FD-E-1042'));
  assert.equal(inbox.store.convByWaId('447700900123')!.jobId, 'FD-I-0877', 'staff choice wins');
  const j = await json(await api('/api/wa/jobs/FD-I-0877/messages'));
  assert.ok(j.body.messages.length >= 1); assert.equal(j.body.conversations[0].agentId, 'ag-1');
  await api(`/api/wa/conversations/${c.id}/read`, { method: 'POST' });
  assert.equal(inbox.store.conv(c.id)!.unread, 0);
});

test('send to a new number: E.164 validated', async () => {
  const bad = await json(await api('/api/wa/send', { method: 'POST', body: JSON.stringify({ to: '12', text: 'x' }) }));
  assert.equal(bad.status, 400);
  const closed = await json(await api('/api/wa/send', { method: 'POST', body: JSON.stringify({ to: '+34 600 112 233', text: 'x' }) }));
  assert.equal(closed.status, 409, 'new contact has no open window → template required');
});

test('360dialog adapter: D360-API-KEY, /messages path, lookaside host rewritten for media', async () => {
  const m360 = await startMockCloud({ token: 'd360key', mode: '360dialog' });
  const c2 = loadConfig({ WA_PROVIDER: '360dialog', WA_TOKEN: 'd360key', WA_API_BASE: m360.url });
  const p = createProvider(c2);
  const { wamid } = await p.send('971501234567', { type: 'text', text: { body: 'hi' } });
  assert.match(wamid, /^wamid\./);
  assert.equal(m360.requests[0].path, '/messages'); assert.equal(m360.requests[0].headers['d360-api-key'], 'd360key');
  const media = await p.downloadMedia('DOC1');
  assert.match(media.bytes.toString(), /%PDF/);
  assert.ok(m360.requests.some((r) => r.path.startsWith('/whatsapp_business/attachments/?mid=DOC1')));
  await m360.close();
});

test('360dialog webhook: x-360dialog-signature checked with the platform secret', async () => {
  const c3 = { ...cfg, provider: '360dialog' as const, appSecret: 'platform' };
  const s3 = createApp(c3, inbox); await new Promise<void>((r) => s3.listen(0, '127.0.0.1', r));
  const u = `http://127.0.0.1:${(s3.address() as AddressInfo).port}/webhooks/whatsapp`;
  const raw = JSON.stringify(textMsg('971501234567', 'wamid.360', 'via 360'));
  assert.equal((await fetch(u, { method: 'POST', body: raw, headers: { 'x-360dialog-signature': sign(raw, 'platform') } })).status, 200);
  assert.equal((await fetch(u, { method: 'POST', body: raw, headers: { 'x-360dialog-signature': sign(raw, 'nope') } })).status, 401);
  s3.close();
});
