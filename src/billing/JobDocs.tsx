import { useRef, useState } from 'react';
import type { Job } from '../jobs/data';
import { useTariffs } from '../jobs/tariffs';
import { getStore } from '../clients/store';
import { useUiLang } from '../ui/lang';
import { bt, day, type BKey } from './i18n';
import { billingBackend, billingStore, ledgerFor, useBilling } from './store';
import { saveLedgerFor } from './JobBilling';
import { defaultFields, docPrefix, docsFor, nextNo, releaseGate, uid, type BlFields, type DocKind, type JobDoc } from './model';
import { downloadBlob, jobDocPdf } from './pdf';

const MAX = 640 * 1024;
const FIELDS: (keyof BlFields)[] = ['shipper', 'consignee', 'notify', 'marks', 'packages', 'grossKg', 'cbm', 'place'];

export function JobDocs({ job, sample }: { job: Job; sample: boolean }) {
  const [lang] = useUiLang();
  const L = (k: BKey) => bt(lang, k);
  const { docs, ledgers } = useBilling();
  const tariffs = useTariffs();
  const ledger = ledgers[job.id] ?? ledgerFor(job);
  const gate = releaseGate(job, ledger);
  const [editing, setEditing] = useState<DocKind | null>(null);
  const [form, setForm] = useState<BlFields | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const allNos = Object.values(docs).map((d) => d.no);

  const get = (k: DocKind): JobDoc | undefined => docs[`${job.id}-${k}`];
  const save = async (d: JobDoc) => {
    try {
      setMsg(null);
      await billingStore.saveDoc(d);
    } catch (e) {
      setMsg(String((e as { message?: string }).message ?? e));
    }
  };
  const create = (k: DocKind) => save({ id: `${job.id}-${k}`, jobId: job.id, clientId: job.clientId ?? null, kind: k, no: nextNo(docPrefix[k], allNos), status: 'draft', fields: defaultFields(job), issuedAt: null, releasedAt: null });
  const pdf = async (d: JobDoc, pl: 'en' | 'es') => {
    const r = await jobDocPdf(job, d, getStore().company, pl, sample);
    downloadBlob(r.blob, r.filename);
  };
  const attach = async (f: File) => {
    if (f.size > MAX) return setMsg(L('tooBig'));
    let meta;
    if (billingBackend.b) {
      const { id } = await billingBackend.b.saveFile(job.id, job.clientId ?? null, f);
      meta = { id, name: f.name, size: f.size, type: f.type, at: Date.now() };
    } else {
      const data = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f); });
      meta = { id: uid('f'), name: f.name, size: f.size, type: f.type, at: Date.now(), data };
    }
    saveLedgerFor(job, { ...ledger, files: [...ledger.files, meta] }, tariffs);
  };
  const openFile = async (id: string) => {
    const m = ledger.files.find((x) => x.id === id);
    if (!m) return;
    const blob = m.data ? await (await fetch(m.data)).blob() : await billingBackend.b?.loadFile(id);
    if (blob) downloadBlob(blob, m.name);
  };
  const removeFile = async (id: string) => {
    if (billingBackend.b) await billingBackend.b.deleteFile(id).catch(() => undefined);
    saveLedgerFor(job, { ...ledger, files: ledger.files.filter((x) => x.id !== id) }, tariffs);
  };

  return (
    <div className="b-wrap" data-testid="job-docs">
      <p className="b-note">{L('docsNote')}</p>
      {msg && <p className="b-msg amber" data-testid="docs-msg">{msg}</p>}
      <div className="b-doc-grid">
        {docsFor(job).map((k) => {
          const d = get(k);
          const gated = k === 'hbl' || k === 'do';
          return (
            <div key={k} className={`b-doc ${d?.status ?? 'none'}`} data-testid={`doc-${k}`}>
              <div className="b-doc-top">
                <svg className="b-doc-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6z M14 3v4h4 M9 12h6 M9 15h6 M9 18h4" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>
                <div>
                  <strong>{L(k)}</strong>
                  <div className="b-sub mono">{d ? d.no : L('notYet')}</div>
                </div>
                {d && <span className={`b-pill ${d.status}`} data-testid={`doc-${k}-status`}>{L(d.status)}</span>}
              </div>
              {d && d.issuedAt ? <div className="b-sub">{L('issued')} · {day(lang, d.issuedAt)}{d.releasedAt ? ` · ${L('released')} ${day(lang, d.releasedAt)}` : ''}</div> : null}
              {gated && d && d.status !== 'released' && (
                <div className={`b-gate ${gate.ok ? 'ok' : 'amber'}`} data-testid={`gate-${k}`}>
                  <strong>{gate.ok ? L('releaseReady') : L('releaseBlocked')}</strong>
                  {!gate.ok && <ul>{gate.reasons.map((r) => <li key={r}>{L(`r_${r}` as BKey)}</li>)}</ul>}
                </div>
              )}
              <div className="b-actions">
                {!d && <button type="button" className="btn primary sm" onClick={() => void create(k)} data-testid={`doc-${k}-create`}>{L('create')}</button>}
                {d && d.status === 'draft' && <button type="button" className="btn ghost sm" onClick={() => { setEditing(k); setForm(d.fields); }} data-testid={`doc-${k}-edit`}>{L('edit')}</button>}
                {d && d.status === 'draft' && <button type="button" className="btn primary sm" onClick={() => void save({ ...d, status: 'issued', issuedAt: Date.now() })} data-testid={`doc-${k}-issue`}>{L('issue')}</button>}
                {d && gated && d.status === 'issued' && (
                  <button type="button" className="btn primary sm" disabled={!gate.ok} title={gate.ok ? '' : L('releaseBlocked')} onClick={() => void save({ ...d, status: 'released', releasedAt: Date.now() })} data-testid={`doc-${k}-release`}>{L('release')}</button>
                )}
                {d && <button type="button" className="btn ghost sm" onClick={() => void pdf(d, 'en')} data-testid={`doc-${k}-pdf`}>{L('pdf')}</button>}
                {d && <button type="button" className="btn ghost sm" onClick={() => void pdf(d, 'es')}>{L('pdfEs')}</button>}
              </div>
              {editing === k && form && d && (
                <div className="b-form" data-testid={`doc-${k}-form`}>
                  {FIELDS.map((f) => (
                    <label key={f} className={f === 'shipper' || f === 'consignee' || f === 'notify' || f === 'marks' ? 'wide' : ''}>
                      <span>{L(f)}</span>
                      {f === 'shipper' || f === 'consignee' || f === 'notify' || f === 'marks' ? (
                        <textarea rows={2} value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })} dir="auto" data-testid={`f-${f}`} />
                      ) : (
                        <input value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })} dir="auto" />
                      )}
                    </label>
                  ))}
                  <label>
                    <span>{L('freight')}</span>
                    <select value={form.freight} onChange={(e) => setForm({ ...form, freight: e.target.value as BlFields['freight'] })}>
                      <option value="prepaid">{L('prepaid')}</option>
                      <option value="collect">{L('collect')}</option>
                    </select>
                  </label>
                  <div className="b-actions wide">
                    <button type="button" className="btn primary sm" onClick={() => { void save({ ...d, fields: form }); setEditing(null); }} data-testid={`doc-${k}-save`}>{L('save')}</button>
                    <button type="button" className="btn ghost sm" onClick={() => setEditing(null)}>{L('cancel')}</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <section className="b-sec">
        <div className="b-sec-h">
          <h3>{L('files')}</h3>
          <button type="button" className="btn ghost sm" onClick={() => fileRef.current?.click()} data-testid="attach-file">{L('attach')}</button>
          <input ref={fileRef} type="file" hidden data-testid="attach-input" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void attach(f).catch(() => setMsg(L('storageFull'))); }} />
        </div>
        {ledger.files.length ? (
          <ul className="b-files" data-testid="job-files">
            {ledger.files.map((f) => (
              <li key={f.id}>
                <button type="button" className="b-link" onClick={() => void openFile(f.id)}>{f.name}</button>
                <span className="b-sub">{Math.ceil(f.size / 1024)} KB · {day(lang, f.at)}</span>
                <button type="button" className="btn ghost sm" onClick={() => void removeFile(f.id)}>{L('remove')}</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="b-sub">{L('noFiles')}</p>
        )}
      </section>
    </div>
  );
}
