import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { Art } from '../ui/Art';
import { LOCATIONS, type QMode } from './locations';
import {
  INCOTERMS,
  chargeableKg,
  missingIssues,
  parseRequest,
  resolveForMode,
  type DgState,
  type Issue,
  type QuoteFields,
} from './parser';
import { CSV_COLUMNS, buildOptions, buildQuote, loadRateCsv, optionBadges, sampleRates, type Badge, type Quote, type RateRow, type Side } from './rates';
import { BADGE_L, MODE_L, ol, type QLang } from './optlabels';
import { DEFAULT_CATALOG } from '../billing/model';
import { quoteNumber } from './quoteno';
import { agentForPort, lineRank, store, useStore } from '../clients/store';
import { SAMPLE_REQUESTS } from './samples';
import { quoteForText, type QuoteFor } from './quotefor';
import { HOME_PORT, autoDir, tl3, tradeBlock, tradeText, type TradeBlock, type TradeDir } from './trade';
import { useTariffs } from '../jobs/tariffs';
import { listedNames, pickable, rid, sanctionsLevel, statusOf as agentStatus, useAgentsDb } from '../agents/db';
import { activities } from '../agents/crm';
import { hsCheck, laneToRequest, sameLane, targetUnits, type LaneProfile } from '../clients/lanes';
import { TargetDelta, fmtTarget, fmtVolume } from '../clients/Lanes';
import { ct } from '../clients/i18n';
import { hsFromCommodity, hsFromText, msdsNeed, useMsdsRules, type MsdsMeta } from '../clients/msds';
import { MsdsChip, MsdsSlot } from '../clients/Msds';
import './quote.css';
import { getUiLang, useUiLang } from '../ui/lang';
import { isLive } from '../backend/bridge';
import { agentStLabel, agentTag, sampleLabel, linesText, scopeText, unitsText, basisLabel, issueText, modeLabel, qu, sideLabel, type UKey } from './uitext';

type Lang = 'en' | 'es';
type FieldKey = keyof QuoteFields;

const MODE_LABEL: Record<QMode, string> = { fcl: 'Ocean FCL', lcl: 'Ocean LCL', air: 'Air', road: 'Road' };
const SIDE_ORDER: Side[] = ['origin', 'freight', 'destination', 'customs'];
const PENDING: Partial<Record<string, { en: string; es: string }>> = {
  mode: { en: 'transport mode', es: 'modo de transporte' },
  origin: { en: 'origin port / pickup address', es: 'puerto de origen / dirección de recogida' },
  destination: { en: 'destination', es: 'destino' },
  equipment: { en: 'equipment type', es: 'tipo de equipo' },
  weightKg: { en: 'gross weight', es: 'peso bruto' },
  volumeCbm: { en: 'dimensions / volume', es: 'medidas / volumen' },
  incoterm: { en: 'Incoterm', es: 'Incoterm' },
  readyDate: { en: 'cargo ready date', es: 'fecha de mercancía lista' },
  cargo: { en: 'commodity', es: 'tipo de mercancía' },
  dg: { en: 'DG status', es: 'si es mercancía peligrosa' },
};

const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const money2 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

function fmtElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function fmtShort(iso: string, lang: QLang): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString(lang === 'es' ? 'es-ES' : lang === 'fa' ? 'fa-IR' : lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' });
}

function fmtDate(iso: string | null, lang: QLang): string {
  if (!iso) return '—';
  if (iso === 'ASAP') return lang === 'es' ? 'lo antes posible' : lang === 'fa' ? 'در اسرع وقت' : lang === 'ar' ? 'في أقرب وقت' : 'ASAP';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString(lang === 'es' ? 'es-ES' : lang === 'fa' ? 'fa-IR' : lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function equipmentText(eq: Record<string, number>): string {
  return Object.entries(eq).map(([k, n]) => `${n}x${k}`).join(', ');
}

function parseEquipmentInput(s: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of s.split(/[,+;]/)) {
    const m = part.trim().toUpperCase().match(/^(\d+)\s*[X×*]?\s*(20GP|40GP|40HC|45HC|20RF|40RF|40OT|20OT|FTL)$/);
    if (m) out[m[2]] = (out[m[2]] || 0) + Number(m[1]);
  }
  return out;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }
}

function questionsText(issues: Issue[], lang: Lang): string {
  const qs = issues.filter((i) => i.question && i.kind !== 'assumed').map((i) => i.question![lang]);
  const assumed = issues.filter((i) => i.question && i.kind === 'assumed').map((i) => i.question![lang]);
  const all = [...qs, ...assumed];
  if (!all.length) return '';
  if (lang === 'es') {
    return `Hola,\n\nGracias por la solicitud. Para daros un precio en firme, ¿nos podéis confirmar lo siguiente?\n\n${all.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\nMientras tanto os adelantamos una cotización indicativa.\n\nUn saludo,`;
  }
  return `Hi,\n\nThanks for your request. To give you a firm price, could you please confirm:\n\n${all.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\nIn the meantime, please find an indicative quote below.\n\nBest regards,`;
}

const TXT = {
  en: {
    subject: 'Subject: Quotation', hi: 'Hi,', thanks: 'Thank you for your request. Please find our offer below:', thanksMulti: 'Thank you for your request. Please find our options below:',
    route: 'Route', mode: 'Mode', cargo: 'Cargo', ready: 'Cargo ready', transit: 'Transit time', approx: (n: number) => `approx. ${n} days`, tbc: 'to be confirmed',
    charges: 'Charges', line: 'Line', free: 'free time', days: 'days', optionsHead: 'Options', allIn: 'all-in for the charges listed', common: 'Charges included in every option above',
    validity: (d: string) => `Validity: until ${d}, subject to space and equipment availability at time of booking.`,
    notIncl: (x: string) => `Not included: duties, taxes, insurance${x} and anything not listed above.`, pending: (x: string) => `Subject to confirmation of: ${x}.`,
    bye: 'Best regards,', stale: '  (subject to carrier confirmation)', option: 'Option', perCntr: ' per container', chargeable: 'chargeable', pcs: 'pcs', nonDg: 'non-DG',
    fobTbc: 'FOB (to be confirmed)', vs: (o: number) => `vs Option ${o}`, more: 'more', less: 'less', fewer: 'fewer', options: 'options',
  },
  es: {
    subject: 'Asunto: Cotización', hi: 'Hola,', thanks: 'Gracias por vuestra solicitud. Os pasamos nuestra oferta:', thanksMulti: 'Gracias por vuestra solicitud. Os pasamos varias opciones:',
    route: 'Ruta', mode: 'Modo', cargo: 'Mercancía', ready: 'Mercancía lista', transit: 'Tránsito', approx: (n: number) => `aprox. ${n} días`, tbc: 'por confirmar',
    charges: 'Cargos', line: 'Naviera', free: 'free time', days: 'días', optionsHead: 'Opciones', allIn: 'total de los conceptos detallados', common: 'Cargos incluidos en todas las opciones',
    validity: (d: string) => `Validez: hasta ${d}, sujeto a disponibilidad de espacio y equipo en el momento de la reserva.`,
    notIncl: (x: string) => `No incluido: aranceles, impuestos, seguro${x} y cualquier concepto no detallado.`, pending: (x: string) => `Pendiente de confirmar: ${x}.`,
    bye: 'Un saludo,', stale: '  (sujeto a confirmación)', option: 'Opción', perCntr: ' por contenedor', chargeable: 'tasables', pcs: 'bultos', nonDg: 'no peligrosa',
    fobTbc: 'FOB (por confirmar)', vs: (o: number) => `vs Opción ${o}`, more: 'más', less: 'menos', fewer: 'menos', options: 'opciones',
  },
  fa: {
    subject: 'موضوع: پیشنهاد قیمت حمل', hi: 'با سلام،', thanks: 'از درخواست شما سپاسگزاریم. پیشنهاد ما به شرح زیر است:', thanksMulti: 'از درخواست شما سپاسگزاریم. گزینه‌های ما به شرح زیر است:',
    route: 'مسیر', mode: 'نوع حمل', cargo: 'کالا', ready: 'آماده بودن کالا', transit: 'زمان حمل', approx: (n: number) => `حدود ${n} روز`, tbc: 'نیاز به تأیید',
    charges: 'هزینه‌ها', line: 'خط کشتیرانی', free: 'فری‌تایم', days: 'روز', optionsHead: 'گزینه‌ها', allIn: 'جمع هزینه‌های ذکرشده', common: 'هزینه‌های مشترک در همه گزینه‌ها',
    validity: (d: string) => `اعتبار: تا ${d}، منوط به وجود فضا و تجهیزات در زمان بوکینگ.`,
    notIncl: (x: string) => `شامل نمی‌شود: حقوق گمرکی، مالیات، بیمه${x} و هر موردی که ذکر نشده است.`, pending: (x: string) => `منوط به تأیید: ${x}.`,
    bye: 'با احترام،', stale: '  (منوط به تأیید خط)', option: 'گزینه', perCntr: ' برای هر کانتینر', chargeable: 'وزن قابل محاسبه', pcs: 'بسته', nonDg: 'غیرخطرناک',
    fobTbc: 'FOB (نیاز به تأیید)', vs: (o: number) => `نسبت به گزینه ${o}`, more: 'بیشتر', less: 'کمتر', fewer: 'کمتر', options: 'گزینه',
  },
  ar: {
    subject: 'الموضوع: عرض سعر شحن', hi: 'مرحبًا،', thanks: 'شكرًا على طلبكم. نرفق لكم عرضنا أدناه:', thanksMulti: 'شكرًا على طلبكم. نرفق لكم خياراتنا أدناه:',
    route: 'المسار', mode: 'وسيلة النقل', cargo: 'البضاعة', ready: 'جاهزية البضاعة', transit: 'مدة العبور', approx: (n: number) => `حوالي ${n} يومًا`, tbc: 'بانتظار التأكيد',
    charges: 'الرسوم', line: 'الخط الملاحي', free: 'الفترة المجانية', days: 'يومًا', optionsHead: 'الخيارات', allIn: 'إجمالي الرسوم المذكورة', common: 'رسوم مشمولة في جميع الخيارات أعلاه',
    validity: (d: string) => `الصلاحية: حتى ${d}، رهنًا بتوفر المساحة والمعدّات وقت الحجز.`,
    notIncl: (x: string) => `غير مشمول: الرسوم الجمركية والضرائب والتأمين${x} وأي بند غير مذكور أعلاه.`, pending: (x: string) => `رهنًا بتأكيد: ${x}.`,
    bye: 'مع أطيب التحيات،', stale: '  (رهنًا بتأكيد الناقل)', option: 'الخيار', perCntr: ' لكل حاوية', chargeable: 'الوزن المحتسب', pcs: 'طرد', nonDg: 'غير خطرة',
    fobTbc: 'FOB (بانتظار التأكيد)', vs: (o: number) => `مقارنة بالخيار ${o}`, more: 'أكثر', less: 'أقل', fewer: 'أقل', options: 'خيارات',
  },
};

