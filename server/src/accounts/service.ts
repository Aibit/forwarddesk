// Accounts, sessions, company workspaces, invites, workspace documents and the waitlist.
// Transport-free: routes.ts maps HTTP onto these methods; tests call them directly too.
import { createHash, randomBytes } from 'node:crypto';
import { HttpError } from '../service.js';
import { AccountsDb, type Membership, type User, type Workspace } from './db.js';
import type { Mailer } from './mailer.js';
import { hashPassword, needsRehash, verifyPassword } from './password.js';
import { LIMITS, RateLimiter } from './ratelimit.js';
import { canRead, canWrite, type Who } from './rules.js';
import * as v from './validate.js';

export interface AccountsOptions {
  /** Public URL of the ForwardDesk app; reset and invite links point here (…#reset=, …#join=). */
  appUrl: string;
  sessionDays: number;
  /** Emails that may read the waitlist (comma separated in ADMIN_EMAILS). */
  adminEmails: string[];
  now?: () => number;
  /** Override rate limits (tests, or a busier install). */
  limits?: Partial<typeof LIMITS>;
}
export interface Ctx { ip: string; ua: string }
export interface Authed { user: User; tokenHash: string; member: Membership | null }

const ALNUM = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const LOWER = 'abcdefghijklmnopqrstuvwxyz0123456789';
const rnd = (n: number, abc: string) => { const b = randomBytes(n); let s = ''; for (let i = 0; i < n; i++) s += abc[b[i] % abc.length]; return s; };
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const err = (status: number, error: string, extra: Record<string, unknown> = {}) => new HttpError(status, { error, ...extra });
const DAY = 864e5;
/** Used when an email is unknown, so a failed sign-in takes as long as a real one. */
let DUMMY: Promise<string> | null = null;

export class Accounts {
  readonly limiter: RateLimiter;
  private now: () => number;
  private L: typeof LIMITS;
  constructor(readonly db: AccountsDb, readonly mailer: Mailer, readonly opt: AccountsOptions) {
    this.now = opt.now ?? Date.now;
    this.L = { ...LIMITS, ...(opt.limits ?? {}) };
    this.limiter = new RateLimiter(this.now);
  }

  private limit(key: string, rule: { limit: number; windowMs: number }) {
    const wait = this.limiter.hit(key, rule);
    if (wait) throw err(429, 'rate-limited', { retryAfter: wait });
  }
  private newSession(userId: string, ctx: Ctx) {
    const token = randomBytes(32).toString('base64url');
    const t = this.now();
    this.db.insertSession(sha(token), userId, t, t + this.opt.sessionDays * DAY, ctx.ua);
    return token;
  }

  // ── sign up / in / out ──
  async signUp(b: Record<string, unknown>, ctx: Ctx) {
    this.limit(`signup:ip:${ctx.ip}`, this.L.signupIp);
    const email = v.email(b.email), pw = v.password(b.password), name = v.text(b.name, 'name', 80);
    if (this.db.userByEmail(email)) throw err(409, 'email-already-in-use');
    const t = this.now();
    const u: User = { id: `u_${rnd(20, LOWER)}`, email, name, pwHash: await hashPassword(pw), createdAt: t, pwChangedAt: t };
    try { this.db.insertUser(u); } catch { throw err(409, 'email-already-in-use'); }
    return { token: this.newSession(u.id, ctx), me: this.me(u) };
  }

  async signIn(b: Record<string, unknown>, ctx: Ctx) {
    this.limit(`signin:ip:${ctx.ip}`, this.L.signinIp);
    const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
    const pw = typeof b.password === 'string' ? b.password : '';
    const failKey = `signin:fail:${email}`;
    const wait = this.limiter.blocked(failKey, this.L.signinFail);
    if (wait) throw err(429, 'rate-limited', { retryAfter: wait });
    const u = email ? this.db.userByEmail(email) : null;
    const ok = u ? await verifyPassword(pw, u.pwHash) : (await verifyPassword(pw, await (DUMMY ??= hashPassword(rnd(24, ALNUM)))), false);
    if (!u || !ok) {
      this.limiter.hit(failKey, this.L.signinFail);
      throw err(401, 'invalid-credential');
    }
    this.limiter.clear(failKey);
    if (needsRehash(u.pwHash)) this.db.setPassword(u.id, await hashPassword(pw), u.pwChangedAt);
    return { token: this.newSession(u.id, ctx), me: this.me(u) };
  }

