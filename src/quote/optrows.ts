// Rich comparison rows for the quote's shipping options (one row per line / agent option).
// Pure data + i18n: used by OptionsTable (screen) and optexport (xlsx / csv).
import type { QMode } from './locations';
import type { Quote, QuoteLine } from './rates';
import type { QLang } from './optlabels';
import { MODE_L } from './optlabels';

type L4 = readonly [string, string, string, string];
const IX: Record<QLang, number> = { en: 0, es: 1, fa: 2, ar: 3 };

export type ColKey =
  | 'carrier' | 'mode' | 'route' | 'etd' | 'eta' | 'transit' | 'freq' | 'cutoff' | 'freeO' | 'freeD' | 'equip'
  | 'freight' | 'surch' | 'thcO' | 'thcD' | 'local' | 'docs' | 'customs' | 'extras' | 'buy' | 'sell' | 'margin' | 'marginPct'
  | 'currency' | 'conv' | 'payment' | 'valid' | 'source' | 'rateDate' | 'quotes' | 'bookings' | 'winRate' | 'notes';

export type ColKind = 'text' | 'money' | 'int' | 'pct' | 'date';
export interface ColDef {
  key: ColKey;
  label: L4;
  kind: ColKind;
  /** Modes this column applies to (omitted = all). */
  modes?: QMode[];
  /** Shown by default. */
  def: boolean;
  /** Column width in characters for the spreadsheet. */
  w: number;
}

