import { useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { useUiLang } from '../ui/lang';
import { Art } from '../ui/Art';
import { isLive } from '../backend/bridge';
import { useStore } from '../clients/store';
import { useJobs } from '../jobs/store';
import {
  DB_TYPES, KYC_STATUSES, STATUSES, STATUS_ORDER, SVCS, agentsDb, agentsToCsv, csvToAgents, emptyKyc, mergeAgents, newContact, newDbAgent, portalYn, rid, sanctionsLevel, statusOf, useAgentsDb,
  type AgentContact, type AgentStatus, type DbAgent, type DbType, type KycDoc, type LanePair, type Svc,
} from './db';
import { ACT_KINDS, activities, agentStats, daysTo, forAgent, kycFlag, kycSummary, useActivities, type ActKind, type AgentActivity } from './crm';
import { tr, LOCALE, type Lang } from './i18n';
import '../jobs/jobs.css';
import '../clients/clients.css';
import './agents.css';
import './crm.css';
import { PhoneField, WaButton, WaLogItem } from '../whatsapp/WhatsApp';
import { dbAgentRecipients } from '../whatsapp/context';
import { useWaLog, waFor } from '../whatsapp/log';
import { wt } from '../whatsapp/i18n';
import { fmtPhone, isE164 } from '../whatsapp/phone';

type SortKey = 'name' | 'country' | 'status' | 'rating' | 'kyc' | 'last';
type Tab = 'overview' | 'contacts' | 'activity' | 'deals' | 'kyc';
const uniq = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter((x) => x && x !== '—'))].sort((a, b) => a.localeCompare(b));
const splitList = (s: string) => s.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
const laneKey = (p: LanePair) => `${p.from} → ${p.to}`;
const todayIso = () => new Date().toISOString().slice(0, 10);

