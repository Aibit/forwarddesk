// Sales pipeline: one board fed by real app data — jobs (Jobs page + billing ledger) and quotes (Quote page).
// Nothing is estimated here: a value or margin is shown only when a quote or ledger holds it.
import { useEffect, useMemo } from 'react';
import { useJobs } from '../jobs/store';
import type { Job } from '../jobs/data';
import { stepIndex } from '../jobs/steps';
import { store, useStore, type QuoteRecord } from '../clients/store';
import { useBilling } from '../billing/store';
import { pnl } from '../billing/model';
import { MODE_L, type QLang } from '../quote/optlabels';
import { COORDS, haversineKm } from '../quote/geo';
import { useUiLang, type UiLang } from '../ui/lang';
import { Art } from '../ui/Art';
import { isLive } from '../backend/bridge';
import './pipeline.css';

type Stage = 'inquiry' | 'quoted' | 'won' | 'lost';
const STAGES: Stage[] = ['inquiry', 'quoted', 'won', 'lost'];

const T = {
  inquiry: ['Inquiry', 'Consulta', 'استعلام', 'استفسار'],
  quoted: ['Quoted', 'Cotizado', 'قیمت داده شده', 'تم التسعير'],
  won: ['Won / Booked', 'Ganado / Reservado', 'برنده / رزرو شده', 'فاز / محجوز'],
  lost: ['Lost', 'Perdido', 'از دست رفته', 'خاسر'],
  inquiryHint: ['Bookings still finding a rate (E1–E3, I1–I2).', 'Reservas aún buscando tarifa (E1–E3, I1–I2).', 'بوکینگ‌هایی که هنوز دنبال نرخ هستند (E1–E3، I1–I2).', 'حجوزات ما زالت تبحث عن سعر (E1–E3، I1–I2).'],
  quotedHint: ['Quotes sent, waiting for the customer.', 'Cotizaciones enviadas, esperando al cliente.', 'قیمت‌های ارسال‌شده، در انتظار مشتری.', 'عروض مُرسلة، بانتظار العميل.'],
  wonHint: ['Accepted quotes and confirmed bookings. Booking figures come from its billing.', 'Cotizaciones aceptadas y reservas confirmadas. Las cifras de la reserva vienen de su facturación.', 'قیمت‌های پذیرفته‌شده و بوکینگ‌های قطعی. ارقام بوکینگ از صورتحساب آن است.', 'عروض مقبولة وحجوزات مؤكدة. أرقام الحجز تأتي من فوترته.'],
  lostHint: ['Quotes the customer turned down.', 'Cotizaciones rechazadas por el cliente.', 'قیمت‌هایی که مشتری نپذیرفت.', 'عروض رفضها العميل.'],
  value: ['Value', 'Valor', 'ارزش', 'القيمة'],
  margin: ['Margin', 'Margen', 'حاشیه سود', 'الهامش'],
  notPriced: ['not priced yet', 'sin precio aún', 'هنوز قیمت‌گذاری نشده', 'لم يُسعَّر بعد'],
  noMargin: ['margin not recorded', 'margen no registrado', 'حاشیه ثبت نشده', 'الهامش غير مسجّل'],
  marginKnown: ['margin known on', 'margen conocido en', 'حاشیه معلوم برای', 'الهامش معروف لـ'],
  of: ['of', 'de', 'از', 'من'],
  empty: ['Nothing here yet.', 'Nada todavía.', 'هنوز موردی نیست.', 'لا شيء هنا بعد.'],
  sample: ['SAMPLE', 'EJEMPLO', 'نمونه', 'عيّنة'],
  sampleNote: ['Sample bookings and quotes — illustrative only. New quotes from the Quote page and new bookings appear here automatically.', 'Reservas y cotizaciones de ejemplo, solo ilustrativos. Las nuevas cotizaciones y reservas aparecen aquí automáticamente.', 'بوکینگ‌ها و قیمت‌های نمونه — فقط برای نمایش. قیمت‌ها و بوکینگ‌های جدید خودکار اینجا می‌آیند.', 'حجوزات وعروض عيّنة — للتوضيح فقط. العروض الجديدة من صفحة التسعير والحجوزات الجديدة تظهر هنا تلقائيًا.'],
  quote: ['Quote', 'Cotización', 'پیشنهاد قیمت', 'عرض سعر'],
  job: ['Booking', 'Reserva', 'بوکینگ', 'الحجز'],
  fromQuote: ['from quote', 'de la cotización', 'از پیشنهاد', 'من العرض'],
  options: ['options', 'opciones', 'گزینه', 'خيارات'],
  transit: ['transit', 'tránsito', 'ترانزیت', 'العبور'],
  days: ['d', 'd', 'روز', 'يوم'],
  straight: ['km straight line (not the sailing route)', 'km en línea recta (no la ruta de navegación)', 'کیلومتر خط مستقیم (نه مسیر دریانوردی)', 'كم خط مستقيم (ليس مسار الإبحار)'],
  straightAir: ['km great-circle', 'km ortodrómicos', 'کیلومتر دایره عظیمه', 'كم دائرة عظمى'],
  markWon: ['Mark won', 'Marcar ganada', 'برنده شد', 'تحديد كفائز'],
  markLost: ['Mark lost', 'Marcar perdida', 'از دست رفت', 'تحديد كخاسر'],
  open: ['Open', 'Abrir', 'باز کردن', 'فتح'],
  otherCcy: ['plus other currencies:', 'más otras monedas:', 'به‌علاوه ارزهای دیگر:', 'بالإضافة إلى عملات أخرى:'],
  newQuote: ['+ New quote', '+ Nueva cotización', '+ پیشنهاد جدید', '+ عرض سعر جديد'],
} as const;
const LI: Record<UiLang, 0 | 1 | 2 | 3> = { en: 0, es: 1, fa: 2, ar: 3 };

