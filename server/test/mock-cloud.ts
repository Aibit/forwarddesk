// Mock WhatsApp Cloud API (Meta shape, and 360dialog shape). Used by the tests; can also run standalone:
//   npm run mock   → http://localhost:9099  (point WA_API_BASE at http://localhost:9099/v26.0, WA_PROVIDER=meta)
import { createServer, type IncomingMessage } from 'node:http';
import { Readable } from 'node:stream';
import type { AddressInfo } from 'node:net';
import { pathToFileURL } from 'node:url';

export interface MockReq { method: string; path: string; headers: IncomingMessage['headers']; json?: Record<string, unknown>; form?: Record<string, string | { name: string; size: number; type: string }> }
export interface MockCloud { url: string; requests: MockReq[]; media: Map<string, Buffer>; failNext: (code: number, message: string) => void; close: () => Promise<void> }

export async function startMockCloud(opts: { token: string; mode?: 'meta' | '360dialog'; port?: number } ): Promise<MockCloud> {
  const mode = opts.mode ?? 'meta';
  const requests: MockReq[] = [];
  const media = new Map<string, Buffer>([['IMG1', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], ['DOC1', Buffer.from('%PDF-1.4\n% inbound sample\n')]]);
  let fail: { code: number; message: string } | null = null;
  let n = 0;
  let base = '';
  const authOk = (h: IncomingMessage['headers']) => (mode === 'meta' ? h.authorization === `Bearer ${opts.token}` : h['d360-api-key'] === opts.token);

  const server = createServer(async (req, res) => {
    const u = new URL(req.url ?? '/', 'http://x');
    const r: MockReq = { method: req.method ?? 'GET', path: u.pathname + u.search, headers: req.headers };
    requests.push(r);
    const out = (s: number, b: unknown, type = 'application/json') => { res.writeHead(s, { 'Content-Type': type }); res.end(typeof b === 'string' || Buffer.isBuffer(b) ? b : JSON.stringify(b)); };
    // media bytes (no extra auth check on the path itself, but the token is still required like the real API)
    const dl = u.pathname.match(/^\/download\/(\w+)$/) ?? (u.pathname === '/whatsapp_business/attachments/' ? [null, u.searchParams.get('mid')] : null);
    if (dl && r.method === 'GET') {
      if (!authOk(req.headers)) return out(401, { error: { message: 'bad token', code: 190 } });
      const b = media.get(String(dl[1]));
      return b ? out(200, b, String(dl[1]).startsWith('IMG') ? 'image/jpeg' : 'application/pdf') : out(404, { error: { message: 'no media', code: 100 } });
    }
    if (!authOk(req.headers)) return out(401, { error: { message: 'Invalid OAuth access token', code: 190 } });
    const isMessages = mode === 'meta' ? /^\/v[\d.]+\/\w+\/messages$/.test(u.pathname) : u.pathname === '/messages';
    const isMedia = mode === 'meta' ? /^\/v[\d.]+\/\w+\/media$/.test(u.pathname) : u.pathname === '/media';
    if (r.method === 'POST' && isMessages) {
      const chunks: Buffer[] = []; for await (const c of req) chunks.push(c as Buffer);
      r.json = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (fail) { const f = fail; fail = null; return out(400, { error: { message: f.message, type: 'OAuthException', code: f.code } }); }
      if (r.json?.messaging_product !== 'whatsapp' || !r.json?.to) return out(400, { error: { message: 'bad request', code: 100 } });
      return out(200, { messaging_product: 'whatsapp', contacts: [{ input: r.json.to, wa_id: r.json.to }], messages: [{ id: `wamid.MOCK${++n}` }] });
    }
    if (r.method === 'POST' && isMedia) {
      const fd = await new Request('http://x/', { method: 'POST', headers: req.headers as Record<string, string>, body: Readable.toWeb(req) as ReadableStream, duplex: 'half' } as RequestInit).formData();
      r.form = {};
      for (const [k, v] of fd.entries()) r.form[k] = typeof v === 'string' ? v : { name: (v as File).name, size: (v as File).size, type: (v as File).type };
      if (fd.get('messaging_product') !== 'whatsapp' || !fd.get('file')) return out(400, { error: { message: 'missing file', code: 100 } });
      return out(200, { id: `MEDIA${++n}` });
    }
    const mid = mode === 'meta' ? u.pathname.match(/^\/v[\d.]+\/(\w+)$/) : u.pathname.match(/^\/(\w+)$/);
    if (r.method === 'GET' && mid) {
      if (!media.has(mid[1])) return out(404, { error: { message: 'Unsupported get request', code: 100 } });
      const url = mode === 'meta' ? `${base}/download/${mid[1]}` : `https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=${mid[1]}`;
      return out(200, { url, mime_type: mid[1].startsWith('IMG') ? 'image/jpeg' : 'application/pdf', id: mid[1], messaging_product: 'whatsapp' });
    }
    out(404, { error: { message: 'unknown path', code: 100 } });
  });
  await new Promise<void>((r) => server.listen(opts.port ?? 0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { url: base, requests, media, failNext: (code, message) => { fail = { code, message }; }, close: () => new Promise((r) => server.close(() => r())) };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const token = process.env.WA_TOKEN || 'test-token';
  startMockCloud({ token, port: Number(process.env.MOCK_PORT || 9099), mode: (process.env.MOCK_MODE as 'meta' | '360dialog') || 'meta' })
    .then((m) => console.log(`Mock Cloud API on ${m.url} (token "${token}"). Set WA_PROVIDER=meta WA_API_BASE=${m.url}/v26.0`));
}
