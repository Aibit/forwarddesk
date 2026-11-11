// Inbox logic, independent of HTTP: inbound processing, linking, sending with the 24 h rule.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Config } from './config.js';
import type { Store, Conversation, Message } from './store.js';
import { ProviderError, type Provider } from './provider.js';
import { parseWebhook, nextStatus } from './parse.js';
import { digits, isE164Digits, matchPhone, findJobRef } from './phone.js';
import { windowState, decideSend } from './window.js';
import { tplByKey, templateMessage, renderTemplate, type TplLang, TPL_LANGS } from './templates.js';

const EXT: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'video/mp4': 'mp4', 'text/plain': 'txt' };
const safeName = (s: string) => s.replace(/[^\w.\-]+/g, '_').slice(0, 120);

export class HttpError extends Error { constructor(public status: number, public body: Record<string, unknown>) { super(String(body.error ?? status)); } }

export interface TplReq { key: string; lang: string; values: string[] }
export interface SendReq { conversationId?: number; to?: string; text?: string; uploadId?: string; caption?: string; template?: TplReq; fallbackTemplate?: TplReq; jobId?: string | null; sentBy?: string }

export class Inbox {
  pending: Promise<unknown>[] = [];
  constructor(public cfg: Config, public store: Store, public provider: Provider, public now: () => number = Date.now) {}

  view(c: Conversation) {
    return { ...c, window: windowState(c.lastInboundAt, this.now()) };
  }

  /** Link a conversation to a client/agent by phone (unless already linked). */
  linkByPhone(c: Conversation) {
    if (c.clientId || c.agentId) return;
    const m = matchPhone(c.waId, this.store.directory());
    if (!m) return;
    this.store.patchConv(c.id, { clientId: m.kind === 'client' ? m.id : null, agentId: m.kind === 'agent' ? m.id : null, name: m.name, contactName: m.contact ?? null });
  }

  jobRefIn(text: string | null): string | null {
    const ref = findJobRef(text, this.cfg.jobRefRegex);
    if (!ref) return null;
    const known = this.store.knownJobs();
    return known.size === 0 || known.has(ref) ? ref : null;
  }

  handleWebhook(body: unknown) {
    const { messages, statuses } = parseWebhook(body);
    let stored = 0;
    for (const m of messages) {
      const c = this.store.ensureConv(m.from, m.ts);
      if (m.profileName) this.store.patchConv(c.id, { profileName: m.profileName });
      this.linkByPhone(c);
      const ref = this.jobRefIn(m.text);
      const fresh = this.store.conv(c.id)!;
      if (ref && fresh.jobLinkedBy !== 'staff') this.store.patchConv(c.id, { jobId: ref, jobLinkedBy: 'text' });
      const row = this.store.insertMessage({
        conversationId: c.id, wamid: m.wamid, direction: 'in', type: m.type, text: m.text, template: null, lang: null,
        mediaId: m.media?.id ?? null, mediaPath: null, mediaMime: m.media?.mime ?? null, filename: m.media?.filename ?? null, size: null,
        status: 'received', errorCode: null, errorTitle: null, jobId: ref ?? this.store.conv(c.id)!.jobId, sentBy: null, ts: m.ts, statusAt: null,
      });
      if (!row) continue; // duplicate delivery
      stored++;
      const after = this.store.conv(c.id)!;
      this.store.patchConv(c.id, { lastInboundAt: Math.max(after.lastInboundAt ?? 0, m.ts), lastMessageAt: Math.max(after.lastMessageAt ?? 0, m.ts), lastText: m.text ?? `[${m.type}]` });
      this.store.bumpUnread(c.id);
      if (m.media?.id) this.pending.push(this.fetchMedia(row, m.media.url).catch((e) => console.error('media download failed', row.id, (e as Error).message)));
    }
    for (const s of statuses) {
      const row = this.store.messageByWamid(s.wamid);
      if (!row) continue;
      this.store.setStatus(row.id, nextStatus(row.status, s.status), s.ts, s.error ? { code: s.error.code, title: s.error.title } : null);
    }
    return { messages: messages.length, stored, statuses: statuses.length };
  }

  async fetchMedia(row: Message, url: string | null) {
    const { bytes, mime } = await this.provider.downloadMedia(row.mediaId!, url);
    const m = mime ?? row.mediaMime ?? 'application/octet-stream';
    const dir = join(this.cfg.mediaDir, String(row.conversationId));
    mkdirSync(dir, { recursive: true });
    const name = row.filename ? safeName(row.filename) : `${row.type}.${EXT[m.split(';')[0]] ?? 'bin'}`;
    const path = join(dir, `${row.id}-${name}`);
    writeFileSync(path, bytes);
    this.store.setMedia(row.id, path, m, bytes.length);
  }

  async flush() { const p = this.pending; this.pending = []; await Promise.all(p); }

  linkJob(convId: number, jobId: string | null) {
    const c = this.store.conv(convId);
    if (!c) throw new HttpError(404, { error: 'not_found' });
    const j = jobId ? jobId.trim().toUpperCase() : null;
    this.store.patchConv(convId, { jobId: j, jobLinkedBy: j ? 'staff' : null });
    if (j) this.store.setMessageJob(convId, j);
    return this.view(this.store.conv(convId)!);
  }

