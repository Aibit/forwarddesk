// HTTP layer (node:http, no framework).
import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { createReadStream, createWriteStream, mkdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { configProblems, type Config } from './config.js';
import { verifySignature } from './signature.js';
import { Inbox, HttpError } from './service.js';
import { WA_TEMPLATES } from './templates.js';
import type { Accounts } from './accounts/service.js';
import { handleAccounts } from './accounts/routes.js';

const UPLOAD_TYPES = new Set([
  'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []; let n = 0;
    req.on('data', (c: Buffer) => { n += c.length; if (n > limit) { reject(new HttpError(413, { error: 'too_large' })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const send = (res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) => {
  const s = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8', ...headers });
  res.end(s);
};

export function createApp(cfg: Config, inbox: Inbox, accounts: Accounts | null = null): Server {
  const keyOk = (req: IncomingMessage) => {
    if (!cfg.apiKey) return false;
    const h = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    const a = Buffer.from(h), b = Buffer.from(cfg.apiKey);
    return a.length === b.length && timingSafeEqual(a, b);
  };
  const cors = (req: IncomingMessage, res: ServerResponse) => {
    const o = String(req.headers.origin ?? '');
    if (o && cfg.corsOrigins.includes(o)) {
      res.setHeader('Access-Control-Allow-Origin', o);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Filename');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
      res.setHeader('Access-Control-Max-Age', '600');
    }
  };

  const webhookAuthorized = (req: IncomingMessage, raw: Buffer) => {
    if (cfg.provider === 'meta') return verifySignature(raw, req.headers['x-hub-signature-256'] as string, cfg.appSecret);
    if (cfg.provider === '360dialog') {
      if (cfg.appSecret) return verifySignature(raw, req.headers['x-360dialog-signature'] as string, cfg.appSecret);
      return !!cfg.webhookHeaderToken && req.headers['x-fd-webhook-token'] === cfg.webhookHeaderToken;
    }
    // mock: check the signature when a secret is configured (tests), accept otherwise (local dev only)
    return cfg.appSecret ? verifySignature(raw, req.headers['x-hub-signature-256'] as string, cfg.appSecret) : true;
  };

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? '/', 'http://x');
    const p = url.pathname.replace(/\/+$/, '') || '/';
    const m = req.method ?? 'GET';

    if (p === '/healthz') return send(res, 200, { ok: true, accounts: !!accounts });

    // ── Accounts, workspaces, workspace data, waitlist ──
    if (accounts && await handleAccounts(accounts, { corsOrigins: cfg.corsOrigins, waitlistOrigins: cfg.waitlistOrigins, trustProxy: cfg.trustProxy }, req, res, url)) return;

    // ── Webhook ──
    if (p === '/webhooks/whatsapp') {
      if (m === 'GET') {
        const mode = url.searchParams.get('hub.mode'), token = url.searchParams.get('hub.verify_token'), ch = url.searchParams.get('hub.challenge');
        if (mode === 'subscribe' && cfg.verifyToken && token === cfg.verifyToken && ch) return send(res, 200, ch);
        return send(res, 403, 'forbidden');
      }
      if (m === 'POST') {
        const raw = await readBody(req, 5 * 1024 * 1024);
        if (!webhookAuthorized(req, raw)) return send(res, 401, { error: 'bad_signature' });
        let body: unknown;
        try { body = JSON.parse(raw.toString('utf8')); } catch { return send(res, 400, { error: 'bad_json' }); }
        const r = inbox.handleWebhook(body);
        return send(res, 200, { ok: true, ...r });
      }
      return send(res, 405, { error: 'method' });
    }

    // ── App API ──
    if (p.startsWith('/api/wa')) {
      cors(req, res);
      if (m === 'OPTIONS') { res.writeHead(204); return res.end(); }
      if (!cfg.apiKey) return send(res, 503, { error: 'api_key_not_configured' });
      if (!keyOk(req)) return send(res, 401, { error: 'unauthorized' });

      if (p === '/api/wa/status' && m === 'GET') return send(res, 200, { provider: inbox.provider.name, problems: configProblems(cfg), ready: configProblems(cfg).length === 0 && cfg.provider !== 'mock', mock: cfg.provider === 'mock' });
      if (p === '/api/wa/templates' && m === 'GET') return send(res, 200, { templates: WA_TEMPLATES });
      if (p === '/api/wa/conversations' && m === 'GET') return send(res, 200, { conversations: inbox.store.listConvs().map((c) => inbox.view(c)) });
      let mm = p.match(/^\/api\/wa\/conversations\/(\d+)\/messages$/);
      if (mm && m === 'GET') {
        const c = inbox.store.conv(Number(mm[1]));
        if (!c) return send(res, 404, { error: 'not_found' });
        return send(res, 200, { conversation: inbox.view(c), messages: inbox.store.messages(c.id).map(publicMsg) });
      }
      mm = p.match(/^\/api\/wa\/conversations\/(\d+)\/read$/);
      if (mm && m === 'POST') { inbox.store.patchConv(Number(mm[1]), { unread: 0 }); return send(res, 200, { ok: true }); }
      mm = p.match(/^\/api\/wa\/conversations\/(\d+)\/link$/);
      if (mm && m === 'POST') {
        const b = JSON.parse((await readBody(req, 64 * 1024)).toString('utf8') || '{}');
        if ('jobId' in b) return send(res, 200, { conversation: inbox.linkJob(Number(mm[1]), b.jobId) });
        return send(res, 200, { conversation: inbox.linkContact(Number(mm[1]), b) });
      }
      mm = p.match(/^\/api\/wa\/jobs\/([^/]+)\/messages$/);
      if (mm && m === 'GET') {
        const jobId = decodeURIComponent(mm[1]).toUpperCase();
        const msgs = inbox.store.messagesForJob(jobId).map(publicMsg);
        const convIds = [...new Set(msgs.map((x) => x.conversationId))];
        return send(res, 200, { messages: msgs, conversations: convIds.map((id) => inbox.view(inbox.store.conv(id)!)) });
      }
      if (p === '/api/wa/directory' && m === 'PUT') {
        const b = JSON.parse((await readBody(req, 5 * 1024 * 1024)).toString('utf8') || '{}');
        if (!Array.isArray(b.entries)) return send(res, 400, { error: 'entries[] required' });
        inbox.store.replaceDirectory(b.entries, Array.isArray(b.jobs) ? b.jobs : undefined);
        for (const c of inbox.store.listConvs()) inbox.linkByPhone(c);
        return send(res, 200, { ok: true, entries: b.entries.length });
      }
      if (p === '/api/wa/send' && m === 'POST') {
        const b = JSON.parse((await readBody(req, 256 * 1024)).toString('utf8') || '{}');
        const r = await inbox.send(b);
        return send(res, 200, { ...r, message: publicMsg(r.message) });
      }
      if (p === '/api/wa/media' && m === 'POST') {
        const mime = String(req.headers['content-type'] ?? '').split(';')[0].trim();
        if (!UPLOAD_TYPES.has(mime)) return send(res, 415, { error: 'unsupported_type', detail: 'Documents: PDF, Word, Excel, PowerPoint or text.' });
        const filename = decodeURIComponent(String(req.headers['x-filename'] ?? 'document.pdf')).replace(/[\\/]/g, '_').slice(0, 200);
        const id = randomUUID();
        const dir = join(cfg.mediaDir, 'uploads');
        mkdirSync(dir, { recursive: true });
        const path = join(dir, `${id}-${filename.replace(/[^\w.\-]+/g, '_')}`);
        let n = 0;
        const limit = new Transform({ transform(c, _e, cb) { n += c.length; if (n > cfg.maxMediaBytes) cb(new HttpError(413, { error: 'too_large', detail: 'Documents are limited to 100 MB.' })); else cb(null, c); } });
        try { await pipeline(req, limit, createWriteStream(path)); } catch (e) { try { unlinkSync(path); } catch { /* */ } throw e; }
        if (n === 0) { unlinkSync(path); return send(res, 400, { error: 'empty_file' }); }
        inbox.store.addUpload({ id, path, mime, filename, size: n, createdAt: Date.now() });
        return send(res, 200, { id, size: n, filename, mime });
      }
      mm = p.match(/^\/api\/wa\/messages\/(\d+)\/media$/);
      if (mm && m === 'GET') {
        const row = inbox.store.message(Number(mm[1]));
        if (!row?.mediaPath) return send(res, 404, { error: 'no_media' });
        const st = statSync(row.mediaPath);
        res.writeHead(200, { 'Content-Type': row.mediaMime ?? 'application/octet-stream', 'Content-Length': String(st.size), 'Content-Disposition': `inline; filename="${encodeURIComponent(row.filename ?? 'file')}"` });
        return void createReadStream(row.mediaPath).pipe(res);
      }
      return send(res, 404, { error: 'not_found' });
    }
    return send(res, 404, { error: 'not_found' });
  }

  return createServer((req, res) => {
    handle(req, res).catch((e) => {
      if (e instanceof HttpError) return send(res, e.status, e.body);
      console.error(e);
      send(res, 500, { error: 'internal' });
    });
  });
}

/** Never expose local file paths. */
function publicMsg<T extends { mediaPath: string | null }>(m: T) {
  const { mediaPath, ...rest } = m;
  return { ...rest, hasMedia: !!mediaPath };
}
