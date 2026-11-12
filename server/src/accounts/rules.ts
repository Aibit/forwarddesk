// Who may read and write which workspace document. Mirrors the app's Firestore rules:
// staff (and the owner) see everything in their own workspace; a client account sees only what belongs
// to its client (no buy rates, margins, internal notes or agent CRM) and may only make portal changes.
export type Role = 'owner' | 'staff' | 'client';
export interface Who { role: Role; clientId: string | null }
type Data = Record<string, unknown> | null;

const top = (path: string) => path.split('/');
/** Collections a client may read when the document's clientId is theirs. */
const CLIENT_OWNED = new Set(['lanes', 'quotes', 'jobs', 'jobBalances', 'jobDocs', 'msds', 'jobFiles']);
const CLIENT_SETTINGS = new Set(['settings/tariffs', 'settings/msdsRules', 'settings/chargeCatalog']);

export function canRead(w: Who, path: string, data: Data): boolean {
  if (w.role !== 'client') return true;
  const cid = w.clientId;
  if (!cid) return false;
  if (path === '_org' || CLIENT_SETTINGS.has(path)) return true;
  const s = top(path);
  if (s.length !== 2) return false; // sub-collections such as quotes/{id}/private/costs are staff only
  const [col, id] = s;
  if (col === 'clientPublic' || col === 'agentPrefs') return id === cid;
  if (col === 'agents') return !!data && data.hidden !== true;
  if (CLIENT_OWNED.has(col)) return !!data && data.clientId === cid;
  return false;
}

const changedKeys = (a: Data, b: Data) => {
  const ks = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  return [...ks].filter((k) => JSON.stringify(a?.[k]) !== JSON.stringify(b?.[k]));
};

/** next = null means delete. */
export function canWrite(w: Who, path: string, prev: Data, next: Data): boolean {
  if (w.role !== 'client') return true;
  const cid = w.clientId;
  if (!cid) return false;
  const s = top(path);
  if (s.length !== 2) return false;
  const [col, id] = s;
  const mine = (d: Data) => !!d && d.clientId === cid;
  switch (col) {
    case 'lanes': case 'msds': case 'jobFiles': case 'jobDocs':
      return (prev == null || mine(prev)) && (next == null || mine(next));
    case 'agentPrefs':
      return id === cid && next != null && mine(next);
    case 'quotes': {
      if (!prev || !next || !mine(prev) || !mine(next)) return false;
      const allowed = new Set(['status', 'acceptedOption', 'acceptedVia', 'acceptedAt', 'acceptedBy']);
      return next.status === 'won' && next.acceptedVia === 'portal' && changedKeys(prev, next).every((k) => allowed.has(k));
    }
    case 'jobs':
      return !!prev && !!next && mine(prev) && mine(next) && changedKeys(prev, next).every((k) => k === 'portal');
    default:
      return false;
  }
}