function optionHeader(q: Quote, i: number, badges: Badge[], lang: QLang): string {
  const W = TXT[lang];
  const name = [q.carrier, q.routing].filter(Boolean).join(' · ');
  const b = badges.length ? `  [${badges.map((x) => BADGE_L[lang][x]).join(' · ')}]` : '';
  return `${W.option} ${i + 1} — ${name}${b}`;
}

function optionFacts(q: Quote, lang: QLang): string {
  const W = TXT[lang];
  return [
    q.transitDays != null ? `${W.transit} ${W.approx(q.transitDays)}` : null,
    q.etd ? `ETD ${fmtDate(q.etd, lang)}${q.eta ? ` → ETA ${fmtDate(q.eta, lang)}` : ''}` : null,
    q.freeDays != null ? `${W.free} ${q.freeDays} ${W.days}` : null,
  ].filter(Boolean).join(' · ');
}

function quoteText(f: QuoteFields, opts: Quote[], badges: Badge[][], issues: Issue[], lang: QLang, qf?: QuoteFor | null, sign?: string[], tb?: TradeBlock | null): string {
  if (!opts.length) return '';
  const W = TXT[lang];
  const tl: Lang = lang === 'fa' || lang === 'ar' ? 'en' : lang;
  const q = opts[0];
  const multi = opts.length > 1;
  const mode = f.mode ? MODE_L[lang][f.mode] : '';
  const units = f.mode === 'fcl' || f.mode === 'road' ? equipmentText(f.equipment).replace(/x/g, '×') : f.mode === 'air' ? `${q.chargeable} kg ${W.chargeable}` : `${q.units}`;
  const cargoBits = [f.cargo, f.dg === 'no' ? W.nonDg : f.dg === 'yes' ? 'DG' : null].filter(Boolean).join(' · ');
  const weightBits = [f.pieces ? `${f.pieces} ${W.pcs}` : null, f.weightKg ? `${f.weightKg.toLocaleString('en-US')} kg${f.mode === 'fcl' ? W.perCntr : ''}` : null, f.volumeCbm ? `${f.volumeCbm} cbm` : null].filter(Boolean).join(' / ');
  const cur = q.currencies.length === 1 ? q.currencies[0] : q.currencies.join('/');
  const allLines = opts.flatMap((o) => o.lines);
  const width = Math.max(...allLines.map((l) => l.charge.length), 12) + 2;
  const row = (l: Quote['lines'][number]) => `  ${l.charge.padEnd(width)}${money(l.sell).padStart(10)}${l.stale ? W.stale : ''}`;
  const pending = [...new Set(issues.filter((i) => i.kind !== 'assumed' && i.question).map((i) => PENDING[i.field]?.[tl]).filter(Boolean))];
  const incotermLine = f.incoterm ?? W.fobTbc;
  const route = `${f.origin} → ${f.destination}`;
  const excluded = [...new Set(opts.flatMap((o) => o.excluded.map((l) => l.charge)))];
  const validMin = opts.map((o) => o.validUntil).filter((v): v is string => !!v).sort()[0] ?? null;
  const head = [
    ...(tb ? [tb.title, ''] : []),
    `${W.subject} — ${units} ${route} (${mode}, ${incotermLine})${multi ? ` — ${opts.length} ${W.options}` : ''}`,
    '',
    W.hi,
    '',
    multi ? W.thanksMulti : W.thanks,
    '',
    ...(qf && quoteForText(qf, lang).length ? [...quoteForText(qf, lang), ''] : []),
    `${W.route}: ${route}`,
    `${W.mode}: ${mode} · ${units}`,
    cargoBits || weightBits ? `${W.cargo}: ${[cargoBits, weightBits].filter(Boolean).join(' · ')}` : null,
    `Incoterm: ${incotermLine} · ${W.ready}: ${fmtDate(f.readyDate, lang)}`,
  ];
  let body: (string | null)[];
  if (!multi) {
    body = [
      q.carrier ? `${W.line}: ${[q.carrier, q.routing].filter(Boolean).join(' · ')}` : null,
      `${W.transit}: ${q.transitDays != null ? W.approx(q.transitDays) : W.tbc}${q.etd ? ` · ETD ${fmtDate(q.etd, lang)}${q.eta ? ` → ETA ${fmtDate(q.eta, lang)}` : ''}` : ''}${q.freeDays != null ? ` · ${W.free} ${q.freeDays} ${W.days}` : ''}`,
      '',
      `${W.charges} (${cur}):`,
      ...[...q.lines].sort((a, b) => SIDE_ORDER.indexOf(a.side) - SIDE_ORDER.indexOf(b.side)).map(row),
      `  ${'TOTAL'.padEnd(width)}${money(q.sellTotal).padStart(10)}`,
    ];
  } else {
    const base = opts[0];
    body = ['', `${W.optionsHead} (${cur}, ${W.allIn}):`];
    opts.forEach((o, i) => {
      const dSell = o.sellTotal - base.sellTotal;
      const dT = o.transitDays != null && base.transitDays != null ? o.transitDays - base.transitDays : 0;
      const diff = i === 0 ? '' : `  (${dSell >= 0 ? '+' : '−'}${money(Math.abs(dSell))}${dT ? `, ${dT > 0 ? '+' : '−'}${Math.abs(dT)} ${W.days}` : ''} ${W.vs(1)})`;
      body.push('', optionHeader(o, i, badges[i] ?? [], lang) + diff, `  ${optionFacts(o, lang)}`);
      body.push(...o.lines.filter((l) => l.side === 'freight').map(row));
      body.push(`  ${'TOTAL'.padEnd(width)}${money(o.sellTotal).padStart(10)}`);
    });
    const common = base.lines.filter((l) => l.side !== 'freight').sort((a, b) => SIDE_ORDER.indexOf(a.side) - SIDE_ORDER.indexOf(b.side));
    if (common.length) body.push('', `${W.common}:`, ...common.map(row));
  }
  return [
    ...head,
    ...body,
    ...(tb ? ['', ...tradeText(tb, lang)] : []),
    '',
    W.validity(fmtDate(validMin, lang)),
    W.notIncl(excluded.length ? `, ${excluded.join(', ')}` : ''),
    pending.length ? W.pending(pending.join('; ')) : null,
    '',
    W.bye,
    ...(sign ?? []),
  ].filter((x) => x !== null).join('\n');
}

interface ChipProps {
  label: string;
  value: ReactNode;
  status: 'ok' | 'missing' | 'ambiguous' | 'assumed';
  evidence?: string;
  editing: boolean;
  onEdit: () => void;
  editor: ReactNode;
}

function Chip({ label, value, status, evidence, editing, onEdit, editor }: ChipProps) {
  return (
    <div className={`q-chip q-${status} ${editing ? 'editing' : ''}`}>
      <span className="q-chip-label">{label}</span>
      {editing ? (
        <span className="q-chip-editor">{editor}</span>
      ) : (
        <button type="button" className="q-chip-value" onClick={onEdit} title={(() => { const g = getUiLang(); const f = g === 'es' ? ['Encontrado', 'pulsa para editar', 'Pulsa para editar'] : g === 'fa' ? ['پیدا شد', 'برای ویرایش کلیک کنید', 'برای ویرایش کلیک کنید'] : g === 'ar' ? ['وُجد', 'انقر للتعديل', 'انقر للتعديل'] : ['Found', 'click to edit', 'Click to edit']; return evidence ? `${f[0]}: “${evidence}” — ${f[1]}` : f[2]; })()}>
          {value}
        </button>
      )}
      {status !== 'ok' && !editing && <span className="q-chip-flag">{status === 'missing' ? 'MISSING' : status === 'ambiguous' ? 'TO CONFIRM' : 'ASSUMED'}</span>}
    </div>
  );
}

