import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
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
import { quoteNumber } from './quoteno';
import { lineMatches, store, useStore } from '../clients/store';
import { SAMPLE_REQUESTS } from './samples';
import './quote.css';

type Lang = 'en' | 'es';
type FieldKey = keyof QuoteFields;

const MODE_LABEL: Record<QMode, string> = { fcl: 'Ocean FCL', lcl: 'Ocean LCL', air: 'Air', road: 'Road' };
const SIDE_LABEL: Record<Side, string> = { origin: 'Origin', freight: 'Main freight', destination: 'Destination', customs: 'Customs' };
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
const BASIS_LABEL: Record<string, string> = { per_container: 'cntr', per_kg: 'kg', per_wm: 'W/M', per_truck: 'truck', per_shipment: 'shpt' };

const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const money2 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

function fmtElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function fmtShort(iso: string, lang: QLang): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString(lang === 'es' ? 'es-ES' : lang === 'fa' ? 'fa-IR' : 'en-GB', { day: 'numeric', month: 'short' });
}

function fmtDate(iso: string | null, lang: QLang): string {
  if (!iso) return '—';
  if (iso === 'ASAP') return lang === 'es' ? 'lo antes posible' : lang === 'fa' ? 'در اسرع وقت' : 'ASAP';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString(lang === 'es' ? 'es-ES' : lang === 'fa' ? 'fa-IR' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
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

function quoteText(f: QuoteFields, opts: Quote[], badges: Badge[][], issues: Issue[], lang: QLang): string {
  if (!opts.length) return '';
  const W = TXT[lang];
  const tl: Lang = lang === 'fa' ? 'en' : lang;
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
    `${W.subject} — ${units} ${route} (${mode}, ${incotermLine})${multi ? ` — ${opts.length} ${W.options}` : ''}`,
    '',
    W.hi,
    '',
    multi ? W.thanksMulti : W.thanks,
    '',
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
    '',
    W.validity(fmtDate(validMin, lang)),
    W.notIncl(excluded.length ? `, ${excluded.join(', ')}` : ''),
    pending.length ? W.pending(pending.join('; ')) : null,
    '',
    W.bye,
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
        <button type="button" className="q-chip-value" onClick={onEdit} title={evidence ? `Found: “${evidence}” — click to edit` : 'Click to edit'}>
          {value}
        </button>
      )}
      {status !== 'ok' && !editing && <span className="q-chip-flag">{status === 'missing' ? 'MISSING' : status === 'ambiguous' ? 'TO CONFIRM' : 'ASSUMED'}</span>}
    </div>
  );
}

