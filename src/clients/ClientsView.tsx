import { useUiLang } from '../ui/lang';
import { Art } from '../ui/Art';
import { ComplianceNote } from '../backend/AuthBar';
import { isLive } from '../backend/bridge';
import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import { type Job } from '../jobs/data';
import { useJobs } from '../jobs/store';
import { dur, fmtDay, num, usd } from '../jobs/i18n';
import { DAY } from '../jobs/logic';
import { useBilling } from '../billing/store';
import { loadTariffs, useTariffs } from '../jobs/tariffs';
import { stepDef } from '../jobs/steps';
import { ct, type CKey } from './i18n';
import { clientKpi, type ClientKpi } from './kpi';
import { EMPTY_COMPANY, newClient, store, useStore, type CLang, type Client, type Company, type QuoteStatus } from './store';
import { AgentsEditor } from './Agents';
import { LanesEditor } from './Lanes';
import { MsdsRulesEditor } from './Msds';
import { demoLogin } from './portal';
import './clients.css';
import { LogoMark } from '../ui/Brand';
import { PhoneField, WaButton, WaLogList } from '../whatsapp/WhatsApp';
import { WaServerSettings } from '../inbox/Settings';
import { clientRecipients, jobCtx } from '../whatsapp/context';
import { useWaLog, waFor } from '../whatsapp/log';
import { wt } from '../whatsapp/i18n';
import { fmtPhone } from '../whatsapp/phone';
import { balanceFor, ledgerFor } from '../billing/store';

const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];

interface Props {
  openRequest?: { id: string; n: number } | null;
  onOpenJob: (jobId: string) => void;
  onNewQuote: (clientId: string, laneId?: string) => void;
}