export function AgentsDbView() {
  const { list } = useAgentsDb();
  const acts = useActivities();
  const { clients, quotes } = useStore();
  const jobs = useJobs();
  const [lang] = useUiLang<Lang>();
  const L = (k: string) => tr(lang, k);
  const [q, setQ] = useState('');
  const [fType, setFType] = useState<DbType | ''>('');
  const [fCountry, setFCountry] = useState('');
  const [fLane, setFLane] = useState('');
  const [fStatus, setFStatus] = useState<AgentStatus | ''>('');
  const [fTag, setFTag] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: 'status', dir: 1 });
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [editing, setEditing] = useState<DbAgent | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const lastAct = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of acts) m.set(a.agentId, Math.max(m.get(a.agentId) ?? 0, a.at));
    return m;
  }, [acts]);
  const live = list.filter((a) => showArchived || !a.archived);
  const countries = useMemo(() => uniq(list.map((a) => a.country)), [list]);
  const lanes = useMemo(() => uniq(list.flatMap((a) => (a.lanePairs ?? []).map(laneKey))), [list]);
  const tags = useMemo(() => uniq(list.flatMap((a) => [...(a.tags ?? []), ...(a.networks ?? [])])), [list]);
  const shown = live.filter((a) => {
    if (fType && a.type !== fType) return false;
    if (fCountry && a.country !== fCountry) return false;
    if (fStatus && statusOf(a) !== fStatus) return false;
    if (fTag && !(a.tags ?? []).includes(fTag) && !(a.networks ?? []).includes(fTag)) return false;
    if (fLane) {
      const [from, to] = fLane.split(' → ');
      if (!(a.lanePairs ?? []).some((p) => p.from === from && p.to === to)) return false;
    }
    if (q.trim()) {
      const hay = [a.name, a.country, a.city, a.ports, a.lanes, a.services, a.email, a.notes, ...(a.tags ?? []), ...(a.networks ?? []), ...(a.lanePairs ?? []).map(laneKey), ...(a.contacts ?? []).flatMap((c) => [c.name, c.email, c.role])].join(' ').toLowerCase();
      return q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
    }
    return true;
  });
  const sorted = [...shown].sort((a, b) => {
    const k = sort.k;
    const v = k === 'name' ? a.name.localeCompare(b.name)
      : k === 'country' ? (a.country || '~').localeCompare(b.country || '~') || a.name.localeCompare(b.name)
      : k === 'status' ? STATUS_ORDER[statusOf(a)] - STATUS_ORDER[statusOf(b)] || (b.rating ?? 0) - (a.rating ?? 0) || a.name.localeCompare(b.name)
      : k === 'rating' ? (a.rating ?? 0) - (b.rating ?? 0)
      : k === 'kyc' ? kycSummary(a).ok - kycSummary(b).ok
      : (lastAct.get(a.id) ?? 0) - (lastAct.get(b.id) ?? 0);
    return v * sort.dir;
  });
  const sortBy = (k: SortKey) => setSort((s) => (s.k === k ? { k, dir: (s.dir * -1) as 1 | -1 } : { k, dir: k === 'rating' || k === 'last' || k === 'kyc' ? -1 : 1 }));
  const open = list.find((a) => a.id === openId) ?? null;
  const active = list.filter((a) => !a.archived);
  const docsDue = active.filter((a) => { const s = kycSummary(a); return s.expired || s.expiring; });
  const anySample = list.some((a) => a.sample);
  const anyPublic = list.some((a) => a.publicInfo);

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const { list: rows, skipped } = csvToAgents(await f.text(), false);
    if (!rows.length) { setMsg(`${L('imported')}: 0${skipped ? ` · ${skipped} ${L('skipped')}` : ''}`); return; }
    if (window.confirm(L('replaceQ'))) {
      agentsDb.replace(rows, 'user');
      setMsg(`${L('imported')}: ${rows.length}${skipped ? ` · ${skipped} ${L('skipped')}` : ''} (${f.name})`);
    } else {
      const r = mergeAgents(list, rows);
      agentsDb.replace(r.list, 'user');
      setMsg(`${L('imported')}: ${r.added} ${L('added')} · ${r.updated} ${L('updatedN')}${skipped ? ` · ${skipped} ${L('skipped')}` : ''} (${f.name})`);
    }
  };
  const onExport = () => {
    const blob = new Blob(['\uFEFF' + agentsToCsv(shown)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `forwarddesk-agents-${todayIso()}.csv`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  const openAgent = (id: string, t: Tab = 'overview') => { setOpenId(id); setTab(t); };
  const th = (k: SortKey | null, children: ReactNode) => (
    <th key={children as string} aria-sort={k && sort.k === k ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
      {k ? <button type="button" className={`crm-sort ${sort.k === k ? 'on' : ''}`} onClick={() => sortBy(k)} data-testid={`sort-${k}`}>{children}<span aria-hidden="true">{sort.k === k ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}</span></button> : children}
    </th>
  );

  return (
    <div className="clients agents-db agents-crm" dir={(lang === 'fa' || lang === 'ar') ? 'rtl' : 'ltr'} lang={lang} data-testid="agents-db">
      <div className="crm-top">
        <div className="crm-badges">
          {anySample && <span className="j-sample" data-testid="agents-sample">{L('sampleNote')}</span>}
          {anyPublic && <span className="j-sample ad-public" data-testid="agents-public">{L('public')}</span>}
          <span className="j-note">{isLive() ? L('savedLive') : L('savedLocal')}</span>
        </div>
        <div className="crm-actions">
          <button type="button" className="btn primary" onClick={() => setEditing(newDbAgent())} data-testid="agents-add">{L('add')}</button>
          <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()} data-testid="agents-import">{L('importCsv')}</button>
          <button type="button" className="btn ghost" onClick={onExport} data-testid="agents-export">{L('exportCsv')}</button>
          {!isLive() && <button type="button" className="btn ghost" onClick={() => { if (window.confirm(L('resetQ'))) { agentsDb.reset(); activities.reset(); setOpenId(null); } }} data-testid="agents-reset">{L('reset')}</button>}
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={onImport} data-testid="agents-import-input" />
        </div>
      </div>
      {msg && <div className="q-scope" data-testid="agents-msg">{msg}</div>}

      <div className="crm-tiles" data-testid="crm-tiles">
        <Tile label={L('tilesAgents')} value={active.length} on={!fStatus} onClick={() => setFStatus('')} />
        <Tile label={L('tilesPreferred')} value={active.filter((a) => statusOf(a) === 'preferred').length} on={fStatus === 'preferred'} onClick={() => setFStatus(fStatus === 'preferred' ? '' : 'preferred')} />
        <Tile label={L('tilesActive')} value={active.filter((a) => statusOf(a) === 'active').length} on={fStatus === 'active'} onClick={() => setFStatus(fStatus === 'active' ? '' : 'active')} />
        <Tile label={L('tilesProspects')} value={active.filter((a) => statusOf(a) === 'prospect').length} on={fStatus === 'prospect'} onClick={() => setFStatus(fStatus === 'prospect' ? '' : 'prospect')} />
        <Tile label={L('tilesDocs')} value={docsDue.length} tone={docsDue.some((a) => kycSummary(a).expired) ? 'red' : docsDue.length ? 'amber' : undefined} testid="tile-docs" onClick={() => { if (docsDue[0]) openAgent(docsDue[0].id, 'kyc'); }} />
      </div>

      <section className="q-panel crm-panel">
        <div className="crm-filters">
          <input className="c-in crm-search" placeholder={L('search')} value={q} onChange={(e) => setQ(e.target.value)} data-testid="agents-search" />
          <select className="c-in" value={fType} onChange={(e) => setFType(e.target.value as DbType | '')} data-testid="agents-f-type" aria-label={L('type')}>
            <option value="">{L('type')}: {L('all')}</option>
            {DB_TYPES.map((t) => <option key={t} value={t}>{L(`t_${t}`)}</option>)}
          </select>
          <select className="c-in" value={fCountry} onChange={(e) => setFCountry(e.target.value)} data-testid="agents-f-country" aria-label={L('country')}>
            <option value="">{L('country')}: {L('all')}</option>
            {countries.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className="c-in" value={fLane} onChange={(e) => setFLane(e.target.value)} data-testid="agents-f-lane" aria-label={L('lane')}>
            <option value="">{L('lane')}: {L('all')}</option>
            {lanes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="c-in" value={fStatus} onChange={(e) => setFStatus(e.target.value as AgentStatus | '')} data-testid="agents-f-status" aria-label={L('status')}>
            <option value="">{L('status')}: {L('all')}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{L(`s_${s}`)}</option>)}
          </select>
          <select className="c-in" value={fTag} onChange={(e) => setFTag(e.target.value)} data-testid="agents-f-tag" aria-label={L('tag')}>
            <option value="">{L('tag')}: {L('all')}</option>
            {tags.map((c) => <option key={c}>{c}</option>)}
          </select>
          <label className="crm-check"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} data-testid="agents-f-archived" /> {L('showArchived')}</label>
          <span className="c-muted crm-count" data-testid="agents-count">{shown.length} / {live.length} {L('shown')}</span>
        </div>
        <table className="crm-table" data-testid="agents-table">
          <colgroup><col className="w-agent" /><col className="w-loc" /><col className="w-lanes" /><col className="w-status" /><col className="w-rating" /><col className="w-contact" /><col className="w-docs" /><col className="w-last" /></colgroup>
          <thead>
            <tr>
              {th('name', L('agent'))}{th('country', L('location'))}{th(null, L('lanesSvc'))}{th('status', L('status'))}{th('rating', L('rating'))}{th(null, L('mainContact'))}{th('kyc', L('docs'))}{th('last', L('lastAct'))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((a) => {
              const c0 = a.contacts?.[0];
              const ks = kycSummary(a);
              const la = lastAct.get(a.id);
              const lv = sanctionsLevel(a.sanctions);
              return (
                <tr key={a.id} onClick={() => openAgent(a.id)} data-testid={`agent-row-${a.id}`} className={`${openId === a.id ? 'active' : ''} ${a.archived ? 'archived' : ''}`}>
                  <td>
                    <div className="crm-name"><strong>{a.name}</strong></div>
                    <div className="crm-sub">
                      <span className={`ad-type t-${a.type}`}>{L(`t_${a.type}`)}</span>
                      {a.sample && <span className="crm-mini sample">{L('sample')}</span>}
                      {a.publicInfo && <span className="crm-mini pub" title={L('public')}>{L('publicShort')}</span>}
                      {a.archived && <span className="crm-mini">{L('archived')}</span>}
                      {lv === 'listed' && <span className="ad-sanc listed" title={a.sanctions} data-testid="sanctions-listed">⚑ {L('listed')}</span>}
                      {lv === 'note' && <span className="crm-flag" title={a.sanctions} data-testid="sanctions-badge">⚑</span>}
                    </div>
                  </td>
                  <td><div>{[a.country, a.city].filter((x) => x && x !== '—').join(' · ') || '—'}</div><div className="crm-sub crm-clip1" title={a.ports}><bdi>{a.ports || ''}</bdi></div></td>
                  <td>
                    {(a.lanePairs ?? []).length > 0
                      ? <div className="crm-lanes">{a.lanePairs!.slice(0, 2).map((p) => <bdi key={laneKey(p)} className="crm-lane">{p.from} → {p.to}</bdi>)}{a.lanePairs!.length > 2 && <span className="crm-sub">+{a.lanePairs!.length - 2}</span>}</div>
                      : <div className="crm-sub crm-clip1" title={a.lanes}>{a.lanes && a.lanes !== '—' ? a.lanes : ''}</div>}
                    <div className="crm-svcs">{(a.svc ?? []).map((s) => <span key={s} className="crm-svc">{L(`sv_${s}`)}</span>)}</div>
                  </td>
                  <td><StatusChip s={statusOf(a)} L={L} /></td>
                  <td><Stars n={a.rating ?? 0} /></td>
                  <td>{c0 ? <><div className="crm-clip1">{c0.name}{c0.role ? <span className="crm-sub" data-ud=""> · {c0.role}</span> : null}</div><div className="crm-sub crm-clip1"><bdi dir="ltr">{c0.email || c0.phone}</bdi></div></> : <div className="crm-sub crm-clip1"><bdi dir="ltr">{a.email || '—'}</bdi></div>}</td>
                  <td><span className={`crm-kyc ${ks.expired ? 'red' : ks.expiring ? 'amber' : ks.ok === ks.total ? 'ok' : ''}`} data-testid="kyc-cell">{ks.ok}/{ks.total}{ks.expired ? ` · ${L('expired')}` : ks.expiring ? ' · ⏳' : ''}</span></td>
                  <td className="crm-sub">{la ? <Rel at={la} lang={lang} /> : '—'}</td>
                </tr>
              );
            })}
            {sorted.length === 0 && list.length === 0 && (
              <tr><td colSpan={8} className="c-muted fd-empty-cell" data-testid="agents-empty">
                <Art name="map" className="fd-empty-art" />
                <div className="fd-empty-big">{lang === 'fa' ? 'هنوز نماینده‌ای ندارید' : lang === 'ar' ? 'لا يوجد لديك وكلاء بعد' : lang === 'es' ? 'Aún no tienes agentes' : 'No agents yet'}</div>
                <div>{lang === 'fa' ? 'اولین نماینده را دستی اضافه کنید یا فهرست خود را از CSV وارد کنید.' : lang === 'ar' ? 'أضف أول وكيل يدويًا أو استورد قائمتك من ملف CSV.' : lang === 'es' ? 'Añade tu primer agente a mano o importa tu lista desde un CSV.' : 'Add your first agent by hand, or import your list from a CSV.'}</div>
                <div className="fd-empty-btns">
                  <button type="button" className="btn primary" onClick={() => setEditing(newDbAgent())} data-testid="agents-empty-add">{L('add')}</button>
                  <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()} data-testid="agents-empty-import">{L('importCsv')}</button>
                </div>
              </td></tr>
            )}
            {sorted.length === 0 && list.length > 0 && <tr><td colSpan={8} className="c-muted fd-empty-cell"><Art name="map" className="fd-empty-art" /><div>{L('noMatch')}</div></td></tr>}
          </tbody>
        </table>
        <p className="crm-foot c-muted">{L('hiddenNote')}</p>
      </section>

      {open && !editing && (
        <AgentDetail a={open} tab={tab} setTab={setTab} L={L} lang={lang} acts={acts} quotes={quotes} jobs={jobs}
          usedBy={clients.filter((c) => c.agents.some((x) => x.dbId === open.id || x.name.toLowerCase() === open.name.toLowerCase())).map((c) => c.name)}
          onClose={() => setOpenId(null)} onEdit={() => setEditing(open)} />
      )}
      {editing && <AgentForm a={editing} L={L} lang={lang} onClose={() => setEditing(null)} onSaved={(id) => { setEditing(null); openAgent(id); }} />}
    </div>
  );
}

