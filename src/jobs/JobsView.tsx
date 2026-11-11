import { JobWaThreads } from '../inbox/JobThreads';
import { useUiLang } from '../ui/lang';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { JobDocs } from '../billing/JobDocs';
import { JobBilling } from '../billing/JobBilling';
import { bt } from '../billing/i18n';
import { collectState, releaseBlockFor, useBilling } from '../billing/store';
import type { JobBalance } from '../billing/model';
import { type Doc, type Job } from './data';
import { jobsStore, useJobs } from './store';
import { isLive } from '../backend/bridge';
import { GLOSSARY, unitTx, dur, fmtDay, fmtWhen, num, tr, usd, type Key } from './i18n';
import { DAY, chequeAmount, clock, cutoff, jobAlerts, nextDeadline, summarize } from './logic';
import { PHASES, stepDef, stepIndex, stepsFor, type Lang } from './steps';
import { DEFAULT_TARIFFS, TARIFF_ROWS, loadTariffs, saveTariffs, useTariffs, type TariffKey, type Tariffs } from './tariffs';
import { agentForPort, clientForJob, useStore } from '../clients/store';
import { jobMsds } from '../clients/lanes';
import { MsdsChip, MsdsSlot } from '../clients/Msds';
import { store as clientStore, type Client } from '../clients/store';
import { useAgentsDb } from '../agents/db';
import { ledgerFor } from '../billing/store';
import { WaButton, WaIcon, WaLogItem } from '../whatsapp/WhatsApp';
import { agentRecipients, clientRecipients, jobCtx } from '../whatsapp/context';
import { JOB_TPLS, suggestTpl } from '../whatsapp/templates';
import { useWaLog, waFor } from '../whatsapp/log';
import { wt } from '../whatsapp/i18n';
import type { Agent } from '../clients/store';
import './jobs.css';

const LIDX: Record<Lang, 0 | 1 | 2 | 3> = { en: 0, es: 1, fa: 2, ar: 3 };

