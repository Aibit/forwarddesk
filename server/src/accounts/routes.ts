// HTTP routes for accounts, workspaces, workspace documents and the waitlist.
// Auth is a bearer session token (Authorization: Bearer …), not a cookie, so the app can live on a
// different domain (GitHub Pages) from the API without third-party-cookie problems.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { HttpError } from '../service.js';
import type { Accounts, Authed, Ctx } from './service.js';

export interface RouteOpts { corsOrigins: string[]; waitlistOrigins: string[]; trustProxy: boolean }

function body(req: IncomingMessage, limit: number): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []; let n = 0;
    req.on('data', (c: Buffer) => { n += c.length; if (n > limit) { reject(new HttpError(413, { error: 'too_large' })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      const s = Buffer.concat(chunks).toString('utf8');
      if (!s) return resolve({});
      try { const j = JSON.parse(s); resolve(j && typeof j === 'object' && !Array.isArray(j) ? j : {}); } catch { reject(new HttpError(400, { error: 'bad_json' })); }
    });
    req.on('error', reject);
  });
}
const send = (res: ServerResponse, status: number, data: unknown, headers: Record<string, string> = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(JSON.stringify(data));
};

export function clientIp(req: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const f = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim();
    if (f) return f;
  }
  return req.socket.remoteAddress ?? 'unknown';
}

const PREFIXES = ['/api/auth', '/api/workspace', '/api/invites', '/api/ws', '/api/waitlist', '/api/admin'];
export const isAccountsPath = (p: string) => PREFIXES.some((x) => p === x || p.startsWith(`${x}/`));

/** Returns true when the request was handled. */
export async function handleAccounts(acc: Accounts, o: RouteOpts, req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
  const p = url.pathname.replace(/\/+$/, '') || '/';
  if (!isAccountsPath(p)) return false;
  const m = req.method ?? 'GET';
  const origin = String(req.headers.origin ?? '');
  const allowed = p === '/api/waitlist' ? [...o.waitlistOrigins, ...o.corsOrigins] : o.corsOrigins;
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '600');
  } else if (origin && m === 'OPTIONS') { res.writeHead(403); res.end(); return true; }
  if (m === 'OPTIONS') { res.writeHead(204); res.end(); return true; }

  const ctx: Ctx = { ip: clientIp(req, o.trustProxy), ua: String(req.headers['user-agent'] ?? '') };
  const token = String(req.headers.authorization ?? '').match(/^Bearer\s+(\S+)$/i)?.[1] ?? null;
  const auth = (): Authed => { const a = acc.authenticate(token); if (!a) throw new HttpError(401, { error: 'unauthenticated' }); return a; };
  const B = (limit = 64 * 1024) => body(req, limit);
  try {
    // public
    if (p === '/api/auth/signup' && m === 'POST') return send(res, 201, await acc.signUp(await B(), ctx)), true;
    if (p === '/api/auth/signin' && m === 'POST') return send(res, 200, await acc.signIn(await B(), ctx)), true;
    if (p === '/api/auth/reset' && m === 'POST') { await acc.requestReset(await B(), ctx); return send(res, 200, { ok: true }), true; }
    if (p === '/api/auth/reset/confirm' && m === 'POST') return send(res, 200, await acc.confirmReset(await B(), ctx)), true;
    if (p === '/api/waitlist' && m === 'POST') { acc.addWaitlist(await B(16 * 1024), ctx); return send(res, 200, { ok: true }), true; }

    // signed in
    const a = auth();
    if (p === '/api/auth/me' && m === 'GET') return send(res, 200, acc.me(a.user)), true;
    if (p === '/api/auth/signout' && m === 'POST') { acc.signOut(a); return send(res, 200, { ok: true }), true; }
    if (p === '/api/workspace' && m === 'POST') return send(res, 201, acc.createWorkspace(a, await B())), true;
    if (p === '/api/workspace' && m === 'PUT') return send(res, 200, { workspace: acc.updateWorkspace(a, await B()) }), true;
    if (p === '/api/workspace/team' && m === 'GET') return send(res, 200, acc.team(a)), true;
    if (p === '/api/workspace/invites' && m === 'POST') return send(res, 201, acc.createInvite(a, await B())), true;
    let mm = p.match(/^\/api\/workspace\/invites\/([A-Za-z0-9]{8,64})$/);
    if (mm && m === 'DELETE') { acc.revokeInvite(a, mm[1]); return send(res, 200, { ok: true }), true; }
    mm = p.match(/^\/api\/workspace\/members\/([A-Za-z0-9_]{3,64})$/);
    if (mm && m === 'DELETE') { acc.removeMember(a, mm[1]); return send(res, 200, { ok: true }), true; }
    if (p === '/api/invites/accept' && m === 'POST') return send(res, 200, acc.acceptInvite(a, await B(), ctx)), true;

    if (p === '/api/ws/docs' && m === 'GET') return send(res, 200, acc.listDocs(a, Number(url.searchParams.get('since') ?? 0))), true;
    if (p === '/api/ws/doc' && m === 'GET') return send(res, 200, acc.getDoc(a, url.searchParams.get('path') ?? '')), true;
    if (p === '/api/ws/write' && m === 'POST') { const b = await B(8 * 1024 * 1024); return send(res, 200, acc.writeDocs(a, b.ops)), true; }

    if (p === '/api/admin/waitlist' && m === 'GET') {
      if (url.searchParams.get('format') === 'csv') {
        const csv = acc.waitlistCsv(a);
        res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="forwarddesk-waitlist.csv"', 'Cache-Control': 'no-store' });
        res.end('\ufeff' + csv);
        return true;
      }
      return send(res, 200, { entries: acc.listWaitlist(a) }), true;
    }
    mm = p.match(/^\/api\/admin\/waitlist\/(\d+)$/);
    if (mm && m === 'PATCH') { acc.setWaitlistStatus(a, Number(mm[1]), await B()); return send(res, 200, { ok: true }), true; }
    return send(res, 404, { error: 'not_found' }), true;
  } catch (e) {
    if (e instanceof HttpError) {
      const h: Record<string, string> = {};
      if (e.status === 429 && typeof e.body.retryAfter === 'number') h['Retry-After'] = String(e.body.retryAfter);
      return send(res, e.status, e.body, h), true;
    }
    throw e;
  }
}