  /** Resolves a bearer token. Sessions slide: each day of use pushes the expiry out again. */
  authenticate(token: string | null): Authed | null {
    if (!token || token.length > 200) return null;
    const h = sha(token);
    const s = this.db.session(h);
    const t = this.now();
    if (!s || Number(s.expires_at) <= t) { if (s) this.db.deleteSession(h); return null; }
    const user = this.db.userById(String(s.user_id));
    if (!user) return null;
    if (t - Number(s.last_seen_at) > DAY) this.db.touchSession(h, t, t + this.opt.sessionDays * DAY);
    return { user, tokenHash: h, member: this.db.membership(user.id) };
  }
  signOut(a: Authed) { this.db.deleteSession(a.tokenHash); }

  me(u: User) {
    const m = this.db.membership(u.id);
    const w = m ? this.db.workspace(m.workspaceId) : null;
    return {
      user: { id: u.id, email: u.email, name: u.name },
      member: m ? { role: m.role, clientId: m.clientId } : null,
      workspace: w ? publicWs(w) : null,
      admin: this.opt.adminEmails.includes(u.email),
    };
  }

  // ── password reset ──
  async requestReset(b: Record<string, unknown>, ctx: Ctx) {
    this.limit(`reset:ip:${ctx.ip}`, this.L.resetIp);
    const email = v.email(b.email);
    this.limit(`reset:email:${email}`, this.L.resetEmail);
    const u = this.db.userByEmail(email);
    if (!u) return; // same answer either way: no account enumeration
    const token = randomBytes(32).toString('base64url');
    const t = this.now();
    this.db.dropResets(u.id);
    this.db.insertReset(sha(token), u.id, t, t + 60 * 60_000);
    const link = `${this.opt.appUrl}#reset=${token}`;
    await this.mailer.send({
      to: u.email, kind: 'reset', subject: 'Reset your ForwardDesk password',
      text: `Someone asked to reset the password for ${u.email} on ForwardDesk.\n\nSet a new password (the link works for 1 hour, once):\n${link}\n\nIf it wasn't you, ignore this email; your password stays the same.`,
    });
  }
  async confirmReset(b: Record<string, unknown>, ctx: Ctx) {
    this.limit(`resetConfirm:ip:${ctx.ip}`, this.L.resetConfirmIp);
    const token = typeof b.token === 'string' ? b.token : '';
    const pw = v.password(b.password);
    const h = sha(token);
    const r = token ? this.db.reset(h) : undefined;
    const t = this.now();
    if (!r || r.used_at != null) throw err(400, 'bad-code');
    if (Number(r.expires_at) <= t) throw err(400, 'expired-code');
    const u = this.db.userById(String(r.user_id));
    if (!u) throw err(400, 'bad-code');
    const hash = await hashPassword(pw);
    this.db.tx(() => {
      this.db.useReset(h, t);
      this.db.setPassword(u.id, hash, t);
      this.db.deleteUserSessions(u.id); // sign out everywhere
    });
    return { token: this.newSession(u.id, ctx), me: this.me(u) };
  }