interface Card {
  key: string;
  stage: Stage;
  kind: 'quote' | 'job';
  ref: string;
  client: string;
  pol: string;
  pod: string;
  mode: string;
  units: string;
  value: number | null;
  currency: string;
  margin: number | null;
  marginPct: number | null;
  transit: number | null;
  nOptions: number;
  sample: boolean;
  quoteRef?: string;
  quoteId?: string;
  jobId?: string;
  clientId?: string | null;
  at: number;
}

const fmt = (lang: UiLang, n: number) => n.toLocaleString(lang === 'fa' ? 'fa-IR-u-ca-gregory' : lang === 'ar' ? 'ar-EG' : lang === 'es' ? 'es-ES' : 'en-US', { maximumFractionDigits: 0 });
const isInquiry = (j: Job) => stepIndex(j.step) <= (j.dir === 'export' ? 3 : 2);
const split = (route: string) => {
  const [a, b] = route.split('→').map((x) => x.trim());
  return { pol: a ?? '', pod: b ?? '' };
};
const unitsOf = (j: Job) => {
  if (!j.containers.length) return j.plannedEquipment ?? '';
  const by = new Map<string, number>();
  for (const c of j.containers) by.set(c.size, (by.get(c.size) ?? 0) + 1);
  return [...by].map(([s, n]) => `${n}×${s}`).join(' + ');
};