const OCEAN: QMode[] = ['fcl', 'lcl'];
export const COLS: ColDef[] = [
  { key: 'carrier', label: ['Line / agent', 'Naviera / agente', 'خط / نماینده', 'الخط / الوكيل'], kind: 'text', def: true, w: 26 },
  { key: 'mode', label: ['Mode', 'Modo', 'نوع حمل', 'نوع الشحن'], kind: 'text', def: false, w: 12 },
  { key: 'route', label: ['Service / route', 'Servicio / ruta', 'سرویس / مسیر', 'الخدمة / المسار'], kind: 'text', def: true, w: 26 },
  { key: 'etd', label: ['Departure (ETD)', 'Salida (ETD)', 'حرکت (ETD)', 'المغادرة (ETD)'], kind: 'date', def: true, w: 13 },
  { key: 'eta', label: ['Arrival (ETA)', 'Llegada (ETA)', 'رسیدن (ETA)', 'الوصول (ETA)'], kind: 'date', def: true, w: 13 },
  { key: 'transit', label: ['Transit days', 'Días de tránsito', 'روز حمل', 'أيام العبور'], kind: 'int', def: true, w: 10 },
  { key: 'freq', label: ['Frequency', 'Frecuencia', 'تواتر', 'التكرار'], kind: 'text', def: true, w: 14 },
  { key: 'cutoff', label: ['Cut-off (48 h)', 'Cut-off (48 h)', 'کات‌آف (۴۸ ساعت)', 'الموعد النهائي (٤٨ ساعة)'], kind: 'date', modes: OCEAN, def: true, w: 13 },
  { key: 'freeO', label: ['Free time origin (days)', 'Free time origen (días)', 'فری‌تایم مبدأ (روز)', 'الفترة المجانية في المنشأ (أيام)'], kind: 'int', modes: ['fcl'], def: false, w: 12 },
  { key: 'freeD', label: ['Free time destination (days)', 'Free time destino (días)', 'فری‌تایم مقصد (روز)', 'الفترة المجانية في الوجهة (أيام)'], kind: 'int', modes: ['fcl'], def: true, w: 12 },
  { key: 'equip', label: ['Equipment', 'Equipo', 'تجهیزات', 'المعدات'], kind: 'text', def: true, w: 14 },
  { key: 'freight', label: ['Freight', 'Flete', 'کرایه حمل', 'أجرة الشحن'], kind: 'money', def: true, w: 12 },
  { key: 'surch', label: ['BAF / surcharges', 'BAF / recargos', 'BAF / سربار', 'BAF / رسوم إضافية'], kind: 'money', def: true, w: 12 },
  { key: 'thcO', label: ['THC origin', 'THC origen', 'THC مبدأ', 'THC في المنشأ'], kind: 'money', modes: OCEAN, def: false, w: 12 },
  { key: 'thcD', label: ['THC destination', 'THC destino', 'THC مقصد', 'THC في الوجهة'], kind: 'money', modes: OCEAN, def: false, w: 12 },
  { key: 'local', label: ['Local charges', 'Gastos locales', 'هزینه‌های محلی', 'الرسوم المحلية'], kind: 'money', def: false, w: 12 },
  { key: 'docs', label: ['Docs / B/L fee', 'Documentación / B/L', 'هزینه اسناد / بارنامه', 'رسوم المستندات / البوليصة'], kind: 'money', def: false, w: 12 },
  { key: 'customs', label: ['Customs clearance', 'Despacho de aduanas', 'ترخیص گمرکی', 'التخليص الجمركي'], kind: 'money', def: false, w: 12 },
  { key: 'extras', label: ['Requested services', 'Servicios solicitados', 'خدمات درخواستی', 'الخدمات المطلوبة'], kind: 'money', def: false, w: 12 },
  { key: 'buy', label: ['Total buy', 'Compra total', 'جمع خرید', 'إجمالي الشراء'], kind: 'money', def: true, w: 12 },
  { key: 'sell', label: ['Sell', 'Venta', 'فروش', 'البيع'], kind: 'money', def: true, w: 12 },
  { key: 'margin', label: ['Margin', 'Margen', 'سود', 'الهامش'], kind: 'money', def: true, w: 12 },
  { key: 'marginPct', label: ['Margin %', 'Margen %', 'درصد سود', 'نسبة الهامش'], kind: 'pct', def: true, w: 10 },
  { key: 'currency', label: ['Currency', 'Moneda', 'ارز', 'العملة'], kind: 'text', def: false, w: 9 },
  { key: 'conv', label: ['Total in quote currency', 'Total en moneda de la oferta', 'جمع به ارز پیشنهاد', 'الإجمالي بعملة العرض'], kind: 'money', def: false, w: 14 },
  { key: 'payment', label: ['Payment terms', 'Condiciones de pago', 'شرایط پرداخت', 'شروط الدفع'], kind: 'text', def: false, w: 14 },
  { key: 'valid', label: ['Valid until', 'Válida hasta', 'اعتبار تا', 'صالح حتى'], kind: 'date', def: true, w: 13 },
  { key: 'source', label: ['Rate source', 'Origen de la tarifa', 'منبع نرخ', 'مصدر السعر'], kind: 'text', def: false, w: 18 },
  { key: 'rateDate', label: ['Rate date', 'Fecha de la tarifa', 'تاریخ نرخ', 'تاريخ السعر'], kind: 'date', def: false, w: 13 },
  { key: 'quotes', label: ['Past quotes', 'Cotizaciones previas', 'پیشنهادهای قبلی', 'العروض السابقة'], kind: 'int', def: false, w: 10 },
  { key: 'bookings', label: ['Bookings', 'Reservas', 'رزروها', 'الحجوزات'], kind: 'int', def: false, w: 10 },
  { key: 'winRate', label: ['Win rate', 'Tasa de éxito', 'نرخ موفقیت', 'نسبة الفوز'], kind: 'pct', def: true, w: 10 },
  { key: 'notes', label: ['Notes', 'Notas', 'یادداشت', 'ملاحظات'], kind: 'text', def: true, w: 40 },
];
export const colDef = (k: ColKey) => COLS.find((c) => c.key === k)!;
export const colLabel = (lang: QLang, k: ColKey) => colDef(k).label[IX[lang]];

