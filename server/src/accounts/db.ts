// SQLite tables for accounts, sessions, company workspaces, invites, workspace data and the waitlist.
// Separate file from the WhatsApp store (FD_DB_PATH) so either can be backed up or moved on its own.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL DEFAULT '', pw_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL, pw_changed_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL, user_agent TEXT);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, country TEXT NOT NULL DEFAULT '', base_currency TEXT NOT NULL DEFAULT 'USD',
  ports TEXT NOT NULL DEFAULT '[]', lang TEXT NOT NULL DEFAULT 'en', owner_id TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS members (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','staff','client')), client_id TEXT, created_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, user_id));
CREATE TABLE IF NOT EXISTS invites (
  code TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, email TEXT,
  role TEXT NOT NULL CHECK (role IN ('staff','client')), client_id TEXT, created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, used_by TEXT, used_at INTEGER);
CREATE TABLE IF NOT EXISTS reset_tokens (
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, used_at INTEGER);
CREATE TABLE IF NOT EXISTS docs (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, path TEXT NOT NULL, parent TEXT NOT NULL,
  client_id TEXT, data TEXT, deleted INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL, updated_by TEXT,
  PRIMARY KEY (workspace_id, path));
CREATE INDEX IF NOT EXISTS docs_sync ON docs(workspace_id, updated_at);
CREATE TABLE IF NOT EXISTS waitlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, company TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '', shipments TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT '',
  page TEXT NOT NULL DEFAULT '', lang TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'new',
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, submissions INTEGER NOT NULL DEFAULT 1);
`;

export type Row = Record<string, unknown>;
export interface User { id: string; email: string; name: string; pwHash: string; createdAt: number; pwChangedAt: number }
export interface Workspace { id: string; name: string; country: string; baseCurrency: string; ports: string[]; lang: string; ownerId: string; createdAt: number }
export interface Membership { workspaceId: string; userId: string; role: 'owner' | 'staff' | 'client'; clientId: string | null; createdAt: number }
export interface InviteRow { code: string; workspaceId: string; email: string | null; role: 'staff' | 'client'; clientId: string | null; createdBy: string; createdAt: number; expiresAt: number; usedBy: string | null; usedAt: number | null }
export interface DocRow { path: string; parent: string; clientId: string | null; data: Record<string, unknown> | null; deleted: boolean; updatedAt: number }
export interface WaitlistRow { id: number; email: string; company: string; role: string; country: string; shipments: string; note: string; source: string; page: string; lang: string; status: string; createdAt: number; updatedAt: number; submissions: number }

const user = (r: Row): User => ({ id: String(r.id), email: String(r.email), name: String(r.name), pwHash: String(r.pw_hash), createdAt: Number(r.created_at), pwChangedAt: Number(r.pw_changed_at) });
const ws = (r: Row): Workspace => ({ id: String(r.id), name: String(r.name), country: String(r.country), baseCurrency: String(r.base_currency), ports: JSON.parse(String(r.ports)), lang: String(r.lang), ownerId: String(r.owner_id), createdAt: Number(r.created_at) });
const mem = (r: Row): Membership => ({ workspaceId: String(r.workspace_id), userId: String(r.user_id), role: r.role as Membership['role'], clientId: (r.client_id as string) ?? null, createdAt: Number(r.created_at) });
const inv = (r: Row): InviteRow => ({ code: String(r.code), workspaceId: String(r.workspace_id), email: (r.email as string) ?? null, role: r.role as InviteRow['role'], clientId: (r.client_id as string) ?? null, createdBy: String(r.created_by), createdAt: Number(r.created_at), expiresAt: Number(r.expires_at), usedBy: (r.used_by as string) ?? null, usedAt: r.used_at == null ? null : Number(r.used_at) });
const docRow = (r: Row): DocRow => ({ path: String(r.path), parent: String(r.parent), clientId: (r.client_id as string) ?? null, data: r.data == null ? null : JSON.parse(String(r.data)), deleted: !!r.deleted, updatedAt: Number(r.updated_at) });
const wl = (r: Row): WaitlistRow => ({ id: Number(r.id), email: String(r.email), company: String(r.company), role: String(r.role), country: String(r.country), shipments: String(r.shipments), note: String(r.note), source: String(r.source), page: String(r.page), lang: String(r.lang), status: String(r.status), createdAt: Number(r.created_at), updatedAt: Number(r.updated_at), submissions: Number(r.submissions) });

export const parentOf = (path: string) => (path === '_org' ? '' : path.split('/').slice(0, -1).join('/'));

export class AccountsDb {
  db: DatabaseSync;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
    this.db.exec(SCHEMA);
  }
  close() { this.db.close(); }
  tx<T>(f: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const r = f(); this.db.exec('COMMIT'); return r; } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }

  // users
  insertUser(u: User) { this.db.prepare('INSERT INTO users (id, email, name, pw_hash, created_at, pw_changed_at) VALUES (?, ?, ?, ?, ?, ?)').run(u.id, u.email, u.name, u.pwHash, u.createdAt, u.pwChangedAt); }
  userByEmail(email: string) { const r = this.db.prepare('SELECT * FROM users WHERE email = ?').get(email) as Row | undefined; return r ? user(r) : null; }
  userById(id: string) { const r = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Row | undefined; return r ? user(r) : null; }
  setPassword(id: string, hash: string, at: number) { this.db.prepare('UPDATE users SET pw_hash = ?, pw_changed_at = ? WHERE id = ?').run(hash, at, id); }

  // sessions (only a SHA-256 of the token is stored)
  insertSession(hash: string, userId: string, now: number, expires: number, ua: string) { this.db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_seen_at, user_agent) VALUES (?, ?, ?, ?, ?, ?)').run(hash, userId, now, expires, now, ua.slice(0, 200)); }
  session(hash: string) { return this.db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(hash) as Row | undefined; }
  touchSession(hash: string, now: number, expires: number) { this.db.prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE token_hash = ?').run(now, expires, hash); }
  deleteSession(hash: string) { this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash); }
  deleteUserSessions(userId: string) { this.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId); }
  purgeExpired(now: number) { this.db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now); this.db.prepare('DELETE FROM reset_tokens WHERE expires_at < ?').run(now - 864e5); }

  // reset tokens
  insertReset(hash: string, userId: string, now: number, expires: number) { this.db.prepare('INSERT INTO reset_tokens (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(hash, userId, now, expires); }
  reset(hash: string) { return this.db.prepare('SELECT * FROM reset_tokens WHERE token_hash = ?').get(hash) as Row | undefined; }
  useReset(hash: string, now: number) { this.db.prepare('UPDATE reset_tokens SET used_at = ? WHERE token_hash = ?').run(now, hash); }
  dropResets(userId: string) { this.db.prepare('DELETE FROM reset_tokens WHERE user_id = ? AND used_at IS NULL').run(userId); }

  // workspaces + members
  insertWorkspace(w: Workspace) { this.db.prepare('INSERT INTO workspaces (id, name, country, base_currency, ports, lang, owner_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(w.id, w.name, w.country, w.baseCurrency, JSON.stringify(w.ports), w.lang, w.ownerId, w.createdAt); }
  updateWorkspace(id: string, p: Pick<Workspace, 'name' | 'country' | 'baseCurrency' | 'ports' | 'lang'>) { this.db.prepare('UPDATE workspaces SET name = ?, country = ?, base_currency = ?, ports = ?, lang = ? WHERE id = ?').run(p.name, p.country, p.baseCurrency, JSON.stringify(p.ports), p.lang, id); }
  workspace(id: string) { const r = this.db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id) as Row | undefined; return r ? ws(r) : null; }
  insertMember(m: Membership) { this.db.prepare('INSERT INTO members (workspace_id, user_id, role, client_id, created_at) VALUES (?, ?, ?, ?, ?)').run(m.workspaceId, m.userId, m.role, m.clientId, m.createdAt); }
  membership(userId: string) { const r = this.db.prepare('SELECT * FROM members WHERE user_id = ?').get(userId) as Row | undefined; return r ? mem(r) : null; }
  members(workspaceId: string) {
    return (this.db.prepare('SELECT m.*, u.email, u.name FROM members m JOIN users u ON u.id = m.user_id WHERE m.workspace_id = ? ORDER BY m.created_at').all(workspaceId) as Row[])
      .map((r) => ({ ...mem(r), email: String(r.email), name: String(r.name) }));
  }
  deleteMember(workspaceId: string, userId: string) { this.db.prepare('DELETE FROM members WHERE workspace_id = ? AND user_id = ?').run(workspaceId, userId); }

  // invites
  insertInvite(i: InviteRow) { this.db.prepare('INSERT INTO invites (code, workspace_id, email, role, client_id, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(i.code, i.workspaceId, i.email, i.role, i.clientId, i.createdBy, i.createdAt, i.expiresAt); }
  invite(code: string) { const r = this.db.prepare('SELECT * FROM invites WHERE code = ?').get(code) as Row | undefined; return r ? inv(r) : null; }
  invites(workspaceId: string) { return (this.db.prepare('SELECT * FROM invites WHERE workspace_id = ? ORDER BY created_at DESC').all(workspaceId) as Row[]).map(inv); }
  useInvite(code: string, userId: string, now: number) { return this.db.prepare('UPDATE invites SET used_by = ?, used_at = ? WHERE code = ? AND used_by IS NULL').run(userId, now, code).changes === 1; }
  deleteInvite(workspaceId: string, code: string) { return this.db.prepare('DELETE FROM invites WHERE workspace_id = ? AND code = ?').run(workspaceId, code).changes === 1; }

  // workspace documents
  doc(workspaceId: string, path: string) { const r = this.db.prepare('SELECT * FROM docs WHERE workspace_id = ? AND path = ?').get(workspaceId, path) as Row | undefined; return r ? docRow(r) : null; }
  lastUpdate(workspaceId: string) { return Number((this.db.prepare('SELECT MAX(updated_at) AS t FROM docs WHERE workspace_id = ?').get(workspaceId) as Row).t ?? 0); }
  docsSince(workspaceId: string, since: number) { return (this.db.prepare('SELECT * FROM docs WHERE workspace_id = ? AND updated_at > ? ORDER BY updated_at').all(workspaceId, since) as Row[]).map(docRow); }
  putDoc(workspaceId: string, path: string, data: Record<string, unknown>, at: number, by: string) {
    const cid = typeof data.clientId === 'string' ? data.clientId : null;
    this.db.prepare(`INSERT INTO docs (workspace_id, path, parent, client_id, data, deleted, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, 0, ?, ?)
      ON CONFLICT (workspace_id, path) DO UPDATE SET client_id = excluded.client_id, data = excluded.data, deleted = 0, updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
      .run(workspaceId, path, parentOf(path), cid, JSON.stringify(data), at, by);
  }
  /** Soft delete (a tombstone) so other browsers learn about it on their next sync. */
  deleteDoc(workspaceId: string, path: string, at: number, by: string) { this.db.prepare('UPDATE docs SET data = NULL, deleted = 1, updated_at = ?, updated_by = ? WHERE workspace_id = ? AND path = ? AND deleted = 0').run(at, by, workspaceId, path); }

  // waitlist
  upsertWaitlist(e: Omit<WaitlistRow, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'submissions'>, now: number) {
    this.db.prepare(`INSERT INTO waitlist (email, company, role, country, shipments, note, source, page, lang, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (email) DO UPDATE SET company = COALESCE(NULLIF(excluded.company, ''), company), role = COALESCE(NULLIF(excluded.role, ''), role),
      country = COALESCE(NULLIF(excluded.country, ''), country), shipments = COALESCE(NULLIF(excluded.shipments, ''), shipments),
      note = COALESCE(NULLIF(excluded.note, ''), note), source = excluded.source, page = excluded.page, lang = excluded.lang,
      updated_at = excluded.updated_at, submissions = submissions + 1`)
      .run(e.email, e.company, e.role, e.country, e.shipments, e.note, e.source, e.page, e.lang, now, now);
  }
  waitlist() { return (this.db.prepare('SELECT * FROM waitlist ORDER BY created_at DESC').all() as Row[]).map(wl); }
  setWaitlistStatus(id: number, status: string) { return this.db.prepare('UPDATE waitlist SET status = ? WHERE id = ?').run(status, id).changes === 1; }
}