function Tile({ label, value, on, tone, onClick, testid }: { label: string; value: number; on?: boolean; tone?: 'amber' | 'red'; onClick?: () => void; testid?: string }) {
  return <button type="button" className={`crm-tile ${on ? 'on' : ''} ${tone ?? ''}`} onClick={onClick} data-testid={testid}><span className="crm-tile-l">{label}</span><span className="crm-tile-v">{value}</span></button>;
}
export function StatusChip({ s, L }: { s: AgentStatus; L: (k: string) => string }) {
  return <span className={`crm-status st-${s}`} data-testid="status-chip">{L(`s_${s}`)}</span>;
}
function Stars({ n, onPick }: { n: number; onPick?: (n: number) => void }) {
  return (
    <span className={`crm-stars ${onPick ? 'pick' : ''}`} aria-label={`${n}/5`} dir="ltr">
      {[1, 2, 3, 4, 5].map((i) => onPick
        ? <button key={i} type="button" className={i <= n ? 'on' : ''} onClick={() => onPick(i === n ? 0 : i)} aria-label={`${i}`} data-testid={`star-${i}`}>★</button>
        : <i key={i} className={i <= n ? 'on' : ''}>★</i>)}
    </span>
  );
}
function fmtDate(ms: number, lang: Lang) { return new Date(ms).toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'short', year: 'numeric' }); }
function Rel({ at, lang }: { at: number; lang: Lang }) {
  const d = Math.round((Date.now() - at) / 86400000);
  const rtf = new Intl.RelativeTimeFormat(LOCALE[lang], { numeric: 'auto' });
  return <span title={fmtDate(at, lang)}>{Math.abs(d) < 45 ? rtf.format(-d, 'day') : fmtDate(at, lang)}</span>;
}