export function PipelineView({ onOpenJob, onOpenClient, onNewQuote }: { onOpenJob: (id: string) => void; onOpenClient: (id: string) => void; onNewQuote: () => void }) {
  const [lang] = useUiLang();
  const L = (k: keyof typeof T) => T[k][LI[lang]];
  const jobs = useJobs();
  const { quotes, clients, costs } = useStore();
  const { ledgers } = useBilling();

  useEffect(() => {
    if (isLive()) void store.loadCosts(quotes.map((q) => q.id));
  }, [quotes]);

  const cards = useMemo(() => {
    const nameOf = (q: QuoteRecord) => {
      const c = clients.find((x) => x.id === q.clientId);
      return { name: c?.name ?? '—', jobName: c?.jobName ?? c?.name ?? '' };
    };
    const quoteFigures = (q: QuoteRecord) => {
      const opts = q.options.filter((o) => o.sell > 0);
      const accepted = q.status === 'won' && q.acceptedOption ? opts.find((o) => o.carrier === q.acceptedOption) : undefined;
      const o = accepted ?? [...opts].sort((a, b) => a.sell - b.sell)[0];
      const c = costs[q.id]?.options.find((x) => x.carrier === o?.carrier);
      return { value: o?.sell ?? null, transit: o?.transit ?? null, margin: c?.margin ?? null, marginPct: c?.marginPct ?? null };
    };
    const out: Card[] = [];
    const usedJobs = new Set<string>();
    for (const q of quotes) {
      const { name, jobName } = nameOf(q);
      const { pol, pod } = split(q.route);
      const f = quoteFigures(q);
      const stage: Stage = q.status === 'sent' ? 'quoted' : q.status === 'won' ? 'won' : 'lost';
      const job = stage === 'won' ? jobs.find((j) => !usedJobs.has(j.id) && j.customer === jobName && `${j.pol} → ${j.pod}` === q.route && !isInquiry(j)) : undefined;
      if (job) {
        usedJobs.add(job.id);
        const l = ledgers[job.id];
        const p = l && l.lines.length ? pnl(l) : null;
        out.push({ key: `j-${job.id}`, stage, kind: 'job', ref: job.id, client: name, pol, pod, mode: q.mode, units: unitsOf(job), value: p ? p.revenue : f.value, currency: 'USD', margin: p ? p.profit : f.margin, marginPct: p ? p.marginPct : f.marginPct, transit: f.transit, nOptions: q.options.length, sample: !!(job.sample || q.sample), quoteRef: q.id, quoteId: q.id, jobId: job.id, clientId: q.clientId, at: q.at });
        continue;
      }
      out.push({ key: `q-${q.id}`, stage, kind: 'quote', ref: q.id, client: name, pol, pod, mode: q.mode, units: q.units, value: f.value, currency: q.currency, margin: f.margin, marginPct: f.marginPct, transit: f.transit, nOptions: q.options.length, sample: !!q.sample, quoteId: q.id, clientId: q.clientId, at: q.at });
    }
    for (const j of jobs) {
      if (usedJobs.has(j.id)) continue;
      const sent = quotes.some((q) => q.status === 'sent' && nameOf(q).jobName === j.customer && q.route === `${j.pol} → ${j.pod}`);
      if (isInquiry(j) && sent) continue; // already on the board as its quote
      const l = ledgers[j.id];
      const p = l && l.lines.length ? pnl(l) : null;
      const at = j.log.length ? Math.min(...j.log.map((x) => x.at)) : 0;
      out.push({ key: `j-${j.id}`, stage: isInquiry(j) ? 'inquiry' : 'won', kind: 'job', ref: j.id, client: j.customer, pol: j.pol, pod: j.pod, mode: 'Ocean FCL', units: unitsOf(j), value: p ? p.revenue : null, currency: 'USD', margin: p ? p.profit : null, marginPct: p ? p.marginPct : null, transit: null, nOptions: 0, sample: !!j.sample, jobId: j.id, at });
    }
    return out.sort((a, b) => b.at - a.at);
  }, [quotes, clients, costs, jobs, ledgers]);

  const anySample = cards.some((c) => c.sample);
  return (
    <div className="pl-view" dir={(lang === 'fa' || lang === 'ar') ? 'rtl' : 'ltr'} lang={lang} data-testid="pipeline">
      <div className="pl-top">
        {anySample && <p className="pl-note"><span className="j-sample">{L('sample')}</span> {L('sampleNote')}</p>}
        <button type="button" className="btn sm primary" onClick={onNewQuote} data-testid="pl-new-quote">{L('newQuote')}</button>
      </div>
      <div className="pl-board">
        {STAGES.map((s) => {
          const list = cards.filter((c) => c.stage === s);
          const usd = list.filter((c) => c.value != null && c.currency === 'USD');
          const other = new Map<string, number>();
          for (const c of list) if (c.value != null && c.currency !== 'USD') other.set(c.currency, (other.get(c.currency) ?? 0) + c.value);
          const withM = list.filter((c) => c.margin != null);
          return (
            <section key={s} className={`pl-col pl-${s}`} data-testid={`pl-col-${s}`}>
              <header className="pl-col-h">
                <h2>{L(s)} <span className="pl-count" data-testid={`pl-count-${s}`}>{fmt(lang, list.length)}</span></h2>
                <p className="pl-hint">{L(`${s}Hint` as keyof typeof T)}</p>
                <div className="pl-sum">
                  <span>{L('value')} <bdi className="mono" data-testid={`pl-value-${s}`}>USD {fmt(lang, usd.reduce((a, c) => a + (c.value ?? 0), 0))}</bdi>{other.size ? <> · {L('otherCcy')} <bdi>{[...other].map(([k, v]) => `${k} ${fmt(lang, v)}`).join(', ')}</bdi></> : null}</span>
                  <span>{L('margin')} <bdi className="mono">{withM.length ? `USD ${fmt(lang, withM.reduce((a, c) => a + (c.margin ?? 0), 0))}` : '—'}</bdi>{list.length ? <> · {L('marginKnown')} {fmt(lang, withM.length)} {L('of')} {fmt(lang, list.length)}</> : null}</span>
                </div>
              </header>
              {list.length === 0 && <div className="pl-empty"><Art name="containers" className="pl-empty-art" /><p>{L('empty')}</p></div>}
              <ul className="pl-cards">
                {list.map((c) => {
                  const a = COORDS[c.pol], b = COORDS[c.pod];
                  const km = a && b ? Math.round(haversineKm(a, b)) : null;
                  const air = /air/i.test(c.mode);
                  return (
                    <li key={c.key} className="pl-card" data-testid={`pl-card-${c.ref}`}>
                      <div className="pl-card-h">
                        <span className="pl-kind">{c.kind === 'job' ? L('job') : L('quote')}</span>
                        <bdi className="mono pl-ref">{c.ref}</bdi>
                        {c.sample && <span className="j-sample sm">{L('sample')}</span>}
                      </div>
                      <strong className="pl-client">{c.client}</strong>
                      <div className="pl-route"><bdi>{c.pol}</bdi> <span aria-hidden="true">{(lang === 'fa' || lang === 'ar') ? '←' : '→'}</span> <bdi>{c.pod}</bdi></div>
                      <div className="pl-meta"><bdi>{modeLabel(lang, c.mode)}</bdi>{c.units ? <> · <bdi>{c.units}</bdi></> : null}{c.nOptions > 1 ? <> · {fmt(lang, c.nOptions)} {L('options')}</> : null}</div>
                      {(km != null || c.transit != null) && (
                        <div className="pl-geo">
                          {km != null && <span>{fmt(lang, km)} {air ? L('straightAir') : L('straight')}</span>}
                          {c.transit != null && <span>{L('transit')} <bdi className="mono">{fmt(lang, c.transit)} {L('days')}</bdi></span>}
                        </div>
                      )}
                      <div className="pl-fig">
                        <span>{L('value')} <bdi className="mono">{c.value != null ? `${c.currency} ${fmt(lang, c.value)}` : '—'}</bdi>{c.value == null && <em> · {L('notPriced')}</em>}</span>
                        <span>{L('margin')} <bdi className="mono">{c.margin != null ? `USD ${fmt(lang, c.margin)}${c.marginPct != null ? ` (${fmt(lang, c.marginPct)}%)` : ''}` : '—'}</bdi>{c.margin == null && c.value != null && <em> · {L('noMargin')}</em>}</span>
                      </div>
                      {c.quoteRef && c.kind === 'job' && <div className="pl-sub">{L('fromQuote')} <bdi className="mono">{c.quoteRef}</bdi></div>}
                      <div className="pl-actions">
                        {c.jobId && <button type="button" className="btn sm ghost" onClick={() => onOpenJob(c.jobId!)}>{L('open')} <bdi>{c.jobId}</bdi></button>}
                        {!c.jobId && c.clientId && <button type="button" className="btn sm ghost" onClick={() => onOpenClient(c.clientId!)}>{L('open')}</button>}
                        {c.kind === 'quote' && c.stage === 'quoted' && c.quoteId && (
                          <>
                            <button type="button" className="btn sm ghost" onClick={() => store.setQuoteStatus(c.quoteId!, 'won')} data-testid={`pl-won-${c.ref}`}>{L('markWon')}</button>
                            <button type="button" className="btn sm ghost" onClick={() => store.setQuoteStatus(c.quoteId!, 'lost')} data-testid={`pl-lost-${c.ref}`}>{L('markLost')}</button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** Stored quote modes are EN labels ("Ocean FCL"); show them in the UI language. Free text passes through. */
function modeLabel(lang: string, mode: string): string {
  const k = (Object.keys(MODE_L.en) as (keyof typeof MODE_L.en)[]).find((m) => MODE_L.en[m] === mode);
  return k ? MODE_L[(lang in MODE_L ? lang : 'en') as QLang][k] : mode;
}
