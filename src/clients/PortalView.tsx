import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { type Job } from '../jobs/data';
import { useJobs } from '../jobs/store';
import { dur, fmtDay, fmtWhen, num, usd } from '../jobs/i18n';
import { CHARGE_LABEL, chargeAmount, chequeAmount, clock } from '../jobs/logic';
import { stepIndex } from '../jobs/steps';
import { useTariffs } from '../jobs/tariffs';
import { AgentsEditor } from './Agents';
import { LanesEditor } from './Lanes';
import { jobMsds } from './lanes';
import { MsdsSlot } from './Msds';
import { ct } from './i18n';
import { DEMO_PASSWORD, MILESTONES, demoLogin, pt, type PKey } from './portal';
import { store, useStore, type CLang, type Client } from './store';
import { jobsStore } from '../jobs/store';
import { backendAvailable } from '../backend/config';
import { signIn, signOut, useSession, getSession } from '../backend/session';
import { errText } from '../backend/AuthBar';
import './clients.css';

const SESSION = 'fd.portal.session';
const APPROVALS = 'fd.portal.approvals.v1';
const LIDX: Record<CLang, 0 | 1 | 2> = { en: 0, es: 1, fa: 2 };

function loadApprovals(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(APPROVALS) || '{}');
  } catch {
    return {};
  }
}

export function PortalView() {
  const { clients, company, quotes } = useStore();
  const [sessionId, setSessionId] = useState<string | null>(() => sessionStorage.getItem(SESSION));
  const client = clients.find((c) => c.id === sessionId) ?? null;
  const [lang, setLang] = useState<CLang>(client?.lang ?? 'en');
  const logout = () => {
    sessionStorage.removeItem(SESSION);
    setSessionId(null);
  };
  const login = (c: Client) => {
    sessionStorage.setItem(SESSION, c.id);
    setSessionId(c.id);
    setLang(c.lang);
  };
  const sess = useSession();
  if (sess.mode === 'live' && sess.role === 'client') {
    const mine = clients.find((x) => x.id === sess.clientId) ?? null;
    if (!mine) return <div className="portal-view jobs-view" data-testid="portal-loading"><p className="c-muted">{pt(lang, 'loading')}</p></div>;
    return <Portal c={mine} lang={lang} setLang={setLang} onLogout={() => void signOut()} quotes={quotes} company={company} live />;
  }
  if (!client) return <Login clients={clients} lang={lang} setLang={setLang} onLogin={login} companyName={company.name} />;
  return <Portal c={client} lang={lang} setLang={setLang} onLogout={logout} quotes={quotes} company={company} live={sess.mode === 'live'} />;
}