  linkContact(convId: number, p: { clientId?: string | null; agentId?: string | null; name?: string | null }) {
    if (!this.store.conv(convId)) throw new HttpError(404, { error: 'not_found' });
    this.store.patchConv(convId, { clientId: p.clientId ?? null, agentId: p.agentId ?? null, ...(p.name !== undefined ? { name: p.name } : {}) });
    return this.view(this.store.conv(convId)!);
  }

  async send(r: SendReq) {
    let c: Conversation | null = null;
    if (r.conversationId) c = this.store.conv(Number(r.conversationId));
    else if (r.to) {
      const d = digits(r.to);
      if (!isE164Digits(d)) throw new HttpError(400, { error: 'bad_number', detail: 'Use an international number, e.g. +971501234567' });
      c = this.store.ensureConv(d, this.now());
      this.linkByPhone(c);
      c = this.store.conv(c.id);
    }
    if (!c) throw new HttpError(404, { error: 'conversation_not_found' });
    const text = (r.text ?? '').trim();
    if (text.length > 4096) throw new HttpError(400, { error: 'text_too_long', detail: 'WhatsApp text messages are limited to 4096 characters.' });
    const upload = r.uploadId ? this.store.upload(r.uploadId) : null;
    if (r.uploadId && !upload) throw new HttpError(400, { error: 'upload_not_found' });
    if (!text && !upload && !r.template) throw new HttpError(400, { error: 'empty' });
    const w = windowState(c.lastInboundAt, this.now());
    const d = decideSend({ text: !!text, document: !!upload, template: !!r.template, fallbackTemplate: !!r.fallbackTemplate }, w);
    if (!d.ok) throw new HttpError(409, { error: d.error, detail: d.detail, window: w });

    let payload: Record<string, unknown>;
    let stored: { type: string; text: string | null; template: string | null; lang: string | null };
    try {
      if (d.kind === 'template') {
        const tr = (r.template ?? r.fallbackTemplate)!;
        const t = tplByKey(tr.key);
        if (!t) throw new HttpError(400, { error: 'unknown_template', detail: tr.key });
        const lang = (TPL_LANGS as string[]).includes(tr.lang) ? (tr.lang as TplLang) : 'en';
        let header: { id: string; filename: string } | undefined;
        if (upload && t.header === 'document') header = { id: await this.provider.uploadMedia(upload.path, upload.mime, upload.filename), filename: upload.filename };
        try { payload = { type: 'template', template: templateMessage(t, lang, tr.values ?? [], header) }; } catch (e) { throw new HttpError(400, { error: 'template_values', detail: (e as Error).message }); }
        stored = { type: header ? 'template+document' : 'template', text: renderTemplate(t, lang, tr.values ?? []), template: t.name, lang };
      } else if (d.kind === 'document') {
        const id = await this.provider.uploadMedia(upload!.path, upload!.mime, upload!.filename);
        const caption = (r.caption ?? text).slice(0, 1024) || undefined;
        payload = { type: 'document', document: { id, filename: upload!.filename, ...(caption ? { caption } : {}) } };
        stored = { type: 'document', text: caption ?? null, template: null, lang: null };
      } else {
        payload = { type: 'text', text: { body: text, preview_url: false } };
        stored = { type: 'text', text, template: null, lang: null };
      }
    } catch (e) {
      if (e instanceof HttpError) throw e;
      return this.recordFailure(c, r, e, upload);
    }
    try {
      const { wamid } = await this.provider.send(c.waId, payload);
      const now = this.now();
      const row = this.store.insertMessage({
        conversationId: c.id, wamid, direction: 'out', type: stored.type, text: stored.text, template: stored.template, lang: stored.lang,
        mediaId: null, mediaPath: upload?.path ?? null, mediaMime: upload?.mime ?? null, filename: upload?.filename ?? null, size: upload?.size ?? null,
        status: 'queued', errorCode: null, errorTitle: null, jobId: r.jobId ?? c.jobId, sentBy: r.sentBy ?? null, ts: now, statusAt: null,
      })!;
      this.store.patchConv(c.id, { lastMessageAt: now, lastText: stored.text ?? `[${stored.type}]` });
      return { message: row, conversation: this.view(this.store.conv(c.id)!), usedTemplate: d.kind === 'template', reason: d.ok ? d.reason ?? null : null };
    } catch (e) {
      return this.recordFailure(c, r, e, upload, stored);
    }
  }

  recordFailure(c: Conversation, r: SendReq, e: unknown, upload: { path: string; mime: string; filename: string; size: number } | null, stored?: { type: string; text: string | null; template: string | null; lang: string | null }): never {
    const pe = e instanceof ProviderError ? e : null;
    const now = this.now();
    const row = this.store.insertMessage({
      conversationId: c.id, wamid: null, direction: 'out', type: stored?.type ?? (upload ? 'document' : 'text'), text: stored?.text ?? r.text ?? null, template: stored?.template ?? null, lang: stored?.lang ?? null,
      mediaId: null, mediaPath: upload?.path ?? null, mediaMime: upload?.mime ?? null, filename: upload?.filename ?? null, size: upload?.size ?? null,
      status: 'failed', errorCode: pe?.code ?? null, errorTitle: pe?.message ?? String((e as Error)?.message ?? e), jobId: r.jobId ?? c.jobId, sentBy: r.sentBy ?? null, ts: now, statusAt: now,
    });
    throw new HttpError(502, { error: 'provider_error', code: pe?.code ?? null, detail: pe?.message ?? String((e as Error)?.message ?? e), message: row });
  }
}
