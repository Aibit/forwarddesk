// SQLite storage (node:sqlite, no native build step). One file, easy to back up; matches the planned
// PocketBase direction (also SQLite). A Postgres implementation can replace this class behind the same methods.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { DirEntry } from './phone.js';

export interface Conversation {
  id: number; waId: string; name: string | null; profileName: string | null;
  clientId: string | null; agentId: string | null; contactName: string | null; jobId: string | null; jobLinkedBy: 'text' | 'staff' | null;
  lastInboundAt: number | null; lastMessageAt: number | null; lastText: string | null; unread: number; createdAt: number;
}
export interface Message {
  id: number; conversationId: number; wamid: string | null; direction: 'in' | 'out'; type: string; text: string | null;
  template: string | null; lang: string | null; mediaId: string | null; mediaPath: string | null; mediaMime: string | null;
  filename: string | null; size: number | null; status: string; errorCode: number | null; errorTitle: string | null;
  jobId: string | null; sentBy: string | null; ts: number; statusAt: number | null;
}
export interface Upload { id: string; path: string; mime: string; filename: string; size: number; createdAt: number }

const SCHEMA = `
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT, wa_id TEXT NOT NULL UNIQUE, name TEXT, profile_name TEXT,
  client_id TEXT, agent_id TEXT, contact_name TEXT, job_id TEXT, job_linked_by TEXT,
  last_inbound_at INTEGER, last_message_at INTEGER, last_text TEXT, unread INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id INTEGER NOT NULL REFERENCES conversations(id), wamid TEXT UNIQUE,
  direction TEXT NOT NULL, type TEXT NOT NULL, text TEXT, template TEXT, lang TEXT, media_id TEXT, media_path TEXT, media_mime TEXT,
  filename TEXT, size INTEGER, status TEXT NOT NULL, error_code INTEGER, error_title TEXT, job_id TEXT, sent_by TEXT,
  ts INTEGER NOT NULL, status_at INTEGER);
CREATE INDEX IF NOT EXISTS messages_conv ON messages(conversation_id, ts);
CREATE INDEX IF NOT EXISTS messages_job ON messages(job_id);
CREATE TABLE IF NOT EXISTS directory (kind TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL, contact TEXT, phones TEXT NOT NULL, PRIMARY KEY (kind, id));
CREATE TABLE IF NOT EXISTS uploads (id TEXT PRIMARY KEY, path TEXT NOT NULL, mime TEXT NOT NULL, filename TEXT NOT NULL, size INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY);
`;

type Row = Record<string, unknown>;
const conv = (r: Row): Conversation => ({
  id: Number(r.id), waId: String(r.wa_id), name: (r.name as string) ?? null, profileName: (r.profile_name as string) ?? null,
  clientId: (r.client_id as string) ?? null, agentId: (r.agent_id as string) ?? null, contactName: (r.contact_name as string) ?? null,
  jobId: (r.job_id as string) ?? null, jobLinkedBy: (r.job_linked_by as Conversation['jobLinkedBy']) ?? null,
  lastInboundAt: r.last_inbound_at == null ? null : Number(r.last_inbound_at), lastMessageAt: r.last_message_at == null ? null : Number(r.last_message_at),
  lastText: (r.last_text as string) ?? null, unread: Number(r.unread), createdAt: Number(r.created_at),
});
const msg = (r: Row): Message => ({
  id: Number(r.id), conversationId: Number(r.conversation_id), wamid: (r.wamid as string) ?? null, direction: r.direction as 'in' | 'out',
  type: String(r.type), text: (r.text as string) ?? null, template: (r.template as string) ?? null, lang: (r.lang as string) ?? null,
  mediaId: (r.media_id as string) ?? null, mediaPath: (r.media_path as string) ?? null, mediaMime: (r.media_mime as string) ?? null,
  filename: (r.filename as string) ?? null, size: r.size == null ? null : Number(r.size), status: String(r.status),
  errorCode: r.error_code == null ? null : Number(r.error_code), errorTitle: (r.error_title as string) ?? null,
  jobId: (r.job_id as string) ?? null, sentBy: (r.sent_by as string) ?? null, ts: Number(r.ts), statusAt: r.status_at == null ? null : Number(r.status_at),
});