  // ── workspaces ──
  createWorkspace(a: Authed, b: Record<string, unknown>) {
    if (a.member) throw err(409, 'already-member');
    const p = v.profile(b);
    const t = this.now();
    const w: Workspace = { id: rnd(16, LOWER), ...p, ownerId: a.user.id, createdAt: t };
    this.db.tx(() => {
      this.db.insertWorkspace(w);
      this.db.insertMember({ workspaceId: w.id, userId: a.user.id, role: 'owner', clientId: null, createdAt: t });
      this.db.putDoc(w.id, '_org', { company: { name: p.name, email: a.user.email } }, t, a.user.id);
    });
    return this.me(a.user);
  }
  private staff(a: Authed) {
    if (!a.member) throw err(403, 'no-org');
    if (a.member.role === 'client') throw err(403, 'permission-denied');
    return a.member;
  }
  private owner(a: Authed) {
    const m = this.staff(a);
    if (m.role !== 'owner') throw err(403, 'permission-denied');
    return m;
  }
  updateWorkspace(a: Authed, b: Record<string, unknown>) {
    const m = this.owner(a);
    const p = v.profile(b);
    const t = this.now();
    this.db.tx(() => {
      this.db.updateWorkspace(m.workspaceId, p);
      const org = this.db.doc(m.workspaceId, '_org')?.data ?? {};
      this.db.putDoc(m.workspaceId, '_org', { ...org, company: { ...((org.company as object) ?? {}), name: p.name } }, Math.max(t, this.db.lastUpdate(m.workspaceId) + 1), a.user.id);
    });
    return publicWs(this.db.workspace(m.workspaceId)!);
  }
  team(a: Authed) {
    const m = this.staff(a);
    const w = this.db.workspace(m.workspaceId)!;
    return {
      org: publicWs(w),
      members: this.db.members(m.workspaceId).map((x) => ({ uid: x.userId, role: x.role, email: x.email, name: x.name, clientId: x.clientId ?? undefined })),
      invites: this.db.invites(m.workspaceId).map((i) => ({ code: i.code, email: i.email ?? '', role: i.role, clientId: i.clientId ?? undefined, expiresAt: i.expiresAt, usedBy: i.usedBy, join: `${m.workspaceId}.${i.code}` })),
    };
  }
  /** The owner invites staff and clients; staff may invite client logins (same as the Firestore rules). */
  createInvite(a: Authed, b: Record<string, unknown>) {
    const role = v.oneOf(b.role, 'role', ['staff', 'client'] as const);
    const m = role === 'staff' ? this.owner(a) : this.staff(a);
    const email = b.email == null || b.email === '' ? null : v.email(b.email);
    const clientId = role === 'client' ? v.text(b.clientId, 'clientId', 80, true) : null;
    const t = this.now();
    const code = rnd(24, ALNUM);
    this.db.insertInvite({ code, workspaceId: m.workspaceId, email, role, clientId, createdBy: a.user.id, createdAt: t, expiresAt: t + 14 * DAY, usedBy: null, usedAt: null });
    const join = `${m.workspaceId}.${code}`;
    return { join, link: `${this.opt.appUrl}#join=${join}`, expiresAt: t + 14 * DAY };
  }
  revokeInvite(a: Authed, code: string) {
    const m = this.staff(a);
    const inv = this.db.invite(code);
    if (!inv || inv.workspaceId !== m.workspaceId) throw err(404, 'not_found');
    if (m.role !== 'owner' && inv.role !== 'client') throw err(403, 'permission-denied');
    this.db.deleteInvite(m.workspaceId, code);
  }
  removeMember(a: Authed, uid: string) {
    const m = this.staff(a);
    if (uid === a.user.id) throw err(400, 'cannot-remove-self');
    const target = this.db.membership(uid);
    if (!target || target.workspaceId !== m.workspaceId) throw err(404, 'not_found');
    if (target.role === 'owner' || (m.role !== 'owner' && target.role !== 'client')) throw err(403, 'permission-denied');
    this.db.tx(() => { this.db.deleteMember(m.workspaceId, uid); this.db.deleteUserSessions(uid); });
  }
  acceptInvite(a: Authed, b: Record<string, unknown>, ctx: Ctx) {
    this.limit(`join:ip:${ctx.ip}`, this.L.joinIp);
    const raw = typeof b.join === 'string' ? b.join : '';
    const mm = raw.trim().match(/([a-z0-9]{12,32})\.([A-Za-z0-9]{16,40})\s*$/);
    if (!mm) throw err(400, 'bad-code');
    if (a.member) throw err(409, 'already-member');
    const inv = this.db.invite(mm[2]);
    const t = this.now();
    if (!inv || inv.workspaceId !== mm[1]) throw err(400, 'bad-code');
    if (inv.usedBy) throw err(400, 'used-code');
    if (inv.expiresAt <= t) throw err(400, 'expired-code');
    if (inv.email && inv.email !== a.user.email) throw err(403, 'wrong-email');
    this.db.tx(() => {
      if (!this.db.useInvite(inv.code, a.user.id, t)) throw err(400, 'used-code');
      this.db.insertMember({ workspaceId: inv.workspaceId, userId: a.user.id, role: inv.role, clientId: inv.clientId, createdAt: t });
    });
    return this.me(a.user);
  }

