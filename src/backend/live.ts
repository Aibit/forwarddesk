// Firebase live mode. Loaded on demand (dynamic import) so demo visitors never download the SDK.
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  connectAuthEmulator, createUserWithEmailAndPassword, getAuth, GoogleAuthProvider, onAuthStateChanged, sendEmailVerification, sendPasswordResetEmail,
  signInWithEmailAndPassword, signInWithPopup, signOut as fbSignOut, updateProfile, type Auth, type User,
} from 'firebase/auth';
import {
  arrayUnion, collection, connectFirestoreEmulator, deleteDoc, deleteField, doc, getDoc, initializeFirestore, onSnapshot, query, serverTimestamp,
  setDoc, updateDoc, where, writeBatch, Timestamp, type Firestore,
} from 'firebase/firestore';
import { FIREBASE_CONFIG, ORG_ID, USE_EMULATOR } from './config';
import { bridge, type AccountProfile, type AccountsAdapter, type Invite, type Member, type TeamState } from './bridge';
import { getSession, resetSession, setSession } from './session';
import { EMPTY_COMPANY } from '../clients/store';
import { makeLiveData } from './liveData';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
function init() {
  if (app) return;
  if (!FIREBASE_CONFIG) throw new Error('backend-off');
  app = initializeApp(FIREBASE_CONFIG);
  auth = getAuth(app);
  db = initializeFirestore(app, { ignoreUndefinedProperties: true });
  if (USE_EMULATOR) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
}

const L = makeLiveData(
  { doc, collection, query, where, onSnapshot, setDoc, updateDoc, deleteDoc, getDoc, writeBatch, serverTimestamp, deleteField, arrayUnion, Timestamp } as never,
  { db: () => db!, uid: () => auth?.currentUser?.uid ?? '' },
);
const { fail, ms } = L;
const stop = () => L.stop();


async function start(user: User) {
  const link = await getDoc(doc(db!, `userOrgs/${user.uid}`)).catch(() => null);
  let orgId = link?.data()?.orgId as string | undefined;
  if (!orgId) {
    // Legacy seeded accounts may be members of the demo org without a link doc.
    const legacy = await getDoc(doc(db!, `orgs/${ORG_ID}/members/${user.uid}`)).catch(() => null);
    if (legacy?.exists()) orgId = ORG_ID;
  }
  if (!orgId) {
    // Signed up but no company account yet: verify the email, then onboarding (create or join).
    stop();
    setSession({ mode: user.emailVerified ? 'onboard' : 'verify', uid: user.uid, email: user.email, role: null, clientId: null, orgId: null, owner: false, orgName: null, error: null });
    return;
  }
  const m = await getDoc(doc(db!, `orgs/${orgId}/members/${user.uid}`)).catch(() => null);
  const mem = m?.data();
  if (!mem) throw Object.assign(new Error('no-org'), { code: 'no-org' });
  const owner = mem.role === 'owner';
  const role: 'staff' | 'client' = mem.role === 'client' ? 'client' : 'staff';
  const clientId = role === 'client' ? (mem.clientId as string) : null;
  const o = await getDoc(doc(db!, `orgs/${orgId}`)).catch(() => null);
  stop();
  setSession({ orgId });
  bridge.w = L.writer(user.uid, role, clientId);
  bridge.onError = fail;
  L.subscribe(role, clientId);
  setSession({ mode: 'live', uid: user.uid, email: user.email, role, clientId, orgId, owner, orgName: (o?.data()?.name as string) ?? null, error: null });
}

// ── Self-serve accounts ──
const rnd = (n: number, abc = 'abcdefghijklmnopqrstuvwxyz0123456789') => {
  const a = crypto.getRandomValues(new Uint8Array(n));
  return [...a].map((x) => abc[x % abc.length]).join('');
};
const ALNUM = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

export async function signUp(email: string, password: string, name: string) {
  init();
  watch();
  const cred = await createUserWithEmailAndPassword(auth!, email.trim(), password);
  if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() }).catch(() => undefined);
  await sendEmailVerification(cred.user).catch(() => undefined); // Firebase sends the email
  await start(cred.user);
}
export async function googleSignIn() {
  init();
  watch();
  const cred = await signInWithPopup(auth!, new GoogleAuthProvider());
  await start(cred.user);
}
export async function resetPassword(email: string) {
  init();
  await sendPasswordResetEmail(auth!, email.trim());
}
export async function resendVerification() {
  if (auth?.currentUser) await sendEmailVerification(auth.currentUser);
}
/** After the user clicked the verification link: refresh the token so the rules see email_verified. */
export async function recheckVerified(): Promise<boolean> {
  const u = auth?.currentUser;
  if (!u) return false;
  await u.reload();
  await u.getIdToken(true);
  await start(u);
  return u.emailVerified;
}
export async function createAccount(p: AccountProfile) {
  const u = auth!.currentUser!;
  const id = rnd(16);
  const email = (u.email ?? '').toLowerCase();
  await setDoc(doc(db!, `orgs/${id}`), {
    name: p.name.trim(), ownerUid: u.uid, country: p.country.trim(), baseCurrency: p.baseCurrency, ports: p.ports.slice(0, 12), lang: p.lang,
    company: { ...EMPTY_COMPANY, name: p.name.trim(), email }, createdAt: Date.now(),
  });
  await setDoc(doc(db!, `orgs/${id}/members/${u.uid}`), { role: 'owner', email, name: u.displayName ?? '', createdAt: Date.now() });
  await setDoc(doc(db!, `userOrgs/${u.uid}`), { orgId: id });
  await start(u);
}
/** Join code = "<orgId>.<inviteCode>" (also accepted: a full link ending in #join=<orgId>.<inviteCode>). */
export function parseJoin(raw: string): { orgId: string; code: string } | null {
  const m = raw.trim().match(/([a-z0-9]{12,32})\.([A-Za-z0-9]{16,40})\s*$/);
  return m ? { orgId: m[1], code: m[2] } : null;
}
export async function joinWithCode(raw: string) {
  const j = parseJoin(raw);
  if (!j) throw Object.assign(new Error('bad-code'), { code: 'bad-code' });
  const u = auth!.currentUser!;
  const inv = (await getDoc(doc(db!, `orgs/${j.orgId}/invites/${j.code}`)).catch(() => null))?.data();
  if (!inv) throw Object.assign(new Error('bad-code'), { code: 'bad-code' });
  if (inv.usedBy) throw Object.assign(new Error('used-code'), { code: 'used-code' });
  if ((inv.email as string) !== (u.email ?? '').toLowerCase()) throw Object.assign(new Error('wrong-email'), { code: 'wrong-email' });
  const mem: Record<string, unknown> = { role: inv.role, email: inv.email, name: u.displayName ?? '', invite: j.code, createdAt: Date.now() };
  if (inv.role === 'client') mem.clientId = inv.clientId;
  await setDoc(doc(db!, `orgs/${j.orgId}/members/${u.uid}`), mem);
  await updateDoc(doc(db!, `orgs/${j.orgId}/invites/${j.code}`), { usedBy: u.uid, usedAt: serverTimestamp() });
  await setDoc(doc(db!, `userOrgs/${u.uid}`), { orgId: j.orgId });
  await start(u);
}

