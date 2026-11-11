import { useEffect, useMemo, useRef, useState } from 'react';
import { useUiLang, type UiLang } from '../ui/lang';
import { useJobs } from '../jobs/store';
import { useTariffs } from '../jobs/tariffs';
import { useStore } from '../clients/store';
import { useAgentsDb } from '../agents/db';
import { useBilling } from '../billing/store';
import { bt, type BKey } from '../billing/i18n';
import { downloadBlob } from '../billing/pdf';
import { fmtPhone } from '../whatsapp/phone';
import { WaIcon } from '../whatsapp/WhatsApp';
import { WA_TEMPLATES, TPL_LANGS, tplByKey, renderTemplate, type TplLang } from '../../server/src/templates';
import { InboxError, type Conv, type Msg } from './backend';
import { useInbox, reloadConvs, patchConv, getInbox } from './state';
import { syncDirectory } from './sync';
import { it, when, left, num, type IKey } from './i18n';
import { templateValues, jobFiles, type JobFile } from './jobdata';
import { WaServerSettings } from './Settings';
import './inbox.css';

type Filter = 'all' | 'unread' | 'unlinked';
const RTL = (l: string) => l === 'fa' || l === 'ar';

export function convTitle(c: Conv) { return c.name ?? c.profileName ?? fmtPhone(`+${c.waId}`); }
/** Last-message preview; the service stores "[document]" etc. for messages without text. */
export function lastPreview(c: Conv, lang: UiLang) {
  const m = (c.lastText ?? '').match(/^\[([\w+]+)\]$/);
  if (!m) return c.lastText ?? '';
  return m[1] === 'image' ? it(lang, 'image') : m[1].startsWith('template') ? it(lang, 'tplTag') : it(lang, 'doc');
}