export function ClientsView({ openRequest, onOpenJob, onNewQuote }: Props) {
  const { clients, company, quotes } = useStore();
  const [lang] = useUiLang<CLang>();
  const [now, setNow] = useState(() => Date.now());
  const jobs: Job[] = useJobs();
  const tariffs = useTariffs();
  const [openId, setOpenId] = useState<string | null>(openRequest?.id ?? null);
  const [editing, setEditing] = useState<Client | null>(null);
  const [editCompany, setEditCompany] = useState(false);
  const [editRules, setEditRules] = useState(false);

  useEffect(() => {
    if (openRequest) setOpenId(openRequest.id);
  }, [openRequest?.n]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const L = (k: CKey) => ct(lang, k);
  const bill = useBilling();
  const kpis = useMemo(() => new Map(clients.map((c) => [c.id, clientKpi(c, jobs, quotes, now, tariffs)])), [clients, jobs, quotes, now, tariffs, bill]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = clients.find((c) => c.id === openId) ?? null;
  const D = lang === 'fa' ? 'روز' : lang === 'ar' ? 'يوم' : 'd';

  const deadline = (k: ClientKpi): ReactNode => {
    if (!k.next) return <span className="c-muted">{L('nothingDue')}</span>;
    const n = k.next;
    const label = n.kind === 'over' ? L('over') : n.kind === 'cutoff' ? L('cutoff') : L('free');
    return (
      <span className={`c-dl ${n.level}`}>
        <bdi className="mono">{n.job.id}</bdi> · {label} <bdi className="mono">{n.kind === 'over' ? `+${num(lang, Math.ceil(-n.ms / DAY))} ${D}` : dur(lang, n.ms, false)}</bdi>
      </span>
    );
  };

  return (
    <div className="clients-view jobs-view" dir={(lang === 'fa' || lang === 'ar') ? 'rtl' : 'ltr'} lang={lang} data-testid="clients-view">
      <div className="j-top">
        <div className="j-title">
          <span className="j-sample">{L('sample')}</span>
          <span className="j-note">{L(isLive() ? 'savedLive' : 'savedLocal')}</span>
        </div>
        <div className="c-top-actions">
          <button type="button" className="btn sm primary" onClick={() => setEditing(newClient())} data-testid="add-client">{L('addClient')}</button>
          <button type="button" className="btn sm ghost" onClick={() => setEditCompany(true)} data-testid="edit-company">{L('yourCompany')}</button>
          <button type="button" className="btn sm ghost" onClick={() => setEditRules((v) => !v)} data-testid="edit-msds-rules">{lang === 'fa' ? 'قواعد MSDS' : lang === 'ar' ? 'قواعد MSDS' : lang === 'es' ? 'Reglas MSDS' : 'MSDS rules'}</button>
        </div>
      </div>

      <div className="q-panel c-company" data-testid="company-card">
        {company.logo ? <img src={company.logo} alt="" className="c-logo" /> : <LogoMark size={48} className="c-logo-ph-mark" />}
        <div className="c-company-txt">
          <strong>{L('yourCompany')}: </strong>
          {company.name ? (
            <span>
              {company.name}
              {company.contactName ? ` · ${company.contactName}` : ''}
              {company.email ? ` · ${company.email}` : ''}
              {company.phone ? ` · ${company.phone}` : ''}
            </span>
          ) : (
            <span className="q-amber">{L('notSet')}</span>
          )}
          <div className="c-muted">{L('companyHint')}</div>
        </div>
        <button type="button" className="btn sm ghost" onClick={() => setEditCompany(true)}>{L('edit')}</button>
      </div>

      {!open && (
        <section className="q-panel" aria-label={L('allClients')}>
          <div className="q-head">
            <h2>{L('allClients')} · {num(lang, clients.length)}</h2>
            <button type="button" className="btn sm ghost" onClick={() => { if (window.confirm('Reset sample clients and sample quotes? Your own clients and quotes in this browser are replaced.')) store.resetSample(); }}>{L('resetSample')}</button>
          </div>
          <div className="c-table" role="table" data-testid="clients-table">
            <div className="c-row c-row-head" role="row">
              <span>{L('client')}</span>
              <span>{L('liveJobs')}</span>
              <span>{L('nextDeadline')}</span>
              <span>{L('inFreeTime')}</span>
              <span>{L('demurrage')}</span>
              <span>{L('unpaid')}</span>
              <span>{L('cheques')}</span>
              <span>{L('quotes')} <small>({L('sentWon')})</small></span>
            </div>
            {clients.map((c) => {
              const k = kpis.get(c.id)!;
              return (
                <button type="button" role="row" key={c.id} className="c-row" onClick={() => setOpenId(c.id)} data-testid={`client-${c.id}`}>
                  <span className="c-name">
                    <strong>{c.name || '—'}</strong>
                    <span className="c-sub">
                      {c.contactName || '—'} · <bdi>{c.lang.toUpperCase()}</bdi> · <bdi>{c.incoterm}</bdi> · <bdi>{num(lang, c.marginPct)}%</bdi>
                      {c.sample && <span className="j-sample sm">{L('sampleTag')}</span>}
                    </span>
                  </span>
                  <bdi className="mono c-num">{num(lang, k.jobs.length)}</bdi>
                  <span>{deadline(k)}</span>
                  <bdi className="mono c-num">{num(lang, k.inFreeTime)}{k.atRiskCntr ? <span className="c-amber-sub"> · {num(lang, k.atRiskCntr)} &lt;3{D}</span> : null}</bdi>
                  <bdi className={`mono c-num ${k.demurrageUsd ? 'c-red' : ''}`}>{k.demurrageUsd ? `${usd(lang, k.demurrageUsd)} · ${num(lang, k.demurrageCntr)} ${L('cntr')}` : '—'}</bdi>
                  <bdi className={`mono c-num ${k.unpaidUsd ? 'c-amber' : ''}`} data-testid={`client-unpaid-${c.name}`}>{k.unpaidUsd ? usd(lang, k.unpaidUsd) : '—'}</bdi>
                  <bdi className="mono c-num">{k.chequesHeld ? `${num(lang, k.chequesHeld)} · ${usd(lang, k.chequesUsd)}` : '—'}</bdi>
                  <bdi className="mono c-num">{num(lang, k.sent)} · {num(lang, k.won)}</bdi>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {open && (
        <ClientDashboard
          c={open}
          k={kpis.get(open.id)!}
          lang={lang}
          L={L}
          deadline={deadline}
          onBack={() => setOpenId(null)}
          onEdit={() => setEditing(open)}
          onOpenJob={onOpenJob}
          onNewQuote={(laneId) => onNewQuote(open.id, laneId)}
          now={now}
          D={D}
        />
      )}

      {editing && <ClientForm c={editing} L={L} lang={lang} onClose={() => setEditing(null)} onSaved={(id) => { setEditing(null); setOpenId(id); }} />}
      {editRules && <MsdsRulesEditor lang={lang} onClose={() => setEditRules(false)} />}
      {editCompany && <CompanyForm co={company} L={L} lang={lang} onClose={() => setEditCompany(false)} />}
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'amber' | 'red' }) {
  return (
    <div className={`j-tile ${tone ?? ''}`}>
      <span className="j-tile-label">{label}</span>
      <bdi className="j-tile-value">{value}</bdi>
      {sub && <span className="j-tile-sub">{sub}</span>}
    </div>
  );
}

function ClientDashboard({ c, k, lang, L, deadline, onBack, onEdit, onOpenJob, onNewQuote, now, D }: {
  c: Client; k: ClientKpi; lang: CLang; L: (k: CKey) => string; deadline: (k: ClientKpi) => ReactNode; onBack: () => void; onEdit: () => void; onOpenJob: (id: string) => void; onNewQuote: (laneId?: string) => void; now: number; D: string;
}) {
  const winRate = k.won + k.lost ? Math.round((100 * k.won) / (k.won + k.lost)) : null;
  const statusL: Record<QuoteStatus, CKey> = { sent: 'sent', won: 'won', lost: 'lost' };
  return (
    <section className="c-dash" data-testid="client-dashboard">
      <div className="q-panel c-dash-head">
        <button type="button" className="btn sm ghost" onClick={onBack} data-testid="clients-back">{L('back')}</button>
        <div className="c-dash-title">
          <h2>{c.name} {c.sample && <span className="j-sample sm">{L('sampleTag')}</span>}</h2>
          <span className="c-muted">{L('dashboard')} · portal: <bdi className="mono" dir="ltr">{demoLogin(c) || '—'}</bdi> / demo</span>
        </div>
        <button type="button" className="btn sm ghost" onClick={onEdit} data-testid="edit-client">{L('edit')}</button>
        <ClientWa c={c} k={k} now={now} />
        <button type="button" className="btn sm primary" onClick={() => onNewQuote()} data-testid="client-new-quote">{L('newQuote')}</button>
      </div>

      <div className="j-summary">
        <Tile label={L('liveJobs')} value={num(lang, k.jobs.length)} />
        <Tile label={L('inFreeTime')} value={num(lang, k.inFreeTime)} sub={k.atRiskCntr ? `${num(lang, k.atRiskCntr)} < 3 ${D}` : undefined} tone={k.atRiskCntr ? 'amber' : undefined} />
        <Tile label={L('demurrage')} value={usd(lang, k.demurrageUsd)} sub={k.demurrageCntr ? `${num(lang, k.demurrageCntr)} ${L('cntr')} ${L('over')}` : undefined} tone={k.demurrageUsd ? 'red' : undefined} />
        <Tile label={L('unpaid')} value={usd(lang, k.unpaidUsd)} tone={k.unpaidUsd ? 'amber' : undefined} />
        <Tile label={L('cheques')} value={num(lang, k.chequesHeld)} sub={k.chequesHeld ? usd(lang, k.chequesUsd) : undefined} />
        <Tile label={L('quotes')} value={`${num(lang, k.sent)} · ${num(lang, k.won)}`} sub={`${L('sentWon')}${winRate != null ? ` · ${num(lang, winRate)}% ${L('winRate')}` : ''}`} />
      </div>

      <div className="c-dash-main">
        <div className="c-dash-left">
          <section className="q-panel" aria-label={L('lanesH')} data-testid="client-lanes">
            <div className="q-head"><h2>{L('lanesH')} · {num(lang, c.lanes.length)}</h2><span className="c-muted c-small">{L('best')}: sample rates · {c.marginPct}%</span></div>
            <p className="c-muted c-small">{L('lanesNote')}</p>
            <LanesEditor lanes={c.lanes} onChange={(l) => store.setLanes(c.id, l)} lang={lang} client={c} onQuote={(l) => onNewQuote(l.id)} testid="dash-lanes" />
          </section>
          <section className="q-panel" aria-label={L('jobs')}>
            <div className="q-head"><h2>{L('jobs')} · {num(lang, k.jobs.length)}</h2><span>{deadline(k)}</span></div>
            {k.jobs.length === 0 && <div className="fd-empty"><Art name="containers" className="fd-empty-art" /><p className="c-muted">{L('noJobs')}</p></div>}
            <div className="c-jobs">
              {k.jobs.map((j) => (
                <button key={j.id} type="button" className="c-job" onClick={() => onOpenJob(j.id)} data-testid={`client-job-${j.id}`}>
                  <bdi className="mono c-job-id">{j.id}</bdi>
                  <span className="c-job-route"><bdi>{j.pol} → {j.pod}</bdi><span className="c-sub">{j.commodity} · {j.line}</span></span>
                  <span className="c-job-step"><bdi className="j-code">{j.step}</bdi> {stepDef(j.step)[lang]}</span>
                  <JobDeadline j={j} lang={lang} now={now} L={L} />
                  <span className="c-job-open">{L('openJob')} →</span>
                </button>
              ))}
            </div>
          </section>

          <section className="q-panel" aria-label={L('quotes')} data-testid="client-quotes">
            <div className="q-head"><h2>{L('quotes')} · {num(lang, k.sent)}</h2></div>
            {k.quotes.length === 0 && <div className="fd-empty"><Art name="truck" className="fd-empty-art" /><p className="c-muted">{L('noQuotes')}</p></div>}
            {k.quotes.length > 0 && (
              <div className="c-quotes">
                {k.quotes.map((q) => {
                  const from = Math.min(...q.options.map((o) => o.sell));
                  return (
                    <div key={q.id} className="c-quote" data-testid={`quote-row-${q.id}`}>
                      <span className="c-q-id">
                        <bdi className="mono">{q.id}</bdi>
                        <span className="c-sub">{fmtDay(lang, q.at)} · {L('via')} {q.via.join(' + ')}{q.sample ? ` · ${L('sampleTag')}` : ''}{q.status === 'won' && q.acceptedVia === 'portal' ? ` · ✓ portal${q.acceptedOption ? `: ${q.acceptedOption.replace(/^Sample /, '')}` : ''}` : ''}</span>
                      </span>
                      <span>
                        <bdi>{q.route}</bdi>
                        <span className="c-sub"><bdi>{q.mode} · {q.units}</bdi></span>
                      </span>
                      <span>
                        <bdi className="mono">{q.options.length > 1 ? `${L('from')} ` : ''}{usd(lang, from)}</bdi>
                        <span className="c-sub"><bdi>{q.options.map((o) => o.carrier.replace(/^Sample /, '')).join(' · ')}</bdi></span>
                      </span>
                      <span className="q-lang c-status" role="group" aria-label={L('status')}>
                        {(['sent', 'won', 'lost'] as QuoteStatus[]).map((s) => (
                          <button key={s} type="button" className={`${q.status === s ? 'active' : ''} st-${s}`} onClick={() => store.setQuoteStatus(q.id, s)} data-testid={`status-${q.id}-${s}`}>
                            {L(statusL[s])}
                          </button>
                        ))}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          <section className="q-panel" aria-label={L('agents')} data-testid="client-agents">
            <div className="q-head"><h2>{L('agents')} · {num(lang, c.agents.length)}</h2></div>
            <p className="c-muted c-small">{L('agentsNote')}</p>
            <AgentsEditor agents={c.agents} onChange={(a) => store.setAgents(c.id, a)} lang={lang} testid="dash-agents" />
          </section>
          <ClientWaLog c={c} />
        </div>

        <aside className="q-panel c-info" aria-label={L('contact')}>
          <dl>
            <dt>{L('contact')}</dt>
            <dd>{c.contactName || '—'}<br /><bdi className="mono" dir="ltr">{fmtPhone(c.phone)}</bdi>{c.whatsapp ? <><br /><span className="c-sub">{wt(lang, 'wa')}</span> <bdi className="mono" dir="ltr">{fmtPhone(c.whatsapp)}</bdi></> : null}<br /><bdi>{c.email}</bdi>{c.address ? <><br />{c.address}</> : null}</dd>
            <dt>{L('clearanceAgent')}</dt>
            <dd>{c.clearanceAgent.name || '—'}{c.clearanceAgent.phone ? <><br /><bdi className="mono" dir="ltr">{fmtPhone(c.clearanceAgent.phone)}</bdi></> : null}{c.clearanceAgent.whatsapp ? <><br /><span className="c-sub">{wt(lang, 'wa')}</span> <bdi className="mono" dir="ltr">{fmtPhone(c.clearanceAgent.whatsapp)}</bdi></> : null}</dd>
            <dt>{L('baContact')}</dt>
            <dd>{c.bandarAbbas.name || '—'}{c.bandarAbbas.phone ? <><br /><bdi className="mono" dir="ltr">{fmtPhone(c.bandarAbbas.phone)}</bdi></> : null}{c.bandarAbbas.whatsapp ? <><br /><span className="c-sub">{wt(lang, 'wa')}</span> <bdi className="mono" dir="ltr">{fmtPhone(c.bandarAbbas.whatsapp)}</bdi></> : null}</dd>
          </dl>
          <h3>{L('defaults')}</h3>
          <dl className="c-defs">
            <dt>{L('language')}</dt><dd>{c.lang.toUpperCase()}</dd>
            <dt>{L('incoterm')}</dt><dd>{c.incoterm}</dd>
            <dt>{L('margin')}</dt><dd>{num(lang, c.marginPct)}%</dd>
            <dt>{L('lines')}</dt><dd>{c.agents.filter((a) => a.type === 'line').map((a) => `${a.name} (${L(`r_${a.rank}` as CKey)})`).join(', ') || L('anyLine')}</dd>
            <dt>{L('freeTimeReq')}</dt><dd>{c.freeTimeRequest ? `${num(lang, c.freeTimeRequest)} ${D}` : '—'}</dd>
            <dt>{L('payment')}</dt><dd>{c.paymentTerms || '—'}</dd>
          </dl>
          <p className="c-muted c-small">{L('inQuoteNote')}</p>
          {c.notes && (
            <>
              <h3>{L('notes')}</h3>
              <p className="c-notes">{c.notes}</p>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}

function JobDeadline({ j, lang, now, L }: { j: Job; lang: CLang; now: number; L: (k: CKey) => string }) {
  const k = clientKpi({ id: '_', name: j.customer, jobName: j.customer } as Client, [j], [], now, loadTariffsCached());
  if (!k.next) return <span className="c-muted">{L('nothingDue')}</span>;
  const n = k.next;
  const label = n.kind === 'over' ? L('over') : n.kind === 'cutoff' ? L('cutoff') : L('free');
  return <span className={`c-dl ${n.level}`}>{label} <bdi className="mono">{n.kind === 'over' ? `+${num(lang, Math.ceil(-n.ms / DAY))} ${lang === 'fa' ? 'روز' : lang === 'ar' ? 'يوم' : 'd'}` : dur(lang, n.ms, n.kind === 'cutoff')}</bdi></span>;
}
let tariffCache: ReturnType<typeof loadTariffs> | null = null;
const loadTariffsCached = () => (tariffCache ??= loadTariffs());

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`c-field ${wide ? 'wide' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function ClientForm({ c, L, lang, onClose, onSaved }: { c: Client; L: (k: CKey) => string; lang: CLang; onClose: () => void; onSaved: (id: string) => void }) {
  const [d, setD] = useState<Client>(c);
  const [err, setErr] = useState<string | null>(null);
  const up = <K extends keyof Client>(k: K, v: Client[K]) => setD((x) => ({ ...x, [k]: v }));
  const txt = (k: 'name' | 'contactName' | 'phone' | 'email' | 'address' | 'paymentTerms', testid?: string) => (
    <input className="c-in" value={d[k]} onChange={(e: ChangeEvent<HTMLInputElement>) => up(k, e.target.value)} data-testid={testid} />
  );
  const save = () => {
    if (!d.name.trim()) return setErr(L('required'));
    const rec: Client = { ...d, name: d.name.trim(), lines: d.agents.filter((a) => a.type === 'line' && a.rank !== 'avoid').map((a) => a.name) };
    if (!rec.jobName && c.name) rec.jobName = c.name; // keep the link to existing jobs when renamed
    store.upsertClient(rec);
    onSaved(rec.id);
  };
  return (
    <div className="c-modal-bg" onClick={onClose}>
      <div className="q-panel c-modal" role="dialog" aria-label={L('client')} onClick={(e) => e.stopPropagation()} dir={(lang === 'fa' || lang === 'ar') ? 'rtl' : 'ltr'} data-testid="client-form">
        <div className="q-head"><h2>{c.name ? `${L('edit')} · ${c.name}` : L('addClient')}</h2><span className="c-muted">{L(isLive() ? 'savedLive' : 'savedLocal')}</span></div>
        <div className="c-form">
          <Field label={L('company')}>{txt('name', 'cf-name')}</Field>
          <Field label={L('contactName')}>{txt('contactName')}</Field>
          <PhoneField label={L('phone')} value={d.phone} onChange={(v) => up('phone', v)} testid="cf-phone" />
          <PhoneField label={wt(lang, 'waNumber')} hint={wt(lang, 'sameAsPhone')} value={d.whatsapp ?? ''} onChange={(v) => up('whatsapp', v)} testid="cf-whatsapp" />
          <Field label={L('email')}>{txt('email')}</Field>
          <Field label={L('address')} wide>{txt('address')}</Field>
          <Field label={`${L('clearanceAgent')} · ${L('name')}`}><input className="c-in" value={d.clearanceAgent.name} onChange={(e) => up('clearanceAgent', { ...d.clearanceAgent, name: e.target.value })} /></Field>
          <PhoneField label={`${L('clearanceAgent')} · ${L('phone')}`} value={d.clearanceAgent.phone} onChange={(v) => up('clearanceAgent', { ...d.clearanceAgent, phone: v })} testid="cf-broker-phone" />
          <PhoneField label={`${L('clearanceAgent')} · ${wt(lang, 'waNumber')}`} hint={wt(lang, 'sameAsPhone')} value={d.clearanceAgent.whatsapp ?? ''} onChange={(v) => up('clearanceAgent', { ...d.clearanceAgent, whatsapp: v })} testid="cf-broker-wa" />
          <span className="c-field" aria-hidden="true" />
          <Field label={`${L('baContact')} · ${L('name')}`}><input className="c-in" value={d.bandarAbbas.name} onChange={(e) => up('bandarAbbas', { ...d.bandarAbbas, name: e.target.value })} /></Field>
          <PhoneField label={`${L('baContact')} · ${L('phone')}`} value={d.bandarAbbas.phone} onChange={(v) => up('bandarAbbas', { ...d.bandarAbbas, phone: v })} testid="cf-office-phone" />
          <PhoneField label={`${L('baContact')} · ${wt(lang, 'waNumber')}`} hint={wt(lang, 'sameAsPhone')} value={d.bandarAbbas.whatsapp ?? ''} onChange={(v) => up('bandarAbbas', { ...d.bandarAbbas, whatsapp: v })} testid="cf-office-wa" />
          <span className="c-field" aria-hidden="true" />
          <Field label={L('language')}>
            <select className="c-in" value={d.lang} onChange={(e) => up('lang', e.target.value as CLang)}>
              <option value="en">EN</option><option value="es">ES</option><option value="fa">FA</option><option value="ar">AR</option>
            </select>
          </Field>
          <Field label={L('incoterm')}>
            <select className="c-in" value={d.incoterm} onChange={(e) => up('incoterm', e.target.value)}>
              {INCOTERMS.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </Field>
          <Field label={`${L('margin')} %`}><input className="c-in" type="number" min={0} max={60} value={d.marginPct} onChange={(e) => up('marginPct', Math.max(0, Math.min(60, Number(e.target.value) || 0)))} data-testid="cf-margin" /></Field>
          <Field label={L('freeTimeReq')}>
            <select className="c-in" value={d.freeTimeRequest ?? ''} onChange={(e) => up('freeTimeRequest', (e.target.value ? Number(e.target.value) : null) as Client['freeTimeRequest'])}>
              <option value="">—</option><option value="10">10</option><option value="14">14</option><option value="21">21</option>
            </select>
          </Field>
          <Field label={L('payment')} wide>{txt('paymentTerms')}</Field>
          <Field label={L('notes')} wide><textarea className="c-in" rows={2} value={d.notes} onChange={(e) => up('notes', e.target.value)} /></Field>
        </div>
        <h3 className="c-form-h">{L('lanesH')}</h3>
        <p className="c-muted c-small">{L('lanesNote')}</p>
        <LanesEditor lanes={d.lanes} onChange={(l) => up('lanes', l)} lang={lang} testid="cf-lanes" clientId={d.id} />
        <h3 className="c-form-h">{L('agents')}</h3>
        <p className="c-muted c-small">{L('agentsNote')}</p>
        <AgentsEditor agents={d.agents} onChange={(a) => up('agents', a)} lang={lang} testid="cf-agents" />
        {err && <div className="q-amber">{err}</div>}
        <div className="c-form-actions">
          {c.name && !c.sample && <button type="button" className="btn sm ghost" onClick={() => { if (window.confirm(`Delete ${c.name} from this browser?`)) { store.removeClient(c.id); onClose(); } }}>{L('remove')}</button>}
          <span style={{ flex: 1 }} />
          <button type="button" className="btn sm ghost" onClick={onClose}>{L('cancel')}</button>
          <button type="button" className="btn sm primary" onClick={save} data-testid="cf-save">{L('save')}</button>
        </div>
      </div>
    </div>
  );
}

function CompanyForm({ co, L, lang, onClose }: { co: Company; L: (k: CKey) => string; lang: CLang; onClose: () => void }) {
  const [d, setD] = useState<Company>({ ...EMPTY_COMPANY, ...co });
  const up = <K extends keyof Company>(k: K, v: Company[K]) => setD((x) => ({ ...x, [k]: v }));
  const onLogo = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        // normalise to a small PNG so it fits in localStorage and jsPDF
        const scale = Math.min(1, 480 / img.width, 200 / img.height);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const cv = document.createElement('canvas');
        cv.width = w;
        cv.height = h;
        cv.getContext('2d')!.drawImage(img, 0, 0, w, h);
        setD((x) => ({ ...x, logo: cv.toDataURL('image/png'), logoW: w, logoH: h }));
      };
      img.src = String(r.result);
    };
    r.readAsDataURL(f);
  };
  return (
    <div className="c-modal-bg" onClick={onClose}>
      <div className="q-panel c-modal" role="dialog" aria-label={L('yourCompany')} onClick={(e) => e.stopPropagation()} dir={(lang === 'fa' || lang === 'ar') ? 'rtl' : 'ltr'} data-testid="company-form">
        <div className="q-head"><h2>{L('yourCompany')}</h2><span className="c-muted">{L('companyHint')}</span></div>
        <ComplianceNote lang={lang} />
        <div className="c-form">
          <Field label={L('company')}><input className="c-in" value={d.name} onChange={(e) => up('name', e.target.value)} data-testid="co-name" /></Field>
          <Field label={`${L('preparedBy')} · ${L('contactName')}`}><input className="c-in" value={d.contactName} onChange={(e) => up('contactName', e.target.value)} data-testid="co-contact" /></Field>
          <Field label={L('email')}><input className="c-in" value={d.email} onChange={(e) => up('email', e.target.value)} data-testid="co-email" /></Field>
          <PhoneField label={L('phone')} value={d.phone} onChange={(v) => up('phone', v)} testid="co-phone" />
          <Field label={L('address')} wide><input className="c-in" value={d.address} onChange={(e) => up('address', e.target.value)} /></Field>
          <Field label={L('logo')} wide>
            <span className="c-logo-row">
              {d.logo ? <img src={d.logo} alt="" className="c-logo lg" /> : <LogoMark size={48} className="c-logo-ph-mark" />}
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onLogo} data-testid="co-logo" />
              {d.logo && <button type="button" className="btn sm ghost" onClick={() => setD((x) => ({ ...x, logo: null }))}>{L('removeLogo')}</button>}
            </span>
          </Field>
        </div>
        <WaServerSettings compact />
        <div className="c-form-actions">
          <span style={{ flex: 1 }} />
          <button type="button" className="btn sm ghost" onClick={onClose}>{L('cancel')}</button>
          <button type="button" className="btn sm primary" onClick={() => { store.setCompany(d); onClose(); }} data-testid="co-save">{L('save')}</button>
        </div>
      </div>
    </div>
  );
}

/** WhatsApp from the client page: the client's contacts; job templates use the job with the largest open balance. */
function ClientWa({ c, k, now }: { c: Client; k: ClientKpi; now: number }) {
  const { company, quotes } = useStore();
  const tariffs = useTariffs();
  useBilling();
  const job = [...k.jobs].sort((a, b) => balanceFor(b).open - balanceFor(a).open)[0] ?? null;
  const ctx = job ? jobCtx(job, { company, ledger: ledgerFor(job), tariffs, now, openBalance: balanceFor(job).open || undefined }) : { company: company.name, now };
  const q = quotes.filter((x) => x.clientId === c.id).sort((a, b) => b.at - a.at)[0];
  const quoteText = q ? `${q.route} · ${q.mode} ${q.units}\n${q.options.map((o) => `${o.carrier.replace(/^Sample /, '')}: ${q.currency} ${o.sell.toLocaleString('en-US')}${o.transit != null ? ` · ${o.transit} d` : ''}`).join('\n')}` : '';
  return (
    <WaButton
      className="sm ghost"
      recipients={clientRecipients(c)}
      templates={['general', 'quoteSent', 'invoiceIssued', 'payBeforeBl', 'freeTime', 'arrival']}
      ctx={{ ...ctx, quoteText, quoteRef: q?.id }}
      defaultTpl="general"
      link={{ clientId: c.id, jobId: null }}
      fallbackLang={c.lang}
      testid="client"
    />
  );
}
function ClientWaLog({ c }: { c: Client }) {
  const [lang] = useUiLang();
  const log = waFor(useWaLog(), 'clientId', c.id);
  return (
    <section className="q-panel" aria-label={wt(lang, 'log')} data-testid="client-wa-log">
      <div className="q-head"><h2>{wt(lang, 'log')} · {num(lang, log.length)}</h2></div>
      <p className="c-muted c-small">{wt(lang, 'logNote')}</p>
      <WaLogList entries={log} testid="client-wa-list" />
    </section>
  );
}