// ── Detail drawer ──
function AgentDetail({ a, tab, setTab, L, lang, acts, quotes, jobs, usedBy, onClose, onEdit }: {
  a: DbAgent; tab: Tab; setTab: (t: Tab) => void; L: (k: string) => string; lang: Lang; acts: AgentActivity[];
  quotes: ReturnType<typeof useStore>['quotes']; jobs: ReturnType<typeof useJobs>; usedBy: string[]; onClose: () => void; onEdit: () => void;
}) {
  const st = agentStats(a, quotes, jobs, acts);
  const lv = sanctionsLevel(a.sanctions);
  const mine = forAgent(acts, a.id);
  const ks = kycSummary(a);
  const tabs: [Tab, string, number | null][] = [['overview', L('overview'), null], ['contacts', L('contacts'), a.contacts?.length ?? 0], ['activity', L('activity'), mine.length], ['deals', L('deals'), st.quotes.length + st.jobs.length], ['kyc', L('kyc'), null]];
  return (
    <div className="j-drawer-wrap" onClick={onClose}>
      <aside className="j-drawer crm-drawer" onClick={(e) => e.stopPropagation()} data-testid="agent-drawer" dir={(lang === 'fa' || lang === 'ar') ? 'rtl' : 'ltr'} lang={lang}>
        <div className="crm-d-head">
          <div>
            <div className="crm-d-kicker">
              <span className={`ad-type t-${a.type}`}>{L(`t_${a.type}`)}</span>
              <StatusChip s={statusOf(a)} L={L} />
              {a.sample && <span className="j-sample sm">{L('sample')}</span>}
              {a.publicInfo && <span className="j-sample sm ad-public">{L('public')}</span>}
              {a.archived && <span className="crm-mini">{L('archived')}</span>}
            </div>
            <h2 data-testid="agent-name">{a.name}</h2>
            <div className="crm-sub">{[a.city, a.country].filter((x) => x && x !== '—').join(', ')}</div>
          </div>
          <div className="crm-d-btns">
            <AgentWa a={a} />
            <button type="button" className="btn sm primary" onClick={onEdit} data-testid="agent-edit">{L('edit')}</button>
            <button type="button" className="btn sm ghost" onClick={onClose} data-testid="agent-close">{L('close')}</button>
          </div>
        </div>
        {a.sanctions && <div className={`ad-sanc block ${lv === 'listed' ? 'listed' : ''}`} data-testid="drawer-sanctions">{lv === 'listed' ? <strong>⚑ {L('listed')}. </strong> : '⚑ '}{L('sanctions')}: {a.sanctions}</div>}
        <div className="crm-tabs" role="tablist">
          {tabs.map(([k, label, count]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)} data-testid={`agent-tab-${k}`}>
              {label}{count != null && count > 0 ? <span className="crm-count-pill">{count}</span> : null}{k === 'kyc' && (ks.expired || ks.expiring) ? <span className={`crm-dot ${ks.expired ? 'red' : 'amber'}`} /> : null}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="crm-pane" data-testid="pane-overview">
            <div className="crm-stats" data-testid="agent-stats">
              <Stat label={L('stQuoted')} value={String(st.quoted)} />
              <Stat label={L('stWin')} value={st.winRate == null ? '—' : `${Math.round(st.winRate * 100)}%`} sub={st.decided ? `${st.won} ${L('won')} ${L('of')} ${st.decided} ${L('decided')}` : ''} />
              <Stat label={L('stResp')} value={st.responseRate == null ? '—' : `${st.replies}/${st.requests}`} />
              <Stat label={L('stReply')} value={st.avgReplyHours == null ? '—' : st.avgReplyHours < 48 ? `${Math.round(st.avgReplyHours)} ${L('hours')}` : `${Math.round(st.avgReplyHours / 24)} ${L('days')}`} />
              <Stat label={L('stJobs')} value={String(st.jobs.length)} />
            </div>
            <p className="crm-note">{L('statsNote')}</p>
            <div className="crm-quick">
              <label className="c-field"><span>{L('status')}</span>
                <select className="c-in" value={statusOf(a)} onChange={(e) => agentsDb.patch(a.id, { status: e.target.value as AgentStatus })} data-testid="quick-status">
                  {STATUSES.map((s) => <option key={s} value={s}>{L(`s_${s}`)}</option>)}
                </select>
              </label>
              <div className="c-field"><span>{L('rating')}</span><Stars n={a.rating ?? 0} onPick={(n) => agentsDb.patch(a.id, { rating: n })} /></div>
            </div>
            <dl className="crm-dl">
              <Row k={L('ports')} v={a.ports} />
              <Row k={L('lanes')} v={(a.lanePairs ?? []).length ? <span className="crm-lanes">{a.lanePairs!.map((p) => <bdi key={laneKey(p)} className="crm-lane">{laneKey(p)}</bdi>)}</span> : ''} />
              {a.lanes && a.lanes !== '—' && <Row k={L('laneNotes')} v={a.lanes} />}
              <Row k={L('services')} v={<>{(a.svc ?? []).map((s) => <span key={s} className="crm-svc">{L(`sv_${s}`)}</span>)}{a.services ? <div className="crm-sub">{a.services}</div> : null}</>} />
              <Row k={L('networks')} v={(a.networks ?? []).join(', ')} />
              <Row k={L('payTerms')} v={a.paymentTerms} />
              <Row k={L('credit')} v={a.creditLimit != null ? <bdi dir="ltr">{a.creditLimit.toLocaleString(LOCALE[lang])} {a.currency ?? ''}</bdi> : ''} />
              <Row k={L('currency')} v={a.currency} />
              <Row k={L('tags')} v={(a.tags ?? []).length ? <span className="crm-tags">{a.tags!.map((t) => <span key={t} className="crm-tag">{t}</span>)}</span> : ''} />
              <Row k={L('website')} v={a.website ? <a href={/^https?:/.test(a.website) ? a.website : `https://${a.website}`} target="_blank" rel="noreferrer noopener"><bdi dir="ltr">{a.website}</bdi></a> : ''} />
              <Row k={L('generalContact')} v={[a.email, a.phone ? fmtPhone(a.phone) : '', a.whatsapp ? `WhatsApp ${fmtPhone(a.whatsapp)}` : ''].filter(Boolean).join(' · ')} ltr />
              <Row k={L('notes')} v={a.notes} />
              {a.portal && <Row k="Portal" v={`${portalYn(a.portal)} — ${a.portal}`} />}
              <Row k={L('source')} v={a.source} />
              <Row k={L('onClients')} v={usedBy.join(', ')} />
              {a.createdAt && <Row k={L('created')} v={fmtDate(a.createdAt, lang)} />}
              {a.updatedAt && <Row k={L('updated')} v={fmtDate(a.updatedAt, lang)} />}
            </dl>
            <div className="c-form-actions">
              {a.archived ? (
                <>
                  <button type="button" className="btn sm ghost" onClick={() => agentsDb.archive(a.id, false)} data-testid="agent-restore">{L('restore')}</button>
                  <span style={{ flex: 1 }} />
                  <button type="button" className="btn sm ghost" onClick={() => { if (window.confirm(L('delQ'))) { agentsDb.remove(a.id); } }} data-testid="agent-delete">{L('delForever')}</button>
                </>
              ) : <button type="button" className="btn sm ghost" onClick={() => agentsDb.archive(a.id, true)} data-testid="agent-archive">{L('archive')}</button>}
            </div>
          </div>
        )}

        {tab === 'contacts' && <ContactsPane a={a} L={L} />}
        {tab === 'activity' && <ActivityPane a={a} L={L} lang={lang} mine={mine} />}
        {tab === 'deals' && (
          <div className="crm-pane" data-testid="pane-deals">
            <p className="crm-note">{L('statsNote')}</p>
            <h3 className="crm-h">{L('quotes')}</h3>
            {st.quotes.length ? (
              <table className="crm-mini-table" data-testid="agent-quotes"><tbody>
                {st.quotes.map((q) => <tr key={q.id}><td><bdi dir="ltr" className="mono">{q.id}</bdi>{q.sample && <span className="crm-mini sample">{L('sample')}</span>}</td><td>{fmtDate(q.at, lang)}</td><td><bdi>{q.route}</bdi> · {q.units}</td><td><span className={`crm-q st-${q.status}`}>{L(`q_${q.status}`)}</span></td></tr>)}
              </tbody></table>
            ) : <p className="c-muted">{L('noQuotes')}</p>}
            <h3 className="crm-h">{L('jobs')}</h3>
            {st.jobs.length ? (
              <table className="crm-mini-table" data-testid="agent-jobs"><tbody>
                {st.jobs.map((j) => <tr key={j.id}><td><bdi dir="ltr" className="mono">{j.id}</bdi>{j.sample && <span className="crm-mini sample">{L('sample')}</span>}</td><td><bdi>{j.pol} → {j.pod}</bdi></td><td>{j.customer}</td><td className="crm-sub">{j.step}</td></tr>)}
              </tbody></table>
            ) : <p className="c-muted">{L('noJobs')}</p>}
          </div>
        )}
        {tab === 'kyc' && <KycPane a={a} L={L} lang={lang} />}
      </aside>
    </div>
  );
}
function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="crm-stat"><span className="crm-stat-l">{label}</span><span className="crm-stat-v">{value}</span>{sub ? <span className="crm-sub">{sub}</span> : null}</div>;
}
function Row({ k, v, ltr }: { k: string; v: ReactNode; ltr?: boolean }) {
  return <><dt>{k}</dt><dd>{v ? (ltr ? <bdi dir="ltr">{v}</bdi> : v) : '—'}</dd></>;
}

