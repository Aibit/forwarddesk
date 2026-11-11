import type { QuoteFields } from '../quote/parser';
import type { CLang } from './store';
import { hsFromCommodity, msdsNeed, type MsdsMeta, type MsdsNeed } from './msds';

export type VolUnit = '20GP' | '40GP' | '40HC' | 'TEU' | 'tons' | 'cbm';
export type VolPeriod = 'month' | 'shipment' | 'year';
export type TargetPer = '20GP' | '40GP' | '40HC' | 'TEU' | 'ton' | 'cbm' | 'shipment';
/** A client's lane / cargo profile (client setup core: POL, POD, commodity, HS, volume, payment, target rate). */
export interface LaneProfile {
  id: string;
  pol: string;
  pod: string;
  commodity: string;
  hs: string;
  volume: { amount: number | null; unit: VolUnit; period: VolPeriod };
  payment: string;
  target: { amount: number | null; currency: string; per: TargetPer };
  notes: string;
  /** Dangerous goods (always needs MSDS). */
  dg?: boolean;
  /** MSDS file metadata; the file itself lives in IndexedDB (this browser only). */
  msds?: MsdsMeta | null;
  /** Submitted by the client in the portal (an RFQ). */
  source?: 'portal' | 'desk';
  submittedAt?: number;
}

export const PAYMENT_TERMS = ['Prepaid', 'Collect', 'Cash', 'Credit 30 days', 'Credit 60 days', 'LC at sight', 'CAD (cash against documents)'];
export const VOL_UNITS: VolUnit[] = ['20GP', '40GP', '40HC', 'TEU', 'tons', 'cbm'];
export const PERIODS: VolPeriod[] = ['shipment', 'month', 'year'];
export const TARGET_PER: TargetPer[] = ['20GP', '40GP', '40HC', 'TEU', 'ton', 'cbm', 'shipment'];