const T = {
  direct: ['Direct', 'Directo', 'مستقیم', 'مباشر'],
  tranship: ['Transhipment', 'Transbordo', 'ترانشیپ', 'مسافنة'],
  via: ['via', 'vía', 'از طریق', 'عبر'],
  daily: ['Daily', 'Diaria', 'روزانه', 'يومي'],
  weekly: ['Weekly', 'Semanal', 'هفتگی', 'أسبوعي'],
  prepaid: ['Prepaid', 'Prepagado', 'پیش‌پرداخت', 'مسبق الدفع'],
  collect: ['Collect', 'A cobrar en destino', 'پس‌کرایه', 'الدفع عند الوصول'],
  expired: ['Expired', 'Caducada', 'منقضی', 'منتهية'],
  expiresIn: ['Expires in {n} d', 'Caduca en {n} d', '{n} روز تا انقضا', 'تنتهي خلال {n} يوم'],
  sheet: ['Rate sheet', 'Tarifario', 'جدول نرخ', 'جدول الأسعار'],
  agentQuote: ['Agent quote', 'Cotización del agente', 'پیشنهاد نماینده', 'عرض الوكيل'],
  sample: ['SAMPLE', 'MUESTRA', 'نمونه', 'عيّنة'],
  recheck: ['Re-check rate', 'Revisar tarifa', 'بررسی دوباره نرخ', 'أعد التحقق من السعر'],
  prefers: ['Client prefers this line', 'Naviera preferida del cliente', 'خط مورد ترجیح مشتری', 'خط يفضّله العميل'],
  avoids: ['Client avoids this line', 'El cliente evita esta naviera', 'مشتری از این خط پرهیز می‌کند', 'العميل يتجنّب هذا الخط'],
  lowFree: ['Free time below the {n} days the client asks for', 'Free time por debajo de los {n} días que pide el cliente', 'فری‌تایم کمتر از {n} روز درخواستی مشتری', 'الفترة المجانية أقل من {n} يومًا يطلبها العميل'],
  notQuoted: ['not in customer quote', 'fuera de la oferta', 'خارج از پیشنهاد مشتری', 'خارج عرض العميل'],
  bestMargin: ['Best margin', 'Mejor margen', 'بیشترین سود', 'أفضل هامش'],
  longestFree: ['Longest free time', 'Más free time', 'بیشترین فری‌تایم', 'أطول فترة مجانية'],
  cheapest: ['Cheapest', 'Más barata', 'ارزان‌ترین', 'الأرخص'],
  fastest: ['Fastest', 'Más rápida', 'سریع‌ترین', 'الأسرع'],
  recommended: ['Recommended', 'Recomendada', 'پیشنهادی', 'مُوصى به'],
} as const satisfies Record<string, L4>;
export type TKey = keyof typeof T;
export const tt = (lang: QLang, k: TKey, n?: number | string) => T[k][IX[lang]].replace('{n}', String(n ?? ''));

export type RowBadge = 'recommended' | 'cheapest' | 'fastest' | 'bestMargin' | 'longestFree';
export const BADGE_ORDER: RowBadge[] = ['recommended', 'cheapest', 'fastest', 'bestMargin', 'longestFree'];
export const badgeLabel = (lang: QLang, b: RowBadge) => tt(lang, b);

export interface History { quotes: number; bookings: number; winRate: number | null }

export interface OptRow {
  /** Index into the options array the quote screen uses. */
  idx: number;
  key: string;
  carrier: string;
  line: string | null;
  agent: string | null;
  mode: QMode;
  direct: boolean;
  via: string | null;
  routing: string | null;
  etd: string | null;
  eta: string | null;
  transit: number | null;
  /** 'daily' | 'mon'…'sun' | null */
  freq: string | null;
  cutoff: string | null;
  freeO: number | null;
  freeD: number | null;
  equip: string;
  freight: number;
  surch: number;
  thcO: number;
  thcD: number;
  local: number;
  docs: number;
  customs: number;
  extras: number;
  buy: number;
  sell: number;
  margin: number;
  /** Margin as a percent of sell (12.5 = 12.5 %). */
  marginPct: number;
  currency: string;
  /** Sell converted to the quote currency, null when no exchange rate is set. */
  conv: number | null;
  payment: 'prepaid' | 'collect';
  valid: string | null;
  /** Days until validity ends (negative = expired); null without a date. */
  validDays: number | null;
  stale: string[];
  source: string | null;
  rateDate: string | null;
  quotes: number | null;
  bookings: number | null;
  winRate: number | null;
  notes: string;
  sample: boolean;
  badges: RowBadge[];
}

const DAY = 86400000;
function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Breakdown buckets; the sum always equals the option's total buy. */
export function bucketOf(l: QuoteLine): 'freight' | 'surch' | 'thcO' | 'thcD' | 'local' | 'docs' | 'customs' | 'extras' {
  const c = l.charge;
  if (l.side === 'customs') return 'customs';
  if (l.side === 'services') return 'extras';
  if (l.side === 'freight') return /freight|linehaul/i.test(c) ? 'freight' : 'surch';
  if (/\bTHC\b/i.test(c)) return l.side === 'origin' ? 'thcO' : 'thcD';
  if (/B\/L|\bdocs?\b|AWB|\bDO\b|delivery order/i.test(c)) return 'docs';
  return 'local';
}

/** Freight payment terms from the Incoterm (E/F terms: freight collect; C/D terms: prepaid). */
export function paymentFor(incoterm: string | null): 'prepaid' | 'collect' {
  return incoterm && /^[CD]/.test(incoterm) ? 'prepaid' : 'collect';
}

