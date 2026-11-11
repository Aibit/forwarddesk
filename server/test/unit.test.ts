import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sign, verifySignature } from '../src/signature.js';
import { parseWebhook, nextStatus } from '../src/parse.js';
import { windowState, decideSend, WINDOW_MS } from '../src/window.js';
import { matchPhone, findJobRef, digits, type DirEntry } from '../src/phone.js';
import { WA_TEMPLATES, TPL_LANGS, templateMessage, renderTemplate, metaSubmissions, tplByKey } from '../src/templates.js';
import { textMsg, imageMsg, documentMsg, statusMsg } from './fixtures.js';

// ── signature ──
test('signature: valid X-Hub-Signature-256 passes', () => {
  const raw = Buffer.from(JSON.stringify(textMsg('971501234567', 'wamid.A', 'hi')));
  assert.equal(verifySignature(raw, `sha256=${sign(raw, 's3cret')}`, 's3cret'), true);
});
test('signature: 360dialog header without sha256= prefix passes', () => {
  const raw = Buffer.from('{"a":1}');
  assert.equal(verifySignature(raw, sign(raw, 'platform'), 'platform'), true);
});
test('signature: wrong secret, tampered body, missing/garbage header fail', () => {
  const raw = Buffer.from('{"a":1}');
  const good = `sha256=${sign(raw, 's3cret')}`;
  assert.equal(verifySignature(raw, `sha256=${sign(raw, 'other')}`, 's3cret'), false);
  assert.equal(verifySignature(Buffer.from('{"a":2}'), good, 's3cret'), false);
  assert.equal(verifySignature(raw, undefined, 's3cret'), false);
  assert.equal(verifySignature(raw, 'sha256=xyz', 's3cret'), false);
  assert.equal(verifySignature(raw, good, ''), false, 'no secret configured → reject');
});
test('signature: re-serialised JSON (different spacing) fails — raw bytes only', () => {
  const raw = Buffer.from('{"a": 1}');
  assert.equal(verifySignature(Buffer.from(JSON.stringify(JSON.parse(raw.toString()))), `sha256=${sign(raw, 'k')}`, 'k'), false);
});

// ── parsing ──
test('parse: text message with profile name', () => {
  const { messages, statuses } = parseWebhook(textMsg('971501234567', 'wamid.T1', 'Hello, about FD-E-1042', 1700000000, 'Ana'));
  assert.equal(statuses.length, 0);
  assert.deepEqual({ ...messages[0], media: messages[0].media }, { wamid: 'wamid.T1', from: '971501234567', profileName: 'Ana', ts: 1700000000000, type: 'text', text: 'Hello, about FD-E-1042', media: null, replyTo: null, phoneNumberId: '123456789012345' });
});
test('parse: image with caption → media id + mime', () => {
  const m = parseWebhook(imageMsg('971501234567', 'wamid.I1')).messages[0];
  assert.equal(m.type, 'image'); assert.equal(m.text, 'seal photo');
  assert.deepEqual(m.media, { id: 'IMG1', mime: 'image/jpeg', filename: null, sha256: 'abc', url: null });
});
test('parse: document keeps filename and caption', () => {
  const m = parseWebhook(documentMsg('971501234567', 'wamid.D1')).messages[0];
  assert.equal(m.type, 'document'); assert.equal(m.media?.filename, 'packing list.pdf'); assert.equal(m.text, 'Packing list FD-E-1042');
});
test('parse: statuses sent/delivered/read/failed with error', () => {
  for (const s of ['sent', 'delivered', 'read'] as const) assert.equal(parseWebhook(statusMsg('wamid.X', s, '971501234567')).statuses[0].status, s);
  const f = parseWebhook(statusMsg('wamid.X', 'failed', '971501234567', [{ code: 131047, title: 'Re-engagement message', error_data: { details: 'More than 24 hours have passed' } }])).statuses[0];
  assert.deepEqual(f.error, { code: 131047, title: 'Re-engagement message', detail: 'More than 24 hours have passed' });
});
test('parse: junk and unknown types are safe', () => {
  assert.deepEqual(parseWebhook(null), { messages: [], statuses: [] });
  assert.deepEqual(parseWebhook({ entry: 'x' }), { messages: [], statuses: [] });
  const body = textMsg('1', 'w', 'x'); (body.entry[0].changes[0].value as any).messages[0].type = 'ephemeral';
  assert.equal(parseWebhook(body).messages[0].type, 'unsupported');
});
test('status order: never goes backwards; failed wins', () => {
  assert.equal(nextStatus('read', 'delivered'), 'read');
  assert.equal(nextStatus('queued', 'delivered'), 'delivered');
  assert.equal(nextStatus('delivered', 'failed'), 'failed');
  assert.equal(nextStatus('failed', 'read'), 'failed');
});

