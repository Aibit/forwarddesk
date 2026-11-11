// Provider adapters. Meta Cloud API and 360dialog share the Cloud API message shape; they differ in
// base URL, auth header, the phone-number-ID path segment and the media download host.
import { openAsBlob } from 'node:fs';
import type { Config } from './config.js';

export interface SendResult { wamid: string }
export interface Provider {
  name: string;
  send(to: string, message: Record<string, unknown>): Promise<SendResult>;
  uploadMedia(path: string, mime: string, filename: string): Promise<string>;
  /** Download inbound media by ID (or the direct URL included in newer webhooks). */
  downloadMedia(mediaId: string, directUrl?: string | null): Promise<{ bytes: Buffer; mime: string | null }>;
}

export class ProviderError extends Error {
  constructor(message: string, public status: number, public code: number | null, public body: unknown) { super(message); }
}

async function json(r: Response) {
  const t = await r.text();
  let b: unknown = t;
  try { b = JSON.parse(t); } catch { /* not JSON */ }
  if (!r.ok) {
    const e = (b as { error?: { message?: string; code?: number } })?.error;
    throw new ProviderError(e?.message ?? `HTTP ${r.status}`, r.status, e?.code ?? null, b);
  }
  return b as Record<string, unknown>;
}

export function createProvider(c: Config): Provider {
  if (c.provider === 'mock') return mockProvider();
  const is360 = c.provider === '360dialog';
  const auth: Record<string, string> = is360 ? { 'D360-API-KEY': c.token } : { Authorization: `Bearer ${c.token}` };
  const base = is360 ? c.apiBase : `${c.apiBase}/${c.phoneNumberId}`;
  const mediaHostFix = (u: string) => (is360 ? u.replace(/^https:\/\/lookaside\.fbsbx\.com/, c.apiBase) : u);
  return {
    name: c.provider,
    async send(to, message) {
      const r = await fetch(`${base}/messages`, {
        method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, ...message }),
      });
      const b = await json(r) as { messages?: { id: string }[] };
      const id = b.messages?.[0]?.id;
      if (!id) throw new ProviderError('no message id in provider response', 502, null, b);
      return { wamid: id };
    },
    async uploadMedia(path, mime, filename) {
      const fd = new FormData();
      fd.append('messaging_product', 'whatsapp');
      fd.append('type', mime);
      fd.append('file', await openAsBlob(path, { type: mime }), filename);
      const b = await json(await fetch(`${base}/media`, { method: 'POST', headers: auth, body: fd })) as { id?: string };
      if (!b.id) throw new ProviderError('no media id in provider response', 502, null, b);
      return String(b.id);
    },
    async downloadMedia(mediaId, directUrl) {
      let url = directUrl ?? null;
      let mime: string | null = null;
      if (!url) {
        const metaUrl = is360 ? `${c.apiBase}/${mediaId}` : `${c.apiBase}/${mediaId}?phone_number_id=${encodeURIComponent(c.phoneNumberId)}`;
        const m = await json(await fetch(metaUrl, { headers: auth })) as { url?: string; mime_type?: string };
        if (!m.url) throw new ProviderError('no media url', 502, null, m);
        url = m.url; mime = m.mime_type ?? null;
      }
      const r = await fetch(mediaHostFix(url), { headers: auth });
      if (!r.ok) throw new ProviderError(`media download HTTP ${r.status}`, r.status, null, null);
      const len = Number(r.headers.get('content-length') ?? 0);
      if (len > c.maxMediaBytes) throw new ProviderError('media larger than limit', 413, null, null);
      const bytes = Buffer.from(await r.arrayBuffer());
      if (bytes.length > c.maxMediaBytes) throw new ProviderError('media larger than limit', 413, null, null);
      return { bytes, mime: mime ?? r.headers.get('content-type') };
    },
  };
}

/** In-process provider for local development: accepts sends, returns fake IDs, never contacts anyone. */
export function mockProvider(): Provider {
  let n = 0;
  return {
    name: 'mock',
    async send() { return { wamid: `wamid.MOCK${Date.now()}${++n}` }; },
    async uploadMedia() { return `mockmedia${++n}`; },
    async downloadMedia() { return { bytes: Buffer.from('%PDF-1.4\n% mock\n'), mime: 'application/pdf' }; },
  };
}