export interface RowCtx {
  mode: QMode;
  incoterm: string | null;
  quoteCurrency: string;
  /** 1 <option currency> = fx[cur] <quote currency>; missing = not converted. */
  fx: Record<string, number>;
  today?: Date;
  history?: (name: string) => History | null;
  rank?: (carrier: string | null) => string | null;
  extraNote?: (idx: number) => string | null;
  freeTimeRequest?: number | null;
  offCarriers?: string[];
  recommendedIdx?: number;
  lang: QLang;
}

export function buildRows(opts: Quote[], ctx: RowCtx): OptRow[] {
  const today = ctx.today ?? new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12).getTime();
  const rows: OptRow[] = opts.map((q, idx) => {
    const sum = { freight: 0, surch: 0, thcO: 0, thcD: 0, local: 0, docs: 0, customs: 0, extras: 0 };
    for (const l of q.lines) sum[bucketOf(l)] += l.buy;
    for (const k of Object.keys(sum) as (keyof typeof sum)[]) sum[k] = Math.round(sum[k] * 100) / 100;
    const routing = q.routing ?? null;
    const viaM = routing?.match(/via\s+(.+)$/i);
    const direct = !viaM && (!routing || /^direct/i.test(routing));
    const name = q.agent ?? q.carrier ?? '—';
    const h = ctx.history ? ctx.history(name) : null;
    const currency = q.currencies.length ? q.currencies.join('/') : 'USD';
    const rate = currency === ctx.quoteCurrency ? 1 : ctx.fx[currency];
    const validDays = q.validUntil ? Math.round((new Date(q.validUntil + 'T12:00:00').getTime() - t0) / DAY) : null;
    const stale = q.lines.filter((l) => l.stale).map((l) => l.charge);
    const notes: string[] = [];
    const rk = ctx.rank?.(q.carrier) ?? null;
    if (rk === 'preferred') notes.push(tt(ctx.lang, 'prefers'));
    if (rk === 'avoid') notes.push(tt(ctx.lang, 'avoids'));
    if (stale.length) notes.push(`${tt(ctx.lang, 'recheck')}: ${stale.join(', ')}`);
    if (ctx.freeTimeRequest && q.freeDays != null && q.freeDays < ctx.freeTimeRequest) notes.push(tt(ctx.lang, 'lowFree', ctx.freeTimeRequest));
    const extra = ctx.extraNote?.(idx);
    if (extra) notes.push(extra);
    if (ctx.offCarriers?.includes(q.carrier ?? '')) notes.push(tt(ctx.lang, 'notQuoted'));
    const freq = q.sails ? (/daily/i.test(q.sails) ? 'daily' : q.sails.slice(0, 3).toLowerCase()) : null;
    return {
      idx, key: q.carrier ?? String(idx), carrier: name, line: q.carrier, agent: q.agent, mode: ctx.mode,
      direct, via: viaM ? viaM[1].trim() : null, routing,
      etd: q.etd, eta: q.eta, transit: q.transitDays, freq,
      cutoff: q.etd && OCEAN.includes(ctx.mode) ? addDays(q.etd, -2) : null,
      freeO: ctx.mode === 'fcl' ? q.freeDaysOrigin : null, freeD: ctx.mode === 'fcl' ? q.freeDays : null,
      equip: q.units, ...sum,
      buy: q.buyTotal, sell: q.sellTotal, margin: q.marginUsd, marginPct: q.marginPct,
      currency, conv: rate ? Math.round(q.sellTotal * rate * 100) / 100 : null,
      payment: q.payment ?? paymentFor(ctx.incoterm),
      valid: q.validUntil, validDays, stale,
      source: q.rateSource, rateDate: q.rateDate,
      quotes: h ? h.quotes : null, bookings: h ? h.bookings : null, winRate: h ? h.winRate : null,
      notes: notes.join(' · '),
      sample: /sample/i.test(`${q.carrier ?? ''} ${q.agent ?? ''} ${q.rateSource ?? ''}`),
      badges: [],
    };
  });
  // highlight badges across all options
  if (rows.length > 1) {
    const varies = (f: (r: OptRow) => number | null) => new Set(rows.map(f).filter((v) => v != null)).size > 1;
    const best = (f: (r: OptRow) => number | null, dir: 1 | -1) => {
      const vals = rows.map(f).filter((v): v is number => v != null);
      return vals.length ? (dir === 1 ? Math.min(...vals) : Math.max(...vals)) : null;
    };
    const minSell = best((r) => r.sell, 1);
    const minT = varies((r) => r.transit) ? best((r) => r.transit, 1) : null;
    const maxM = varies((r) => r.margin) ? best((r) => r.margin, -1) : null;
    const maxF = varies((r) => r.freeD) ? best((r) => r.freeD, -1) : null;
    for (const r of rows) {
      if (ctx.recommendedIdx === r.idx) r.badges.push('recommended');
      if (r.sell === minSell) r.badges.push('cheapest');
      if (minT != null && r.transit === minT) r.badges.push('fastest');
      if (maxM != null && r.margin === maxM) r.badges.push('bestMargin');
      if (maxF != null && r.freeD === maxF) r.badges.push('longestFree');
    }
  }
  return rows;
}

