// Inbox data sources: the ForwardDesk WhatsApp service (server/), or SAMPLE conversations with a mock
// provider for the public demo. The sample backend never sends anything and marks every send "Sample: not sent".
import { windowState, decideSend, type WindowState } from '../../server/src/window';
import { tplByKey, renderTemplate, TPL_LANGS, type TplLang } from '../../server/src/templates';

export type MsgStatus = 'received' | 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'sample';
export interface Conv {
  id: number; waId: string; name: string | null; profileName: string | null;
  clientId: string | null; agentId: string | null; contactName: string | null;
  jobId: string | null; jobLinkedBy: 'text' | 'staff' | null;
  lastInboundAt: number | null; lastMessageAt: number | null; lastText: string | null; unread: number; createdAt: number;
  window: WindowState; sample?: boolean;
}
export interface Msg {
  id: number; conversationId: number; wamid: string | null; direction: 'in' | 'out'; type: string; text: string | null;
  template: string | null; lang: string | null; mediaMime: string | null; filename: string | null; size: number | null;
  status: MsgStatus; errorCode: number | null; errorTitle: string | null; jobId: string | null; ts: number; hasMedia: boolean; sample?: boolean;
}
export interface TplReq { key: string; lang: string; values: string[] }
export interface SendReq { conversationId: number; text?: string; uploadId?: string; caption?: string; template?: TplReq; jobId?: string | null }
export class InboxError extends Error {
  status: number; body: { error?: string; detail?: string; code?: number | null };
  constructor(status: number, body: { error?: string; detail?: string; code?: number | null }) { super(body.detail ?? body.error ?? `HTTP ${status}`); this.status = status; this.body = body; }
}
export interface DirEntry { kind: 'client' | 'agent'; id: string; name: string; contact?: string; phones: string[] }

export interface InboxBackend {
  kind: 'sample' | 'server';
  status(): Promise<{ provider: string; problems: string[]; ready: boolean; mock: boolean }>;
  list(): Promise<Conv[]>;
  thread(id: number): Promise<{ conversation: Conv; messages: Msg[] }>;
  send(r: SendReq): Promise<{ message: Msg }>;
  upload(blob: Blob, filename: string): Promise<{ id: string }>;
  linkJob(id: number, jobId: string | null): Promise<Conv>;
  read(id: number): Promise<void>;
  media(msgId: number): Promise<Blob | null>;
  syncDirectory(entries: DirEntry[], jobs: string[]): Promise<void>;
}

// ── ForwardDesk WhatsApp service ──
export function serverBackend(url: string, key: string): InboxBackend {
  const base = url.replace(/\/+$/, '');
  const call = async (path: string, init: RequestInit = {}) => {
    const r = await fetch(`${base}${path}`, { ...init, headers: { Authorization: `Bearer ${key}`, ...(init.body && !(init.body instanceof Blob) ? { 'Content-Type': 'application/json' } : {}), ...(init.headers ?? {}) } });
    if (!r.ok) { let b: InboxError['body'] = {}; try { b = await r.json(); } catch { /* */ } throw new InboxError(r.status, b); }
    return r;
  };
  const j = async <T,>(path: string, init?: RequestInit) => (await (await call(path, init)).json()) as T;
  return {
    kind: 'server',
    status: () => j('/api/wa/status'),
    list: async () => (await j<{ conversations: Conv[] }>('/api/wa/conversations')).conversations,
    thread: (id) => j(`/api/wa/conversations/${id}/messages`),
    send: (r) => j('/api/wa/send', { method: 'POST', body: JSON.stringify(r) }),
    upload: (blob, filename) => j('/api/wa/media', { method: 'POST', body: blob, headers: { 'Content-Type': blob.type || 'application/pdf', 'X-Filename': encodeURIComponent(filename) } }),
    linkJob: async (id, jobId) => (await j<{ conversation: Conv }>(`/api/wa/conversations/${id}/link`, { method: 'POST', body: JSON.stringify({ jobId }) })).conversation,
    read: async (id) => { await call(`/api/wa/conversations/${id}/read`, { method: 'POST' }); },
    media: async (id) => (await call(`/api/wa/messages/${id}/media`)).blob(),
    syncDirectory: async (entries, jobs) => { await call('/api/wa/directory', { method: 'PUT', body: JSON.stringify({ entries, jobs }) }); },
  };
}

