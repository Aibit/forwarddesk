// Firestore wiring for documents + billing (live mode). Called from backend/live.ts.
import { collection, deleteDoc, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, where, type Firestore, type Unsubscribe } from 'firebase/firestore';
import { billingBackend, billingStore } from './store';
import { balanceOf, pnl, type ChargeCode, type JobBalance, type JobDoc, type Ledger } from './model';

export function startBilling(db: Firestore, orgPath: string, role: 'staff' | 'client', clientId: string | null, uid: string, onErr: (e: unknown) => void): Unsubscribe[] {
  const d = (p: string) => doc(db, `${orgPath}/${p}`);
  const c = (p: string) => collection(db, `${orgPath}/${p}`);
  const run = (p: Promise<unknown>) => void p.catch(onErr);
  const unsubs: Unsubscribe[] = [];
  billingStore.hydrate({ ledgers: [], docs: [], catalog: null });
  if (role === 'staff') {
    unsubs.push(onSnapshot(c('ledgers'), (s) => billingStore.hydrate({ ledgers: s.docs.map((x) => ({ ...(x.data() as Ledger), jobId: x.id })) }), onErr));
  } else {
    // Clients never read ledgers (buy rates, margins). They read the balance staff publish next to each ledger.
    unsubs.push(onSnapshot(query(c('jobBalances'), where('clientId', '==', clientId)), (s) => billingStore.hydrate({ balances: s.docs.map((x) => ({ ...(x.data() as JobBalance), jobId: x.id })) }), onErr));
  }
  unsubs.push(onSnapshot(role === 'staff' ? c('jobDocs') : query(c('jobDocs'), where('clientId', '==', clientId)), (s) => billingStore.hydrate({ docs: s.docs.map((x) => ({ ...(x.data() as JobDoc), id: x.id })) }), onErr));
  unsubs.push(onSnapshot(d('settings/chargeCatalog'), (s) => billingStore.hydrate({ catalog: (s.data()?.codes as ChargeCode[] | undefined) ?? null }), onErr));
  billingBackend.b = {
    saveLedger(l) {
      if (role !== 'staff') return;
      // Files keep only metadata here; the bytes live in jobFiles/{id}.
      const p = pnl(l);
      const { localPaid: _lp, ...rest } = l as Ledger & { localPaid?: unknown };
      const now = Date.now();
      run(setDoc(d(`ledgers/${l.jobId}`), { ...rest, localMigrated: true, files: l.files.map(({ data: _d, ...m }) => m), clientOpen: p.receivable, releaseOk: !!l.releaseOk, updatedAt: now }));
      // Same numbers the staff screens use, published for the client portal (no lines, no buy side).
      const b = balanceOf(l, now);
      run(setDoc(d(`jobBalances/${l.jobId}`), { jobId: l.jobId, clientId: l.clientId ?? null, customer: l.customer, currency: b.currency, open: b.open, missing: b.missing, invoices: b.invoices, releaseOk: !!l.releaseOk, updatedAt: now }));
    },
    async saveDoc(x) {
      await setDoc(d(`jobDocs/${x.id}`), x);
    },
    saveCatalog(codes) {
      if (role === 'staff') run(setDoc(d('settings/chargeCatalog'), { codes }));
    },
    async saveFile(jobId, cid, file) {
      const buf = new Uint8Array(await file.arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      const id = `f-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      await setDoc(d(`jobFiles/${id}`), { jobId, clientId: cid ?? null, name: file.name, type: file.type || 'application/octet-stream', size: file.size, dataB64: btoa(bin), uid, at: serverTimestamp() });
      return { id };
    },
    async loadFile(id) {
      const v = (await getDoc(d(`jobFiles/${id}`))).data();
      if (!v) return undefined;
      const bin = atob(v.dataB64 as string);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return new Blob([out], { type: v.type as string });
    },
    async deleteFile(id) {
      await deleteDoc(d(`jobFiles/${id}`));
    },
  };
  return unsubs;
}

export function stopBilling() {
  billingBackend.b = null;
  billingStore.reload();
}