/** Columns that apply to at least one of these modes. */
export const applicable = (modes: QMode[]) => COLS.filter((c) => !c.modes || c.modes.some((m) => modes.includes(m)));

/** Raw (typed) value of a cell: numbers stay numbers, dates stay ISO, text is localised. */
export function cellValue(r: OptRow, k: ColKey, lang: QLang): string | number | null {
  switch (k) {
    case 'carrier': return r.agent && r.line ? `${r.agent} (${r.line})` : r.carrier;
    case 'mode': return MODE_L[lang][r.mode];
    case 'route': return routeText(r, lang);
    case 'freq': return freqText(r.freq, lang);
    case 'payment': return tt(lang, r.payment);
    case 'source': return sourceText(r.source, lang);
    case 'marginPct': return r.marginPct / 100;
    case 'winRate': return r.winRate;
    default: return (r as unknown as Record<string, string | number | null>)[k] ?? null;
  }
}

/** Value used for sorting (numbers numeric, dates ISO, text lower-case). */
export function sortValue(r: OptRow, k: ColKey, lang: QLang): string | number | null {
  if (k === 'route') return `${r.direct ? 0 : 1}${r.via ?? ''}`;
  if (k === 'freq') return r.freq === 'daily' ? 0 : r.freq ? 7 : null;
  const v = cellValue(r, k, lang);
  return typeof v === 'string' ? v.toLowerCase() : v;
}

export function sortRows(rows: OptRow[], k: ColKey | null, dir: 1 | -1, lang: QLang): OptRow[] {
  if (!k) return rows;
  return [...rows].sort((a, b) => {
    const va = sortValue(a, k, lang);
    const vb = sortValue(b, k, lang);
    if (va == null && vb == null) return a.idx - b.idx;
    if (va == null) return 1; // empty cells last in both directions
    if (vb == null) return -1;
    const c = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), lang);
    return c === 0 ? a.idx - b.idx : c * dir;
  });
}

export interface Filters { mode: QMode | 'all'; directOnly: boolean; validOnly: boolean }
export const isValidRow = (r: OptRow) => r.stale.length === 0 && r.validDays != null && r.validDays >= 0;
export function filterRows(rows: OptRow[], f: Filters): OptRow[] {
  return rows.filter((r) => (f.mode === 'all' || r.mode === f.mode) && (!f.directOnly || r.direct) && (!f.validOnly || isValidRow(r)));
}

const WD = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const LOC: Record<QLang, string> = { en: 'en-GB', es: 'es-ES', fa: 'fa-IR-u-ca-gregory', ar: 'ar-EG' };
export function freqText(f: string | null, lang: QLang): string | null {
  if (!f) return null;
  if (f === 'daily') return tt(lang, 'daily');
  const i = WD.indexOf(f);
  if (i < 0) return f;
  const d = new Date(2026, 0, 4 + i, 12); // 4 Jan 2026 is a Sunday
  return `${tt(lang, 'weekly')} (${d.toLocaleDateString(LOC[lang], { weekday: 'short' })})`;
}
export function routeText(r: OptRow, lang: QLang): string {
  return r.direct ? tt(lang, 'direct') : `${tt(lang, 'tranship')}${r.via ? ` ${tt(lang, 'via')} ${r.via}` : ''}`;
}
export function sourceText(s: string | null, lang: QLang): string | null {
  if (!s) return null;
  const sample = /sample/i.test(s);
  const base = /agent/i.test(s) ? tt(lang, 'agentQuote') : /sheet/i.test(s) ? tt(lang, 'sheet') : s;
  return sample && base !== s ? `${base} (${tt(lang, 'sample')})` : base;
}
export function fmtDay(iso: string | null, lang: QLang): string {
  if (!iso) return '—';
  return new Date(iso + 'T12:00:00').toLocaleDateString(LOC[lang], { day: 'numeric', month: 'short' });
}
export const fmtInt = (n: number, lang: QLang) => n.toLocaleString(LOC[lang], { maximumFractionDigits: 0 });