// ── 24 h window ──
test('window: open for 24 h after the last inbound message, then closed', () => {
  const t0 = 1_700_000_000_000;
  assert.equal(windowState(null, t0).open, false);
  assert.equal(windowState(t0, t0 + 1000).open, true);
  assert.equal(windowState(t0, t0 + WINDOW_MS - 1).open, true);
  assert.equal(windowState(t0, t0 + WINDOW_MS).open, false);
  assert.equal(windowState(t0, t0 + 3_600_000).msLeft, WINDOW_MS - 3_600_000);
});
test('window: decideSend — text/document inside, refused outside, template always, fallback outside', () => {
  const open = windowState(1000, 2000), closed = windowState(1000, 1000 + WINDOW_MS + 1);
  assert.deepEqual(decideSend({ text: true }, open), { ok: true, kind: 'text' });
  assert.deepEqual(decideSend({ document: true }, open), { ok: true, kind: 'document' });
  assert.equal(decideSend({ text: true }, closed).ok, false);
  assert.equal(decideSend({ document: true }, closed).ok, false);
  assert.deepEqual(decideSend({ template: true }, closed), { ok: true, kind: 'template' });
  assert.deepEqual(decideSend({ text: true, fallbackTemplate: true }, closed), { ok: true, kind: 'template', reason: 'window_closed_fallback' });
  assert.deepEqual(decideSend({ text: true, fallbackTemplate: true }, open), { ok: true, kind: 'text' });
});

// ── phone → contact linking ──
const DIR: DirEntry[] = [
  { kind: 'client', id: 'c-a', name: 'Customer A', contact: 'Ana', phones: ['+971 50 123 4567'] },
  { kind: 'agent', id: 'ag-1', name: 'Agent One', phones: ['0044 7700 900123'] },
  { kind: 'client', id: 'c-b', name: 'Customer B', phones: ['0612 345 678'] },
];
test('linking: exact E.164 match to a client (spaces, +, 00 ignored)', () => {
  assert.deepEqual(matchPhone('971501234567', DIR), { kind: 'client', id: 'c-a', name: 'Customer A', contact: 'Ana', how: 'exact' });
  assert.equal(matchPhone('447700900123', DIR)?.id, 'ag-1');
});
test('linking: national-format number matches on the last 9 digits when unique', () => {
  assert.equal(matchPhone('34612345678', DIR)?.id, 'c-b');
  assert.equal(matchPhone('34612345678', DIR)?.how, 'suffix');
});
test('linking: no match / ambiguous suffix → null', () => {
  assert.equal(matchPhone('15550001111', DIR), null);
  assert.equal(matchPhone('34612345678', [...DIR, { kind: 'agent', id: 'x', name: 'X', phones: ['+33 612 345 678'] }]), null);
});
test('linking: job reference found in text', () => {
  const re = /\b[A-Z]{2,4}-[EI]-\d{3,6}\b/i;
  assert.equal(findJobRef('status of fd-e-1042 please', re), 'FD-E-1042');
  assert.equal(findJobRef('no ref here', re), null);
  assert.equal(digits('00971 50-123'), '97150123');
});

// ── templates ──
test('templates: six utility alerts × EN/ES/FA/AR, Meta-ready', () => {
  assert.deepEqual(WA_TEMPLATES.map((t) => t.key).sort(), ['arrival', 'cutoff48', 'draftBl', 'freeTime', 'invoiceIssued', 'payBeforeBl']);
  for (const t of WA_TEMPLATES) {
    assert.match(t.name, /^[a-z0-9_]{1,512}$/);
    assert.equal(t.category, 'UTILITY');
    assert.equal(t.example.length, t.params.length);
    for (const l of TPL_LANGS) {
      const b = t.body[l];
      const nums = [...b.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
      assert.deepEqual(nums, t.params.map((_, i) => i + 1), `${t.name}/${l}: variables 1..n in order`);
      assert.ok(!/^\s*\{\{/.test(b) && !/\}\}\s*$/.test(b), `${t.name}/${l}: no variable at start/end`);
      assert.ok(b.length <= 1024);
      assert.ok(t.label[l]);
    }
    for (const l of ['en', 'es'] as const) assert.ok(!/[\u0600-\u06FF]/.test(t.body[l]), `${t.name}/${l} has no Arabic script`);
    assert.ok(!/[\u067E\u0686\u0698\u06AF\u06A9\u06CC]/.test(t.body.ar), `${t.name}/ar has no Persian-only letters`);
  }
  assert.equal(metaSubmissions().length, WA_TEMPLATES.length * 4);
});
test('templates: message payload + rendered copy', () => {
  const t = tplByKey('freeTime')!;
  const v = ['Ana', 'MSKU1234567', 'FD-E-1042', '14 Nov'];
  const msg = templateMessage(t, 'es', v);
  assert.deepEqual(msg, { name: 'fd_free_time_ending', language: { code: 'es' }, components: [{ type: 'body', parameters: v.map((text) => ({ type: 'text', text })) }] });
  assert.ok(renderTemplate(t, 'en', v).startsWith('Hello Ana, free time for container(s) MSKU1234567 on booking FD-E-1042 ends on 14 Nov.'));
  assert.throws(() => templateMessage(t, 'en', ['Ana']), /needs 4 values/);
  assert.throws(() => templateMessage(t, 'en', ['Ana', '', 'x', 'y']), /empty variable/);
  const inv = templateMessage(tplByKey('invoiceIssued')!, 'ar', ['INV-1', 'FD-E-1', 'USD 1', '1 Dec'], { id: 'M1', filename: 'inv.pdf' });
  assert.deepEqual(inv.components[0], { type: 'header', parameters: [{ type: 'document', document: { id: 'M1', filename: 'inv.pdf' } }] });
});
