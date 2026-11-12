// Firestore-shaped client for the self-hosted API's workspace documents (/api/ws/*).
// It implements the small slice of the Firestore modular API that liveData.ts uses (doc, collection,
// query/where, onSnapshot, setDoc, updateDoc, deleteDoc, getDoc, writeBatch, sentinels), on top of a
// local cache that is loaded once and then kept fresh by polling ?since=. Writes are optimistic and
// rolled back if the server refuses them (e.g. a client account touching staff-only data).
import type { DocSnap, FsApi, Snap } from './liveData';
import { api } from './serverApi';

type Data = Record<string, unknown>;
interface Ref { kind: 'doc' | 'col'; rel: string; wheres: [string, unknown][] }
interface Op { path: string; data: Data | null }
const SENT = '__fdOp';
type Sentinel = { [SENT]: 'ts' } | { [SENT]: 'del' } | { [SENT]: 'union'; v: unknown[] };
const isSent = (x: unknown): x is Sentinel => !!x && typeof x === 'object' && SENT in (x as object);

export class TimestampShim {
  private ms: number;
  constructor(ms: number) { this.ms = ms; }
  static fromMillis(ms: number) { return new TimestampShim(ms); }
  toMillis() { return this.ms; }
  toJSON() { return this.ms; }
}

/** "orgs/<id>/jobs/X" → "jobs/X"; "orgs/<id>" → "_org". */
export function relPath(full: string): string {
  const m = /^orgs\/[^/]+(?:\/(.+))?$/.exec(full);
  if (!m) throw Object.assign(new Error('bad-path'), { code: 'invalid-argument' });
  return m[1] ?? '_org';
}
const parentOf = (rel: string) => (rel === '_org' ? '' : rel.split('/').slice(0, -1).join('/'));
const idOf = (rel: string) => rel.split('/').pop() ?? rel;
const clone = <T,>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

function resolve(v: unknown, prev: unknown, now: number): unknown {
  if (!isSent(v)) return v instanceof TimestampShim ? v.toMillis() : v;
  if (v[SENT] === 'ts') return now;
  if (v[SENT] === 'union') {
    const cur = Array.isArray(prev) ? [...prev] : [];
    for (const x of v.v) if (!cur.some((y) => JSON.stringify(y) === JSON.stringify(x))) cur.push(x);
    return cur;
  }
  return undefined; // del
}
/** setDoc: sentinels resolved, deleteField()/undefined dropped. */
export function applySet(data: Data, now: number): Data {
  const out: Data = {};
  for (const [k, v] of Object.entries(data)) {
    const r = resolve(v, undefined, now);
    if (r !== undefined) out[k] = r;
  }
  return clone(out);
}
/** updateDoc: top-level and dotted keys ("company.name"), with sentinels. */
export function applyUpdate(prev: Data, patch: Data, now: number): Data {
  const out = clone(prev);
  for (const [k, v] of Object.entries(patch)) {
    const parts = k.split('.');
    let o = out as Data;
    for (const p of parts.slice(0, -1)) { if (!o[p] || typeof o[p] !== 'object') o[p] = {}; o = o[p] as Data; }
    const last = parts[parts.length - 1];
    const r = resolve(v, o[last], now);
    if (r === undefined) delete o[last]; else o[last] = clone(r);
  }
  return out;
}

export class ServerDocs {
  private cache = new Map<string, Data>();
  private subs = new Set<{ ref: Ref; cb: (s: Snap) => void }>();
  private since = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private loaded = false;
  private stopped = false;
  private onError: (e: unknown) => void;
  private pollMs: number;
  constructor(onError: (e: unknown) => void, pollMs = 5000) { this.onError = onError; this.pollMs = pollMs; }

  async load() {
    const r = await api<{ docs: { path: string; data: Data | null }[]; at: number }>('GET', '/api/ws/docs?since=0');
    for (const d of r.docs) if (d.data) this.cache.set(d.path, d.data);
    this.since = r.at;
    this.loaded = true;
    this.emit(null);
    this.timer = setInterval(() => { if (!document.hidden) void this.poll(); }, this.pollMs);
  }
  async poll() {
    if (this.stopped) return;
    try {
      const r = await api<{ docs: { path: string; data: Data | null }[]; at: number }>('GET', `/api/ws/docs?since=${this.since}`);
      if (this.stopped || !r.docs.length) return;
      const changed = new Set<string>();
      for (const d of r.docs) {
        const cur = this.cache.get(d.path);
        if (JSON.stringify(cur ?? null) === JSON.stringify(d.data)) continue;
        if (d.data) this.cache.set(d.path, d.data); else this.cache.delete(d.path);
        changed.add(d.path);
      }
      this.since = Math.max(this.since, r.at);
      if (changed.size) this.emit(changed);
    } catch (e) { if ((e as { code?: string }).code !== 'network') this.onError(e); }
  }
  stop() { this.stopped = true; if (this.timer) clearInterval(this.timer); this.subs.clear(); }