  // ── workspace documents (the app's bookings, clients, quotes, agents …) ──
  private who(a: Authed): Who & { ws: string } {
    if (!a.member) throw err(403, 'no-org');
    return { role: a.member.role, clientId: a.member.clientId, ws: a.member.workspaceId };
  }
  listDocs(a: Authed, since: number) {
    const w = this.who(a);
    const now = this.now();
    const rows = this.db.docsSince(w.ws, Number.isFinite(since) ? since : 0);
    return {
      // tombstones are only sent for documents this account could have seen
      docs: rows.filter((r) => r.deleted ? w.role !== 'client' || canRead(w, r.path, { clientId: w.clientId }) : canRead(w, r.path, r.data))
        .map((r) => ({ path: r.path, data: r.deleted ? null : r.data, updatedAt: r.updatedAt })),
      at: rows.length ? rows[rows.length - 1].updatedAt : Math.max(0, since || 0), serverTime: now,
    };
  }
  getDoc(a: Authed, path: string) {
    const w = this.who(a);
    const p = v.docPath(path);
    const r = this.db.doc(w.ws, p);
    const data = r && !r.deleted ? r.data : null;
    if (!canRead(w, p, data)) throw err(403, 'permission-denied');
    return { path: p, data };
  }
  /** Applies all operations or none. Each op: { path, data } to set, { path, data: null } to delete. */
  writeDocs(a: Authed, ops: unknown) {
    const w = this.who(a);
    this.limit(`write:${a.user.id}`, this.L.writeUser);
    if (!Array.isArray(ops) || ops.length === 0 || ops.length > 500) throw err(400, 'invalid', { field: 'ops' });
    const clean = ops.map((o: Record<string, unknown>) => ({ path: v.docPath(o?.path), data: o?.data == null ? null : v.docData(o.data) }));
    let at = 0;
    this.db.tx(() => {
      // one strictly increasing stamp per workspace write, so "since" never skips a write made in the same millisecond
      at = Math.max(this.now(), this.db.lastUpdate(w.ws) + 1);
      for (const o of clean) {
        const prev = this.db.doc(w.ws, o.path);
        const before = prev && !prev.deleted ? prev.data : null;
        if (!canWrite(w, o.path, before, o.data)) throw err(403, 'permission-denied', { path: o.path });
        if (o.data) this.db.putDoc(w.ws, o.path, o.data, at, a.user.id);
        else this.db.deleteDoc(w.ws, o.path, at, a.user.id);
      }
    });
    return { ok: true, at };
  }

  // ── waitlist (landing page form) ──
  addWaitlist(b: Record<string, unknown>, ctx: Ctx): { stored: boolean } {
    // honeypot / too-fast submissions get the same 200 answer but are not stored
    if (typeof b.website === 'string' && b.website.trim()) return { stored: false };
    if (typeof b.elapsedMs === 'number' && b.elapsedMs < 2000) return { stored: false };
    this.limit(`waitlist:ip:${ctx.ip}`, this.L.waitlistIp);
    const e = v.waitlist(b);
    this.db.upsertWaitlist(e, this.now());
    return { stored: true };
  }
  private admin(a: Authed) { if (!this.opt.adminEmails.includes(a.user.email)) throw err(403, 'permission-denied'); }
  listWaitlist(a: Authed) { this.admin(a); return this.db.waitlist(); }
  setWaitlistStatus(a: Authed, id: number, b: Record<string, unknown>) {
    this.admin(a);
    const status = v.oneOf(b.status, 'status', ['new', 'contacted', 'invited', 'archived'] as const);
    if (!this.db.setWaitlistStatus(id, status)) throw err(404, 'not_found');
  }
  waitlistCsv(a: Authed) {
    const rows = this.listWaitlist(a);
    const head = ['email', 'company', 'role', 'country', 'shipments', 'note', 'source', 'lang', 'status', 'submissions', 'created_utc'];
    // neutralise spreadsheet formulas (=, +, -, @) in user-supplied cells
    const cell = (x: unknown) => { let s = String(x ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    return [head.join(','), ...rows.map((r) => [r.email, r.company, r.role, r.country, r.shipments, r.note, r.source, r.lang, r.status, r.submissions, new Date(r.createdAt).toISOString()].map(cell).join(','))].join('\r\n') + '\r\n';
  }
}

const publicWs = (w: Workspace) => ({ id: w.id, name: w.name, country: w.country, baseCurrency: w.baseCurrency, ports: w.ports, lang: w.lang });