export function JobsView({ onDraftQuote, onOpenClient, openRequest }: { onDraftQuote: (text: string, customer?: string) => void; onOpenClient?: (customer: string) => void; openRequest?: { id: string; n: number } | null }) {
  const [lang] = useUiLang<Lang>();
  const { clients } = useStore();
  /** E: agent at the port of discharge; I: agent at the port of loading (I2, I4–I8). */
  const agentOf = (j: Job) => agentForPort(clientForJob(clients, j.customer), j.dir === 'import' ? j.pol : j.pod);
  const [now, setNow] = useState(() => Date.now());
  const jobs = useJobs();
  const tariffs = useTariffs();
  const setTariffs = (u: Tariffs | ((t: Tariffs) => Tariffs)) => saveTariffs(typeof u === 'function' ? u(loadTariffs()) : u);
  const [openId, setOpenId] = useState<string | null>(openRequest?.id ?? null);
  const [filter, setFilter] = useState<'all' | 'export' | 'import'>('all');
  const [newJob, setNewJob] = useState(false);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    if (openRequest) setOpenId(openRequest.id);
  }, [openRequest?.n]); // eslint-disable-line react-hooks/exhaustive-deps
  const custLink = (name: string): ReactNode =>
    onOpenClient ? (
      <span className="j-custlink" role="link" title={`${name} — client dashboard`} onClick={(e) => { e.stopPropagation(); onOpenClient(name); }} data-testid={`custlink-${name}`}>
        {name}
      </span>
    ) : (
      name
    );
  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenId(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId]);

  const L = (k: Key) => tr(lang, k);
  /** Label in the UI language only (Persian terms appear only when the UI is FA). */
  const T = (k: Key): ReactNode => L(k);
  const bill = useBilling();
  const blockOf = (j: Job) => releaseBlockFor(j, bill, now);
  const sum = useMemo(() => summarize(jobs, now, tariffs, (j) => { const b = releaseBlockFor(j, bill, now); return b.blocking ? b.open : 0; }), [jobs, now, tariffs, bill]);
  const shown = jobs.filter((j) => filter === 'all' || j.dir === filter);
  const open = jobs.find((j) => j.id === openId) ?? null;
  const stepName = (code: string) => stepDef(code)[lang];

  // ── Deadline tracker rows ──
  const tracker = useMemo(() => {
    const rows: { job: Job; kind: 'cutoff' | 'free' | 'over' | 'stopped'; level: 'red' | 'amber' | 'ok' | 'idle'; ms: number; used: number; text: string; sub: string; right?: string }[] = [];
    for (const j of jobs) {
      const co = cutoff(j);
      if (co != null) {
        const total = 72 * 3600000;
        rows.push({ job: j, kind: 'cutoff', level: co < now ? 'red' : co - now < 72 * 3600000 ? 'amber' : 'ok', ms: co - now, used: Math.min(1, Math.max(0, 1 - (co - now) / total)), text: `${L('docCutoff')} · E18`, sub: `${L('vessel')} ${j.vessel?.name} · ${L('eta')} ${fmtWhen(lang, j.vessel!.eta)}` });
      }
      const ks = j.containers.map((c) => ({ c, k: clock(c, now, tariffs) })).filter((x) => x.k.state === 'running');
      if (ks.length) {
        const worst = ks.reduce((a, b) => (b.k.remainingMs < a.k.remainingMs ? b : a));
        const fd = worst.c.freeDays ?? 10;
        const used = Math.min(1, (fd * DAY - worst.k.remainingMs) / (fd * DAY));
        const over = worst.k.daysOver > 0;
        const cost = ks.reduce((s, x) => s + x.k.cost, 0);
        rows.push({
          job: j, kind: over ? 'over' : 'free', level: worst.k.level === 'idle' ? 'ok' : worst.k.level, ms: worst.k.remainingMs, used,
          text: `${L('freeTime')} ${num(lang, fd)} ${lang === 'fa' ? 'روز' : lang === 'ar' ? 'يوم' : lang === 'es' ? 'días' : 'days'} · ${j.dir === 'export' ? 'E8' : 'I14'} · ${num(lang, ks.length)} ${L('cntr')}`,
          sub: over ? `${num(lang, worst.k.daysOver)} ${lang === 'fa' ? 'روز' : lang === 'ar' ? 'يوم' : 'd'} ${L('over')} · ${usd(lang, cost)} ${L('estDemurrage')}${j.docDelay ? ` · ${L('docDelay')}` : ''}` : `${L('freeTime')} → ${fmtDay(lang, worst.k.end!)}`,
        });
      }
      const stopped = j.containers.map((c) => clock(c, now, tariffs)).filter((k) => k.state === 'stopped' && k.daysOver > 0);
      if (stopped.length) {
        const cost = stopped.reduce((s, k) => s + k.cost, 0);
        rows.push({ job: j, kind: 'stopped', level: 'red', ms: 0, used: 1, right: usd(lang, cost), text: `${L('demurrage')} · ${j.dir === 'export' ? 'E21' : 'I15'} · ${num(lang, stopped.length)} ${L('cntr')}`, sub: `${num(lang, Math.max(...stopped.map((k) => k.daysOver)))} ${lang === 'fa' ? 'روز' : lang === 'ar' ? 'يوم' : 'd'} ${L('over')} (${L(j.dir === 'export' ? 'loaded' : 'returnedEmpty')}) · ${usd(lang, cost)} ${L('estDemurrage')}` });
      }
    }
    const rank = (r: (typeof rows)[number]) => (r.kind === 'over' ? -2e12 + r.ms : r.kind === 'stopped' ? -1e12 : r.ms);
    return rows.sort((a, b) => rank(a) - rank(b));
  }, [jobs, now, tariffs, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const blJobs = jobs.filter((j) => blockOf(j).blocking);
  const collectJobs = jobs.filter((j) => j.collect && stepIndex(j.step) >= 10);
  const collectOf = (j: Job) => collectState(j.id, bill) ?? { amount: j.collect?.amount ?? 0, collected: !!j.collect?.collected };
  const chequeJobs = jobs.filter((j) => j.cheques.length);

  return (
    <div className="jobs-view" dir={(lang === 'fa' || lang === 'ar') ? 'rtl' : 'ltr'} lang={lang}>
      <div className="j-top">
        <div className="j-title">
          {(!isLive() || jobs.some((j) => j.sample)) && <><span className="j-sample" data-testid="jobs-sample">{L('sampleData')}</span>
          <span className="j-note">{L('sampleNote')}</span></>}
        </div>
        <button type="button" className="btn sm primary" onClick={() => setNewJob(true)} data-testid="job-new">{L('newJob')}</button>
      </div>

      {newJob && <NewJobForm lang={lang} clients={clients} onClose={() => setNewJob(false)} onCreated={(id) => { setNewJob(false); setOpenId(id); }} />}
      <div className="j-summary" data-testid="jobs-summary">
        <Tile label={L('jobsLive')} value={num(lang, sum.jobsLive)} />
        <Tile label={T('inFreeTime')} value={num(lang, sum.inFreeTime)} />
        <Tile label={L('atRisk')} value={num(lang, sum.atRisk)} tone={sum.atRisk ? 'amber' : undefined} sub={sum.inDemurrage ? `${num(lang, sum.inDemurrage)} ${L('inDemurrage').toLowerCase()}` : undefined} subTone="red" />
        <Tile label={L('cutoffs72')} value={num(lang, sum.cutoffs72)} tone={sum.cutoffs72 ? 'amber' : undefined} />
        <Tile label={L('unpaidBl')} value={usd(lang, sum.unpaidBl)} tone={sum.unpaidBl ? 'amber' : undefined} />
        <Tile label={L('chequesHeld')} value={num(lang, sum.chequesHeld)} sub={usd(lang, sum.chequesValue)} />
      </div>

      <div className="j-main">
        <section className="q-panel j-board" aria-label={L('board')}>
          <div className="q-head">
            <h2>{L('board')}</h2>
            <div className="q-lang" role="group">
              {(['all', 'export', 'import'] as const).map((f) => (
                <button key={f} type="button" className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
                  {L(f)}
                </button>
              ))}
            </div>
          </div>
          <div className="j-rows" role="table">
            <div className="j-row j-row-head" role="row">
              <span>{L('job')}</span>
              <span>{L('route')} · {L('customer')}</span>
              <span>{L('step')}</span>
              <span>{L('containers')}</span>
              <span>{L('next')}</span>
            </div>
            {shown.map((j) => {
              const nd = nextDeadline(j, now, tariffs);
              const steps = stepsFor(j.dir);
              const cur = stepIndex(j.step);
              const holder = stepDef(j.step).holder;
              return (
                <button type="button" role="row" key={j.id} className={`j-row ${openId === j.id ? 'sel' : ''}`} onClick={() => setOpenId(j.id)} data-testid={`job-${j.id}`}>
                  <span className="j-c-id">
                    <bdi className="mono">{j.id}</bdi>
                    <span className="j-tags">
                      <span className={`j-dir ${j.dir}`}>{L(j.dir)}</span>
                      <span className={`j-owner ${holder}`}>{L(holder)}</span>
                    </span>
                  </span>
                  <span className="j-c-cust">
                    <strong>
                      <bdi>{j.pol} → {j.pod}</bdi>
                    </strong>
                    <span className="j-sub">
                      {custLink(j.customer)} · {j.commodity}
                      {j.portal?.draftBlApprovedAt && <span className="j-portal-ok" data-testid={`job-portal-ok-${j.id}`}> · ✓ {L('draftBl')}</span>}
                    </span>
                    <span className="j-sub">
                      {j.line}
                      {agentOf(j) && <span className="j-agent"> · {L('agent')}: {agentOf(j)!.name}</span>}
                      {(() => { const m = jobMsds(clientForJob(clients, j.customer)?.lanes, j); return m.need === 'required' ? <> <MsdsChip hs={m.hs} meta={m.meta} lang={lang} /></> : null; })()}
                    </span>
                  </span>
                  <span className="j-c-step">
                    <span className="j-stepname">
                      <bdi className={`j-code ${stepDef(j.step).critical ? 'crit' : ''}`}>{j.step}</bdi> {stepName(j.step)}
                    </span>
                    <span className="j-mini" aria-label={`${j.step} of ${steps.length}`}>
                      {steps.map((s, i) => (
                        <i key={s.code} className={`${i + 1 < cur ? 'done' : i + 1 === cur ? 'cur' : ''} ${s.critical ? 'crit' : ''}`} title={`${s.code} ${s[lang]}`} />
                      ))}
                    </span>
                  </span>
                  <span className="j-c-cntr">
                    {j.containers.length ? (
                      <>
                        <strong>
                          {num(lang, j.containers.length)} × {j.containers[0].size === '40HC' ? "40′HC" : `${j.containers[0].size}′`}
                          {j.containers[0].heavy ? (lang === 'fa' ? ' سنگین' : lang === 'ar' ? ' ثقيلة' : lang === 'es' ? ' pesado' : ' heavy') : ''}
                        </strong>
                        <bdi className="j-sub mono">
                          {j.containers[0].no}
                          {j.containers.length > 1 ? ` +${j.containers.length - 1}` : ''}
                        </bdi>
                      </>
                    ) : (
                      <>
                        <strong>{j.plannedEquipment}</strong>
                        <span className="j-sub">{L('notBooked')}</span>
                      </>
                    )}
                  </span>
                  <span className="j-c-next">
                    {nd ? (
                      <span className={`j-count ${nd.level}`}>
                        <span className="j-count-k">{nd.kind === 'cutoff' ? L('cutoff') : nd.kind === 'over' ? L('inDemurrage') : L('freeTime')}</span>
                        <bdi className="mono">{nd.kind === 'over' ? `+${num(lang, Math.ceil(-nd.ms / DAY))} ${lang === 'fa' ? 'روز' : lang === 'ar' ? 'يوم' : 'd'}` : dur(lang, nd.ms, nd.ms < 2 * DAY)}</bdi>
                      </span>
                    ) : (
                      <span className="j-sub">—</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          {!isLive() && <p className="j-foot">{L('buildOrder')}</p>}
        </section>

        <section className="q-panel j-tracker" aria-label={L('deadlines')} data-testid="deadline-tracker">
          <div className="q-head">
            <h2>{L('deadlines')}</h2>
            <span className="q-muted">E8 · E18 · E21 · I14–I16</span>
          </div>
          <ul className="j-dl">
            {tracker.map((r, i) => (
              <li key={i} className={`j-dl-item ${r.level}`}>
                <button type="button" onClick={() => setOpenId(r.job.id)}>
                  <span className="j-dl-top">
                    <bdi className="mono j-dl-id">{r.job.id}</bdi>
                    <span className="j-dl-what">{r.text}</span>
                    <bdi className={`mono j-dl-time ${r.level}`}>
                      {r.kind === 'over' ? `+${num(lang, Math.ceil(-r.ms / DAY))} ${lang === 'fa' ? 'روز' : lang === 'ar' ? 'يوم' : 'd'}` : r.kind === 'stopped' ? r.right : dur(lang, r.ms, r.ms < 2 * DAY)}
                    </bdi>
                  </span>
                  <span className="j-bar">
                    <i style={{ width: `${Math.round(r.used * 100)}%` }} />
                  </span>
                  <span className="j-dl-sub">{r.sub}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="q-panel j-money" aria-label={L('money')} data-testid="money-at-risk">
        <div className="q-head">
          <h2>{L('money')}</h2>
          <span className="q-muted">E21–E22 · I11–I13 · I14–I16</span>
        </div>
        <div className="j-money-grid">
          <div>
            <h3 data-testid="release-block-h">{L('unpaidBl')} — {L('releaseDocBl')} / {L('releaseDocDo')}</h3>
            {blJobs.length === 0 && <p className="j-sub">{L('noOpen')}</p>}
            {blJobs.map((j) => {
              const b = blockOf(j);
              return (
                <div key={j.id} className="j-money-card" data-testid={`release-block-${j.id}`}>
                  <div className="j-mc-head">
                    <button type="button" className="j-link mono" onClick={() => setOpenId(j.id)}>{j.id}</button>
                    <span>{j.customer}</span>
                  </div>
                  <BalanceTable b={b.balance} lang={lang} />
                  <div className="j-mc-foot amber">
                    {usd(lang, b.open)} {L('unpaid')} — {L(b.kind === 'hbl' ? 'blocksBl' : 'blocksDo')}
                  </div>
                </div>
              );
            })}
          </div>
          <div>
            <h3>{T('collectFreight')} + {L('rebate')} ({num(lang, tariffs.lineRebatePct)}%) · I13</h3>
            {collectJobs.map((j) => (
              <div key={j.id} className="j-money-card">
                <div className="j-mc-head">
                  <button type="button" className="j-link mono" onClick={() => setOpenId(j.id)}>{j.id}</button>
                  <span>{j.line}</span>
                </div>
                <div className="j-kv">
                  <span>{L('collectFreight')}</span>
                  <strong className={collectOf(j).collected ? 'ok' : 'amber'}>
                    {usd(lang, collectOf(j).amount)} · {collectOf(j).collected ? L('collected') : L('notCollected')}
                  </strong>
                </div>
                <div className="j-kv">
                  <span>{L('rebate')} {num(lang, tariffs.lineRebatePct)}%</span>
                  <strong className={j.collect!.rebateReceived ? 'ok' : 'amber'}>
                    {usd(lang, (j.collect!.amount * tariffs.lineRebatePct) / 100)} · {j.collect!.rebateReceived ? L('collected') : L('pending')}
                  </strong>
                </div>
              </div>
            ))}
          </div>
          <div>
            <h3>{T('cheque')} · I14–I16</h3>
            {chequeJobs.map((j) => {
              const total = j.cheques.reduce((s, c) => s + chequeAmount(j, c, tariffs), 0);
              const holder = j.cheques[0].holder;
              const st = j.cheques[0].status;
              return (
                <div key={j.id} className="j-money-card">
                  <div className="j-mc-head">
                    <button type="button" className="j-link mono" onClick={() => setOpenId(j.id)}>{j.id}</button>
                    <span>{j.customer}</span>
                  </div>
                  <div className="j-kv">
                    <span>{L('chequeDem')} × {num(lang, j.cheques.filter((c) => c.kind === 'demurrage').length)} + {L('chequeCntr')} × {num(lang, j.cheques.filter((c) => c.kind === 'container').length)}</span>
                    <strong>{usd(lang, total)}</strong>
                  </div>
                  <div className="j-kv">
                    <span>{st === 'toLodge' ? L('toLodge') : `${L('heldBy')} ${holder}`}</span>
                    <strong className={j.containers.some((c) => clock(c, now, tariffs).daysOver > 0) ? 'red' : st === 'toLodge' ? 'amber' : ''}>{stepName(j.step)} · {j.step}</strong>
                  </div>
                </div>
              );
            })}
            <p className="j-foot">{L('returnsWhen')}</p>
          </div>
        </div>
      </section>

      <div className="j-bottom">
        <section className="q-panel j-tariffs" data-testid="tariffs">
          <div className="q-head">
            <h2>{T('tariffs')} · {tariffs.year}</h2>
            <button type="button" className="btn ghost sm" onClick={() => setTariffs({ ...DEFAULT_TARIFFS })}>{L('reset')}</button>
          </div>
          <p className="j-foot">{L('tariffsNote')}</p>
          <div className="j-tariff-grid">
            {TARIFF_ROWS.map((r) => (
              <label key={r.key} className="j-tariff">
                <span className="j-tariff-name">{TARIFF_LABEL[r.key][LIDX[lang]]}</span>
                <span className="j-tariff-by">{L(r.setBy === 'sa' ? 'setBySa' : r.setBy === 'po' ? 'setByPo' : 'setByLine')}</span>
                <span className="j-tariff-in">
                  <input
                    type="number"
                    min={0}
                    step={r.key === 'lineRebatePct' ? 0.5 : 1}
                    value={tariffs[r.key]}
                    onChange={(e) => setTariffs((t) => ({ ...t, [r.key]: Math.max(0, Number(e.target.value) || 0) }))}
                    aria-label={TARIFF_LABEL[r.key][0]}
                  />
                  <bdi className="j-unit">{r.key === 'lineRebatePct' || r.key === 'tier1Days' ? unitTx(lang, r.unit) : `${tariffs.currency} ${unitTx(lang, r.unit)}`}</bdi>
                </span>
              </label>
            ))}
          </div>
        </section>
        {/* Persian ↔ English trade-term glossary: only for the Persian UI. */}
        {lang === 'fa' && (
          <section className="q-panel j-gloss">
            <div className="q-head">
              <h2>{L('glossary')}</h2>
            </div>
            <dl className="j-gloss-list">
              {GLOSSARY.map(([fa, en]) => (
                <div key={fa}>
                  <dt lang="fa" dir="rtl">{fa}</dt>
                  <dd lang="en" dir="ltr">{en}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>

      {open && (
        <JobDrawer
          job={open}
          lang={lang}
          now={now}
          tariffs={tariffs}
          T={T}
          onClose={() => setOpenId(null)}
          onDraftQuote={() => open.quoteText && onDraftQuote(open.quoteText, open.customer)}
          onOpenClient={onOpenClient ? () => onOpenClient(open.customer) : undefined}
          agentName={agentOf(open)?.name ?? null}
          agent={agentOf(open)}
          client={clientForJob(clients, open.customer)}
        />
      )}
    </div>
  );
}

const TARIFF_LABEL: Record<TariffKey, [string, string, string, string]> = {
  demurrage20Tier1: ["Demurrage 20′, days 1–N", "Demora 20′, días 1–N", 'حق توقف ۲۰ فوت، روزهای اول', 'غرامة التأخير ٢٠′، الأيام ١–N'],
  demurrage20Tier2: ["Demurrage 20′, after N", "Demora 20′, después de N", 'حق توقف ۲۰ فوت، بعد از آن', 'غرامة التأخير ٢٠′، بعد N'],
  demurrage40Tier1: ["Demurrage 40′, days 1–N", "Demora 40′, días 1–N", 'حق توقف ۴۰ فوت، روزهای اول', 'غرامة التأخير ٤٠′، الأيام ١–N'],
  demurrage40Tier2: ["Demurrage 40′, after N", "Demora 40′, después de N", 'حق توقف ۴۰ فوت، بعد از آن', 'غرامة التأخير ٤٠′، بعد N'],
  tier1Days: ['N (first tier days)', 'N (días primer tramo)', 'تعداد روزهای پله اول', 'N (أيام الشريحة الأولى)'],
  blFee: ['B/L fee', 'Tasa B/L', 'هزینه بارنامه', 'رسوم بوليصة الشحن'],
  doFee: ['DO fee', 'Tasa DO', 'هزینه دی‌او (ترخیصیه)', 'رسوم إذن التسليم'],
  thc20: ["THC 20′", "THC 20′", 'THC ۲۰ فوت', 'THC 20′'],
  thc40: ["THC 40′", "THC 40′", 'THC ۴۰ فوت', 'THC 40′'],
  sealFee: ['Seal fee', 'Precinto', 'هزینه پلمپ', 'رسوم الختم'],
  chequeDemurrage: ['Demurrage cheque', 'Cheque de demora', 'چک تضمین حق توقف', 'شيك غرامة التأخير'],
  chequeContainer20: ["Container cheque 20′", "Cheque contenedor 20′", 'چک تضمین کانتینر ۲۰ فوت', 'شيك الحاوية ٢٠′'],
  chequeContainer40: ["Container cheque 40′", "Cheque contenedor 40′", 'چک تضمین کانتینر ۴۰ فوت', 'شيك الحاوية ٤٠′'],
  lineRebatePct: ['Line rebate on collect freight (I13)', 'Comisión naviera sobre collect (I13)', 'سهم خط از کرایه کالکت (I13)', 'خصم الخط على أجرة الشحن المُحصَّلة (I13)'],
};

function Tile({ label, value, tone, sub, subTone }: { label: ReactNode; value: string; tone?: 'amber' | 'red'; sub?: string; subTone?: 'red' }) {
  return (
    <div className={`j-tile ${tone ?? ''}`}>
      <span className="j-tile-label">{label}</span>
      <bdi className="j-tile-value">{value}</bdi>
      {sub && <span className={`j-tile-sub ${subTone ?? ''}`}>{sub}</span>}
    </div>
  );
}

/** Open client invoices on a job — read from the billing ledger, the same figure Finance, Clients and the portal show. */
function BalanceTable({ b, lang }: { b: JobBalance; lang: Lang }) {
  const miss = Object.entries(b.missing);
  if (!b.invoices.length) return <p className="j-sub" data-testid="job-balance-none">{tr(lang, 'noOpen')}</p>;
  return (
    <table className="j-charges" data-testid="job-balance">
      <tbody>
        {b.invoices.map((x) => (
          <tr key={x.no}>
            <td><bdi className="mono">{x.no}</bdi></td>
            <td className="mono num"><bdi>{x.currency} {x.open.toLocaleString(lang === 'fa' ? 'fa-IR-u-ca-gregory' : lang === 'ar' ? 'ar-EG' : lang === 'es' ? 'es-ES' : 'en-US', { maximumFractionDigits: 2 })}</bdi></td>
            <td className={`st ${x.overdue ? 'red' : 'amber'}`}>{tr(lang, 'unpaid')}</td>
          </tr>
        ))}
        <tr className="tot"><td>{tr(lang, 'total')}</td><td className="mono num" data-testid="job-balance-total"><bdi>{usd(lang, b.open)}</bdi></td><td className="st">{miss.length ? `+ ${miss.map(([c, v]) => `${c} ${v}`).join(', ')} (${tr(lang, 'noRate')})` : ''}</td></tr>
      </tbody>
    </table>
  );
}

const DOC_KEY: Record<Doc['key'], Key> = {
  booking: 'booking', release: 'releaseOrder', seals: 'seals', declaration: 'declaration', shippingOrder: 'shippingOrder', draftBl: 'draftBl',
  originalBl: 'originalBl', packing: 'packing', arrival: 'arrival', loi: 'loi', do: 'do', warehouse: 'warehouse',
};

function JobDrawer(props: Parameters<typeof JobDrawerBody>[0]) {
  const [tab, setTab] = useState<'overview' | 'docs' | 'billing'>('overview');
  return <JobDrawerBody {...props} tab={tab} setTab={setTab} />;
}

function JobDrawerBody({ job, lang, now, tariffs, T, onClose, onDraftQuote, onOpenClient, agentName, agent, client, tab = 'overview', setTab }: { job: Job; lang: Lang; now: number; tariffs: Tariffs; T: (k: Key) => ReactNode; onClose: () => void; onDraftQuote: () => void; onOpenClient?: () => void; agentName?: string | null; agent?: Agent | null; client?: Client | null; tab?: 'overview' | 'docs' | 'billing'; setTab?: (t: 'overview' | 'docs' | 'billing') => void }) {
  const L = (k: Key) => tr(lang, k);
  const steps = stepsFor(job.dir);
  const cur = stepIndex(job.step);
  const blk = releaseBlockFor(job, useBilling(), now);
  const alerts = jobAlerts(job, now, tariffs, lang, blk.blocking ? { amount: blk.open, kind: blk.kind } : null);
  const canQuote = job.quoteText && ((job.dir === 'export' && cur >= 2 && cur <= 4) || (job.dir === 'import' && cur === 2));
  const co = cutoff(job);
  const { company } = useStore();
  const agentsDb = useAgentsDb();
  const waEntries = waFor(useWaLog(), 'jobId', job.id);
  const waCtx = jobCtx(job, { company, ledger: ledgerFor(job), tariffs, now, openBalance: blk.open > 0.005 ? blk.open : undefined });
  const clientR = clientRecipients(client ?? null);
  const agentR = agentRecipients(agent ?? null, agentsDb.list);
  const waTpl = suggestTpl(waCtx, { blocking: blk.blocking, draftBlPending: job.docs.some((d) => d.key === 'draftBl' && (d.status === 'waiting' || d.status === 'pending')), isImportArrival: job.dir === 'import' && !!job.vessel && !job.vessel.sailed });
  return (
    <div className="j-drawer-wrap" onClick={onClose}>
      <aside className={`j-drawer ${tab === 'billing' ? 'wide' : ''}`} role="dialog" aria-label={job.id} onClick={(e) => e.stopPropagation()} data-testid="job-detail">
        <header className="j-d-head">
          <div>
            <div className="j-d-id">
              <bdi className="mono">{job.id}</bdi>
              <span className={`j-dir ${job.dir}`}>{L(job.dir)}</span>
              <span className={`j-owner ${stepDef(job.step).holder}`}>{L(stepDef(job.step).holder)}</span>
              {(!isLive() || job.sample) && <span className="j-sample sm">{L('sampleData')}</span>}
            </div>
            <h2>
              <bdi>{job.pol} → {job.pod}</bdi>
            </h2>
            <p className="j-sub">
              {job.portal?.draftBlApprovedAt && <span className="j-portal-ok" data-testid="job-portal-approved">✓ {L('portalApproved')} · {fmtWhen(lang, job.portal.draftBlApprovedAt)}<br /></span>}
              {job.customer} · {job.commodity} · {job.line}
              {agentName && <> · {L('agent')} ({job.dir === 'import' ? job.pol : job.pod}): <strong data-testid="job-agent">{agentName}</strong></>}
              {job.vessel && (
                <>
                  {' '}· {L('vessel')} <bdi>{job.vessel.name}</bdi> · {job.vessel.sailed ? `${L('sailed')} ${fmtDay(lang, job.vessel.sailed)}` : `${L('eta')} ${fmtWhen(lang, job.vessel.eta)}`}
                </>
              )}
            </p>
          </div>
          <div className="j-d-actions">
            {onOpenClient && (
              <button type="button" className="btn ghost" onClick={onOpenClient} data-testid="open-client">
                {L('clientDash')} →
              </button>
            )}
            {canQuote && (
              <button type="button" className="btn primary" onClick={onDraftQuote} data-testid="draft-quote">
                {L('draftQuote')} →
              </button>
            )}
            <button type="button" className="btn ghost" onClick={onClose} aria-label={L('close')}>
              ✕
            </button>
          </div>
        </header>

        <div className="j-d-wa" data-testid="job-wa">
          <WaButton recipients={clientR} templates={JOB_TPLS} ctx={waCtx} defaultTpl={waTpl} link={{ jobId: job.id, clientId: client?.id ?? null }} fallbackLang={client?.lang ?? 'en'} label={wt(lang, 'wa')} testid="job-client" />
            {agentR.length > 0 && <WaButton recipients={agentR} templates={['general', 'arrival', 'draftBl', 'cutoff48']} ctx={waCtx} defaultTpl="general" link={{ jobId: job.id }} fallbackLang="en" label={`${wt(lang, 'wa')} · ${L('agent')}`} testid="job-agent" />}
        </div>
        <JobWaThreads jobId={job.id} />
        <div className="b-tabs" role="tablist" data-testid="job-tabs">
          {(['overview', 'docs', 'billing'] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => setTab?.(k)} data-testid={`job-tab-${k}`}>
              {bt(lang, k === 'docs' ? 'documents' : k)}
            </button>
          ))}
        </div>
        {tab === 'docs' && <JobDocs job={job} sample={!isLive()} />}
        {tab === 'billing' && <JobBilling job={job} sample={!isLive()} />}
        {tab === 'overview' && <>
        {alerts.length > 0 && (
          <ul className="j-alerts-now">
            {alerts.map((a, i) => (
              <li key={i} className={a.level}>
                {a.text}
              </li>
            ))}
          </ul>
        )}
        {co != null && (
          <div className={`j-cutoff ${co < now ? 'red' : 'amber'}`}>
            <span>{T('docCutoff')} · E18</span>
            <bdi className="mono">{dur(lang, co - now)}</bdi>
            <span className="j-sub">{fmtWhen(lang, co)}</span>
          </div>
        )}

        <section className="j-d-sec">
          <h3>{L('timeline')} · {steps[0].code}–{steps[steps.length - 1].code}</h3>
          <div className="j-phases">
            {PHASES[job.dir].map((p) => (
              <div key={p.from} className="j-phase">
                <div className="j-phase-name">{p[lang]}</div>
                <ol>
                  {steps.slice(p.from - 1, p.to).map((s) => {
                    const i = stepIndex(s.code);
                    return (
                      <li key={s.code} className={`${i < cur ? 'done' : i === cur ? 'cur' : ''} ${s.critical ? 'crit' : ''}`}>
                        <bdi className="j-code">{s.code}</bdi>
                        <span>{s[lang]}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
        </section>

        {job.containers.length > 0 && (
          <section className="j-d-sec">
            <h3>{L('containers')} · {T('freeTime')}</h3>
            <table className="j-ctable">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{T('seal')}</th>
                  <th>{L('freeTime')}</th>
                  <th>{L('next')}</th>
                  <th>{L('demurrage')}</th>
                </tr>
              </thead>
              <tbody>
                {job.containers.map((c) => {
                  const k = clock(c, now, tariffs);
                  return (
                    <tr key={c.no}>
                      <td>
                        <bdi className="mono">{c.no}</bdi> <span className="j-sub">{c.size === '40HC' ? "40′HC" : `${c.size}′`}</span>
                      </td>
                      <td><bdi className="mono">{c.seal ?? '—'}</bdi></td>
                      <td>{c.freeDays != null ? `${num(lang, c.freeDays)} ${lang === 'fa' ? 'روز' : lang === 'ar' ? 'يوم' : 'd'}` : '—'}</td>
                      <td className={k.level}>
                        {k.state === 'notStarted'
                          ? L('notStarted')
                          : k.daysOver > 0
                            ? `${num(lang, k.daysOver)} ${lang === 'fa' ? 'روز' : lang === 'ar' ? 'يوم' : 'd'} ${L('over')}${k.state === 'stopped' ? ` (${job.dir === 'export' ? L('loaded') : L('returnedEmpty')})` : ''}`
                            : k.state === 'stopped'
                              ? `${L('stopped')}${c.returned === 'checking' ? ' · I15' : ''}`
                              : <bdi className="mono">{dur(lang, k.remainingMs, k.remainingMs < 2 * DAY)}</bdi>}
                      </td>
                      <td className={k.cost ? 'red mono' : 'mono'}>{k.cost ? usd(lang, k.cost) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="j-foot">{L('estDemurrage')}</p>
          </section>
        )}

        <div className="j-d-two">
          <section className="j-d-sec">
            <h3>{L('documents')}</h3>
            {job.docs.length ? (
              <ul className="j-docs">
                {job.docs.map((d) => (
                  <li key={d.key} className={d.status}>
                    <span className="j-doc-st" aria-hidden>{d.status === 'done' ? '✓' : d.status === 'blocked' ? '■' : d.status === 'waiting' ? '…' : '○'}</span>
                    <span className="j-doc-name">{T(DOC_KEY[d.key])}</span>
                    <span className="j-doc-meta">
                      {L(d.status)}
                      {d.rounds ? ` · ${num(lang, d.rounds)} ${L('rounds')}` : ''}
                      {d.at ? ` · ${fmtDay(lang, d.at)}` : ''}
                    </span>
                    {d.note && <span className="j-doc-note">{d.note}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="j-sub">—</p>
            )}
            {(() => {
              const m = jobMsds(client?.lanes, job);
              return (
                <div className="j-msds" data-testid="job-msds">
                  <span className="j-doc-name">MSDS{m.hs ? <> · HS <bdi dir="ltr" className="mono">{m.hs}</bdi>{m.guessed ? ' ~' : ''}</> : ''}</span>
                  {m.lane && client ? (
                    <MsdsSlot hs={m.hs} dg={m.lane.dg ? 'yes' : null} meta={m.meta} lang={lang} testid="job-msds-slot" clientId={client.id} onChange={(meta) => clientStore.setLanes(client.id, client.lanes.map((l) => (l.id === m.lane!.id ? { ...l, msds: meta } : l)))} />
                  ) : (
                    <MsdsChip hs={m.hs} meta={m.meta} lang={lang} />
                  )}
                </div>
              );
            })()}
          </section>
          <section className="j-d-sec">
            <h3>{L('charges')}</h3>
            <BalanceTable b={blk.balance} lang={lang} />
            <p className="j-sub">{L('seeBilling')}</p>
            {job.cheques.length > 0 && (
              <>
                <h3 className="j-h3-gap">{T('cheque')}</h3>
                <table className="j-charges">
                  <tbody>
                    {job.cheques.map((c, i) => (
                      <tr key={i}>
                        <td>
                          {c.kind === 'demurrage' ? L('chequeDem') : L('chequeCntr')} {c.container && <bdi className="mono j-sub">{c.container}</bdi>}
                        </td>
                        <td className="mono num">{usd(lang, chequeAmount(job, c, tariffs))}</td>
                        <td className={`st ${c.status === 'returned' ? 'ok' : c.status === 'toLodge' ? 'amber' : ''}`}>{c.status === 'held' ? `${L('heldBy')} ${c.holder}` : c.status === 'toLodge' ? L('toLodge') : L('returned')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </section>
        </div>

        <section className="j-d-sec">
          <h3>{L('alerts')}</h3>
          {waEntries.length > 0 && (
            <div className="j-wa-log" data-testid="job-wa-log">
              <div className="j-wa-log-h"><WaIcon size={16} /> {wt(lang, 'log')} · <span className="j-sub">{wt(lang, 'logNote')}</span></div>
              <ul className="wa-log">{waEntries.map((e) => <WaLogItem key={e.id} e={e} ui={lang} />)}</ul>
            </div>
          )}
          <ul className="j-log">
            {[...job.log].sort((a, b) => b.at - a.at).map((e, i) => (
              <li key={i} className={e.kind ?? 'info'}>
                <bdi className="mono j-log-at">{fmtWhen(lang, e.at)}</bdi>
                <span dir="ltr">{e.text}</span>
              </li>
            ))}
          </ul>
        </section>
        </>}
      </aside>
    </div>
  );
}

function NewJobForm({ lang, clients, onClose, onCreated }: { lang: Lang; clients: Client[]; onClose: () => void; onCreated: (id: string) => void }) {
  const L = (k: Key) => tr(lang, k);
  const [dir, setDir] = useState<'export' | 'import'>('export');
  const [cid, setCid] = useState(clients[0]?.id ?? '');
  const [pol, setPol] = useState('Bandar Abbas');
  const [pod, setPod] = useState('');
  const [commodity, setCommodity] = useState('');
  const [line, setLine] = useState('');
  const [equip, setEquip] = useState('1×20');
  const steps = stepsFor(dir);
  const [step, setStep] = useState('E5');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const flip = (d: 'export' | 'import') => {
    setDir(d);
    setStep(d === 'export' ? 'E5' : 'I3');
    if (d === 'import') { setPod('Bandar Abbas'); if (pol === 'Bandar Abbas') setPol(''); } else { setPol('Bandar Abbas'); if (pod === 'Bandar Abbas') setPod(''); }
  };
  const c = clients.find((x) => x.id === cid);
  const ok = c && pol.trim() && pod.trim() && commodity.trim();
  const create = async () => {
    if (!c) return;
    const id = `FD-${dir === 'export' ? 'E' : 'I'}-${String(Date.now()).slice(-5)}`;
    const now = Date.now();
    const j: Job = {
      id, dir, customer: c.jobName ?? c.name, clientId: c.id, commodity: commodity.trim(), pol: pol.trim(), pod: pod.trim(), line: line.trim() || '—', step,
      containers: [], plannedEquipment: equip.trim() || undefined, charges: [], cheques: [], docs: [{ key: 'booking', status: 'pending' }],
      log: [{ at: now, text: `${step} Job created on the desk` }], sample: true,
    };
    setBusy(true);
    try {
      await jobsStore.create(j);
      onCreated(id);
    } catch (e) {
      setErr(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="q-panel" data-testid="job-new-form">
      <div className="q-head">
        <h2>{L('newJob').replace('+ ', '')}</h2>
        <div className="q-lang" role="group">
          {(['export', 'import'] as const).map((d) => (
            <button key={d} type="button" className={dir === d ? 'active' : ''} onClick={() => flip(d)} data-testid={`nj-dir-${d}`}>{L(d)}</button>
          ))}
        </div>
      </div>
      <div className="j-newjob">
        <label>{L('customer')}<select value={cid} onChange={(e) => setCid(e.target.value)} data-testid="nj-client">{clients.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label>{L('pol')}<input value={pol} onChange={(e) => setPol(e.target.value)} data-testid="nj-pol" /></label>
        <label>{L('pod')}<input value={pod} onChange={(e) => setPod(e.target.value)} data-testid="nj-pod" /></label>
        <label>{L('commodityJ')}<input value={commodity} onChange={(e) => setCommodity(e.target.value)} data-testid="nj-commodity" /></label>
        <label>{L('lineJ')}<input value={line} onChange={(e) => setLine(e.target.value)} placeholder="Line A (sample)" data-testid="nj-line" /></label>
        <label>{L('equipment')}<input value={equip} onChange={(e) => setEquip(e.target.value)} data-testid="nj-equip" /></label>
        <label>{L('startStep')}<select value={step} onChange={(e) => setStep(e.target.value)} data-testid="nj-step">{steps.map((st) => <option key={st.code} value={st.code}>{st.code} · {st[lang]}</option>)}</select></label>
      </div>
      <p className="j-foot">{L('newJobNote')} {isLive() ? L('savedLive') : L('savedLocal')}.</p>
      {err && <p className="q-amber">{err}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn ghost sm" onClick={onClose}>{L('cancelJ')}</button>
        <button type="button" className="btn primary sm" disabled={!ok || busy} onClick={() => void create()} data-testid="nj-create">{L('createJob')}</button>
      </div>
    </section>
  );
}