export function Ticks({ m, lang }: { m: Msg; lang: UiLang }) {
  if (m.direction !== 'out') return null;
  const k = `st_${m.status}` as IKey;
  const label = it(lang, k in { st_queued: 1, st_sent: 1, st_delivered: 1, st_read: 1, st_failed: 1, st_sample: 1 } ? k : 'st_queued');
  const title = m.status === 'sample' || m.sample ? it(lang, 'statusSample') : `${it(lang, 'statusFrom')}: ${label}${m.errorTitle ? ` (${m.errorCode ?? ''} ${m.errorTitle})` : ''}`;
  const icon = m.status === 'queued' ? <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M8 4.8V8l2.2 1.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
    : m.status === 'sent' ? <svg viewBox="0 0 18 14" width="16" height="14" aria-hidden="true"><path d="M2 7.5l3.5 3.5L13 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
    : m.status === 'delivered' || m.status === 'read' ? <svg viewBox="0 0 22 14" width="19" height="14" aria-hidden="true"><path d="M1.5 7.5L5 11l7.5-7.5M8.5 10l1 1L17 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
    : null;
  return (
    <span className={`ib-tick ib-st-${m.status}`} title={title} data-testid="inbox-tick" data-status={m.status}>
      {icon}
      {(m.status === 'failed' || m.status === 'sample' || m.status === 'queued') && <span>{label}</span>}
      {m.status === 'failed' && m.errorCode ? <span className="ib-err-detail mono">#{m.errorCode}</span> : null}
    </span>
  );
}

export function Bubble({ m, lang, onOpenMedia }: { m: Msg; lang: UiLang; onOpenMedia?: (m: Msg) => void }) {
  const t = m.template ? WA_TEMPLATES.find((x) => x.name === m.template) : null;
  const isDoc = m.type === 'document' || m.type === 'template+document' || m.type === 'image';
  return (
    <div className={`ib-msg ${m.direction}`} data-testid="inbox-msg" data-dir={m.direction} data-status={m.status}>
      <div className="ib-bubble">
        {t && <div className="ib-tpl-tag" data-testid="inbox-msg-tpl">{it(lang, 'tplTag')} · {t.label[lang]}{m.lang ? ` · ${m.lang.toUpperCase()}` : ''}</div>}
        {isDoc && (
          <div className="ib-file">
            <span className="ib-file-ic" aria-hidden="true">{m.type === 'image' ? '▣' : 'PDF'}</span>
            <bdi className="ib-file-name" data-ud="">{m.filename ?? it(lang, m.type === 'image' ? 'image' : 'doc')}</bdi>
            {m.size ? <span className="ib-file-size">{num(lang, Math.max(1, Math.round(m.size / 1024)))} KB</span> : null}
            {m.hasMedia && onOpenMedia ? <button type="button" className="btn sm ghost" onClick={() => onOpenMedia(m)}>{it(lang, 'open')}</button>
              : m.sample ? <span className="ib-file-size">{it(lang, 'sampleFile')}</span> : null}
          </div>
        )}
        {m.text && <p dir="auto" data-ud="">{m.text}</p>}
        <div className="ib-meta"><time>{when(lang, m.ts)}</time><Ticks m={m} lang={lang} /></div>
      </div>
    </div>
  );
}

export function InboxView({ onOpenJob }: { onOpenJob?: (id: string) => void }) {
  const [lang] = useUiLang();
  const L = (k: IKey, v?: Record<string, string | number>) => it(lang, k, v);
  const ib = useInbox();
  const jobs = useJobs();
  const tariffs = useTariffs();
  const store = useStore();
  const agents = useAgentsDb();
  useBilling();
  const [sel, setSel] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [thread, setThread] = useState<{ conversation: Conv; messages: Msg[] } | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [status, setStatus] = useState<{ provider: string; mock: boolean } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const b = ib.backend;

  // A draft handed over from the booking drawer ("Update client"): fill the composer once that conversation is open.
  const pendingDraft = useRef<{ id: number; text: string } | null>(null);
  useEffect(() => {
    if (!ib.nav) return;
    if (ib.nav.draft) { pendingDraft.current = { id: ib.nav.id, text: ib.nav.draft }; if (sel === ib.nav.id) { setText(ib.nav.draft); pendingDraft.current = null; } }
    setSel(ib.nav.id);
  }, [ib.nav]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void reloadConvs(); }, [b]);
  useEffect(() => { if (b?.kind === 'server') { b.status().then((s) => setStatus(s)).catch(() => setStatus(null)); } else setStatus(null); }, [b]);
  useEffect(() => { if (b) syncDirectory(b).catch(() => { /* shown via list errors */ }); }, [b, store.clients, agents.list, jobs]);

  const loadThread = async (id: number) => {
    if (!b) return;
    try {
      const t = await b.thread(id);
      if (getInbox().backend === b) setThread(t);
    } catch (e) { setErr(String((e as Error).message ?? e)); }
  };
  useEffect(() => {
    setThread(null); setErr(null); setAttachOpen(false);
    if (pendingDraft.current && pendingDraft.current.id === sel) { setText(pendingDraft.current.text); pendingDraft.current = null; } else setText('');
    if (sel == null || !b) return;
    void loadThread(sel);
    const c = ib.convs.find((x) => x.id === sel);
    if (c?.unread) b.read(sel).then(() => patchConv({ ...c, unread: 0 })).catch(() => { /* */ });
    if (b.kind !== 'server') return;
    const t = setInterval(() => { if (document.visibilityState !== 'hidden') void loadThread(sel); }, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, b]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [thread?.messages.length]);

  const list = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return ib.convs.filter((c) => (filter === 'unread' ? c.unread > 0 : filter === 'unlinked' ? !c.clientId && !c.agentId : true))
      .filter((c) => !qq || [c.name, c.profileName, c.contactName, c.waId, c.jobId, c.lastText].some((x) => x && x.toLowerCase().includes(qq)));
  }, [ib.convs, filter, q]);

  if (ib.mode === 'none') {
    return (
      <section className="ib-setup" data-testid="inbox-setup">
        <span className="wa-head-ic"><WaIcon size={26} /></span>
        <h2>{L('notConfiguredH')}</h2>
        <p>{L('notConfiguredP')}</p>
        <WaServerSettings />
      </section>
    );
  }

  const conv = thread?.conversation ?? ib.convs.find((c) => c.id === sel) ?? null;
  const job = conv?.jobId ? jobs.find((j) => j.id === conv.jobId) ?? null : null;
  const sample = ib.mode === 'sample';
  const clientName = conv?.clientId ? store.clients.find((c) => c.id === conv.clientId)?.name : null;
  const agentName = conv?.agentId ? agents.list.find((a) => a.id === conv.agentId)?.name : null;
  const recipLang: TplLang = (conv?.clientId ? store.clients.find((c) => c.id === conv.clientId)?.lang : null) ?? 'en';

  const doSend = async (req: Parameters<NonNullable<typeof b>['send']>[0]) => {
    if (!b) return false;
    setBusy(true); setErr(null);
    try {
      await b.send(req);
      await loadThread(req.conversationId);
      void reloadConvs();
      return true;
    } catch (e) {
      const ie = e instanceof InboxError ? e : null;
      setErr(ie?.body.error === 'window_closed' ? L('closedRefused') : L('sendFailed', { e: ie?.body.detail ?? ie?.message ?? String(e) }));
      if (conv) void loadThread(conv.id);
      return false;
    } finally { setBusy(false); }
  };
  const sendText = async () => { if (conv && text.trim() && await doSend({ conversationId: conv.id, text: text.trim(), jobId: conv.jobId })) setText(''); };
  const attach = async (f: JobFile) => {
    if (!b || !conv) return;
    setAttachOpen(false); setBusy(true); setErr(null);
    try {
      const { blob, filename } = await f.make(recipLang === 'es' ? 'es' : 'en');
      const up = await b.upload(blob, filename);
      setBusy(false);
      await doSend({ conversationId: conv.id, uploadId: up.id, caption: text.trim() || undefined, jobId: conv.jobId });
      setText('');
    } catch (e) { setBusy(false); setErr(L('sendFailed', { e: String((e as Error).message ?? e) })); }
  };
  const link = async (jobId: string) => {
    if (!b || !conv) return;
    try { const c = await b.linkJob(conv.id, jobId || null); patchConv(c); setThread((t) => (t ? { ...t, conversation: { ...t.conversation, ...c } } : t)); } catch (e) { setErr(String((e as Error).message ?? e)); }
  };
  const openMedia = async (m: Msg) => { if (!b) return; const blob = await b.media(m.id); if (blob) downloadBlob(blob, m.filename ?? 'file'); };

  const w = conv?.window;
  const files = jobFiles(job, sample);

  return (
    <section className={`ib ${sel != null ? 'has-sel' : ''}`} data-testid="inbox">
      <div className="ib-banner" data-testid="inbox-mode" data-mode={ib.mode}>
        {sample ? (<><span className="j-sample" data-testid="inbox-sample-pill">{L('sample')}</span><span data-testid="inbox-sample-note">{L('sampleNote')}</span></>)
          : (<span>{status?.mock ? L('mockServer') : L('serverNote', { p: status?.provider ?? '…' })}</span>)}
        {ib.error && <span className="ib-warn" data-testid="inbox-offline">{L('offline', { e: ib.error })}</span>}
      </div>
      <div className="ib-grid">
        <aside className="ib-list" aria-label={L('back')}>
          <input className="c-in ib-search" placeholder={L('search')} value={q} onChange={(e) => setQ(e.target.value)} data-testid="inbox-search" />
          <div className="ib-filters" role="group">
            {(['all', 'unread', 'unlinked'] as Filter[]).map((f) => (
              <button key={f} type="button" className={filter === f ? 'active' : ''} onClick={() => setFilter(f)} data-testid={`inbox-filter-${f}`}>{L(f === 'all' ? 'fAll' : f === 'unread' ? 'fUnread' : 'fUnlinked')}</button>
            ))}
          </div>
          {ib.loaded && list.length === 0 && <p className="c-muted ib-empty">{L('noConvs')}</p>}
          <ul>
            {list.map((c) => {
              const cn = c.clientId ? store.clients.find((x) => x.id === c.clientId)?.name : null;
              const an = c.agentId ? agents.list.find((x) => x.id === c.agentId)?.name : null;
              return (
                <li key={c.id}>
                  <button type="button" className={`ib-item ${sel === c.id ? 'active' : ''} ${c.unread ? 'unread' : ''}`} onClick={() => setSel(c.id)} data-testid={`inbox-conv-${c.id}`}>
                    <span className="ib-av" aria-hidden="true">{convTitle(c).replace(/^\+/, '').slice(0, 1).toUpperCase()}</span>
                    <span className="ib-item-main">
                      <span className="ib-item-top">
                        <strong data-ud=""><bdi>{c.contactName ?? convTitle(c)}</bdi></strong>
                        <time>{c.lastMessageAt ? when(lang, c.lastMessageAt) : ''}</time>
                      </span>
                      <span className="ib-item-sub" dir="auto" data-ud="">{lastPreview(c, lang)}</span>
                      <span className="ib-chips">
                        {cn ? <span className="ib-chip">{L('client')} · <bdi data-ud="">{cn}</bdi></span> : an ? <span className="ib-chip">{L('agent')} · <bdi data-ud="">{an}</bdi></span> : <span className="ib-chip muted">{L('unlinked')}</span>}
                        {c.jobId && <span className="ib-chip mono"><bdi>{c.jobId}</bdi></span>}
                        <span className={`ib-dot ${c.window.open ? 'open' : ''}`} title={c.window.open ? L('winOpen', { t: left(lang, c.window.msLeft) }) : L('winClosed')} />
                        {c.sample && <span className="j-sample sm">{L('sample')}</span>}
                      </span>
                    </span>
                    {c.unread > 0 && <span className="ib-badge" data-testid="inbox-unread" aria-label={L('unreadN', { n: c.unread })}>{num(lang, c.unread)}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <div className="ib-thread" data-testid="inbox-thread">
          {!conv ? <p className="c-muted ib-empty">{L('pick')}</p> : (
            <>
              <header className="ib-th-head">
                <button type="button" className="btn sm ghost ib-back" onClick={() => setSel(null)} data-testid="inbox-back">{RTL(lang) ? '→' : '←'} {L('back')}</button>
                <div className="ib-th-who">
                  <h2 data-ud=""><bdi>{conv.contactName ?? convTitle(conv)}</bdi></h2>
                  <div className="ib-th-sub">
                    <bdi dir="ltr" className="mono">{fmtPhone(`+${conv.waId}`)}</bdi>
                    {clientName ? <span>· {L('client')}: <bdi data-ud="">{clientName}</bdi></span> : agentName ? <span>· {L('agent')}: <bdi data-ud="">{agentName}</bdi></span> : <span className="c-muted">· {L('unlinked')}</span>}
                    {conv.sample && <span className="j-sample">{L('sample')}</span>}
                  </div>
                </div>
                <label className="ib-link">
                  <span>{L('linkJob')}</span>
                  <select className="c-in" value={conv.jobId ?? ''} onChange={(e) => void link(e.target.value)} data-testid="inbox-job-link">
                    <option value="">{L('noJob')}</option>
                    {conv.jobId && !jobs.some((j) => j.id === conv.jobId) && <option value={conv.jobId}>{conv.jobId}</option>}
                    {jobs.map((j) => <option key={j.id} value={j.id}>{j.id} · {j.customer}</option>)}
                  </select>
                  {conv.jobId && <small className="c-muted" data-testid="inbox-job-source">{L(conv.jobLinkedBy === 'staff' ? 'byStaff' : 'byText')}{job && onOpenJob ? <> · <button type="button" className="ib-linkbtn" onClick={() => onOpenJob(job.id)} data-testid="inbox-open-job">{L('job')} {job.id}</button></> : null}</small>}
                </label>
              </header>
              <div className={`ib-window ${w?.open ? 'open' : 'closed'}`} data-testid="inbox-window" data-open={w?.open ? '1' : '0'} title={L('winHelp')}>
                <span className="ib-dot open-ind" aria-hidden="true" />
                {w?.open ? L('winOpen', { t: left(lang, w.msLeft) }) : conv.lastInboundAt ? L('winClosed') : L('winNever')}
              </div>
              <div className="ib-msgs" data-testid="inbox-msgs">
                {(thread?.messages ?? []).map((m) => <Bubble key={m.id} m={m} lang={lang} onOpenMedia={openMedia} />)}
                <div ref={endRef} />
              </div>
              {err && <p className="ib-warn" role="status" data-testid="inbox-error">{err}</p>}
              {w?.open ? (
                <div className="ib-compose">
                  <textarea className="c-in" rows={2} dir="auto" placeholder={L('typeMsg')} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void sendText(); }} data-testid="inbox-text" />
                  <div className="ib-compose-btns">
                    <div className="ib-attach-wrap">
                      <button type="button" className="btn ghost" onClick={() => setAttachOpen((o) => !o)} disabled={busy} data-testid="inbox-attach">{L('attach')}</button>
                      {attachOpen && (
                        <div className="ib-attach-menu" data-testid="inbox-attach-menu">
                          {!job ? <p className="c-muted">{L('linkFirst')}</p> : files.length === 0 ? <p className="c-muted">{L('noDocs')}</p> : (
                            <>
                              <div className="ib-attach-h">{L('attachFrom', { job: job.id })}</div>
                              {files.map((f) => <button key={f.id} type="button" onClick={() => void attach(f)} data-testid="inbox-attach-item">{f.label === 'invoice' ? L('invoice') : bt(lang, f.label as BKey)} · <bdi>{f.no}</bdi></button>)}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <button type="button" className="btn primary" onClick={() => void sendText()} disabled={busy || !text.trim()} data-testid="inbox-send">{busy ? L('sending') : L('send')}</button>
                  </div>
                </div>
              ) : (
                <TemplateComposer key={conv.id} conv={conv} jobFilesList={files} busy={busy} defaultLang={recipLang}
                  values={(k, l) => templateValues(tplByKey(k)!, l, conv, job, tariffs)}
                  onSend={async (tpl, file) => {
                    if (!b) return;
                    let uploadId: string | undefined;
                    if (file) { const { blob, filename } = await file.make(tpl.lang === 'es' ? 'es' : 'en'); uploadId = (await b.upload(blob, filename)).id; }
                    await doSend({ conversationId: conv.id, template: tpl, uploadId, jobId: conv.jobId });
                  }} />
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function TemplateComposer({ conv, defaultLang, values, onSend, busy, jobFilesList }: { conv: Conv; defaultLang: TplLang; values: (key: string, l: TplLang) => string[]; onSend: (t: { key: string; lang: string; values: string[] }, file: JobFile | null) => Promise<void>; busy: boolean; jobFilesList: JobFile[] }) {
  const [lang] = useUiLang();
  const L = (k: IKey) => it(lang, k);
  const [key, setKey] = useState(WA_TEMPLATES[0].key as string);
  const [ml, setMl] = useState<TplLang>(defaultLang);
  const t = tplByKey(key)!;
  const [vals, setVals] = useState<string[]>(() => values(key, defaultLang));
  const [file, setFile] = useState('');
  useEffect(() => { setVals(values(key, ml)); setFile(''); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ml, conv.id, conv.jobId]);
  const preview = renderTemplate(t, ml, vals.map((v, i) => v || `{{${i + 1}}}`));
  const ready = vals.length === t.params.length && vals.every((v) => v.trim());
  return (
    <div className="ib-tpl" data-testid="inbox-tpl">
      <div className="ib-tpl-row">
        <label><span>{L('template')}</span>
          <select className="c-in" value={key} onChange={(e) => setKey(e.target.value)} data-testid="inbox-tpl-select">
            {WA_TEMPLATES.map((x) => <option key={x.key} value={x.key}>{x.label[lang]}</option>)}
          </select>
        </label>
        <div><span className="ib-lbl">{L('msgLang')}</span>
          <div className="q-lang" role="group">
            {TPL_LANGS.map((l) => <button key={l} type="button" className={ml === l ? 'active' : ''} onClick={() => setMl(l)} data-testid={`inbox-tpl-lang-${l}`}>{l.toUpperCase()}</button>)}
          </div>
        </div>
      </div>
      <div className="ib-tpl-vars">
        <span className="ib-lbl">{L('vars')}</span>
        {t.params.map((p, i) => (
          <label key={p}><span className="mono">{`{{${i + 1}}}`}</span>
            <input className={`c-in ${vals[i]?.trim() ? '' : 'wa-bad'}`} dir="auto" value={vals[i] ?? ''} placeholder={t.example[i]} onChange={(e) => setVals((v) => v.map((x, j) => (j === i ? e.target.value : x)))} data-testid={`inbox-tpl-var-${i}`} />
          </label>
        ))}
      </div>
      {t.header === 'document' && (
        <label className="ib-tpl-file"><span>{L('attachHeader')}</span>
          <select className="c-in" value={file} onChange={(e) => setFile(e.target.value)} data-testid="inbox-tpl-file">
            <option value="">{L('none')}</option>
            {jobFilesList.map((f) => <option key={f.id} value={f.id}>{f.label === 'invoice' ? L('invoice') : bt(lang, f.label as BKey)} · {f.no}</option>)}
          </select>
        </label>
      )}
      <div className="ib-lbl">{L('preview')}</div>
      <p className="ib-tpl-preview" dir={RTL(ml) ? 'rtl' : 'ltr'} lang={ml} data-testid="inbox-tpl-preview" data-ud="">{preview}</p>
      <div className="ib-tpl-foot">
        <small className="c-muted">{L('tplApproved')}</small>
        <button type="button" className="btn primary" disabled={busy || !ready} onClick={() => void onSend({ key, lang: ml, values: vals }, jobFilesList.find((f) => f.id === file) ?? null)} data-testid="inbox-tpl-send">{L('sendTpl')}</button>
      </div>
    </div>
  );
}