// ── SAMPLE conversations (public demo) ──
const H = 3600000, M = 60000;
interface SampleState { convs: Omit<Conv, 'window'>[]; msgs: Msg[]; n: number; v: 1 }
const SKEY = 'fd.inbox.sample.v1';

function seed(now: number): SampleState {
  let id = 0;
  const msgs: Msg[] = [];
  const m = (conversationId: number, direction: 'in' | 'out', ago: number, text: string, extra: Partial<Msg> = {}) => msgs.push({
    id: ++id, conversationId, wamid: null, direction, type: 'text', text, template: null, lang: null, mediaMime: null, filename: null, size: null,
    status: direction === 'in' ? 'received' : 'read', errorCode: null, errorTitle: null, jobId: null, ts: now - ago, hasMedia: false, sample: true, ...extra,
  });
  const ft = tplByKey('freeTime')!, pay = tplByKey('payBeforeBl')!;
  // 1 · Customer A: window open, unread document
  m(1, 'out', 26 * H, renderTemplate(ft, 'en', ['Sample contact A', 'LNAU2041180, LNAU2043774', 'FD-E-1042', '14 Nov']), { type: 'template', template: ft.name, lang: 'en', jobId: 'FD-E-1042' });
  m(1, 'in', 3 * H, 'Thanks. Is LNAU2041180 loaded yet? (FD-E-1042)', { jobId: 'FD-E-1042' });
  m(1, 'out', 2 * H + 50 * M, 'Not yet. Gate-in is booked for tomorrow at 09:00; we will send the draft B/L right after.', { jobId: 'FD-E-1042' });
  m(1, 'in', 40 * M, 'Packing list attached.', { type: 'document', filename: 'packing-list-FD-E-1042.pdf', mediaMime: 'application/pdf', size: 48213, jobId: 'FD-E-1042' });
  // 2 · Unknown number: not linked, open, 2 unread
  m(2, 'in', 16 * M, 'Hello, do you have space to Port Two next week?');
  m(2, 'in', 15 * M, '2×40HC, general cargo. Ready on Monday.');
  // 3 · Customer F (Spanish): window closed, linked by staff
  m(3, 'in', 31 * H, 'Hola, ¿cuándo llega el contenedor del FD-I-0921?', { jobId: 'FD-I-0921' });
  m(3, 'out', 30 * H, 'Llega el jueves. Le enviaremos el aviso de llegada ese día.', { status: 'delivered', jobId: 'FD-I-0921' });
  // 4 · Customer B: closed, template not delivered
  m(4, 'in', 4 * 24 * H, 'Received, thank you.', { jobId: 'FD-E-1038' });
  m(4, 'out', 2 * H, renderTemplate(pay, 'en', ['FD-E-1038', 'USD 2,950']), { type: 'template', template: pay.name, lang: 'en', status: 'failed', errorCode: 131026, errorTitle: 'Message undeliverable', jobId: 'FD-E-1038' });
  const c = (cid: number, waId: string, p: Partial<Conv>): Omit<Conv, 'window'> => {
    const mine = msgs.filter((x) => x.conversationId === cid);
    const lastIn = mine.filter((x) => x.direction === 'in').at(-1);
    const last = mine.at(-1)!;
    return { id: cid, waId, name: null, profileName: null, clientId: null, agentId: null, contactName: null, jobId: null, jobLinkedBy: null, lastInboundAt: lastIn?.ts ?? null, lastMessageAt: last.ts, lastText: last.text, unread: 0, createdAt: mine[0].ts, sample: true, ...p };
  };
  return {
    convs: [
      c(1, '447700900101', { name: 'Customer A', contactName: 'Sample contact A', profileName: 'Sample contact A', clientId: 'c-a', jobId: 'FD-E-1042', jobLinkedBy: 'text', unread: 1, lastText: 'packing-list-FD-E-1042.pdf' }),
      c(2, '447700900456', { profileName: 'Sample sender', unread: 2 }),
      c(3, '447700900106', { name: 'Customer F', contactName: 'Sample contact F', profileName: 'Sample contact F', clientId: 'c-f', jobId: 'FD-I-0921', jobLinkedBy: 'staff' }),
      c(4, '447700900102', { name: 'Customer B', contactName: 'Sample contact B', profileName: 'Sample contact B', clientId: 'c-b', jobId: 'FD-E-1038', jobLinkedBy: 'text' }),
    ],
    msgs, n: id, v: 1,
  };
}