// ── Team (account settings) ──
export const joinLink = (orgId: string, code: string) => `${location.origin}${location.pathname}#join=${orgId}.${code}`;
export function watchTeam(cb: (t: TeamState) => void): () => void {
  const orgId = getSession().orgId!;
  let members: Member[] = [];
  let invites: Invite[] = [];
  let org: AccountProfile | null = null;
  const emit = () => cb({ members, invites, org });
  const u = [
    onSnapshot(doc(db!, `orgs/${orgId}`), (s) => {
      const x = s.data() ?? {};
      org = { name: x.name ?? '', country: x.country ?? '', baseCurrency: x.baseCurrency ?? 'USD', ports: (x.ports as string[]) ?? [], lang: x.lang ?? 'en' };
      emit();
    }, fail),
    onSnapshot(collection(db!, `orgs/${orgId}/members`), (s) => {
      members = s.docs.map((x) => ({ uid: x.id, ...(x.data() as Omit<Member, 'uid'>) }));
      emit();
    }, fail),
    onSnapshot(collection(db!, `orgs/${orgId}/invites`), (s) => {
      invites = s.docs.map((x) => {
        const v = x.data();
        return { code: x.id, email: v.email, role: v.role, clientId: v.clientId, expiresAt: ms(v.expiresAt) ?? 0, usedBy: v.usedBy ?? null, join: `${orgId}.${x.id}` };
      });
      emit();
    }, fail),
  ];
  return () => u.forEach((f) => f());
}
export async function createInvite(email: string, role: 'staff' | 'client', clientId: string | null): Promise<string> {
  const orgId = getSession().orgId!;
  const code = rnd(20, ALNUM);
  const v: Record<string, unknown> = {
    email: email.trim().toLowerCase(), role, createdBy: auth!.currentUser!.uid, createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + 14 * 864e5), usedBy: null,
  };
  if (role === 'client') v.clientId = clientId;
  await setDoc(doc(db!, `orgs/${orgId}/invites/${code}`), v);
  return `${orgId}.${code}`;
}
export async function revokeInvite(code: string) {
  await deleteDoc(doc(db!, `orgs/${getSession().orgId}/invites/${code}`));
}
export async function removeMember(uid: string) {
  const orgId = getSession().orgId!;
  const b = writeBatch(db!);
  b.delete(doc(db!, `orgs/${orgId}/members/${uid}`));
  const link = await getDoc(doc(db!, `userOrgs/${uid}`)).catch(() => null);
  if (link?.exists() && link.data()?.orgId === orgId) b.delete(doc(db!, `userOrgs/${uid}`));
  await b.commit();
}
export async function updateAccount(p: AccountProfile) {
  const orgId = getSession().orgId!;
  await updateDoc(doc(db!, `orgs/${orgId}`), { name: p.name.trim(), country: p.country.trim(), baseCurrency: p.baseCurrency, ports: p.ports.slice(0, 12), lang: p.lang, 'company.name': p.name.trim() });
  setSession({ orgName: p.name.trim() });
}

let watching = false;
function watch() {
  if (watching) return;
  watching = true;
  onAuthStateChanged(auth!, (u) => {
    if (!u && getSession().mode === 'live') {
      stop();
      resetSession();
    }
  });
}

export async function signIn(email: string, password: string) {
  init();
  watch();
  const cred = await signInWithEmailAndPassword(auth!, email.trim(), password);
  try {
    await start(cred.user);
  } catch (e) {
    await fbSignOut(auth!);
    throw e;
  }
}
export async function resume() {
  init();
  await auth!.authStateReady();
  watch();
  if (!auth!.currentUser) {
    resetSession();
    localStorage.removeItem('fd.live');
    return;
  }
  await start(auth!.currentUser);
}
export async function signOut() {
  stop();
  if (auth) await fbSignOut(auth);
}

/** Firebase implementation of the backend-agnostic accounts adapter (see bridge.ts). */
export const adapter: AccountsAdapter = {
  signIn, signUp, googleSignIn, resetPassword, resendVerification, recheckVerified, createAccount, joinWithCode, joinLink,
  watchTeam, createInvite, revokeInvite, removeMember, updateAccount, resume, signOut,
};