export function QuoteView({ seed, onOpenClient }: { seed?: { text: string; n: number; clientId?: string | null; laneId?: string | null } | null; onOpenClient?: (id: string) => void } = {}) {
  const { clients, company } = useStore();
  const [clientId, setClientId] = useState<string | null>(null);
  const client = clients.find((c) => c.id === clientId) ?? null;
  const [savedTo, setSavedTo] = useState<string | null>(null);
  const [laneId, setLaneId] = useState<string | null>(null);
  const [quoteMsds, setQuoteMsds] = useState<MsdsMeta | null>(null);
  const [dirOverride, setDirOverride] = useState<TradeDir | null>(null);
  const [rateAsked, setRateAsked] = useState<string[]>([]);
  const tariffs = useTariffs();
  const { list: agentDb } = useAgentsDb();
  const msdsRules = useMsdsRules();
  const [text, setText] = useState('');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [doneMs, setDoneMs] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [overrides, setOverrides] = useState<Partial<QuoteFields>>({});
  const [editing, setEditing] = useState<FieldKey | null>(null);
  const [margin, setMargin] = useState(15);
  const [rates, setRates] = useState<RateRow[]>(() => sampleRates());
  const [sheet, setSheet] = useState<{ name: string; rows: number; skipped: { line: number; reason: string }[] } | null>(null);
  const [extraLocs, setExtraLocs] = useState<string[]>([]);
  const [lang, setLang] = useState<QLang>('en');
  const [ui] = useUiLang();
  const u = (k: UKey) => qu(ui, k);
  const [activeCarrier, setActiveCarrier] = useState<string | null>(null);
  const [offCarriers, setOffCarriers] = useState<string[]>([]);
  const [copied, setCopied] = useState<'quote' | 'questions' | null>(null);
  const [showFormat, setShowFormat] = useState(false);
  const [pdfInternal, setPdfInternal] = useState(false);
  const [showTarget, setShowTarget] = useState(false);
  const [pdfState, setPdfState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const fileRef = useRef<HTMLInputElement>(null);
  const quoteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (startedAt == null || doneMs != null) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [startedAt, doneMs]);

  const parsed = useMemo(() => parseRequest(text, extraLocs), [text, extraLocs]);

  const startFresh = (t: string) => {
    setText(t);
    setOverrides({});
    setEditing(null);
    setCopied(null);
    setDoneMs(null);
    setStartedAt(t.trim() ? Date.now() : null);
    setNow(Date.now());
    const p = parseRequest(t, extraLocs);
    setLang(client ? client.lang : p.language);
    setSavedTo(null);
    setShowAvoid(false);
    setActiveCarrier(null);
    setOffCarriers([]);
    setLaneId(null);
    setQuoteMsds(null);
    setDirOverride(null);
  };

  /** Prefill POL/POD/commodity/HS/volume from one of the client's lane profiles. */
  const applyLane = (cid: string, l: LaneProfile) => {
    const c = clients.find((x) => x.id === cid);
    if (!c) return;
    const r = laneToRequest(l, c.name, c.incoterm);
    startFresh(r.text);
    setOverrides(r.fields);
    setLaneId(l.id);
    setLang(c.lang);
  };

  const applyClient = (id: string | null) => {
    setClientId(id);
    setLaneId(null);
    setSavedTo(null);
    const c = clients.find((x) => x.id === id);
    if (c) {
      setMargin(c.marginPct);
      setLang(c.lang);
    }
  };

  useEffect(() => {
    if (!seed) return;
    if (seed.text) startFresh(seed.text);
    if (seed.clientId !== undefined) applyClient(seed.clientId ?? null);
    if (seed.clientId && seed.laneId) {
      const l = clients.find((x) => x.id === seed.clientId)?.lanes.find((x) => x.id === seed.laneId);
      if (l) applyLane(seed.clientId, l);
    }
  }, [seed?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  const mode = overrides.mode !== undefined ? overrides.mode : parsed.fields.mode;
  const originRes = parsed.originBase ? resolveForMode(parsed.originBase, mode) : null;
  const destRes = parsed.destBase ? resolveForMode(parsed.destBase, mode) : null;
  const fields: QuoteFields = {
    ...parsed.fields,
    mode,
    origin: originRes?.name ?? null,
    destination: destRes?.name ?? null,
    ...overrides,
  };
  const clientIncoterm = !!client && parsed.fields.incoterm == null && overrides.incoterm === undefined;
  if (clientIncoterm) fields.incoterm = client!.incoterm as QuoteFields['incoterm'];
  if (overrides.mode !== undefined && overrides.origin === undefined) fields.origin = originRes?.name ?? null;
  if (overrides.mode !== undefined && overrides.destination === undefined) fields.destination = destRes?.name ?? null;

  const originOptions = overrides.origin === undefined ? originRes?.options : undefined;
  const destOptions = overrides.destination === undefined ? destRes?.options : undefined;

  const baseIssues: Issue[] = useMemo(() => {
    if (!text.trim()) return [];
    const out: Issue[] = [];
    if (originOptions)
      out.push({
        field: 'origin',
        kind: 'ambiguous',
        message: `${parsed.originBase} has ${originOptions.length} container ports — ${originOptions.join(' or ')}. Different trucking, tolls and terminal fees.`,
        question: {
          en: `Which ${parsed.originBase} port should we quote from — ${originOptions.map((o) => o.replace(/^.*\((.*)\)$/, '$1')).join(' or ')}? If the factory address is known, we can suggest the cheaper one.`,
          es: `¿Desde qué puerto de ${parsed.originBase} cotizamos — ${originOptions.map((o) => o.replace(/^.*\((.*)\)$/, '$1')).join(' o ')}? Si nos pasáis la dirección de fábrica, os recomendamos el más económico.`,
        },
        options: originOptions,
      });
    if (destOptions)
      out.push({ field: 'destination', kind: 'ambiguous', message: `${parsed.destBase}: choose port (${destOptions.join(' / ')}).`, options: destOptions });
    for (const i of parsed.parseIssues) if (overrides[i.field as FieldKey] === undefined && !(clientIncoterm && i.field === 'incoterm')) out.push(i);
    if (clientIncoterm) out.push({ field: 'incoterm', kind: 'assumed', message: `No Incoterm in the request — using ${client!.name}'s default ${client!.incoterm} (client setup).` } as Issue);
    for (const i of missingIssues(fields)) if (!out.some((o) => o.field === i.field && o.kind === i.kind)) out.push(i);
    const rank = { missing: 0, ambiguous: 1, confirm: 1, assumed: 2 };
    return out.sort((a, b) => rank[a.kind] - rank[b.kind]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, parsed, JSON.stringify(overrides), JSON.stringify(fields), originOptions?.join(), destOptions?.join(), clientId, client?.incoterm]);

  const statusOf = (k: FieldKey): ChipProps['status'] => {
    const mine = issues.filter((i) => i.field === k);
    if (mine.some((i) => i.kind === 'missing')) return 'missing';
    if (mine.some((i) => i.kind === 'ambiguous' || i.kind === 'confirm')) return 'ambiguous';
    if (mine.some((i) => i.kind === 'assumed')) return 'assumed';
    return 'ok';
  };

  const rawQuote = useMemo(() => (text.trim() ? buildQuote(fields, rates, margin) : null), [text, JSON.stringify(fields), rates, margin]); // eslint-disable-line react-hooks/exhaustive-deps
  const allOptions = useMemo(() => (text.trim() ? buildOptions(fields, rates, margin) : []), [text, JSON.stringify(fields), rates, margin]); // eslint-disable-line react-hooks/exhaustive-deps
  const [showAvoid, setShowAvoid] = useState(false);
  const rankOf = (carrier: string | null) => lineRank(client, carrier);
  const avoided = allOptions.filter((o) => rankOf(o.carrier) === 'avoid');
  const visible = showAvoid || avoided.length === allOptions.length ? allOptions : allOptions.filter((o) => rankOf(o.carrier) !== 'avoid');
  // client-preferred lines first, then by price (buildOptions already sorts by price)
  const options = [...visible].sort((a, b) => Number(rankOf(b.carrier) === 'preferred') - Number(rankOf(a.carrier) === 'preferred'));
  const prefCount = options.filter((o) => rankOf(o.carrier) === 'preferred').length;
  const linesNote = client && allOptions.length > 1 && (prefCount || avoided.length) ? (
    <>
      {prefCount ? linesText(ui, 'pref', client.name, prefCount) : ''}
      {avoided.length > 0 && (
        <>
          {showAvoid ? linesText(ui, 'showing', client.name, avoided.length) : linesText(ui, 'hidden', client.name, avoided.length, avoided.map((o) => o.carrier).join(', '))}
          <button type="button" className="q-linklike" onClick={() => setShowAvoid((v) => !v)} data-testid="toggle-avoid">{linesText(ui, showAvoid ? 'hide' : 'show', '', 0)}</button>
        </>
      )}
    </>
  ) : null;
  const clientAgent = client ? agentForPort(client, fields.destination) ?? agentForPort(client, fields.origin) : null;
  const badges = useMemo(() => optionBadges(options), [options]);
  const recIdx = Math.max(0, badges.findIndex((b) => b.includes('recommended')));
  const activeIdx = options.findIndex((o) => o.carrier === activeCarrier) >= 0 ? options.findIndex((o) => o.carrier === activeCarrier) : recIdx;
  const quote: Quote | null = options.length ? options[activeIdx] : rawQuote;
  // the client's lane profile for this request: the one picked, else one matching POL/POD
  const laneProfile = client ? client.lanes.find((l) => l.id === laneId) ?? client.lanes.find((l) => sameLane(l, fields.origin, fields.destination)) ?? null : null;
  // MSDS: needed by HS code (sample rule list) or DG; attached to the lane profile when there is one
  const hsText = hsFromText(text);
  const hsQ = laneProfile?.hs || hsText || (fields.cargo ? hsFromCommodity(fields.cargo) : null);
  const hsGuessed = !laneProfile?.hs && !hsText && !!hsQ;
  const msdsInfo = msdsNeed(hsQ, laneProfile?.dg ? 'yes' : fields.dg);
  const msdsMeta = laneProfile ? laneProfile.msds ?? null : quoteMsds;
  const setMsds = (m: MsdsMeta | null) => {
    if (client && laneProfile) store.setLanes(client.id, client.lanes.map((l) => (l.id === laneProfile.id ? { ...l, msds: m } : l)));
    else setQuoteMsds(m);
  };
  const issues: Issue[] = useMemo(() => {
    if (!text.trim()) return baseIssues;
    let out = baseIssues;
    if (msdsInfo.need === 'required' && !msdsMeta) {
      const why = msdsInfo.rule ? `HS ${hsQ}${hsGuessed ? ` (guessed from “${fields.cargo}”)` : ''} → ${msdsInfo.rule.label}` : 'cargo marked DG';
      out = out.filter((i) => !(i.field === 'dg' && i.kind === 'confirm'));
      out = [...out, {
        field: 'dg', kind: 'confirm',
        message: `MSDS required (${why} — sample rule, confirm with line) and not attached yet.`,
        question: fields.dg === 'yes' || laneProfile?.dg
          ? { en: 'Please send the MSDS (material safety data sheet), UN number and IMO class so we can confirm DG acceptance with the line.', es: 'Por favor enviad la MSDS (ficha de datos de seguridad), número UN y clase IMO para confirmar la aceptación DG con la naviera.' }
          : { en: 'Please send the MSDS (material safety data sheet) for this cargo, and the UN number if it is classified as dangerous goods — the line asks for it on this HS code.', es: 'Por favor enviad la MSDS (ficha de datos de seguridad) de la mercancía y el número UN si está clasificada como peligrosa — la naviera la pide para este código HS.' },
      } as Issue];
    } else if (msdsMeta) {
      out = out.map((i) => (i.field === 'dg' && i.question && /MSDS/.test(i.question.en) ? { ...i, message: `${i.message} MSDS received (${msdsMeta.name}).`, question: { en: 'MSDS received, thank you. Please confirm the UN number and IMO class.', es: 'MSDS recibida, gracias. Por favor confirmad número UN y clase IMO.' } } : i));
    }
    const rank = { missing: 0, ambiguous: 1, confirm: 1, assumed: 2 };
    return [...out].sort((a, b) => rank[a.kind] - rank[b.kind]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseIssues, msdsInfo.need, msdsInfo.rule?.prefix, msdsMeta?.id, hsQ, fields.dg, laneProfile?.dg, msdsRules]);
  const targetDiff = (q: Quote | null): { perUnit: number; diff: number } | null => {
    if (!q || !laneProfile || laneProfile.target.amount == null || laneProfile.target.currency !== 'USD' || !q.currencies.every((c) => c === 'USD')) return null;
    const u = targetUnits(laneProfile.target.per, fields);
    if (!u) return null;
    const perUnit = q.sellTotal / u;
    return { perUnit, diff: Math.round(perUnit - laneProfile.target.amount) };
  };
  // customer options: recommended first, then by price
  const custIdx = options
    .map((_, i) => i)
    .filter((i) => !offCarriers.includes(options[i].carrier ?? ''))
    .sort((a, b) => {
      const pa = Number(rankOf(options[a].carrier) === 'preferred');
      const pb = Number(rankOf(options[b].carrier) === 'preferred');
      if (pa !== pb) return pb - pa;
      return a === recIdx ? -1 : b === recIdx ? 1 : options[a].sellTotal - options[b].sellTotal;
    });
  const custOpts = custIdx.map((i) => options[i]);
  const custBadges = custIdx.map((i) => badges[i] ?? []);
  const tl: Lang = lang === 'fa' || lang === 'ar' ? 'en' : lang;

  const alternatives = useMemo(() => {
    const opts = originRes?.options;
    if (!opts || !text.trim()) return [];
    return opts
      .filter((o) => o !== fields.origin)
      .map((o) => ({ name: o, q: buildQuote({ ...fields, origin: o }, rates, margin) }))
      .filter((a) => a.q && a.q.hasFreight);
  }, [originRes?.options?.join(), JSON.stringify(fields), rates, margin, text]); // eslint-disable-line react-hooks/exhaustive-deps

  const allLocations = useMemo(() => {
    const s = new Set<string>();
    for (const l of LOCATIONS) if (!l.choices || Object.keys(l.choices).length === 0) s.add(l.name);
    for (const r of rates) {
      if (r.origin !== '*') s.add(r.origin);
      if (r.destination !== '*') s.add(r.destination);
    }
    return [...s].sort();
  }, [rates]);

  const setField = <K extends FieldKey>(k: K, v: QuoteFields[K]) => setOverrides((o) => ({ ...o, [k]: v }));
  const closeEdit = () => setEditing(null);

  const onUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = loadRateCsv(String(reader.result ?? ''));
      if (res.rows.length) {
        setRates(res.rows);
        setExtraLocs(res.newLocations);
      }
      setSheet({ name: file.name, rows: res.rows.length, skipped: res.skipped });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const resetSample = () => {
    setRates(sampleRates());
    setSheet(null);
    setExtraLocs([]);
  };

  const autoD = autoDir(fields);
  const dir: TradeDir = dirOverride ?? autoD ?? 'export';
  const tradeFor = (l: QLang) => (custOpts.length && fields.mode === 'fcl' ? tradeBlock(dir, fields, custOpts[0], tariffs, l, laneProfile?.payment ?? client?.paymentTerms ?? null) : null);
  const tb = tradeFor(lang);
  const tbUi = ui === lang ? tb : tradeFor(ui);
  // Agent picker: import → agents at the POL, export → agents at the POD. Client's own list first, then the Agent CRM
  // (preferred → active → prospect → on hold; blacklisted, archived and sanctions-listed agents are never offered).
  const agentPort = dir === 'import' ? fields.origin : fields.destination;
  const polBase = (agentPort ?? '').toLowerCase().replace(/\s*\(.*\)$/, '');
  const hiddenNames = listedNames();
  const crmUsable = pickable(agentDb);
  const ST_LABEL: Record<string, string> = { preferred: 'Preferred', active: 'Active', prospect: 'Prospect', on_hold: 'On hold' };
  const originAgents = polBase ? [
    ...(client?.agents ?? []).filter((a) => a.type === 'overseas' && a.rank !== 'avoid' && a.ports.toLowerCase().includes(polBase) && !hiddenNames.has(a.name.trim().toLowerCase()) && !agentDb.some((d) => d.archived && d.name.toLowerCase() === a.name.toLowerCase())).map((a) => ({ id: agentDb.find((d) => d.id === a.dbId || d.name.toLowerCase() === a.name.toLowerCase())?.id ?? null, name: a.name, tag: a.rank === 'preferred' ? 'Client preferred' : 'Client allowed', note: a.contactName || a.email, sanc: '', st: '' })),
    ...crmUsable.filter((d) => d.type !== 'line' && d.type !== 'network' && (`${d.ports} ${d.city}`.toLowerCase().includes(polBase) || (d.lanePairs ?? []).some((p) => p.from.toLowerCase().includes(polBase) || p.to.toLowerCase().includes(polBase))) && !(client?.agents ?? []).some((a) => a.name.toLowerCase() === d.name.toLowerCase())).slice(0, 8).map((d) => ({ id: d.id, name: d.name, tag: `Agent CRM · ${ST_LABEL[agentStatus(d)] ?? agentStatus(d)}${d.sample ? ' · sample' : d.publicInfo ? ' · public info, verify' : ''}`, note: d.contacts?.[0] ? `${d.contacts[0].name}${d.contacts[0].email ? ` · ${d.contacts[0].email}` : ''}` : d.services, sanc: sanctionsLevel(d.sanctions) ?? '', st: agentStatus(d) })),
  ] : [];
  const otherCrm = crmUsable.filter((d) => d.type !== 'network' && !originAgents.some((a) => a.id === d.id));
  const logRateRequest = (agentId: string, name: string) => {
    activities.add({ id: rid('act'), agentId, kind: 'rate_request', at: Date.now(), text: `Rate request from Quote: ${fields.origin ?? '?'} → ${fields.destination ?? '?'}${fields.mode ? ` · ${fields.mode.toUpperCase()}` : ''}`, by: 'demo' });
    setRateAsked((x) => [...x, name]);
  };
  const quoteFor = (forInternal: boolean): QuoteFor | null => {
    if (!client && !laneProfile && !text.trim()) return null;
    return {
      client: client ? { name: client.name, contactName: client.contactName, email: client.email, phone: client.phone, address: client.address } : null,
      lane: laneProfile ? { pol: laneProfile.pol, pod: laneProfile.pod, commodity: laneProfile.commodity, hs: laneProfile.hs, volume: fmtVolume(laneProfile, 'en'), payment: laneProfile.payment } : null,
      target: laneProfile && laneProfile.target.amount != null && (forInternal || showTarget) ? fmtTarget(laneProfile, 'en') : null,
      msds: msdsMeta ? { status: 'received', file: msdsMeta.name } : hsQ || fields.dg === 'yes' ? { status: msdsInfo.need } : null,
    };
  };
  const qText = custOpts.length ? quoteText(fields, custOpts, custBadges, issues, lang, quoteFor(false), [company.contactName, company.name, [company.email, company.phone].filter(Boolean).join(' · ')].filter(Boolean), tb) : '';
  const askText = questionsText(issues, tl);
  const elapsed = startedAt == null ? null : (doneMs ?? now - startedAt);
  const usingSample = !sheet || sheet.rows === 0;

  async function doPdf() {
    if (!custOpts.length) return;
    setPdfState('busy');
    try {
      const { generateQuotePdf } = await import('./pdf');
      const { blob, filename } = await generateQuotePdf({
        fields, quote: custOpts[0], options: custOpts, badges: custBadges, issues: issues.filter((i) => i.kind !== 'assumed'), lang: tl, internal: pdfInternal, msds: msdsMeta ? { name: msdsMeta.name, at: msdsMeta.at } : null, sampleRates: usingSample, sourceText: text, marginTarget: margin,
        company, clientName: client?.name ?? null, quoteFor: quoteFor(pdfInternal), trade: tradeFor(tl),
      });
      if (!pdfInternal) record('pdf');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setPdfState('done');
      setTimeout(() => setPdfState('idle'), 2500);
    } catch (err) {
      console.warn('PDF generation failed', err);
      setPdfState('error');
    }
  }
  const templateHref = `${import.meta.env.BASE_URL}rate-sheet-template.csv`;

  function record(via: 'copy' | 'pdf') {
    if (!custOpts.length) return;
    const units = fields.mode === 'fcl' || fields.mode === 'road' ? equipmentText(fields.equipment).replace(/x/g, '×') : fields.mode === 'air' ? `${custOpts[0].chargeable} kg` : String(custOpts[0].units);
    store.recordQuote({
      id: quoteNumber(text), clientId, at: Date.now(), route: `${fields.origin} → ${fields.destination}`, mode: fields.mode ? MODE_L.en[fields.mode] : '', units,
      options: custOpts.map((o) => ({ carrier: o.carrier ?? '—', sell: o.sellTotal, transit: o.transitDays })), currency: custOpts[0].currencies.join('/') || 'USD', via, sample: usingSample,
    }, { options: custOpts.map((o) => ({ carrier: o.carrier ?? '—', buy: o.buyTotal, margin: o.marginUsd, marginPct: o.marginPct })), marginPct: margin ?? null, sample: usingSample });
    setSavedTo(client ? client.name : 'unassigned');
  }

  const doCopy = async (what: 'quote' | 'questions') => {
    const ok = await copyText(what === 'quote' ? qText : askText);
    if (ok && what === 'quote') record('copy');
    if (ok) {
      setCopied(what);
      if (what === 'quote' && startedAt != null && doneMs == null) setDoneMs(Date.now() - startedAt);
      window.setTimeout(() => setCopied((c) => (c === what ? null : c)), 2500);
    }
  };

  const lineGroups = quote ? SIDE_ORDER.map((s) => ({ side: s, lines: quote.lines.filter((l) => l.side === s) })).filter((g) => g.lines.length) : [];

  const sel = (k: FieldKey, value: string, options: { v: string; l: string }[], apply: (v: string) => void) => (
    <select
      autoFocus
      className="q-input"
      value={value}
      onChange={(e: ChangeEvent<HTMLSelectElement>) => {
        apply(e.target.value);
        closeEdit();
      }}
      onBlur={closeEdit}
      aria-label={k}
    >
      <option value="">—</option>
      {options.map((o) => (
        <option key={o.v} value={o.v}>
          {o.l}
        </option>
      ))}
    </select>
  );

  const inp = (k: FieldKey, value: string, apply: (v: string) => void, type: 'text' | 'number' | 'date' = 'text') => (
    <input
      autoFocus
      className="q-input"
      type={type}
      defaultValue={value}
      aria-label={k}
      onBlur={(e) => {
        apply(e.target.value);
        closeEdit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') closeEdit();
      }}
    />
  );

  const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));

  return (
    <div className="quote-view">
      <section className="q-left" aria-label="Customer request">
        <div className="q-panel">
          <div className="q-head">
            <h2>{u('pasteH')}</h2>
            {elapsed != null && (
              <span className={`q-timer ${doneMs != null ? 'done' : ''}`} title={u('timerTitle')}>
                {doneMs != null ? u('readyIn') : u('timeTo')}
                <strong>{fmtElapsed(elapsed)}</strong>
              </span>
            )}
          </div>
          <div className="q-client" data-testid="quote-client">
            <span className="q-muted">{u('client')}</span>
            <select value={clientId ?? ''} onChange={(e) => applyClient(e.target.value || null)} data-testid="quote-client-select" aria-label={u('client')}>
              <option value="">{u('none')}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.sample ? u('sample') : ''}</option>
              ))}
            </select>
            {client ? (
              <>
                <span className="q-client-defs">
                  {client.marginPct}% · {client.incoterm} · {client.lang.toUpperCase()} · {client.lines.length ? client.lines.join(', ') : u('anyLine')}{client.freeTimeRequest ? ` · ${u('ask')} ${client.freeTimeRequest} ${u('dFree')}` : ''}
                </span>
                {onOpenClient && <button type="button" className="q-linklike" onClick={() => onOpenClient(client.id)}>{u('dashboard')}</button>}
              </>
            ) : (
              <span className="q-client-defs">{u('pickClient')}</span>
            )}
          </div>
          {client && client.lanes.length > 0 && (
            <div className="q-client q-lanes" data-testid="quote-lanes">
              <span className="q-muted">{u('lanes')}</span>
              {client.lanes.map((l, i) => (
                <button key={l.id} type="button" className={`btn ghost sm ${laneProfile?.id === l.id ? 'active' : ''}`} onClick={() => applyLane(client.id, l)} data-testid={`quote-lane-${i}`} title={`${l.commodity} · ${fmtVolume(l, ui)} · ${u('target')} ${fmtTarget(l, ui)}`}>
                  {l.pol.replace(/ \(.*\)$/, '')} → {l.pod.replace(/ \(.*\)$/, '')} · {l.commodity.split(/[,(]/)[0].trim()}
                </button>
              ))}
            </div>
          )}
          <textarea
            className="q-paste"
            placeholder={u('placeholder')}
            value={text}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
              const v = e.target.value;
              if (!text.trim() && v.trim()) startFresh(v);
              else {
                setText(v);
                if (!v.trim()) {
                  setStartedAt(null);
                  setDoneMs(null);
                }
              }
            }}
            onPaste={(e) => {
              const el = e.currentTarget;
              window.setTimeout(() => startFresh(el.value), 0);
            }}
            rows={4}
          />
          <div className="q-samples">
            <span className="q-muted">{u('trySample')}</span>
            {SAMPLE_REQUESTS.map((s) => (
              <button key={s.id} type="button" className="btn ghost sm" onClick={() => startFresh(s.text)} title={s.text}>
                {sampleLabel(ui, s.label)}
              </button>
            ))}
            {text && (
              <button type="button" className="btn ghost sm" onClick={() => startFresh('')}>
                {u('clear')}
              </button>
            )}
          </div>
        </div>

        {text.trim() && (
          <div className={`q-summary ${quote && quote.hasFreight ? 'priced' : 'unpriced'}`} data-testid="quote-summary">
            {quote && quote.hasFreight ? (
              <>
                <span className="q-summary-tag">{u('priced')}</span>
                <span className="mono">
                  {u('sellU')} <strong>${money(quote.sellTotal)}</strong> · {u('margin')} ${money(quote.marginUsd)} ({quote.marginPct}%) · {quote.transitDays ?? '?'} {u('d')}
                  {options.length > 1 && <> · {options.length} {u('optionsFrom')} ${money(Math.min(...options.map((o) => o.sellTotal)))}</>}
                </span>
                <span className="q-summary-meta">
                  {issues.filter((i) => i.kind === 'missing').length === 0
                    ? issues.filter((i) => i.kind === 'ambiguous' || i.kind === 'confirm').length === 0
                      ? u('allPresent')
                      : `${issues.filter((i) => i.kind === 'ambiguous' || i.kind === 'confirm').length} ${u('toConfirmCust')}`
                    : `${issues.filter((i) => i.kind === 'missing').length} ${u('missing')}`}
                </span>
                <button type="button" className="btn sm primary" onClick={() => quoteRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                  {u('viewQuote')}
                </button>
              </>
            ) : (
              <>
                <span className="q-summary-tag">{u('notPriced')}</span>
                <span>{!quote ? u('needsMode') : `${u('noRateFor')} ${fields.origin} → ${fields.destination} ${u('inSheet')}`}</span>
              </>
            )}
          </div>
        )}

        {text.trim() && (
          <div className="q-panel">
            <div className="q-head">
              <h2>{u('whatRead')}</h2>
              <span className="q-muted">{u('clickFix')}</span>
            </div>
            <div className="q-chips">
              <Chip label={u('fMode')} status={statusOf('mode')} evidence={parsed.evidence.mode} editing={editing === 'mode'} onEdit={() => setEditing('mode')}
                value={fields.mode ? modeLabel(ui, fields.mode) : '—'}
                editor={sel('mode', fields.mode ?? '', (Object.keys(MODE_LABEL) as QMode[]).map((m) => ({ v: m, l: modeLabel(ui, m) })), (v) => setField('mode', (v || null) as QMode | null))} />
              <Chip label={u('fOrigin')} status={statusOf('origin')} evidence={parsed.evidence.origin} editing={editing === 'origin'} onEdit={() => setEditing('origin')}
                value={fields.origin ?? '—'}
                editor={sel('origin', fields.origin ?? '', allLocations.map((l) => ({ v: l, l })), (v) => setField('origin', v || null))} />
              <Chip label={u('fDest')} status={statusOf('destination')} evidence={parsed.evidence.destination} editing={editing === 'destination'} onEdit={() => setEditing('destination')}
                value={fields.destination ?? '—'}
                editor={sel('destination', fields.destination ?? '', allLocations.map((l) => ({ v: l, l })), (v) => setField('destination', v || null))} />
              {(fields.mode === 'fcl' || fields.mode === 'road' || Object.keys(fields.equipment).length > 0) && (
                <Chip label={u('fEquip')} status={statusOf('equipment')} evidence={parsed.evidence.equipment} editing={editing === 'equipment'} onEdit={() => setEditing('equipment')}
                  value={equipmentText(fields.equipment) || '—'}
                  editor={inp('equipment', equipmentText(fields.equipment), (v) => setField('equipment', parseEquipmentInput(v)))} />
              )}
              <Chip label={u('fWeight')} status={statusOf('weightKg')} evidence={parsed.evidence.weightKg} editing={editing === 'weightKg'} onEdit={() => setEditing('weightKg')}
                value={fields.weightKg != null ? `${fields.weightKg.toLocaleString('en-US')} kg${fields.mode === 'fcl' ? u('perCntr') : fields.mode === 'road' && parsed.weightPerUnit ? u('perTruck') : ''}` : '—'}
                editor={inp('weightKg', fields.weightKg != null ? String(fields.weightKg) : '', (v) => setField('weightKg', numOrNull(v)), 'number')} />
              <Chip label={u('fVolume')} status={statusOf('volumeCbm')} evidence={parsed.evidence.volumeCbm} editing={editing === 'volumeCbm'} onEdit={() => setEditing('volumeCbm')}
                value={fields.volumeCbm != null ? `${fields.volumeCbm} cbm` : '—'}
                editor={inp('volumeCbm', fields.volumeCbm != null ? String(fields.volumeCbm) : '', (v) => setField('volumeCbm', numOrNull(v)), 'number')} />
              {fields.mode === 'air' && (
                <div className="q-chip q-ok q-derived">
                  <span className="q-chip-label">{u('fCharge')}</span>
                  <span className="q-chip-static">{chargeableKg(fields.weightKg, fields.volumeCbm) ?? '—'} kg</span>
                  <span className="q-chip-hint">1:6000</span>
                </div>
              )}
              <Chip label={u('fPieces')} status="ok" evidence={parsed.evidence.pieces} editing={editing === 'pieces'} onEdit={() => setEditing('pieces')}
                value={fields.pieces ?? '—'}
                editor={inp('pieces', fields.pieces != null ? String(fields.pieces) : '', (v) => setField('pieces', numOrNull(v)), 'number')} />
              <Chip label={u('fInco')} status={statusOf('incoterm')} evidence={parsed.evidence.incoterm} editing={editing === 'incoterm'} onEdit={() => setEditing('incoterm')}
                value={fields.incoterm ?? '—'}
                editor={sel('incoterm', fields.incoterm ?? '', INCOTERMS.map((i) => ({ v: i, l: i })), (v) => setField('incoterm', v || null))} />
              <Chip label={u('fReady')} status={statusOf('readyDate')} evidence={parsed.evidence.readyDate} editing={editing === 'readyDate'} onEdit={() => setEditing('readyDate')}
                value={fmtDate(fields.readyDate, ui)}
                editor={inp('readyDate', fields.readyDate && fields.readyDate !== 'ASAP' ? fields.readyDate : '', (v) => setField('readyDate', v || null), 'date')} />
              <Chip label={u('fCargo')} status={statusOf('cargo')} evidence={parsed.evidence.cargo} editing={editing === 'cargo'} onEdit={() => setEditing('cargo')}
                value={fields.cargo ?? '—'}
                editor={inp('cargo', fields.cargo ?? '', (v) => setField('cargo', v.trim() || null))} />
              <Chip label={u('fDg')} status={statusOf('dg')} evidence={parsed.evidence.dg} editing={editing === 'dg'} onEdit={() => setEditing('dg')}
                value={<>{fields.dg === 'yes' || laneProfile?.dg ? u('yesDg') : fields.dg === 'no' ? u('no') : u('unknown')} <MsdsChip hs={hsQ} dg={laneProfile?.dg ? 'yes' : fields.dg} meta={msdsMeta} lang={ui} /></>}
                editor={sel('dg', fields.dg, [{ v: 'no', l: u('no') }, { v: 'yes', l: u('yesDg') }, { v: 'unknown', l: u('unknown') }], (v) => setField('dg', (v || 'unknown') as DgState))} />
            </div>
            <div className="q-msds" data-testid="quote-msds">
              <span className="q-muted">MSDS{hsQ ? <> · HS <bdi dir="ltr" className="mono">{hsQ}</bdi>{hsGuessed ? u('hsGuessed') : laneProfile?.hs ? u('hsLane') : ''}</> : u('noHs')}</span>
              <MsdsSlot hs={hsQ} dg={laneProfile?.dg ? 'yes' : fields.dg} meta={msdsMeta} onChange={setMsds} lang={ui} testid="quote-msds-slot" clientId={client?.id ?? null} />
              {msdsMeta && laneProfile && <span className="q-muted">{u('savedOn')} {client!.name}</span>}
            </div>
          </div>
        )}

        {text.trim() && issues.length > 0 && (
          <div className="q-panel">
            <div className="q-head">
              <h2>{u('askH')}</h2>
              <span className="q-muted">{issues.filter((i) => i.kind === 'missing').length} {u('missing')} · {issues.filter((i) => i.kind === 'ambiguous' || i.kind === 'confirm').length} {u('toConfirm')} · {issues.filter((i) => i.kind === 'assumed').length} {u('assumed')}</span>
            </div>
            <ul className="q-issues">
              {issues.map((i, n) => (
                <li key={n} className={`q-issue q-${i.kind === 'confirm' ? 'ambiguous' : i.kind}`}>
                  <span className="q-issue-tag">{i.kind === 'missing' ? u('tagMissing') : i.kind === 'assumed' ? u('tagAssumed') : u('tagConfirm')}</span>
                  <div>
                    <div className="q-issue-msg">{issueText(ui, i.message)}</div>
                    {i.question && <div className="q-issue-q">“{i.question[tl]}”</div>}
                    {i.options && (
                      <div className="q-options">
                        {i.options.map((o) => (
                          <button key={o} type="button" className={`btn sm ${fields[i.field as FieldKey] === o ? 'primary' : 'ghost'}`} onClick={() => setField(i.field as FieldKey, o as never)}>
                            {o}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {askText && (
              <div className="q-actions">
                <button type="button" className="btn sm" onClick={() => void doCopy('questions')}>
                  {copied === 'questions' ? u('copied') : u('copyQ')}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="q-right" aria-label="Quote">
        <div className={`q-banner ${usingSample ? 'sample' : 'own'}`}>
          <div>
            {usingSample ? (
              <>
                <strong>{u('sampleRates')}</strong> {u('sampleRatesNote')}
              </>
            ) : (
              <>
                <strong>{u('yourSheet')}</strong> — {sheet!.name} · {sheet!.rows} {u('rows')}
              </>
            )}
          </div>
          <div className="q-banner-actions">
            <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={onUpload} data-testid="rate-upload" />
            <button type="button" className="btn sm primary" onClick={() => fileRef.current?.click()}>
              {u('loadSheet')}
            </button>
            <a className="btn sm ghost" href={templateHref} download="forwarddesk-rate-sheet-template.csv">
              {u('dlTemplate')}
            </a>
            {!usingSample && (
              <button type="button" className="btn sm ghost" onClick={resetSample}>
                {u('useSample')}
              </button>
            )}
            <button type="button" className="btn sm ghost" onClick={() => setShowFormat((s) => !s)}>
              {showFormat ? u('hideFormat') : u('csvFormat')}
            </button>
          </div>
        </div>
        {sheet && sheet.skipped.length > 0 && (
          <div className="q-warn">
            {sheet.rows === 0 ? u('couldNotLoad') : `${sheet.skipped.length} ${u('rowsSkipped')}`}
            {sheet.skipped.slice(0, 4).map((s) => `${u('line')} ${s.line}: ${s.reason}`).join(' · ')}
          </div>
        )}
        {showFormat && (
          <div className="q-panel q-format">
            <p>{u('fmtIntro')} <code dir="ltr">{CSV_COLUMNS.join(', ')}</code></p>
            <ul>{(['fmt1', 'fmt2', 'fmt3', 'fmt4', 'fmt5'] as const).map((k) => <li key={k}>{u(k)}</li>)}</ul>
          </div>
        )}

        {!text.trim() && (
          <div className="q-panel q-empty">
            <Art name="truck" className="fd-empty-art" />
            <strong>{u('emptyH')}</strong>
            <p>{u('emptyP')}</p>
          </div>
        )}

        {text.trim() && !quote && (
          <div className="q-panel q-empty">
            <Art name="map" className="fd-empty-art" />
            <strong>{u('needH')}</strong>
            <p>{u('fixLeft')}</p>
          </div>
        )}

        {quote && !quote.hasFreight && (
          <div className="q-panel q-empty">
            <Art name="containers" className="fd-empty-art" />
            <strong>{u('noRateFor')} {fields.origin} → {fields.destination}{fields.mode ? ` · ${modeLabel(ui, fields.mode)}` : ''}{fields.mode === 'fcl' ? ` (${Object.keys(fields.equipment).join(', ') || u('noEquip')})` : ''} {u('inSheet')}</strong>
            <p>{u('addRow')}</p>
          </div>
        )}

        {quote && quote.hasFreight && (
          <>
            {quote.staleCount > 0 && (
              <div className="q-warn stale">
                <strong>{u('recheckH')}</strong> — {quote.lines.filter((l) => l.stale).map((l) => `${l.charge} ${u('expired')} ${fmtDate(l.validUntil, ui)}`).join('; ')}. {u('recheckP')}
              </div>
            )}
            <div className="q-panel q-quote-panel" ref={quoteRef}>
              <div className="q-head">
                <h2>
                  {u('quoteH')} · {fields.origin} → {fields.destination}
                  {options.length > 1 && quote.carrier ? ` · ${ol(ui, 'showing')} ${quote.carrier}` : ''}
                </h2>
                <span className="q-muted">{unitsText(ui, quote.units)}</span>
              </div>
              <div className="q-scope">{scopeText(ui, fields.incoterm, quote.scopeNote)}</div>
              {linesNote && <div className="q-scope" data-testid="lines-note">{linesNote}</div>}
              {laneProfile && (
                <div className="q-scope" data-testid="lane-note">
                  {client!.name} · {u('laneProfile')}: {laneProfile.commodity}{laneProfile.hs ? <> · HS <bdi dir="ltr" className="mono">{laneProfile.hs}</bdi> ({hsCheck(laneProfile.hs, ui).text})</> : null} · {fmtVolume(laneProfile, ui)} · {laneProfile.payment} · {u('target')} <strong><bdi dir="ltr">{fmtTarget(laneProfile, ui)}</bdi></strong>
                  {targetDiff(quote) && <> · {u('thisOption')} <bdi dir="ltr" className="mono">${money(Math.round(targetDiff(quote)!.perUnit))}</bdi>/{laneProfile.target.per} <TargetDelta diff={targetDiff(quote)!.diff} lang={ui} /></>}
                </div>
              )}
              {fields.mode === 'fcl' && tbUi && (
                <div className="q-trade" data-testid="quote-trade" dir={(ui === 'fa' || ui === 'ar') ? 'rtl' : 'ltr'} lang={ui}>
                  <div className="q-trade-head">
                    <span className="q-lang" role="group" aria-label="Export / import">
                      {(['export', 'import'] as TradeDir[]).map((d) => (
                        <button key={d} type="button" className={dir === d ? 'active' : ''} onClick={() => setDirOverride(d === autoD ? null : d)} data-testid={`dir-${d}`}>{u(d === 'export' ? 'export' : 'import')}</button>
                      ))}
                    </span>
                    <strong data-testid="trade-title">{tbUi.title}</strong>
                    <span className="q-muted">{dirOverride ? u('setByHand') : autoD ? `${u('auto')} ${autoD === 'import' ? 'POD' : 'POL'} = ${HOME_PORT} (${u('homePort')})` : `${u('noLeg')} ${HOME_PORT} — ${u('pickOne')}`} · {dir === 'export' ? tl3(ui, 'lineCompare') : tl3(ui, 'agentCompare')}</span>
                  </div>
                  <div className="q-trade-sub q-muted">{tbUi.localTitle}</div>
                  <table className="q-trade-table">
                    <tbody>
                      {tbUi.lines.map((l) => (
                        <tr key={l.label}><td>{l.label}</td><td className="mono"><bdi dir="ltr">{l.amount != null ? `${tbUi.currency} ${money(l.amount)}` : '—'}</bdi></td><td className="q-muted">{l.note}</td><td className={l.included ? 'q-ok' : 'q-muted'}>{l.included ? `✓ ${tl3(ui, 'included')}` : l.amount != null ? tl3(ui, 'local') : ''}</td></tr>
                      ))}
                    </tbody>
                  </table>
                  <ul className="q-trade-notes">{tbUi.notes.map((x) => <li key={x}>{x}</li>)}</ul>
                  <div className="q-trade-agents" data-testid={dir === 'import' ? 'import-agents' : 'export-agents'}>
                    <strong>{dir === 'import' ? tl3(ui, 'agentAt') : u('agentDest')} · {agentPort}</strong>
                    {originAgents.length ? (
                      <ul data-testid="quote-agent-list">{originAgents.map((a) => (
                        <li key={a.name} data-testid="quote-agent">
                          <span className={`q-badge ${a.tag.startsWith('Client preferred') || a.st === 'preferred' ? 'pref' : ''}`}>{agentTag(ui, a.tag)}</span> {a.name}{a.note ? <span className="q-muted"> · {a.note.length > 70 ? `${a.note.slice(0, 68)}…` : a.note}</span> : null}{a.sanc === 'note' ? <span className="q-muted">{u('screened')}</span> : null}
                          {a.id && (rateAsked.includes(a.name) ? <span className="q-ok">{u('rateLogged')}</span> : <> · <button type="button" className="q-linklike" onClick={() => logRateRequest(a.id!, a.name)} data-testid="quote-agent-ask">{u('logRate')}</button></>)}
                        </li>
                      ))}</ul>
                    ) : <span className="q-muted">{u('noneOnFile')}</span>}
                    {otherCrm.length > 0 && (
                      <div className="q-agent-pick">
                        <select className="c-in" value="" onChange={(e) => { const d = otherCrm.find((x) => x.id === e.target.value); if (d) logRateRequest(d.id, d.name); }} data-testid="quote-agent-picker" aria-label="Ask another agent from the Agent CRM">
                          <option value="">{u('askOther')}</option>
                          {otherCrm.map((d) => <option key={d.id} value={d.id}>{agentStLabel(ui, agentStatus(d))} · {d.name}{d.city && d.city !== '—' ? ` · ${d.city}` : ''}{d.sample ? u('sample') : ''}</option>)}
                        </select>
                        {rateAsked.filter((n) => !originAgents.some((a) => a.name === n)).map((n) => <span key={n} className="q-ok"> ✓ {n}</span>)}
                      </div>
                    )}
                    <div className="q-muted">{u('agentNote')}</div>
                  </div>
                </div>
              )}
              {clientAgent && (
                <div className="q-scope" data-testid="client-agent">
                  {u('agentOf')} {client!.name} {u('at')} {clientAgent.ports.split(',')[0]}: <strong>{clientAgent.name}</strong> ({clientAgent.rank}){clientAgent.contactName ? ` · ${clientAgent.contactName}` : ''}{clientAgent.whatsapp ? ` · WhatsApp ${clientAgent.whatsapp}` : ''}
                </div>
              )}
              {options.length > 1 && (
                <div className="q-opts-wrap" dir={(ui === 'fa' || ui === 'ar') ? 'rtl' : 'ltr'} lang={ui} data-testid="quote-options">
                  <div className="q-opts-head">
                    <strong>{ol(ui, 'options')} · {options.length}</strong>
                    <span className="q-muted">{ol(ui, 'optionsSub')}</span>
                  </div>
                  <div className="q-opts" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
                    {options.map((o, i) => {
                      const cheapest = options.reduce((a, b) => (b.sellTotal < a.sellTotal ? b : a));
                      const dSell = o.sellTotal - cheapest.sellTotal;
                      const dT = o.transitDays != null && cheapest.transitDays != null ? o.transitDays - cheapest.transitDays : null;
                      const dF = o.freeDays != null && cheapest.freeDays != null ? o.freeDays - cheapest.freeDays : null;
                      const on = !offCarriers.includes(o.carrier ?? '');
                      const D = ol(ui, 'd');
                      return (
                        <div key={o.carrier ?? i} className={`q-opt ${i === activeIdx ? 'active' : ''} ${on ? 'on' : 'off'}`} onClick={() => setActiveCarrier(o.carrier)} data-testid={`option-${i}`}>
                          <div className="q-opt-top">
                            <label className="q-opt-pick" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={on}
                                data-testid={`option-pick-${i}`}
                                onChange={() => setOffCarriers((off) => (on ? [...off, o.carrier ?? ''] : off.filter((c) => c !== (o.carrier ?? ''))))}
                              />
                              {ol(ui, 'inQuote')}
                            </label>
                          </div>
                          <div className="q-opt-badges">
                            {rankOf(o.carrier) === 'preferred' && <span className="q-badge pref">{ui === 'es' ? 'Preferida del cliente' : ui === 'fa' ? 'ترجیح مشتری' : ui === 'ar' ? 'مفضّل لدى العميل' : 'Client preferred'}</span>}
                            {rankOf(o.carrier) === 'avoid' && <span className="q-badge">{ui === 'es' ? 'El cliente la evita' : ui === 'fa' ? 'مشتری پرهیز می‌کند' : ui === 'ar' ? 'العميل يتجنّبه' : 'Client avoids'}</span>}
                            {(badges[i] ?? []).map((b) => (
                              <span key={b} className={`q-badge ${b}`}>{BADGE_L[ui][b]}</span>
                            ))}
                          </div>
                          <div className="q-opt-name">{o.carrier ?? '—'}</div>
                          <div className="q-opt-route">{o.routing ?? '—'}</div>
                          <div className="q-opt-sell">
                            <bdi dir="ltr" className="mono">${money(o.sellTotal)}</bdi>
                            <span className={`q-delta ${dSell === 0 ? 'best' : ''}`}>{dSell === 0 ? ol(ui, 'cheapest') : <bdi dir="ltr">+${money(dSell)}</bdi>}</span>
                          </div>
                          {targetDiff(o) && <div className="q-opt-target" data-testid={`option-target-${i}`}><TargetDelta diff={targetDiff(o)!.diff} lang={ui} /> <span className="q-muted"><bdi dir="ltr">${money(Math.round(targetDiff(o)!.perUnit))}</bdi> / {laneProfile!.target.per} · {ct(ui, 'target').toLowerCase()} <bdi dir="ltr">{laneProfile!.target.amount}</bdi></span></div>}
                          <div className="q-opt-bm mono">
                            {ol(ui, 'buy')} <bdi dir="ltr">${money(o.buyTotal)}</bdi> · {ol(ui, 'margin')} <bdi dir="ltr">${money(o.marginUsd)} ({o.marginPct}%)</bdi>
                          </div>
                          <dl className="q-opt-facts">
                            <div><dt>{ol(ui, 'transit')}</dt><dd>{o.transitDays ?? '?'} {D}{dT ? <bdi className={`q-delta ${dT < 0 ? 'best' : ''}`}><bdi dir="ltr">{dT > 0 ? '+' : '−'}{Math.abs(dT)}</bdi> {D}</bdi> : null}</dd></div>
                            <div><dt>{ol(ui, 'sailing')}</dt><dd className="mono"><bdi dir={(ui === 'fa' || ui === 'ar') ? 'rtl' : 'ltr'}>{o.etd ? fmtShort(o.etd, ui) : '—'}{o.eta ? `${(ui === 'fa' || ui === 'ar') ? ' ← ' : ' → '}${fmtShort(o.eta, ui)}` : ''}</bdi></dd></div>
                            <div><dt>{ol(ui, 'freeTime')}</dt><dd>{o.freeDays != null ? `${o.freeDays} ${D}` : ol(ui, 'na')}{client?.freeTimeRequest && o.freeDays != null && o.freeDays < client.freeTimeRequest ? <bdi className="q-delta q-amber" title={`${client.name} asks for ${client.freeTimeRequest} days`}>&lt; {client.freeTimeRequest}</bdi> : null}{dF ? <bdi className={`q-delta ${dF > 0 ? 'best' : ''}`}><bdi dir="ltr">{dF > 0 ? '+' : '−'}{Math.abs(dF)}</bdi> {D}</bdi> : null}</dd></div>
                            <div><dt>{ol(ui, 'validTo')}</dt><dd className="mono">{o.validUntil ?? '—'}</dd></div>
                          </dl>
                          {o.staleCount > 0 && <div className="q-opt-stale">{ol(ui, 'recheck')}: {o.lines.filter((l) => l.stale).map((l) => l.charge).join(', ')}</div>}
                          <div className="q-opt-incl">
                            <span>{ol(ui, 'included')}:</span> {o.lines.filter((l) => l.side === 'freight').map((l) => l.charge).join(', ')} + {o.lines.filter((l) => l.side !== 'freight').length} {ol(ui, 'common')}
                            {o.excluded.length > 0 && (
                              <>
                                <br />
                                <span>{ol(ui, 'excluded')}:</span> {o.excluded.map((l) => l.charge).join(', ')}
                              </>
                            )}
                          </div>
                          <div className="q-opt-foot">{i === activeIdx ? `▼ ${ol(ui, 'breakdown')}` : ol(ui, 'breakdown')}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="q-muted q-opts-note">
                    {custOpts.length ? `${custOpts.length} ${ol(ui, 'nSelected')} · ` : ''}
                    {custOpts.length === 0 ? <span className="q-amber">{ol(ui, 'pickOne')}</span> : null} {ol(ui, 'recRule')}
                  </div>
                </div>
              )}
              <table className="q-table">
                <thead>
                  <tr>
                    <th>{u('thCharge')}</th>
                    <th className="num">{u('thQty')}</th>
                    <th className="num">{u('thBuy')}</th>
                    <th className="num">{u('thSell')}</th>
                    <th>{u('thValid')}</th>
                  </tr>
                </thead>
                <tbody>
                  {lineGroups.map((g) => (
                    <FragmentRows key={g.side} label={sideLabel(ui, g.side)}>
                      {g.lines.map((l, i) => (
                        <tr key={i} className={l.stale ? 'stale' : ''}>
                          <td title={l.charge}>{chargeLabel(ui, l.charge)}</td>
                          <td className="num mono">
                            {money2(l.qty)} {basisLabel(ui, l.basis)}
                          </td>
                          <td className="num mono">{money(l.buy)}</td>
                          <td className="num mono">{money(l.sell)}</td>
                          <td className="mono">
                            {l.validUntil}
                            {l.stale && <span className="q-stale-tag">{u('stale')}</span>}
                          </td>
                        </tr>
                      ))}
                    </FragmentRows>
                  ))}
                </tbody>
              </table>
              {quote.excluded.length > 0 && (
                <div className="q-excluded">{u('notInScope')} {fields.incoterm ?? u('fobAssumed')}: {quote.excluded.map((l) => l.charge).join(' · ')}</div>
              )}
              <div className="q-margin">
                <label htmlFor="q-margin">
                  {u('marginTarget')} <strong className="mono">{margin}%</strong>
                </label>
                <input id="q-margin" type="range" min={0} max={40} step={1} value={margin} onChange={(e: ChangeEvent<HTMLInputElement>) => setMargin(Number(e.target.value))} />
              </div>
              <div className="q-totals">
                <div><span>{u('tBuy')}</span><strong className="mono">${money(quote.buyTotal)}</strong></div>
                <div className="sell"><span>{u('sellU')}</span><strong className="mono">${money(quote.sellTotal)}</strong></div>
                <div className="margin"><span>{u('tMargin')}</span><strong className="mono">${money(quote.marginUsd)} <small>{quote.marginPct}%</small></strong></div>
                <div><span>{u('tTransit')}</span><strong className="mono">{quote.transitDays != null ? `${quote.transitDays} ${u('d')}` : '—'}</strong></div>
                <div title={u('validTitle')}><span>{u('tValid')}</span><strong className="mono">{quote.validUntil ?? '—'}</strong></div>
              </div>
              {quote.currencies.length > 1 && <div className="q-warn">{u('mixed')} ({quote.currencies.join(', ')}) — {u('notConverted')}</div>}
              {alternatives.length > 0 && (
                <div className="q-alt">
                  {alternatives.map((a) => (
                    <button key={a.name} type="button" className="btn sm ghost" onClick={() => setField('origin', a.name)}>
                      {u('compareEx')} {a.name}: {u('sellU')} ${money(a.q!.sellTotal)} · {a.q!.transitDays ?? '?'} {u('d')}{a.q!.staleCount ? '' : u('ratesCurrent')}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="q-panel">
              <div className="q-head">
                <h2>{u('custQuote')} <span className="q-muted q-h-hint">· {u('quoteLangHint')}</span></h2>
                <div className="q-lang" role="group" aria-label="Quote language">
                  <button type="button" className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
                  <button type="button" className={lang === 'es' ? 'active' : ''} onClick={() => setLang('es')}>ES</button>
                  <button type="button" className={lang === 'fa' ? 'active' : ''} onClick={() => setLang('fa')}>FA</button>
                  <button type="button" className={lang === 'ar' ? 'active' : ''} onClick={() => setLang('ar')} data-testid="quote-lang-ar">AR</button>
                </div>
              </div>
              <pre className="q-text" data-testid="quote-text" dir={(lang === 'fa' || lang === 'ar') ? 'rtl' : 'ltr'}>{qText}</pre>
              <div className="q-actions">
                <button type="button" className="btn primary" onClick={() => void doCopy('quote')}>
                  {copied === 'quote' ? u('copied') : u('copyQuote')}
                </button>
                <button type="button" className="btn" data-testid="generate-pdf" disabled={pdfState === 'busy' || !custOpts.length} title={lang === 'fa' || lang === 'ar' ? u('pdfFa') : undefined} onClick={() => void doPdf()}>
                  {pdfState === 'busy' ? u('pdfBusy') : pdfState === 'done' ? u('pdfDone') : pdfState === 'error' ? u('pdfErr') : `${u('pdfGen')}${custOpts.length > 1 ? ` (${custOpts.length} ${u('options')})` : ''}${lang === 'fa' || lang === 'ar' ? ' · EN' : ''}`}
                </button>
                <label className="q-pdf-internal" title={u('internalTitle')}>
                  <input type="checkbox" data-testid="pdf-internal" checked={pdfInternal} onChange={(e) => setPdfInternal(e.target.checked)} /> {u('internal')}
                </label>
                {laneProfile?.target.amount != null && (
                  <label className="q-pdf-internal" title={u('targetTitle')}>
                    <input type="checkbox" data-testid="show-target" checked={showTarget} onChange={(e) => setShowTarget(e.target.checked)} /> {u('showTarget')}
                  </label>
                )}
              </div>
              <div className="q-muted q-send-note">
                {u('humanSends')}
                {savedTo && (
                  <span className="q-saved" data-testid="quote-saved">
                    {' '}· {u('logged')} {savedTo === 'unassigned' ? u('noClient') : <>{u('toDash')} {savedTo}{onOpenClient && clientId ? <> — <button type="button" className="q-linklike" onClick={() => onOpenClient(clientId)}>{u('open')}</button></> : null}</>} · {u(isLive() ? 'savedLive' : 'savedLocal')}
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function FragmentRows({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <tr className="q-group">
        <td colSpan={5}>{label}</td>
      </tr>
      {children}
    </>
  );
}

/** Rate-sheet charge names are free text; when one matches a standard charge, show it in the UI language. */
function chargeLabel(ui: string, charge: string): string {
  const c = DEFAULT_CATALOG.find((x) => x.name[0].toLowerCase() === charge.trim().toLowerCase());
  const i = ({ en: 0, es: 1, fa: 2, ar: 3 } as Record<string, number>)[ui] ?? 0;
  return c ? c.name[i as 0 | 1 | 2 | 3] : charge;
}