export function sampleBackend(): InboxBackend {
  let s: SampleState;
  try { const raw = localStorage.getItem(SKEY); s = raw ? JSON.parse(raw) : seed(Date.now()); } catch { s = seed(Date.now()); }
  if (s.v !== 1) s = seed(Date.now());
  const save = () => { try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch { /* full */ } };
  save();
  const view = (c: Omit<Conv, 'window'>): Conv => ({ ...c, window: windowState(c.lastInboundAt, Date.now()) });
  const get = (id: number) => { const c = s.convs.find((x) => x.id === id); if (!c) throw new InboxError(404, { error: 'not_found' }); return c; };
  const uploads = new Map<string, { filename: string; size: number; type: string }>();
  return {
    kind: 'sample',
    status: async () => ({ provider: 'sample', problems: [], ready: false, mock: true }),
    list: async () => [...s.convs].sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0)).map(view),
    thread: async (id) => ({ conversation: view(get(id)), messages: s.msgs.filter((m) => m.conversationId === id).sort((a, b) => a.ts - b.ts) }),
    async send(r) {
      const c = get(r.conversationId);
      const w = windowState(c.lastInboundAt, Date.now());
      const up = r.uploadId ? uploads.get(r.uploadId) : undefined;
      const d = decideSend({ text: !!r.text?.trim(), document: !!up, template: !!r.template }, w);
      if (!d.ok) throw new InboxError(409, { error: d.error, detail: d.detail });
      let msg: Partial<Msg>;
      if (d.kind === 'template') {
        const t = tplByKey(r.template!.key);
        if (!t) throw new InboxError(400, { error: 'unknown_template' });
        const lang = (TPL_LANGS as string[]).includes(r.template!.lang) ? (r.template!.lang as TplLang) : 'en';
        if (r.template!.values.length !== t.params.length || r.template!.values.some((v) => !String(v).trim())) throw new InboxError(400, { error: 'template_values', detail: 'Fill in every value.' });
        msg = { type: up && t.header ? 'template+document' : 'template', text: renderTemplate(t, lang, r.template!.values), template: t.name, lang, filename: up?.filename ?? null, mediaMime: up?.type ?? null, size: up?.size ?? null };
      } else if (d.kind === 'document') msg = { type: 'document', text: r.caption ?? r.text ?? null, filename: up!.filename, mediaMime: up!.type, size: up!.size };
      else msg = { type: 'text', text: r.text!.trim() };
      const now = Date.now();
      const row: Msg = { id: ++s.n, conversationId: c.id, wamid: null, direction: 'out', type: 'text', text: null, template: null, lang: null, mediaMime: null, filename: null, size: null, status: 'sample', errorCode: null, errorTitle: null, jobId: r.jobId ?? c.jobId, ts: now, hasMedia: false, sample: true, ...msg };
      s.msgs.push(row);
      c.lastMessageAt = now; c.lastText = row.text ?? row.filename;
      save();
      return { message: row };
    },
    async upload(blob, filename) { const id = `sample-upload-${++s.n}`; uploads.set(id, { filename, size: blob.size, type: blob.type || 'application/pdf' }); return { id }; },
    async linkJob(id, jobId) { const c = get(id); c.jobId = jobId ? jobId.toUpperCase() : null; c.jobLinkedBy = jobId ? 'staff' : null; for (const m of s.msgs) if (m.conversationId === id && !m.jobId) m.jobId = c.jobId; save(); return view(c); },
    async read(id) { get(id).unread = 0; save(); },
    async media() { return null; },
    async syncDirectory() { /* sample data is pre-linked */ },
  };
}
export const resetSampleInbox = () => { try { localStorage.removeItem(SKEY); } catch { /* */ } };