// ── Contacts ──
function ContactsPane({ a, L }: { a: DbAgent; L: (k: string) => string }) {
  const [edit, setEdit] = useState<AgentContact | null>(null);
  const list = a.contacts ?? [];
  const save = (c: AgentContact) => {
    const next = list.some((x) => x.id === c.id) ? list.map((x) => (x.id === c.id ? c : x)) : [...list, c];
    agentsDb.patch(a.id, { contacts: next });
    setEdit(null);
  };
  return (
    <div className="crm-pane" data-testid="pane-contacts">
      <div className="crm-pane-h"><span className="c-muted">{list.length} {L('contacts').toLowerCase()}</span><button type="button" className="btn sm primary" onClick={() => setEdit(newContact())} data-testid="contact-add">{L('addContact')}</button></div>
      {edit && <ContactForm c={edit} L={L} onSave={save} onCancel={() => setEdit(null)} />}
      {list.length === 0 && !edit && <p className="c-muted">{L('noContacts')}</p>}
      <div className="crm-contacts">
        {list.map((c) => (
          <div key={c.id} className="crm-contact" data-testid="contact-card">
            <div className="crm-avatar" aria-hidden="true">{(c.name || '?').trim().slice(0, 1).toUpperCase()}</div>
            <div className="crm-contact-main">
              <strong>{c.name || '—'}</strong>{c.role ? <span className="crm-sub" data-ud=""> · {c.role}</span> : null}
              <div className="crm-contact-links">
                {c.email && <a href={`mailto:${c.email}`}><bdi dir="ltr">{c.email}</bdi></a>}
                {c.phone && <a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`}><bdi dir="ltr">{c.phone}</bdi></a>}
                {c.whatsapp && <span className="crm-sub">WhatsApp <bdi dir="ltr">{fmtPhone(c.whatsapp)}</bdi></span>}
              </div>
            </div>
            <div className="crm-contact-btns">
              <button type="button" className="btn sm ghost" onClick={() => setEdit(c)} data-testid="contact-edit">{L('edit')}</button>
              <button type="button" className="btn sm ghost" onClick={() => agentsDb.patch(a.id, { contacts: list.filter((x) => x.id !== c.id) })} data-testid="contact-remove">{L('remove')}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
function ContactForm({ c, L, onSave, onCancel }: { c: AgentContact; L: (k: string) => string; onSave: (c: AgentContact) => void; onCancel: () => void }) {
  const [lang] = useUiLang<Lang>();
  const [d, setD] = useState(c);
  const f = (k: keyof AgentContact, label: string, ltr = false) => <label className="c-field"><span>{label}</span><input className="c-in" dir={ltr ? 'ltr' : undefined} value={d[k]} onChange={(e) => setD({ ...d, [k]: e.target.value })} data-testid={`cf-${k}`} /></label>;
  return (
    <div className="crm-subform" data-testid="contact-form">
      <div className="c-form crm-form3">{f('name', L('cName'))}{f('role', L('cRole'))}{f('email', L('email'), true)}<PhoneField label={L('phone')} value={d.phone} onChange={(v) => setD({ ...d, phone: v })} testid="cf-phone" /><PhoneField label={L('whatsapp')} hint={wt(lang, 'sameAsPhone')} value={d.whatsapp} onChange={(v) => setD({ ...d, whatsapp: v })} testid="cf-whatsapp" /></div>
      <div className="c-form-actions"><span style={{ flex: 1 }} /><button type="button" className="btn sm ghost" onClick={onCancel}>{L('cancel')}</button><button type="button" className="btn sm primary" disabled={!d.name.trim() && !d.email.trim() && !d.phone.trim()} onClick={() => onSave({ ...d, name: d.name.trim() })} data-testid="cf-save">{L('save')}</button></div>
    </div>
  );
}

// ── Activity ──
function ActivityPane({ a, L, lang, mine }: { a: DbAgent; L: (k: string) => string; lang: Lang; mine: AgentActivity[] }) {
  const [kind, setKind] = useState<ActKind>('call');
  const [date, setDate] = useState(todayIso());
  const [text, setText] = useState('');
  const add = () => {
    const now = new Date();
    const day = Date.parse(`${date}T00:00:00`);
    const at = date === todayIso() ? now.getTime() : (Number.isNaN(day) ? now.getTime() : day + 12 * 3600000);
    activities.add({ id: rid('act'), agentId: a.id, kind, at, text: text.trim(), by: 'demo' });
    setText('');
  };
  return (
    <div className="crm-pane" data-testid="pane-activity">
      <div className="crm-subform crm-actform">
        <select className="c-in" value={kind} onChange={(e) => setKind(e.target.value as ActKind)} data-testid="act-kind" aria-label={L('type')}>
          {ACT_KINDS.map((k) => <option key={k} value={k}>{L(`k_${k}`)}</option>)}
        </select>
        <input className="c-in" type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} data-testid="act-date" aria-label={L('date')} />
        <input className="c-in crm-act-text" placeholder={L('what')} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && text.trim()) add(); }} data-testid="act-text" />
        <button type="button" className="btn sm primary" disabled={!text.trim()} onClick={add} data-testid="act-log">{L('log')}</button>
      </div>
      <AgentWaLog a={a} />
      {mine.length === 0 ? <p className="c-muted">{L('noActs')}</p> : (
        <ol className="crm-timeline" data-testid="act-list">
          {mine.map((x) => (
            <li key={x.id} className={`k-${x.kind}`} data-testid="act-item">
              <span className="crm-tl-dot" aria-hidden="true" />
              <div className="crm-tl-body">
                <div className="crm-tl-head"><strong>{L(`k_${x.kind}`)}</strong><span className="crm-sub">{fmtDate(x.at, lang)}</span>{x.sample && <span className="crm-mini sample">{L('sample')}</span>}</div>
                <div>{x.text}</div>
              </div>
              <button type="button" className="crm-x" onClick={() => activities.remove(x.id)} aria-label={L('remove')} data-testid="act-remove">×</button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ── KYC ──
function KycPane({ a, L, lang }: { a: DbAgent; L: (k: string) => string; lang: Lang }) {
  const docs: KycDoc[] = (a.kyc && a.kyc.length ? a.kyc : emptyKyc());
  const up = (i: number, p: Partial<KycDoc>) => agentsDb.patch(a.id, { kyc: docs.map((d, j) => (j === i ? { ...d, ...p } : d)) });
  return (
    <div className="crm-pane" data-testid="pane-kyc">
      <p className="crm-note">{L('kycHint')}</p>
      <div className="crm-kyc-list">
        {docs.map((d, i) => {
          const f = kycFlag(d);
          const days = daysTo(d.expiry);
          return (
            <div key={d.kind} className={`crm-kyc-row f-${f}`} data-testid={`kyc-${d.kind}`}>
              <strong>{L(`d_${d.kind}`)}</strong>
              <select className="c-in" value={d.status} onChange={(e) => up(i, { status: e.target.value as KycDoc['status'] })} data-testid={`kyc-status-${d.kind}`} aria-label={L('status')}>
                {KYC_STATUSES.map((s) => <option key={s} value={s}>{L(`ks_${s}`)}</option>)}
              </select>
              <label className="crm-kyc-exp"><span className="crm-sub">{L('expiry')}</span><input className="c-in" type="date" value={d.expiry} onChange={(e) => up(i, { expiry: e.target.value })} data-testid={`kyc-exp-${d.kind}`} /></label>
              <span className={`crm-kyc-flag ${f}`} data-testid={`kyc-flag-${d.kind}`}>
                {f === 'expired' ? `${L('expired')} · ${fmtDate(Date.parse(`${d.expiry}T00:00:00`), lang)}` : f === 'expiring' ? `${L('expiresIn')} ${days} ${L('days')}` : f === 'tbc' ? L('ks_requested') : f === 'ok' ? `✓ ${L(`ks_${d.status}`)}` : L('ks_missing')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Add / edit form ──
function AgentForm({ a, L, lang, onClose, onSaved }: { a: DbAgent; L: (k: string) => string; lang: Lang; onClose: () => void; onSaved: (id: string) => void }) {
  const [d, setD] = useState<DbAgent>({ ...a, lanePairs: a.lanePairs ?? [], svc: a.svc ?? [], contacts: a.contacts ?? [] });
  const [netTxt, setNetTxt] = useState((a.networks ?? []).join(', '));
  const [tagTxt, setTagTxt] = useState((a.tags ?? []).join(', '));
  const [credit, setCredit] = useState(a.creditLimit == null ? '' : String(a.creditLimit));
  const isNew = !agentsDb.get().list.some((x) => x.id === a.id);
  const up = <K extends keyof DbAgent>(k: K, v: DbAgent[K]) => setD((x) => ({ ...x, [k]: v }));
  const txt = (k: keyof DbAgent, label: string, cls = '', ltr = false, placeholder?: string) => (
    <label className={`c-field ${cls}`}><span>{label}</span><input className="c-in" dir={ltr ? 'ltr' : undefined} placeholder={placeholder} value={String(d[k] ?? '')} onChange={(e) => up(k, e.target.value as never)} data-testid={`af-${k}`} /></label>
  );
  const lp = d.lanePairs ?? [];
  const setLp = (next: LanePair[]) => up('lanePairs', next);
  const toggleSvc = (s: Svc) => up('svc', (d.svc ?? []).includes(s) ? (d.svc ?? []).filter((x) => x !== s) : [...(d.svc ?? []), s]);
  const cs = d.contacts ?? [];
  const setC = (i: number, p: Partial<AgentContact>) => up('contacts', cs.map((c, j) => (j === i ? { ...c, ...p } : c)));
  const save = () => {
    const rec: DbAgent = {
      ...d, name: d.name.trim(), networks: splitList(netTxt), tags: splitList(tagTxt),
      creditLimit: credit.trim() ? Math.max(0, Number(credit.replace(/[^\d.]/g, '')) || 0) : null,
      lanePairs: lp.map((p) => ({ from: p.from.trim(), to: p.to.trim() })).filter((p) => p.from && p.to),
      contacts: cs.map((c) => ({ ...c, name: c.name.trim() })).filter((c) => c.name || c.email || c.phone),
      sample: d.sample && d.name === a.name ? d.sample : undefined,
      kyc: d.kyc && d.kyc.length ? d.kyc : emptyKyc(),
    };
    agentsDb.upsert(rec);
    onSaved(rec.id);
  };
  return (
    <div className="c-modal-bg" onClick={onClose}>
      <div className="q-panel c-modal crm-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} dir={(lang === 'fa' || lang === 'ar') ? 'rtl' : 'ltr'} lang={lang} data-testid="agent-form">
        <div className="crm-modal-head"><Art name="ship" className="crm-modal-art" /><div><h2>{isNew ? L('newAgent') : a.name}</h2><span className="c-muted">{isLive() ? L('savedLive') : L('savedLocal')}</span></div></div>
        <h3 className="crm-h">{L('company')}</h3>
        <div className="c-form crm-form3">
          {txt('name', `${L('name')} *`, 'span2')}
          <label className="c-field"><span>{L('type')}</span>
            <select className="c-in" value={d.type} onChange={(e) => up('type', e.target.value as DbType)} data-testid="af-type">{DB_TYPES.map((t) => <option key={t} value={t}>{L(`t_${t}`)}</option>)}</select>
          </label>
          <label className="c-field"><span>{L('status')}</span>
            <select className="c-in" value={statusOf(d)} onChange={(e) => up('status', e.target.value as AgentStatus)} data-testid="af-status">{STATUSES.map((s) => <option key={s} value={s}>{L(`s_${s}`)}</option>)}</select>
          </label>
          {txt('country', L('country'))}{txt('city', L('city'))}
          {txt('website', L('website'), '', true)}{txt('email', `${L('generalContact')} · ${L('email')}`, '', true)}{txt('phone', L('phone'), '', true)}
          <PhoneField label={`${L('generalContact')} · ${wt(lang, 'waNumber')}`} hint={wt(lang, 'sameAsPhone')} value={d.whatsapp ?? ''} onChange={(v) => up('whatsapp', v as never)} testid="af-whatsapp" />
        </div>
        <h3 className="crm-h">{L('coverage')}</h3>
        <div className="c-form crm-form3">
          {txt('ports', L('ports'), 'wide', false, 'Jebel Ali, Nhava Sheva')}
          <div className="c-field wide"><span>{L('lanePairs')}</span>
            <div className="crm-lp" data-testid="af-lanes">
              {lp.map((p, i) => (
                <div key={i} className="crm-lp-row">
                  <input className="c-in" placeholder={L('from')} value={p.from} onChange={(e) => setLp(lp.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)))} data-testid={`af-lane-from-${i}`} />
                  <span aria-hidden="true">{(lang === 'fa' || lang === 'ar') ? '←' : '→'}</span>
                  <input className="c-in" placeholder={L('to')} value={p.to} onChange={(e) => setLp(lp.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)))} data-testid={`af-lane-to-${i}`} />
                  <button type="button" className="crm-x" onClick={() => setLp(lp.filter((_, j) => j !== i))} aria-label={L('remove')}>×</button>
                </div>
              ))}
              <button type="button" className="btn sm ghost" onClick={() => setLp([...lp, { from: '', to: '' }])} data-testid="af-lane-add">{L('addLane')}</button>
            </div>
          </div>
          <div className="c-field wide"><span>{L('services')}</span>
            <div className="crm-svc-pick">{SVCS.map((s) => <label key={s} className={(d.svc ?? []).includes(s) ? 'on' : ''}><input type="checkbox" checked={(d.svc ?? []).includes(s)} onChange={() => toggleSvc(s)} data-testid={`af-svc-${s}`} />{L(`sv_${s}`)}</label>)}</div>
          </div>
          {txt('services', L('servicesTxt'), 'span2')}
          <label className="c-field"><span>{L('networks')}</span><input className="c-in" placeholder={L('networksHint')} value={netTxt} onChange={(e) => setNetTxt(e.target.value)} data-testid="af-networks" /></label>
        </div>
        <h3 className="crm-h">{L('commercial')}</h3>
        <div className="c-form crm-form3">
          {txt('paymentTerms', L('payTerms'), '', false, '30 days after invoice')}
          <label className="c-field"><span>{L('credit')}</span><input className="c-in" dir="ltr" inputMode="decimal" value={credit} onChange={(e) => setCredit(e.target.value)} data-testid="af-credit" /></label>
          <label className="c-field"><span>{L('currency')}</span>
            <select className="c-in" value={d.currency ?? 'USD'} onChange={(e) => up('currency', e.target.value)} data-testid="af-currency">{['USD', 'EUR', 'AED', 'CNY', 'INR', 'GBP', 'TRY', 'SAR', 'OTHER'].map((c) => <option key={c}>{c}</option>)}</select>
          </label>
          <div className="c-field"><span>{L('rating')}</span><Stars n={d.rating ?? 0} onPick={(n) => up('rating', n)} /></div>
          <label className="c-field span2"><span>{L('tags')} ({L('tagsHint')})</span><input className="c-in" value={tagTxt} onChange={(e) => setTagTxt(e.target.value)} data-testid="af-tags" /></label>
        </div>
        <h3 className="crm-h">{L('contacts')}</h3>
        <div className="crm-lp" data-testid="af-contacts">
          {cs.map((c, i) => (
            <div key={c.id} className="crm-c-row">
              <input className="c-in" placeholder={L('cName')} value={c.name} onChange={(e) => setC(i, { name: e.target.value })} data-testid={`af-c-name-${i}`} />
              <input className="c-in" placeholder={L('cRole')} value={c.role} onChange={(e) => setC(i, { role: e.target.value })} />
              <input className="c-in" dir="ltr" placeholder={L('email')} value={c.email} onChange={(e) => setC(i, { email: e.target.value })} data-testid={`af-c-email-${i}`} />
              <input className="c-in" dir="ltr" placeholder={L('phone')} value={c.phone} onChange={(e) => setC(i, { phone: e.target.value })} />
              <input className={`c-in ${c.whatsapp && !isE164(c.whatsapp) ? 'wa-bad' : ''}`} title={c.whatsapp && !isE164(c.whatsapp) ? wt(lang, 'badPhone') : undefined} dir="ltr" placeholder={`${L('whatsapp')} (+…)`} value={c.whatsapp} onChange={(e) => setC(i, { whatsapp: e.target.value })} data-testid={`af-c-wa-${i}`} />
              <button type="button" className="crm-x" onClick={() => up('contacts', cs.filter((_, j) => j !== i))} aria-label={L('remove')}>×</button>
            </div>
          ))}
          <button type="button" className="btn sm ghost" onClick={() => up('contacts', [...cs, newContact()])} data-testid="af-contact-add">{L('addContact')}</button>
        </div>
        <h3 className="crm-h">{L('notes')}</h3>
        <div className="c-form">
          <label className="c-field wide"><span>{L('notes')}</span><textarea className="c-in" rows={3} value={d.notes} onChange={(e) => up('notes', e.target.value)} data-testid="af-notes" /></label>
          {txt('sanctions', L('sanctions'), 'wide')}
        </div>
        <div className="c-form-actions crm-modal-foot">
          {!d.name.trim() && <span className="c-muted">{L('required')}</span>}
          <span style={{ flex: 1 }} />
          <button type="button" className="btn ghost" onClick={onClose} data-testid="af-cancel">{L('cancel')}</button>
          <button type="button" className="btn primary" disabled={!d.name.trim()} onClick={save} data-testid="af-save">{L('save')}</button>
        </div>
      </div>
    </div>
  );
}

/** WhatsApp from the agent page: general number + contacts. */
function AgentWa({ a }: { a: DbAgent }) {
  const { company } = useStore();
  return <WaButton className="sm ghost" recipients={dbAgentRecipients(a)} templates={['general']} ctx={{ company: company.name }} defaultTpl="general" link={{ agentId: a.id }} fallbackLang="en" testid="agent" />;
}
function AgentWaLog({ a }: { a: DbAgent }) {
  const [ui] = useUiLang();
  const log = waFor(useWaLog(), 'agentId', a.id);
  if (!log.length) return null;
  return (
    <div className="crm-wa-log" data-testid="agent-wa-log">
      <h3 className="crm-h">{wt(ui, 'log')}</h3>
      <p className="crm-note">{wt(ui, 'logNote')}</p>
      <ul className="wa-log">{log.map((e) => <WaLogItem key={e.id} e={e} ui={ui} />)}</ul>
    </div>
  );
}