export function QuoteView({ seed, onOpenClient }: { seed?: { text: string; n: number; clientId?: string | null } | null; onOpenClient?: (id: string) => void } = {}) {
  const { clients, company } = useStore();
  const [clientId, setClientId] = useState<string | null>(null);
  const client = clients.find((c) => c.id === clientId) ?? null;
  const [savedTo, setSavedTo] = useState<string | null>(null);
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
  const [activeCarrier, setActiveCarrier] = useState<string | null>(null);
  const [offCarriers, setOffCarriers] = useState<string[]>([]);
  const [copied, setCopied] = useState<'quote' | 'questions' | null>(null);
  const [showFormat, setShowFormat] = useState(false);
  const [pdfInternal, setPdfInternal] = useState(false);
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
    setActiveCarrier(null);
    setOffCarriers([]);
  };

  const applyClient = (id: string | null) => {
    setClientId(id);
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

  const issues: Issue[] = useMemo(() => {
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
  const clientLines = client?.lines ?? [];
  const lineFiltered = clientLines.length ? allOptions.filter((o) => lineMatches(o.carrier, clientLines)) : allOptions;
  const options = lineFiltered.length ? lineFiltered : allOptions;
  const linesNote = client && clientLines.length && allOptions.length
    ? lineFiltered.length
      ? allOptions.length > lineFiltered.length ? `${client.name}'s lines only (${clientLines.join(', ')}): ${allOptions.length - lineFiltered.length} other option${allOptions.length - lineFiltered.length > 1 ? 's' : ''} hidden.` : null
      : `None of ${client.name}'s lines (${clientLines.join(', ')}) has a rate on this lane — showing all lines.`
    : null;
  const badges = useMemo(() => optionBadges(options), [options]);
  const recIdx = Math.max(0, badges.findIndex((b) => b.includes('recommended')));
  const activeIdx = options.findIndex((o) => o.carrier === activeCarrier) >= 0 ? options.findIndex((o) => o.carrier === activeCarrier) : recIdx;
  const quote: Quote | null = options.length ? options[activeIdx] : rawQuote;
  // customer options: recommended first, then by price
  const custIdx = options
    .map((_, i) => i)
    .filter((i) => !offCarriers.includes(options[i].carrier ?? ''))
    .sort((a, b) => (a === recIdx ? -1 : b === recIdx ? 1 : options[a].sellTotal - options[b].sellTotal));
  const custOpts = custIdx.map((i) => options[i]);
  const custBadges = custIdx.map((i) => badges[i] ?? []);
  const tl: Lang = lang === 'fa' ? 'en' : lang;

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

  const qText = custOpts.length ? quoteText(fields, custOpts, custBadges, issues, lang) : '';
  const askText = questionsText(issues, tl);
  const elapsed = startedAt == null ? null : (doneMs ?? now - startedAt);
  const usingSample = !sheet || sheet.rows === 0;

  async function doPdf() {
    if (!custOpts.length) return;
    setPdfState('busy');
    try {
      const { generateQuotePdf } = await import('./pdf');
      const { blob, filename } = await generateQuotePdf({
        fields, quote: custOpts[0], options: custOpts, badges: custBadges, issues: issues.filter((i) => i.kind !== 'assumed'), lang: tl, internal: pdfInternal, sampleRates: usingSample, sourceText: text, marginTarget: margin,
        company, clientName: client?.name ?? null,
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
    });
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
            <h2>Paste a customer request (email / WhatsApp)</h2>
            {elapsed != null && (
              <span className={`q-timer ${doneMs != null ? 'done' : ''}`} title="From paste to copied quote">
                {doneMs != null ? 'QUOTE READY IN ' : 'TIME TO QUOTE '}
                <strong>{fmtElapsed(elapsed)}</strong>
              </span>
            )}
          </div>
          <div className="q-client" data-testid="quote-client">
            <span className="q-muted">Client</span>
            <select value={clientId ?? ''} onChange={(e) => applyClient(e.target.value || null)} data-testid="quote-client-select" aria-label="Client">
              <option value="">— none —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.sample ? ' (sample)' : ''}</option>
              ))}
            </select>
            {client ? (
              <>
                <span className="q-client-defs">
                  {client.marginPct}% · {client.incoterm} · {client.lang.toUpperCase()} · {client.lines.length ? client.lines.join(', ') : 'any line'}{client.freeTimeRequest ? ` · ask ${client.freeTimeRequest} d free` : ''}
                </span>
                {onOpenClient && <button type="button" className="q-linklike" onClick={() => onOpenClient(client.id)}>dashboard →</button>}
              </>
            ) : (
              <span className="q-client-defs">pick one to apply their margin, Incoterm, language and lines</span>
            )}
          </div>
          <textarea
            className="q-paste"
            placeholder="e.g. hi need price 2x40HC Shanghai to Barcelona, ready 20 Nov, FOB…"
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
            <span className="q-muted">Try a sample:</span>
            {SAMPLE_REQUESTS.map((s) => (
              <button key={s.id} type="button" className="btn ghost sm" onClick={() => startFresh(s.text)} title={s.text}>
                {s.label}
              </button>
            ))}
            {text && (
              <button type="button" className="btn ghost sm" onClick={() => startFresh('')}>
                Clear
              </button>
            )}
          </div>
        </div>

        {text.trim() && (
          <div className={`q-summary ${quote && quote.hasFreight ? 'priced' : 'unpriced'}`} data-testid="quote-summary">
            {quote && quote.hasFreight ? (
              <>
                <span className="q-summary-tag">PRICED</span>
                <span className="mono">
                  SELL <strong>${money(quote.sellTotal)}</strong> · margin ${money(quote.marginUsd)} ({quote.marginPct}%) · {quote.transitDays ?? '?'} d
                  {options.length > 1 && <> · {options.length} options from ${money(Math.min(...options.map((o) => o.sellTotal)))}</>}
                </span>
                <span className="q-summary-meta">
                  {issues.filter((i) => i.kind === 'missing').length === 0
                    ? issues.filter((i) => i.kind === 'ambiguous' || i.kind === 'confirm').length === 0
                      ? 'all details present — ready to send'
                      : `${issues.filter((i) => i.kind === 'ambiguous' || i.kind === 'confirm').length} to confirm with customer`
                    : `${issues.filter((i) => i.kind === 'missing').length} missing`}
                </span>
                <button type="button" className="btn sm primary" onClick={() => quoteRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                  View quote →
                </button>
              </>
            ) : (
              <>
                <span className="q-summary-tag">NOT PRICED</span>
                <span>{!quote ? 'Needs mode, origin and destination.' : `No freight rate for ${fields.origin} → ${fields.destination} in this rate sheet.`}</span>
              </>
            )}
          </div>
        )}

        {text.trim() && (
          <div className="q-panel">
            <div className="q-head">
              <h2>What it read</h2>
              <span className="q-muted">click any field to fix it</span>
            </div>
            <div className="q-chips">
              <Chip label="Mode" status={statusOf('mode')} evidence={parsed.evidence.mode} editing={editing === 'mode'} onEdit={() => setEditing('mode')}
                value={fields.mode ? MODE_LABEL[fields.mode] : '—'}
                editor={sel('mode', fields.mode ?? '', (Object.keys(MODE_LABEL) as QMode[]).map((m) => ({ v: m, l: MODE_LABEL[m] })), (v) => setField('mode', (v || null) as QMode | null))} />
              <Chip label="Origin" status={statusOf('origin')} evidence={parsed.evidence.origin} editing={editing === 'origin'} onEdit={() => setEditing('origin')}
                value={fields.origin ?? '—'}
                editor={sel('origin', fields.origin ?? '', allLocations.map((l) => ({ v: l, l })), (v) => setField('origin', v || null))} />
              <Chip label="Destination" status={statusOf('destination')} evidence={parsed.evidence.destination} editing={editing === 'destination'} onEdit={() => setEditing('destination')}
                value={fields.destination ?? '—'}
                editor={sel('destination', fields.destination ?? '', allLocations.map((l) => ({ v: l, l })), (v) => setField('destination', v || null))} />
              {(fields.mode === 'fcl' || fields.mode === 'road' || Object.keys(fields.equipment).length > 0) && (
                <Chip label="Equipment" status={statusOf('equipment')} evidence={parsed.evidence.equipment} editing={editing === 'equipment'} onEdit={() => setEditing('equipment')}
                  value={equipmentText(fields.equipment) || '—'}
                  editor={inp('equipment', equipmentText(fields.equipment), (v) => setField('equipment', parseEquipmentInput(v)))} />
              )}
              <Chip label="Weight" status={statusOf('weightKg')} evidence={parsed.evidence.weightKg} editing={editing === 'weightKg'} onEdit={() => setEditing('weightKg')}
                value={fields.weightKg != null ? `${fields.weightKg.toLocaleString('en-US')} kg${fields.mode === 'fcl' ? ' / cntr' : fields.mode === 'road' && parsed.weightPerUnit ? ' / truck' : ''}` : '—'}
                editor={inp('weightKg', fields.weightKg != null ? String(fields.weightKg) : '', (v) => setField('weightKg', numOrNull(v)), 'number')} />
              <Chip label="Volume" status={statusOf('volumeCbm')} evidence={parsed.evidence.volumeCbm} editing={editing === 'volumeCbm'} onEdit={() => setEditing('volumeCbm')}
                value={fields.volumeCbm != null ? `${fields.volumeCbm} cbm` : '—'}
                editor={inp('volumeCbm', fields.volumeCbm != null ? String(fields.volumeCbm) : '', (v) => setField('volumeCbm', numOrNull(v)), 'number')} />
              {fields.mode === 'air' && (
                <div className="q-chip q-ok q-derived">
                  <span className="q-chip-label">Chargeable</span>
                  <span className="q-chip-static">{chargeableKg(fields.weightKg, fields.volumeCbm) ?? '—'} kg</span>
                  <span className="q-chip-hint">1:6000</span>
                </div>
              )}
              <Chip label="Pieces" status="ok" evidence={parsed.evidence.pieces} editing={editing === 'pieces'} onEdit={() => setEditing('pieces')}
                value={fields.pieces ?? '—'}
                editor={inp('pieces', fields.pieces != null ? String(fields.pieces) : '', (v) => setField('pieces', numOrNull(v)), 'number')} />
              <Chip label="Incoterm" status={statusOf('incoterm')} evidence={parsed.evidence.incoterm} editing={editing === 'incoterm'} onEdit={() => setEditing('incoterm')}
                value={fields.incoterm ?? '—'}
                editor={sel('incoterm', fields.incoterm ?? '', INCOTERMS.map((i) => ({ v: i, l: i })), (v) => setField('incoterm', v || null))} />
              <Chip label="Ready" status={statusOf('readyDate')} evidence={parsed.evidence.readyDate} editing={editing === 'readyDate'} onEdit={() => setEditing('readyDate')}
                value={fmtDate(fields.readyDate, 'en')}
                editor={inp('readyDate', fields.readyDate && fields.readyDate !== 'ASAP' ? fields.readyDate : '', (v) => setField('readyDate', v || null), 'date')} />
              <Chip label="Cargo" status={statusOf('cargo')} evidence={parsed.evidence.cargo} editing={editing === 'cargo'} onEdit={() => setEditing('cargo')}
                value={fields.cargo ?? '—'}
                editor={inp('cargo', fields.cargo ?? '', (v) => setField('cargo', v.trim() || null))} />
              <Chip label="DG" status={statusOf('dg')} evidence={parsed.evidence.dg} editing={editing === 'dg'} onEdit={() => setEditing('dg')}
                value={fields.dg === 'yes' ? 'Yes — DG' : fields.dg === 'no' ? 'No' : 'Unknown'}
                editor={sel('dg', fields.dg, [{ v: 'no', l: 'No' }, { v: 'yes', l: 'Yes — DG' }, { v: 'unknown', l: 'Unknown' }], (v) => setField('dg', (v || 'unknown') as DgState))} />
            </div>
          </div>
        )}

        {text.trim() && issues.length > 0 && (
          <div className="q-panel">
            <div className="q-head">
              <h2>What to ask the customer</h2>
              <span className="q-muted">{issues.filter((i) => i.kind === 'missing').length} missing · {issues.filter((i) => i.kind === 'ambiguous' || i.kind === 'confirm').length} to confirm · {issues.filter((i) => i.kind === 'assumed').length} assumed</span>
            </div>
            <ul className="q-issues">
              {issues.map((i, n) => (
                <li key={n} className={`q-issue q-${i.kind === 'confirm' ? 'ambiguous' : i.kind}`}>
                  <span className="q-issue-tag">{i.kind === 'missing' ? 'MISSING' : i.kind === 'assumed' ? 'ASSUMED' : 'TO CONFIRM'}</span>
                  <div>
                    <div className="q-issue-msg">{i.message}</div>
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
                  {copied === 'questions' ? 'Copied ✓' : 'Copy questions for customer'}
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
                <strong>SAMPLE RATES</strong> — illustrative numbers, not market rates. Load your own rate sheet to quote for real.
              </>
            ) : (
              <>
                <strong>YOUR RATE SHEET</strong> — {sheet!.name} · {sheet!.rows} rows
              </>
            )}
          </div>
          <div className="q-banner-actions">
            <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={onUpload} data-testid="rate-upload" />
            <button type="button" className="btn sm primary" onClick={() => fileRef.current?.click()}>
              Load rate sheet (CSV)
            </button>
            <a className="btn sm ghost" href={templateHref} download="forwarddesk-rate-sheet-template.csv">
              Download rate sheet template
            </a>
            {!usingSample && (
              <button type="button" className="btn sm ghost" onClick={resetSample}>
                Use sample rates
              </button>
            )}
            <button type="button" className="btn sm ghost" onClick={() => setShowFormat((s) => !s)}>
              {showFormat ? 'Hide format' : 'CSV format'}
            </button>
          </div>
        </div>
        {sheet && sheet.skipped.length > 0 && (
          <div className="q-warn">
            {sheet.rows === 0 ? 'Could not load this file — ' : `${sheet.skipped.length} row(s) skipped — `}
            {sheet.skipped.slice(0, 4).map((s) => `line ${s.line}: ${s.reason}`).join(' · ')}
          </div>
        )}
        {showFormat && (
          <div className="q-panel q-format">
            <p>
              One row per charge. Columns (header row required, comma or semicolon separated): <code>{CSV_COLUMNS.join(', ')}</code>
            </p>
            <ul>
              <li><code>mode</code>: fcl · lcl · air · road — <code>side</code>: origin · freight · destination · customs</li>
              <li><code>basis</code>: per_container · per_kg (air = chargeable kg) · per_wm (LCL) · per_truck · per_shipment</li>
              <li><code>origin</code>/<code>destination</code>: port or city name; <code>*</code> = any (for local charges). <code>equipment</code>: 20GP, 40GP, 40HC, FTL or <code>*</code></li>
              <li><code>valid_until</code>: YYYY-MM-DD (or DD/MM/YYYY) — past dates are flagged STALE. Amounts are taken as-is (no FX conversion).</li>
              <li><code>carrier</code>: each distinct carrier with freight rows on a lane becomes a quote option. Optional per line: <code>routing</code> (Direct, via Port Klang…), <code>free_days</code> (10/14/21), <code>sails</code> (Mon…Sun or daily).</li>
            </ul>
          </div>
        )}

        {!text.trim() && (
          <div className="q-panel q-empty">
            <strong>Paste a request or pick a sample.</strong>
            <p>ForwardDesk reads the request, flags what's missing or ambiguous, prices it from the rate sheet, and writes the customer quote.</p>
          </div>
        )}

        {text.trim() && !quote && (
          <div className="q-panel q-empty">
            <strong>Need a mode, origin and destination to price.</strong>
            <p>Fix the flagged fields on the left.</p>
          </div>
        )}

        {quote && !quote.hasFreight && (
          <div className="q-panel q-empty">
            <strong>No {fields.mode ? MODE_LABEL[fields.mode] : ''} freight rate for {fields.origin} → {fields.destination}{fields.mode === 'fcl' ? ` (${Object.keys(fields.equipment).join(', ') || 'no equipment'})` : ''} in this rate sheet.</strong>
            <p>Add a <code>freight</code> row for this lane to the CSV, or change the lane on the left.</p>
          </div>
        )}

        {quote && quote.hasFreight && (
          <>
            {quote.staleCount > 0 && (
              <div className="q-warn stale">
                <strong>RATE TO RE-CHECK</strong> — {quote.lines.filter((l) => l.stale).map((l) => `${l.charge} expired ${fmtDate(l.validUntil, 'en')}`).join('; ')}. Re-check with the carrier before sending.
              </div>
            )}
            <div className="q-panel q-quote-panel" ref={quoteRef}>
              <div className="q-head">
                <h2>
                  Quote · {fields.origin} → {fields.destination}
                  {options.length > 1 && quote.carrier ? ` · ${ol('en', 'showing')} ${quote.carrier}` : ''}
                </h2>
                <span className="q-muted">{quote.units}</span>
              </div>
              <div className="q-scope">{quote.scopeNote}</div>
              {linesNote && <div className="q-scope q-amber" data-testid="lines-note">{linesNote}</div>}
              {options.length > 1 && (
                <div className="q-opts-wrap" dir={lang === 'fa' ? 'rtl' : 'ltr'} lang={lang} data-testid="quote-options">
                  <div className="q-opts-head">
                    <strong>{ol(lang, 'options')} · {options.length}</strong>
                    <span className="q-muted">{ol(lang, 'optionsSub')}</span>
                  </div>
                  <div className="q-opts" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
                    {options.map((o, i) => {
                      const cheapest = options.reduce((a, b) => (b.sellTotal < a.sellTotal ? b : a));
                      const dSell = o.sellTotal - cheapest.sellTotal;
                      const dT = o.transitDays != null && cheapest.transitDays != null ? o.transitDays - cheapest.transitDays : null;
                      const dF = o.freeDays != null && cheapest.freeDays != null ? o.freeDays - cheapest.freeDays : null;
                      const on = !offCarriers.includes(o.carrier ?? '');
                      const D = ol(lang, 'd');
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
                              {ol(lang, 'inQuote')}
                            </label>
                          </div>
                          <div className="q-opt-badges">
                            {(badges[i] ?? []).map((b) => (
                              <span key={b} className={`q-badge ${b}`}>{BADGE_L[lang][b]}</span>
                            ))}
                          </div>
                          <div className="q-opt-name">{o.carrier ?? '—'}</div>
                          <div className="q-opt-route">{o.routing ?? '—'}</div>
                          <div className="q-opt-sell">
                            <bdi dir="ltr" className="mono">${money(o.sellTotal)}</bdi>
                            <span className={`q-delta ${dSell === 0 ? 'best' : ''}`}>{dSell === 0 ? ol(lang, 'cheapest') : <bdi dir="ltr">+${money(dSell)}</bdi>}</span>
                          </div>
                          <div className="q-opt-bm mono">
                            {ol(lang, 'buy')} <bdi dir="ltr">${money(o.buyTotal)}</bdi> · {ol(lang, 'margin')} <bdi dir="ltr">${money(o.marginUsd)} ({o.marginPct}%)</bdi>
                          </div>
                          <dl className="q-opt-facts">
                            <div><dt>{ol(lang, 'transit')}</dt><dd>{o.transitDays ?? '?'} {D}{dT ? <bdi className={`q-delta ${dT < 0 ? 'best' : ''}`}><bdi dir="ltr">{dT > 0 ? '+' : '−'}{Math.abs(dT)}</bdi> {D}</bdi> : null}</dd></div>
                            <div><dt>{ol(lang, 'sailing')}</dt><dd className="mono"><bdi dir={lang === 'fa' ? 'rtl' : 'ltr'}>{o.etd ? fmtShort(o.etd, lang) : '—'}{o.eta ? `${lang === 'fa' ? ' ← ' : ' → '}${fmtShort(o.eta, lang)}` : ''}</bdi></dd></div>
                            <div><dt>{ol(lang, 'freeTime')}</dt><dd>{o.freeDays != null ? `${o.freeDays} ${D}` : ol(lang, 'na')}{client?.freeTimeRequest && o.freeDays != null && o.freeDays < client.freeTimeRequest ? <bdi className="q-delta q-amber" title={`${client.name} asks for ${client.freeTimeRequest} days`}>&lt; {client.freeTimeRequest}</bdi> : null}{dF ? <bdi className={`q-delta ${dF > 0 ? 'best' : ''}`}><bdi dir="ltr">{dF > 0 ? '+' : '−'}{Math.abs(dF)}</bdi> {D}</bdi> : null}</dd></div>
                            <div><dt>{ol(lang, 'validTo')}</dt><dd className="mono">{o.validUntil ?? '—'}</dd></div>
                          </dl>
                          {o.staleCount > 0 && <div className="q-opt-stale">{ol(lang, 'recheck')}: {o.lines.filter((l) => l.stale).map((l) => l.charge).join(', ')}</div>}
                          <div className="q-opt-incl">
                            <span>{ol(lang, 'included')}:</span> {o.lines.filter((l) => l.side === 'freight').map((l) => l.charge).join(', ')} + {o.lines.filter((l) => l.side !== 'freight').length} {ol(lang, 'common')}
                            {o.excluded.length > 0 && (
                              <>
                                <br />
                                <span>{ol(lang, 'excluded')}:</span> {o.excluded.map((l) => l.charge).join(', ')}
                              </>
                            )}
                          </div>
                          <div className="q-opt-foot">{i === activeIdx ? `▼ ${ol(lang, 'breakdown')}` : ol(lang, 'breakdown')}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="q-muted q-opts-note">
                    {custOpts.length ? `${custOpts.length} ${ol(lang, 'nSelected')} · ` : ''}
                    {custOpts.length === 0 ? <span className="q-amber">{ol(lang, 'pickOne')}</span> : null} {ol(lang, 'recRule')}
                  </div>
                </div>
              )}
              <table className="q-table">
                <thead>
                  <tr>
                    <th>Charge</th>
                    <th className="num">Qty</th>
                    <th className="num">Buy</th>
                    <th className="num">Sell</th>
                    <th>Valid until</th>
                  </tr>
                </thead>
                <tbody>
                  {lineGroups.map((g) => (
                    <FragmentRows key={g.side} label={SIDE_LABEL[g.side]}>
                      {g.lines.map((l, i) => (
                        <tr key={i} className={l.stale ? 'stale' : ''}>
                          <td>{l.charge}</td>
                          <td className="num mono">
                            {money2(l.qty)} {BASIS_LABEL[l.basis]}
                          </td>
                          <td className="num mono">{money(l.buy)}</td>
                          <td className="num mono">{money(l.sell)}</td>
                          <td className="mono">
                            {l.validUntil}
                            {l.stale && <span className="q-stale-tag">STALE</span>}
                          </td>
                        </tr>
                      ))}
                    </FragmentRows>
                  ))}
                </tbody>
              </table>
              {quote.excluded.length > 0 && (
                <div className="q-excluded">Not in scope for {fields.incoterm ?? 'FOB (assumed)'}: {quote.excluded.map((l) => l.charge).join(' · ')}</div>
              )}
              <div className="q-margin">
                <label htmlFor="q-margin">
                  Margin target <strong className="mono">{margin}%</strong>
                </label>
                <input id="q-margin" type="range" min={0} max={40} step={1} value={margin} onChange={(e: ChangeEvent<HTMLInputElement>) => setMargin(Number(e.target.value))} />
              </div>
              <div className="q-totals">
                <div><span>BUY</span><strong className="mono">${money(quote.buyTotal)}</strong></div>
                <div className="sell"><span>SELL</span><strong className="mono">${money(quote.sellTotal)}</strong></div>
                <div className="margin"><span>MARGIN</span><strong className="mono">${money(quote.marginUsd)} <small>{quote.marginPct}%</small></strong></div>
                <div><span>TRANSIT</span><strong className="mono">{quote.transitDays != null ? `${quote.transitDays} d` : '—'}</strong></div>
                <div title="Earliest rate validity, capped at 14 days"><span>VALID TO</span><strong className="mono">{quote.validUntil ?? '—'}</strong></div>
              </div>
              {quote.currencies.length > 1 && <div className="q-warn">Mixed currencies in rate sheet ({quote.currencies.join(', ')}) — totals are not converted.</div>}
              {alternatives.length > 0 && (
                <div className="q-alt">
                  {alternatives.map((a) => (
                    <button key={a.name} type="button" className="btn sm ghost" onClick={() => setField('origin', a.name)}>
                      Compare ex {a.name}: SELL ${money(a.q!.sellTotal)} · {a.q!.transitDays ?? '?'} d{a.q!.staleCount ? '' : ' · rates current'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="q-panel">
              <div className="q-head">
                <h2>Customer quote</h2>
                <div className="q-lang" role="group" aria-label="Quote language">
                  <button type="button" className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
                  <button type="button" className={lang === 'es' ? 'active' : ''} onClick={() => setLang('es')}>ES</button>
                  <button type="button" className={lang === 'fa' ? 'active' : ''} onClick={() => setLang('fa')}>FA</button>
                </div>
              </div>
              <pre className="q-text" data-testid="quote-text" dir={lang === 'fa' ? 'rtl' : 'ltr'}>{qText}</pre>
              <div className="q-actions">
                <button type="button" className="btn primary" onClick={() => void doCopy('quote')}>
                  {copied === 'quote' ? 'Copied ✓' : 'Copy quote'}
                </button>
                <button type="button" className="btn" data-testid="generate-pdf" disabled={pdfState === 'busy' || !custOpts.length} title={lang === 'fa' ? ol('fa', 'pdfFa') + ' / PDF is generated in English when FA is selected.' : undefined} onClick={() => void doPdf()}>
                  {pdfState === 'busy' ? 'Building PDF…' : pdfState === 'done' ? 'PDF downloaded ✓' : pdfState === 'error' ? 'PDF failed — retry' : `Generate PDF${custOpts.length > 1 ? ` (${custOpts.length} options)` : ''}${lang === 'fa' ? ' · EN' : ''}`}
                </button>
                <label className="q-pdf-internal" title="Adds buy and margin columns. Never send this version to the customer.">
                  <input type="checkbox" data-testid="pdf-internal" checked={pdfInternal} onChange={(e) => setPdfInternal(e.target.checked)} /> Internal (with buy/margin)
                </label>
              </div>
              <div className="q-muted q-send-note">
                Human sends it. Nothing is booked or emailed from here.
                {savedTo && (
                  <span className="q-saved" data-testid="quote-saved">
                    {' '}· Logged {savedTo === 'unassigned' ? 'without a client (pick one to attribute it)' : <>to {savedTo}'s dashboard{onOpenClient && clientId ? <> — <button type="button" className="q-linklike" onClick={() => onOpenClient(clientId)}>open</button></> : null}</>} · saved in this browser only
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