export class Store {
  db: DatabaseSync;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    this.db.exec(SCHEMA);
  }
  close() { this.db.close(); }

  // ── conversations ──
  convByWaId(waId: string) { const r = this.db.prepare('SELECT * FROM conversations WHERE wa_id = ?').get(waId) as Row | undefined; return r ? conv(r) : null; }
  conv(id: number) { const r = this.db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as Row | undefined; return r ? conv(r) : null; }
  ensureConv(waId: string, now = Date.now()): Conversation {
    const c = this.convByWaId(waId);
    if (c) return c;
    this.db.prepare('INSERT INTO conversations (wa_id, created_at) VALUES (?, ?)').run(waId, now);
    return this.convByWaId(waId)!;
  }
  listConvs(): Conversation[] { return (this.db.prepare('SELECT * FROM conversations ORDER BY COALESCE(last_message_at, created_at) DESC').all() as Row[]).map(conv); }
  patchConv(id: number, p: Partial<Pick<Conversation, 'name' | 'profileName' | 'clientId' | 'agentId' | 'contactName' | 'jobId' | 'jobLinkedBy' | 'lastInboundAt' | 'lastMessageAt' | 'lastText' | 'unread'>>) {
    const map: Record<string, string> = { name: 'name', profileName: 'profile_name', clientId: 'client_id', agentId: 'agent_id', contactName: 'contact_name', jobId: 'job_id', jobLinkedBy: 'job_linked_by', lastInboundAt: 'last_inbound_at', lastMessageAt: 'last_message_at', lastText: 'last_text', unread: 'unread' };
    const keys = Object.keys(p).filter((k) => k in map);
    if (!keys.length) return;
    const vals = keys.map((k) => (p as Record<string, unknown>)[k] ?? null) as (string | number | null)[];
    this.db.prepare(`UPDATE conversations SET ${keys.map((k) => `${map[k]} = ?`).join(', ')} WHERE id = ?`).run(...vals, id);
  }
  bumpUnread(id: number) { this.db.prepare('UPDATE conversations SET unread = unread + 1 WHERE id = ?').run(id); }

  // ── messages ──
  insertMessage(m: Omit<Message, 'id'>): Message | null {
    try {
      const r = this.db.prepare(`INSERT INTO messages (conversation_id, wamid, direction, type, text, template, lang, media_id, media_path, media_mime, filename, size, status, error_code, error_title, job_id, sent_by, ts, status_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        m.conversationId, m.wamid, m.direction, m.type, m.text, m.template, m.lang, m.mediaId, m.mediaPath, m.mediaMime, m.filename, m.size, m.status, m.errorCode, m.errorTitle, m.jobId, m.sentBy, m.ts, m.statusAt);
      return this.message(Number(r.lastInsertRowid));
    } catch (e) {
      if (String((e as Error).message).includes('UNIQUE')) return null; // duplicate webhook delivery
      throw e;
    }
  }
  message(id: number) { const r = this.db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as Row | undefined; return r ? msg(r) : null; }
  messageByWamid(w: string) { const r = this.db.prepare('SELECT * FROM messages WHERE wamid = ?').get(w) as Row | undefined; return r ? msg(r) : null; }
  messages(convId: number, limit = 500): Message[] { return (this.db.prepare('SELECT * FROM (SELECT * FROM messages WHERE conversation_id = ? ORDER BY ts DESC, id DESC LIMIT ?) ORDER BY ts, id').all(convId, limit) as Row[]).map(msg); }
  messagesForJob(jobId: string): Message[] { return (this.db.prepare('SELECT m.* FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE m.job_id = ? OR c.job_id = ? ORDER BY m.ts').all(jobId, jobId) as Row[]).map(msg); }
  setStatus(id: number, status: string, at: number, err: { code: number; title: string } | null) {
    this.db.prepare('UPDATE messages SET status = ?, status_at = ?, error_code = COALESCE(?, error_code), error_title = COALESCE(?, error_title) WHERE id = ?').run(status, at, err?.code ?? null, err?.title ?? null, id);
  }
  setMedia(id: number, path: string, mime: string | null, size: number) { this.db.prepare('UPDATE messages SET media_path = ?, media_mime = COALESCE(?, media_mime), size = ? WHERE id = ?').run(path, mime, size, id); }
  setMessageJob(convId: number, jobId: string | null) { this.db.prepare('UPDATE messages SET job_id = ? WHERE conversation_id = ? AND job_id IS NULL').run(jobId, convId); }

  // ── directory (client/agent phone numbers synced from the app) + known job ids ──
  replaceDirectory(entries: DirEntry[], jobs?: string[]) {
    this.db.exec('BEGIN');
    try {
      this.db.exec('DELETE FROM directory');
      const ins = this.db.prepare('INSERT OR REPLACE INTO directory (kind, id, name, contact, phones) VALUES (?, ?, ?, ?, ?)');
      for (const e of entries) ins.run(e.kind, e.id, e.name, e.contact ?? null, JSON.stringify(e.phones));
      if (jobs) {
        this.db.exec('DELETE FROM jobs');
        const ij = this.db.prepare('INSERT OR IGNORE INTO jobs (id) VALUES (?)');
        for (const j of jobs) ij.run(j.toUpperCase());
      }
      this.db.exec('COMMIT');
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  directory(): DirEntry[] { return (this.db.prepare('SELECT * FROM directory').all() as Row[]).map((r) => ({ kind: r.kind as DirEntry['kind'], id: String(r.id), name: String(r.name), contact: (r.contact as string) ?? undefined, phones: JSON.parse(String(r.phones)) })); }
  knownJobs(): Set<string> { return new Set((this.db.prepare('SELECT id FROM jobs').all() as Row[]).map((r) => String(r.id))); }

  // ── uploads (outbound files staged before sending) ──
  addUpload(u: Upload) { this.db.prepare('INSERT INTO uploads (id, path, mime, filename, size, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(u.id, u.path, u.mime, u.filename, u.size, u.createdAt); }
  upload(id: string) { const r = this.db.prepare('SELECT * FROM uploads WHERE id = ?').get(id) as Row | undefined; return r ? { id: String(r.id), path: String(r.path), mime: String(r.mime), filename: String(r.filename), size: Number(r.size), createdAt: Number(r.created_at) } as Upload : null; }
}