let lid = 0;
const P = (pol: string, pod: string, commodity: string, hs: string, amount: number, unit: VolUnit, period: VolPeriod, payment: string, target: number, per: TargetPer, notes = ''): LaneProfile => ({
  id: `l-${(lid++).toString(36)}`, pol, pod, commodity, hs, volume: { amount, unit, period }, payment, target: { amount: target, currency: 'USD', per }, notes, source: 'desk',
});
export function sampleLanes(clientId: string): LaneProfile[] {
  switch (clientId) {
    case 'c-a': return [P('Bandar Abbas', 'Jebel Ali', 'Bitumen 60/70 in drums', '2713.20', 8, '20GP', 'month', 'Prepaid', 600, '20GP', 'Heavy 20ft'), P('Bandar Abbas', 'Nhava Sheva', 'Bitumen 60/70 in drums', '2713.20', 4, '20GP', 'month', 'Prepaid', 1000, '20GP')];
    case 'c-b': return [P('Bandar Abbas', 'Shanghai (Yangshan)', 'Stone blocks (rough-cut)', '2516.11', 12, '20GP', 'month', 'Prepaid', 1500, '20GP', 'Heavy; 21 days free time')];
    case 'c-c': return [P('Bandar Abbas', 'Nhava Sheva', 'Bitumen in drums', '2713.20', 2, '20GP', 'shipment', 'Credit 30 days', 1100, '20GP', 'Several lines every time')];
    case 'c-d': return [P('Nhava Sheva', 'Bandar Abbas', 'Basmati rice, bagged', '1006.30', 10, '20GP', 'month', 'Collect', 900, '20GP')];
    case 'c-e': return [P('Shanghai (Yangshan)', 'Bandar Abbas', 'Machinery spare parts', '8431.49', 2, '40HC', 'month', 'Prepaid', 1800, '40HC')];
    case 'c-f': return [P('Hamburg', 'Bandar Abbas', 'Industrial spare parts', '8483.40', 1, '40GP', 'shipment', 'LC at sight', 2400, '40GP'), P('Shanghai (Yangshan)', 'Barcelona', 'Metal furniture', '9403.20', 2, '40HC', 'shipment', 'Credit 60 days', 3000, '40HC', 'Spanish-speaking buyer side')];
    case 'c-g': return [P('Shanghai (Yangshan)', 'Bandar Abbas', 'Ceramic tiles', '6907.21', 4, '20GP', 'month', 'CAD (cash against documents)', 1100, '20GP')];
    default: return [];
  }
}
export const newLane = (): LaneProfile => ({ id: `l-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, pol: '', pod: '', commodity: '', hs: '', volume: { amount: null, unit: '20GP', period: 'shipment' }, payment: 'Prepaid', target: { amount: null, currency: 'USD', per: '20GP' }, notes: '' });

// ── HS code ──
const CHAPTERS: Record<string, [string, string, string, string]> = {
  '03': ['Fish and crustaceans', 'Pescados y crustáceos', 'ماهی و سخت‌پوستان', 'الأسماك والقشريات'],
  '07': ['Vegetables', 'Hortalizas', 'سبزیجات', 'الخضروات'],
  '08': ['Fruit and nuts', 'Frutas y frutos secos', 'میوه و خشکبار', 'الفواكه والمكسرات'],
  '09': ['Coffee, tea, spices', 'Café, té, especias', 'قهوه، چای، ادویه', 'البن والشاي والتوابل'],
  '10': ['Cereals', 'Cereales', 'غلات', 'الحبوب'],
  '15': ['Fats and oils', 'Grasas y aceites', 'چربی‌ها و روغن‌ها', 'الدهون والزيوت'],
  '17': ['Sugars', 'Azúcares', 'قند و شکر', 'السكريات'],
  '25': ['Salt, sulphur, earths and stone, cement', 'Sal, azufre, tierras y piedras, cemento', 'نمک، گوگرد، خاک و سنگ، سیمان', 'الملح والكبريت والأتربة والحجر والإسمنت'],
  '26': ['Ores, slag and ash', 'Minerales, escorias y cenizas', 'سنگ معدن، سرباره و خاکستر', 'الخامات والخبث والرماد'],
  '27': ['Mineral fuels, oils, bitumen', 'Combustibles minerales, aceites, betún', 'سوخت‌های معدنی، روغن، قیر', 'الوقود المعدني والزيوت والبيتومين'],
  '28': ['Inorganic chemicals', 'Química inorgánica', 'مواد شیمیایی معدنی', 'المواد الكيميائية غير العضوية'],
  '29': ['Organic chemicals', 'Química orgánica', 'مواد شیمیایی آلی', 'المواد الكيميائية العضوية'],
  '31': ['Fertilisers', 'Abonos', 'کود', 'الأسمدة'],
  '39': ['Plastics', 'Plásticos', 'پلاستیک', 'اللدائن (البلاستيك)'],
  '40': ['Rubber', 'Caucho', 'لاستیک', 'المطاط'],
  '44': ['Wood', 'Madera', 'چوب', 'الخشب'],
  '48': ['Paper and paperboard', 'Papel y cartón', 'کاغذ و مقوا', 'الورق والكرتون'],
  '52': ['Cotton', 'Algodón', 'پنبه', 'القطن'],
  '57': ['Carpets', 'Alfombras', 'فرش', 'السجاد'],
  '68': ['Stone, plaster, cement articles', 'Manufacturas de piedra, yeso, cemento', 'مصنوعات سنگی، گچی، سیمانی', 'مصنوعات الحجر والجبس والإسمنت'],
  '69': ['Ceramic products', 'Productos cerámicos', 'محصولات سرامیکی', 'المنتجات الخزفية'],
  '70': ['Glass', 'Vidrio', 'شیشه', 'الزجاج'],
  '72': ['Iron and steel', 'Fundición, hierro y acero', 'آهن و فولاد', 'الحديد والصلب'],
  '73': ['Articles of iron or steel', 'Manufacturas de hierro o acero', 'مصنوعات آهنی و فولادی', 'مصنوعات الحديد أو الصلب'],
  '74': ['Copper', 'Cobre', 'مس', 'النحاس'],
  '76': ['Aluminium', 'Aluminio', 'آلومینیوم', 'الألمنيوم'],
  '84': ['Machinery and mechanical appliances', 'Máquinas y aparatos mecánicos', 'ماشین‌آلات و وسایل مکانیکی', 'الآلات والأجهزة الميكانيكية'],
  '85': ['Electrical machinery', 'Máquinas y material eléctrico', 'ماشین‌آلات برقی', 'الآلات الكهربائية'],
  '87': ['Vehicles and parts', 'Vehículos y partes', 'وسایل نقلیه و قطعات', 'المركبات وقطع الغيار'],
  '94': ['Furniture, lighting', 'Muebles, iluminación', 'مبلمان، روشنایی', 'الأثاث والإنارة'],
};
const LIDX: Record<CLang, number> = { en: 0, es: 1, fa: 2, ar: 3 };
export function hsCheck(hs: string, lang: CLang): { ok: boolean; digits: string; text: string } {
  const digits = hs.replace(/[\s.\-]/g, '');
  if (!digits) return { ok: true, digits, text: '' };
  if (!/^\d+$/.test(digits)) return { ok: false, digits, text: lang === 'fa' ? 'فقط عدد (۶ تا ۱۰ رقم)' : lang === 'ar' ? 'أرقام فقط (٦ إلى ١٠ أرقام)' : lang === 'es' ? 'Solo dígitos (6–10)' : 'Digits only (6–10)' };
  if (digits.length < 6 || digits.length > 10) return { ok: false, digits, text: lang === 'fa' ? `کد HS باید ۶ تا ۱۰ رقم باشد (${digits.length})` : lang === 'ar' ? `يجب أن يتكون رمز HS من 6 إلى 10 أرقام (${digits.length})` : lang === 'es' ? `El HS debe tener 6–10 dígitos (${digits.length})` : `HS code must be 6–10 digits (has ${digits.length})` };
  const ch = digits.slice(0, 2);
  const name = CHAPTERS[ch]?.[LIDX[lang]];
  return { ok: true, digits, text: `${lang === 'fa' ? 'فصل' : lang === 'ar' ? 'الفصل' : lang === 'es' ? 'Capítulo' : 'Chapter'} ${ch}${name ? ` · ${name}` : ''}` };
}

// ── units for target comparison ──
/** How many target units a quote covers (e.g. 2 for 2×20GP per 20GP; 4 TEU for 2×40HC). null = can't compare. */
export function targetUnits(per: TargetPer, f: QuoteFields): number | null {
  const eq = f.equipment ?? {};
  const n = (k: string) => eq[k] ?? 0;
  switch (per) {
    case '20GP': return n('20GP') || null;
    case '40GP': return n('40GP') || null;
    case '40HC': return n('40HC') || null;
    case 'TEU': { const t = n('20GP') + 2 * (n('40GP') + n('40HC') + n('45HC')); return t || null; }
    case 'ton': { const c = Object.values(eq).reduce((s, x) => s + x, 0) || 1; return f.weightKg ? (f.weightKg * (f.mode === 'fcl' ? c : 1)) / 1000 : null; }
    case 'cbm': return f.volumeCbm || null;
    case 'shipment': return 1;
  }
}

const base = (s: string) => s.toLowerCase().replace(/\s*\(.*\)$/, '').trim();
export const sameLane = (l: LaneProfile, origin: string | null, destination: string | null) =>
  !!origin && !!destination && base(l.pol) === base(origin) && base(l.pod) === base(destination);

/** A request text + field overrides that prefill the Quote tab from a lane profile. */
export function laneToRequest(l: LaneProfile, clientName: string, incoterm: string): { text: string; fields: Partial<QuoteFields> } {
  const cntr = ['20GP', '40GP', '40HC'].includes(l.volume.unit);
  const n = Math.max(1, Math.round(l.volume.amount ?? 1));
  const eq: Record<string, number> = cntr ? { [l.volume.unit]: n } : l.volume.unit === 'TEU' ? { '20GP': n } : { '20GP': 1 };
  const volTxt = cntr || l.volume.unit === 'TEU' ? `${eq['20GP'] ?? n}x${Object.keys(eq)[0]}` : `${l.volume.amount ?? '?'} ${l.volume.unit}`;
  const text = `Lane profile (${clientName}): ${volTxt} ${l.pol} to ${l.pod}, ${l.commodity}${l.hs ? `, HS ${l.hs}` : ''}, ${incoterm}, payment ${l.payment}${l.volume.period !== 'shipment' ? ` (volume per ${l.volume.period})` : ''}.`;
  return {
    text,
    fields: { mode: 'fcl', origin: l.pol, destination: l.pod, equipment: eq, cargo: l.commodity, ...(l.volume.unit === 'tons' && l.volume.amount ? { weightKg: l.volume.amount * 1000 } : {}), ...(l.volume.unit === 'cbm' && l.volume.amount ? { volumeCbm: l.volume.amount } : {}) },
  };
}

// ── jobs ↔ lane profiles (MSDS status on jobs) ──
export function laneForJob(lanes: LaneProfile[] | undefined, j: { pol: string; pod: string; commodity: string }): LaneProfile | null {
  if (!lanes?.length) return null;
  const w = j.commodity.toLowerCase().split(/[\s,(]/)[0];
  return lanes.find((l) => sameLane(l, j.pol, j.pod)) ?? lanes.find((l) => w && l.commodity.toLowerCase().includes(w)) ?? null;
}
export function jobMsds(lanes: LaneProfile[] | undefined, j: { pol: string; pod: string; commodity: string }): { hs: string | null; guessed: boolean; need: MsdsNeed; meta: MsdsMeta | null; lane: LaneProfile | null } {
  const lane = laneForJob(lanes, j);
  const hs = lane?.hs || hsFromCommodity(j.commodity);
  const n = msdsNeed(hs, lane?.dg ? 'yes' : null);
  return { hs, guessed: !lane?.hs && !!hs, need: n.need, meta: lane?.msds ?? null, lane };
}