  private matches(ref: Ref, rel: string) {
    if (ref.kind === 'doc') return ref.rel === rel;
    return parentOf(rel) === ref.rel;
  }
  private snap(ref: Ref): Snap {
    if (ref.kind === 'doc') {
      const d = this.cache.get(ref.rel);
      return { id: idOf(ref.rel), exists: () => !!d, data: () => (d ? clone(d) : undefined), docs: [] };
    }
    const docs = [...this.cache.entries()]
      .filter(([p, d]) => parentOf(p) === ref.rel && ref.wheres.every(([f, v]) => d[f] === v))
      .map(([p, d]) => ({ id: idOf(p), data: () => clone(d) }));
    return { id: idOf(ref.rel), exists: () => true, data: () => undefined, docs };
  }
  private emit(changed: Set<string> | null) {
    for (const s of this.subs) if (!changed || [...changed].some((p) => this.matches(s.ref, p))) s.cb(this.snap(s.ref));
  }
  private async commit(ops: Op[]) {
    const before = ops.map((o) => [o.path, this.cache.get(o.path)] as const);
    for (const o of ops) { if (o.data) this.cache.set(o.path, o.data); else this.cache.delete(o.path); }
    this.emit(new Set(ops.map((o) => o.path)));
    try {
      await api('POST', '/api/ws/write', { ops });
    } catch (e) {
      for (const [p, d] of before) { if (d) this.cache.set(p, d); else this.cache.delete(p); }
      this.emit(new Set(ops.map((o) => o.path)));
      throw e;
    }
  }
  private async current(rel: string): Promise<Data | undefined> {
    if (this.cache.has(rel) || this.loaded) return this.cache.get(rel);
    return (await api<{ data: Data | null }>('GET', `/api/ws/doc?path=${encodeURIComponent(rel)}`)).data ?? undefined;
  }

  /** The Firestore-shaped API handed to liveData.ts. */
  fs(): FsApi {
    const self = this;
    const ref = (kind: Ref['kind'], full: string): Ref => ({ kind, rel: relPath(full), wheres: [] });
    const setOp = (r: Ref, data: Data): Op => ({ path: r.rel, data: applySet(data, Date.now()) });
    const updOp = (r: Ref, patch: Data, base: Data | undefined): Op => {
      if (!base) throw Object.assign(new Error('not-found'), { code: 'not-found' });
      return { path: r.rel, data: applyUpdate(base, patch, Date.now()) };
    };
    return {
      doc: (_db, path) => ref('doc', path),
      collection: (_db, path) => ref('col', path),
      where: (field, _op, value) => ({ field, value }),
      query: (r: Ref, ...cs: { field: string; value: unknown }[]) => ({ ...r, wheres: [...r.wheres, ...cs.map((c) => [c.field, c.value] as [string, unknown])] }),
      onSnapshot(r: Ref, next) {
        const s = { ref: r, cb: next };
        self.subs.add(s);
        if (self.loaded) queueMicrotask(() => { if (self.subs.has(s)) next(self.snap(r)); });
        return () => { self.subs.delete(s); };
      },
      setDoc: (r: Ref, data: Data) => self.commit([setOp(r, data)]),
      async updateDoc(r: Ref, patch: Data) { await self.commit([updOp(r, patch, await self.current(r.rel))]); },
      deleteDoc: (r: Ref) => self.commit([{ path: r.rel, data: null }]),
      async getDoc(r: Ref): Promise<DocSnap> {
        let d = self.cache.get(r.rel);
        if (!d && r.rel.split('/').length > 2) d = (await api<{ data: Data | null }>('GET', `/api/ws/doc?path=${encodeURIComponent(r.rel)}`)).data ?? undefined;
        return { id: idOf(r.rel), exists: () => !!d, data: () => (d ? clone(d) : undefined) };
      },
      writeBatch() {
        const ops: Op[] = [];
        const view = (p: string) => { for (let i = ops.length - 1; i >= 0; i--) if (ops[i].path === p) return ops[i].data ?? undefined; return self.cache.get(p); };
        const b = {
          set(r: Ref, data: Data) { ops.push(setOp(r, data)); return b; },
          update(r: Ref, patch: Data) { ops.push(updOp(r, patch, view(r.rel))); return b; },
          delete(r: Ref) { ops.push({ path: r.rel, data: null }); return b; },
          commit: () => (ops.length ? self.commit(ops) : Promise.resolve()),
        };
        return b;
      },
      serverTimestamp: () => ({ [SENT]: 'ts' }),
      deleteField: () => ({ [SENT]: 'del' }),
      arrayUnion: (...v: unknown[]) => ({ [SENT]: 'union', v }),
      Timestamp: TimestampShim as unknown as FsApi['Timestamp'],
    };
  }
}