function LangToggle({ lang, setLang }: { lang: CLang; setLang: (l: CLang) => void }) {
  return (
    <div className="q-lang j-lang" role="group" aria-label="Language">
      {(['en', 'es', 'fa'] as CLang[]).map((l) => (
        <button key={l} type="button" className={lang === l ? 'active' : ''} onClick={() => setLang(l)} data-testid={`portal-lang-${l}`}>
          {l === 'fa' ? 'FA فا' : l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function Login({ clients, lang, setLang, onLogin, companyName }: { clients: Client[]; lang: CLang; setLang: (l: CLang) => void; onLogin: (c: Client) => void; companyName: string }) {
  const L = (k: PKey) => pt(lang, k);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(false);
  const [liveErr, setLiveErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const c = clients.find((x) => demoLogin(x) && demoLogin(x) === email.trim().toLowerCase());
    if (c && pw === DEMO_PASSWORD) return onLogin(c);
    if (!backendAvailable) return setErr(true);
    setBusy(true);
    try {
      await signIn(email, pw);
    } catch {
      setLiveErr(getSession().error ?? 'bad-login');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="portal-view jobs-view" dir={lang === 'fa' ? 'rtl' : 'ltr'} lang={lang} data-testid="portal-login">
      <div className="p-demo" data-testid="portal-demo-warning">⚠ {L('demoWarn')}</div>
      <div className="p-login-wrap">
        <form className="q-panel p-login" onSubmit={submit}>
          <div className="p-brand">
            <span className="c-logo-ph">FD</span>
            <div>
              <strong>{companyName || 'ForwardDesk'}</strong>
              <div className="c-muted">{L('portal')}</div>
            </div>
            <span style={{ flex: 1 }} />
            <LangToggle lang={lang} setLang={setLang} />
          </div>
          <h2>{L('signIn')}</h2>
          <label className="c-field"><span>{L('email')}</span><input className="c-in" type="email" autoComplete="off" value={email} onChange={(e) => { setEmail(e.target.value); setErr(false); setLiveErr(null); }} data-testid="portal-email" dir="ltr" /></label>
          <label className="c-field"><span>{L('password')}</span><input className="c-in" type="password" autoComplete="off" value={pw} onChange={(e) => { setPw(e.target.value); setErr(false); setLiveErr(null); }} data-testid="portal-password" dir="ltr" /></label>
          {err && <div className="q-amber c-small" data-testid="portal-error">{L('bad')}</div>}
          {liveErr && <div className="q-amber c-small" data-testid="portal-error">{liveErr === 'bad-login' ? L('bad') : errText(lang, liveErr)}</div>}
          <button type="submit" className="btn primary" disabled={busy} data-testid="portal-submit">{L('login')}</button>
          {backendAvailable && <p className="c-muted c-small">{L('realAcct')}</p>}
        </form>
        <div className="q-panel p-creds" data-testid="portal-creds">
          <div className="q-head"><h2>{L('demoCreds')}</h2><span className="j-sample sm">{L('sample')}</span></div>
          <table>
            <tbody>
              {clients.filter((c) => demoLogin(c)).map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td><bdi className="mono" dir="ltr">{demoLogin(c)}</bdi></td>
                  <td><bdi className="mono">{DEMO_PASSWORD}</bdi></td>
                  <td><button type="button" className="btn sm ghost" onClick={() => { setEmail(demoLogin(c)); setPw(DEMO_PASSWORD); setErr(false); }} data-testid={`portal-use-${c.id}`}>{L('use')}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Portal({ c, lang, setLang, onLogout, quotes, company, live = false }: { c: Client; lang: CLang; setLang: (l: CLang) => void; onLogout: () => void; quotes: ReturnType<typeof useStore>['quotes']; company: ReturnType<typeof useStore>['company']; live?: boolean }) {
  const L = (k: PKey) => pt(lang, k);
  const [now, setNow] = useState(() => Date.now());
  const jobsAll: Job[] = useJobs();
  const tariffs = useTariffs();
  const [approvals, setApprovals] = useState<Record<string, number>>(loadApprovals);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const jobs = useMemo(() => jobsAll.filter((j) => j.customer === (c.jobName ?? c.name)), [jobsAll, c]);
  const mine = quotes.filter((q) => q.clientId === c.id).sort((a, b) => b.at - a.at);
  const approve = (id: string) => {
    if (live) return jobsStore.approveDraftBl(id);
    const next = { ...approvals, [id]: Date.now() };
    setApprovals(next);
    localStorage.setItem(APPROVALS, JSON.stringify(next));
  };
  const D = L('days');

  const toPay = jobs.flatMap((j) => [
    ...j.charges.filter((ch) => !ch.paid).map((ch) => ({ job: j, label: CHARGE_LABEL[ch.key][LIDX[lang]], amount: chargeAmount(j, ch, tariffs, now), est: ch.key === 'demurrage' })),
    ...(j.collect && !j.collect.collected ? [{ job: j, label: lang === 'fa' ? 'کرایه کالکت' : lang === 'es' ? 'Flete collect' : 'Collect freight', amount: j.collect.amount, est: false }] : []),
  ]).filter((x) => x.amount > 0);
  const cheques = jobs.flatMap((j) => j.cheques.filter((ch) => ch.status === 'held').map((ch) => ({ job: j, ch, amount: chequeAmount(j, ch, tariffs) })));

  return (
    <div className="portal-view jobs-view" dir={lang === 'fa' ? 'rtl' : 'ltr'} lang={lang} data-testid="portal">
      {live ? <div className="p-live" data-testid="portal-live-note">{L('liveNote')}</div> : <div className="p-demo">⚠ {L('demoWarn')}</div>}
      <div className="q-panel p-top">
        {company.logo ? <img src={company.logo} alt="" className="c-logo" /> : <span className="c-logo-ph">FD</span>}
        <div className="p-top-txt">
          <strong>{company.name || 'ForwardDesk'}</strong> · {L('portal')}
          <div className="c-muted">{L('welcome')}, <strong data-testid="portal-client">{c.name}</strong> {c.sample && <span className="j-sample sm">{L('sample')}</span>}</div>
        </div>
        <LangToggle lang={lang} setLang={setLang} />
        <button type="button" className="btn sm ghost" onClick={onLogout} data-testid="portal-logout">{L('logout')}</button>
      </div>

      <div className="p-main">
        <div className="p-col">
          <section className="q-panel" data-testid="portal-shipments">
            <div className="q-head"><h2>{L('shipments')} · {num(lang, jobs.length)}</h2></div>
            {jobs.length === 0 && <p className="c-muted">{L('noShip')}</p>}
            {jobs.map((j) => {
              const ms = MILESTONES[j.dir];
              const idx = stepIndex(j.step);
              const cur = ms.findIndex((m) => idx >= m.from && idx <= m.to);
              const ks = j.containers.map((box) => clock(box, now, tariffs));
              const running = ks.filter((k) => k.state === 'running');
              const worst = running.length ? running.reduce((a, b) => (b.remainingMs < a.remainingMs ? b : a)) : null;
              const stoppedOver = ks.filter((k) => k.state === 'stopped' && k.daysOver > 0);
              const draft = j.docs.find((d) => d.key === 'draftBl');
              const orig = j.docs.find((d) => d.key === 'originalBl');
              const arrival = j.docs.find((d) => d.key === 'arrival');
              const doDoc = j.docs.find((d) => d.key === 'do');
              const liveApproved = live ? j.portal?.draftBlApprovedAt : undefined;
              const draftApproved = draft?.status === 'done' || (live ? !!liveApproved : approvals[j.id]);
              return (
                <article key={j.id} className="p-ship" data-testid={`portal-job-${j.id}`}>
                  <header>
                    <bdi className="mono c-muted">{j.id}</bdi>
                    <strong><bdi>{j.pol} → {j.pod}</bdi></strong>
                    <span className="c-muted">{j.commodity} · {num(lang, j.containers.length || 0)} {L('containers')}</span>
                  </header>
                  <div className="p-steps" aria-label={L('status')}>
                    {ms.map((m, i) => (
                      <span key={i} className={i < cur ? 'done' : i === cur ? 'cur' : ''}>
                        <i />
                        <em>{m[lang]}</em>
                      </span>
                    ))}
                  </div>
                  <dl className="p-facts">
                    <div><dt>{L('status')}</dt><dd>{ms[cur]?.[lang] ?? '—'}</dd></div>
                    <div><dt>{j.vessel?.sailed ? L('sailed') : L('eta')}</dt><dd>{j.vessel ? (j.vessel.sailed ? fmtDay(lang, j.vessel.sailed) : fmtWhen(lang, j.vessel.eta)) : '—'}</dd></div>
                    <div>
                      <dt>{L('freeTime')}</dt>
                      <dd data-testid={`portal-ft-${j.id}`}>
                        {worst ? (
                          worst.daysOver > 0 ? (
                            <span className="c-red">{L('overBy')} {num(lang, worst.daysOver)} {D}</span>
                          ) : (
                            <span className={worst.level === 'amber' ? 'c-amber' : ''}><bdi className="mono">{dur(lang, worst.remainingMs)}</bdi> {L('left')} · {fmtDay(lang, worst.end!)}</span>
                          )
                        ) : stoppedOver.length ? (
                          <span className="c-red">{L('overBy')} {num(lang, Math.max(...stoppedOver.map((k) => k.daysOver)))} {D}</span>
                        ) : ks.some((k) => k.state === 'stopped') ? (
                          L('stopped')
                        ) : (
                          L('notStarted')
                        )}
                      </dd>
                    </div>
                  </dl>
                  {worst && worst.daysOver > 0 && <div className="p-warn">{L('overNote')}</div>}
                  <div className="p-docs">
                    <strong>{L('docs')}</strong>
                    {draft && (
                      <span className={`p-doc ${draftApproved ? 'ok' : draft.status === 'waiting' ? 'act' : ''}`}>
                        {L('draftBl')}: {draftApproved ? (draft.status === 'done' ? L('approved') : live ? L('approvedLive') : approvals[j.id] ? L('approvedDemo') : L('approved')) : draft.status === 'waiting' ? L('toApprove') : L('notYet')}
                        {!draftApproved && draft.status === 'waiting' && (
                          <button type="button" className="btn sm primary" onClick={() => approve(j.id)} data-testid={`portal-approve-${j.id}`}>{L('approve')}</button>
                        )}
                      </span>
                    )}
                    {orig && (
                      <span className={`p-doc ${orig.status === 'done' ? 'ok' : orig.status === 'blocked' ? 'act' : ''}`}>
                        {L('originalBl')}: {orig.status === 'done' ? L('released') : orig.status === 'blocked' ? L('heldPay') : L('notYet')}
                      </span>
                    )}
                    {arrival && <span className={`p-doc ${arrival.status === 'done' ? 'ok' : ''}`}>{L('arrival')}: {arrival.status === 'done' ? L('ready') : L('notYet')}</span>}
                    {doDoc && <span className={`p-doc ${doDoc.status === 'done' ? 'ok' : ''}`}>{L('do')}: {doDoc.status === 'done' ? L('released') : L('notYet')}</span>}
                  </div>
                  {(() => {
                    const m = jobMsds(c.lanes, j);
                    if (m.need !== 'required' && !m.meta && !m.lane) return null;
                    return m.lane ? (
                      <MsdsSlot hs={m.hs} dg={m.lane.dg ? 'yes' : null} meta={m.meta} lang={lang} testid={`portal-msds-${j.id}`} clientId={c.id} onChange={(meta) => store.setLanes(c.id, c.lanes.map((l) => (l.id === m.lane!.id ? { ...l, msds: meta } : l)))} />
                    ) : null;
                  })()}
                </article>
              );
            })}
          </section>

          <section className="q-panel" data-testid="portal-quotes">
            <div className="q-head"><h2>{L('quotes')} · {num(lang, mine.length)}</h2></div>
            {mine.length === 0 && <p className="c-muted">{L('noQuotes')}</p>}
            {mine.map((q) => (
              <div key={q.id} className="p-quote" data-testid={`portal-quote-${q.id}`}>
                <div className="p-quote-head">
                  <bdi className="mono c-muted">{q.id}</bdi>
                  <strong><bdi>{q.route}</bdi></strong>
                  <span className="c-muted"><bdi>{q.mode} · {q.units}</bdi> · {fmtDay(lang, q.at)}</span>
                  <span style={{ flex: 1 }} />
                  {q.status === 'won' && <span className="p-accepted">✓ {L('accepted')}{q.acceptedOption ? ` · ${q.acceptedOption.replace(/^Sample /, '')}` : ''}</span>}
                  {q.status === 'lost' && <span className="c-muted">{L('declined')}</span>}
                </div>
                <div className="p-opts">
                  {q.options.map((o, i) => (
                    <div key={i} className={`p-opt ${q.status === 'won' && q.acceptedOption === o.carrier ? 'acc' : ''}`}>
                      <span className="c-muted">{L('option')} {num(lang, i + 1)}</span>
                      <strong>{o.carrier.replace(/^Sample /, '')}</strong>
                      <span><bdi className="mono">{usd(lang, o.sell)}</bdi> {q.currency !== 'USD' ? q.currency : ''}{o.transit != null ? ` · ${num(lang, o.transit)} ${D}` : ''}</span>
                      {q.status === 'sent' && (
                        <button type="button" className="btn sm primary" onClick={() => store.setQuoteStatus(q.id, 'won', o.carrier, 'portal')} data-testid={`portal-accept-${q.id}-${i}`}>{L('accept')}</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {mine.some((q) => q.status === 'sent') && <p className="c-muted c-small">{L(live ? 'acceptNoteLive' : 'acceptNote')}</p>}
          </section>
        </div>

        <div className="p-col">
          <section className="q-panel" data-testid="portal-charges">
            <div className="q-head"><h2>{L('charges')}</h2></div>
            {toPay.length === 0 ? <p className="c-muted">{L('noCharges')}</p> : (
              <>
                <table className="p-table">
                  <tbody>
                    {toPay.map((x, i) => (
                      <tr key={i}><td><bdi className="mono c-muted">{x.job.id}</bdi></td><td>{x.label}{x.est ? ' *' : ''}</td><td className="num"><bdi className="mono">{usd(lang, x.amount)}</bdi></td></tr>
                    ))}
                    <tr className="tot"><td /><td>{L('total')}</td><td className="num"><bdi className="mono">{usd(lang, toPay.reduce((s, x) => s + x.amount, 0))}</bdi></td></tr>
                  </tbody>
                </table>
                <p className="c-muted c-small">{toPay.some((x) => x.est) ? '* estimate (sample tariff), the line calculates the final amount. ' : ''}{L('payNote')}</p>
              </>
            )}
          </section>
          <section className="q-panel" data-testid="portal-cheques">
            <div className="q-head"><h2>{L('cheques')}</h2></div>
            {cheques.length === 0 ? <p className="c-muted">{L('noCheques')}</p> : (
              <>
                <table className="p-table">
                  <tbody>
                    {cheques.map((x, i) => (
                      <tr key={i}><td><bdi className="mono c-muted">{x.job.id}</bdi></td><td>{x.ch.container ? <bdi className="mono">{x.ch.container}</bdi> : null} {L('heldBy')} {x.ch.holder}</td><td className="num"><bdi className="mono">{usd(lang, x.amount)}</bdi></td></tr>
                    ))}
                  </tbody>
                </table>
                <p className="c-muted c-small">{L('chequeBack')}</p>
              </>
            )}
          </section>
          <section className="q-panel" data-testid="portal-lanes">
            <div className="q-head"><h2>{ct(lang, 'lanesH')}</h2></div>
            <p className="c-muted c-small">{ct(lang, 'lanesNote')}</p>
            <LanesEditor lanes={c.lanes} onChange={(l) => store.setLanes(c.id, l)} lang={lang} portal testid="portal-lanes-ed" clientId={c.id} />
          </section>
          <section className="q-panel" data-testid="portal-agents">
            <div className="q-head"><h2>{(lang === 'fa' ? 'نمایندگان و همکاران ترجیحی شما' : lang === 'es' ? 'Tus agentes y socios preferidos' : 'Your preferred agents & partners')}</h2></div>
            <p className="c-muted c-small">{lang === 'fa' ? 'خودتان اضافه، ویرایش و رتبه‌بندی کنید. فورواردر در قیمت‌دهی از این فهرست استفاده می‌کند' + (live ? '.' : ' (فقط در همین مرورگر).') : lang === 'es' ? 'Añádelos, edítalos y ordénalos tú. Tu transitario los usa al cotizar' + (live ? '.' : ' (solo en este navegador).') : 'Add, edit and rank them yourself. Your forwarder uses this list when quoting' + (live ? '.' : ' (saved in this browser only).')}</p>
            <AgentsEditor agents={c.agents} onChange={(a) => store.setAgents(c.id, a)} lang={lang} testid="portal-agents" />
          </section>
          <p className="c-muted c-small">{L('contactUs')} {company.contactName || company.name || L('yourForwarder')}{company.email ? ` · ${company.email}` : ''}{company.phone ? ` · ${company.phone}` : ''}</p>
        </div>
      </div>
    </div>
  );
}
