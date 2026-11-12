// Live mode against the self-hosted ForwardDesk API (server/, Node + SQLite) instead of Firebase.
// Loaded on demand only when the build has VITE_API_URL, so demo visitors never download it.
import { API_URL } from './config';
import { bridge, type AccountProfile, type AccountsAdapter, type Invite, type Member, type TeamState, type WaitlistEntry } from './bridge';
import { getSession, resetSession, setSession } from './session';
import { makeLiveData, type LiveData } from './liveData';
import { ServerDocs } from './serverDocs';
import { api, getToken, onUnauthenticated, setToken } from './serverApi';

interface Me {
  user: { id: string; email: string; name: string };
  member: { role: 'owner' | 'staff' | 'client'; clientId: string | null } | null;
  workspace: { id: string; name: string; country: string; baseCurrency: string; ports: string[]; lang: AccountProfile['lang'] } | null;
  admin: boolean;
}
let docs: ServerDocs | null = null;
let L: LiveData | null = null;

function stop() {
  docs?.stop();
  docs = null;
  if (L) { L.stop(); L = null; }
  bridge.w = null;
}
onUnauthenticated.f = () => {
  if (getSession().mode === 'demo') return;
  stop();
  setToken(null);
  localStorage.removeItem('fd.live');
  resetSession('session-ended');
};

async function start(me: Me) {
  stop();
  const base = { uid: me.user.id, email: me.user.email, admin: me.admin, error: null };
  if (!me.member || !me.workspace) {
    // Signed up, no company account yet: onboarding (create one or join with an invite link).
    setSession({ mode: 'onboard', ...base, role: null, clientId: null, orgId: null, owner: false, orgName: null });
    return;
  }
  const role: 'staff' | 'client' = me.member.role === 'client' ? 'client' : 'staff';
  const clientId = role === 'client' ? me.member.clientId : null;
  setSession({ orgId: me.workspace.id });
  const d = new ServerDocs((e) => L?.fail(e));
  await d.load();
  docs = d;
  L = makeLiveData(d.fs(), { db: () => d, uid: () => me.user.id });
  bridge.w = L.writer(me.user.id, role, clientId);
  bridge.onError = L.fail;
  L.subscribe(role, clientId);
  setSession({ mode: 'live', ...base, role, clientId, orgId: me.workspace.id, owner: me.member.role === 'owner', orgName: me.workspace.name });
}
const withToken = async (r: { token: string; me: Me }) => { setToken(r.token); await start(r.me); };

export async function signIn(email: string, password: string) {
  await withToken(await api('POST', '/api/auth/signin', { email: email.trim(), password }));
}
export async function signUp(email: string, password: string, name: string) {
  await withToken(await api('POST', '/api/auth/signup', { email: email.trim(), password, name: name.trim() }));
}
export async function resetPassword(email: string) { await api('POST', '/api/auth/reset', { email: email.trim() }); }
export async function confirmReset(token: string, password: string) { await withToken(await api('POST', '/api/auth/reset/confirm', { token, password })); }
export async function resume() {
  if (!getToken()) { resetSession(); localStorage.removeItem('fd.live'); return; }
  try {
    await start(await api<Me>('GET', '/api/auth/me'));
  } catch (e) {
    if ((e as { code?: string }).code === 'unauthenticated') { setToken(null); localStorage.removeItem('fd.live'); resetSession(); return; }
    throw e;
  }
}
export async function signOut() {
  stop();
  await api('POST', '/api/auth/signout').catch(() => undefined);
  setToken(null);
}

// team view refreshes after each change and every 15 s while open
const teamWatchers = new Set<() => void>();
const refreshTeam = () => teamWatchers.forEach((f) => f());
function watchTeam(cb: (t: TeamState) => void): () => void {
  let alive = true;
  const load = () => void api<{ org: Me['workspace']; members: Member[]; invites: Invite[] }>('GET', '/api/workspace/team')
    .then((t) => { if (alive) cb({ members: t.members, invites: t.invites, org: t.org ? { name: t.org.name, country: t.org.country, baseCurrency: t.org.baseCurrency, ports: t.org.ports, lang: t.org.lang } : null }); })
    .catch((e) => { if (alive) L?.fail(e); });
  load();
  teamWatchers.add(load);
  const iv = setInterval(load, 15000);
  return () => { alive = false; teamWatchers.delete(load); clearInterval(iv); };
}

export const adapter: AccountsAdapter = {
  signIn, signUp, resetPassword, confirmReset,
  resendVerification: async () => undefined,
  recheckVerified: async () => true,
  async createAccount(p: AccountProfile) { await start(await api<Me>('POST', '/api/workspace', p)); },
  async joinWithCode(raw: string) { await start(await api<Me>('POST', '/api/invites/accept', { join: raw.trim() })); },
  joinLink: (orgId, code) => `${location.origin}${location.pathname}#join=${orgId}.${code}`,
  watchTeam,
  async createInvite(email, role, clientId) {
    const r = await api<{ join: string }>('POST', '/api/workspace/invites', { email: email.trim() || null, role, clientId });
    refreshTeam();
    return r.join;
  },
  async revokeInvite(code) { await api('DELETE', `/api/workspace/invites/${encodeURIComponent(code)}`); refreshTeam(); },
  async removeMember(uid) { await api('DELETE', `/api/workspace/members/${encodeURIComponent(uid)}`); refreshTeam(); },
  async updateAccount(p) { const r = await api<{ workspace: { name: string } }>('PUT', '/api/workspace', p); setSession({ orgName: r.workspace.name }); refreshTeam(); },
  resume, signOut,
  listWaitlist: async () => (await api<{ entries: WaitlistEntry[] }>('GET', '/api/admin/waitlist')).entries,
  async setWaitlistStatus(id, status) { await api('PATCH', `/api/admin/waitlist/${id}`, { status }); },
  waitlistCsv: () => api<Blob>('GET', '/api/admin/waitlist?format=csv', undefined, true),
};
export const serverUrl = API_URL;
