import type { QuoteFields } from './parser';
import type { Quote } from './rates';
import type { Tariffs } from '../jobs/tariffs';

/** Export / import quote sections around the client's home port (brief E3/E4 export, I2/I13 import). Tariffs are SAMPLE data. */
export const HOME_PORT = 'Bandar Abbas';
export type TradeDir = 'export' | 'import';
type L3 = 'en' | 'es' | 'fa';
const base = (s: string | null) => (s ?? '').toLowerCase().replace(/\s*\(.*\)$/, '').trim();
export function autoDir(f: Pick<QuoteFields, 'origin' | 'destination'>): TradeDir | null {
  const h = base(HOME_PORT);
  if (base(f.destination) === h) return 'import';
  if (base(f.origin) === h) return 'export';
  return null;
}

const T: Record<string, [string, string, string]> = {
  export: ['EXPORT QUOTATION', 'COTIZACIÓN DE EXPORTACIÓN', 'پیش‌فاکتور صادرات'],
  import: ['IMPORT QUOTATION', 'COTIZACIÓN DE IMPORTACIÓN', 'پیش‌فاکتور واردات'],
  localExp: ['Origin charges at Bandar Abbas', 'Gastos en origen en Bandar Abbas', 'هزینه‌های مبدأ در بندرعباس'],
  localImp: ['Destination charges at Bandar Abbas', 'Gastos en destino en Bandar Abbas', 'هزینه‌های مقصد در بندرعباس'],
  tariffSrc: ['per Shipping Association / Ports Organization tariff (sample figures — confirm)', 'según tarifa de la Asociación de Navieras / Organización de Puertos (cifras de ejemplo — confirmar)', 'طبق تعرفه انجمن کشتیرانی / سازمان بنادر (ارقام نمونه — تأیید شود)'],
  thc: ['THC (Ports Organization)', 'THC (Organización de Puertos)', 'THC (سازمان بنادر)'],
  bl: ['B/L fee (Shipping Association)', 'Emisión B/L (Asociación de Navieras)', 'هزینه بارنامه (انجمن کشتیرانی)'],
  seal: ['Seal fee', 'Precinto', 'هزینه پلمب'],
  doFee: ['DO fee (Shipping Association)', 'Despacho DO (Asociación de Navieras)', 'هزینه ترخیصیه / DO (انجمن کشتیرانی)'],
  warehouse: ['Port warehouse / storage', 'Almacén / almacenaje portuario', 'انبارداری بندر'],
  atCost: ['at cost, after the free storage period', 'al coste, tras el periodo libre', 'به قیمت تمام‌شده، پس از دوره رایگان'],
  included: ['included in the totals above', 'incluido en los totales', 'در جمع بالا منظور شده'],
  local: ['payable locally — not in the totals above', 'pagadero en destino — no incluido en los totales', 'محلی پرداخت می‌شود — در جمع بالا نیست'],
  freeOrigin: ['Free time at origin', 'Días libres en origen', 'زمان آزاد در مبدأ'],
  freeDest: ['Free time at destination', 'Días libres en destino', 'زمان آزاد در مقصد'],
  days: ['days', 'días', 'روز'],
  cutoff: ['Cut-off: cargo and documents 48 h before vessel closing', 'Cut-off: mercancía y documentos 48 h antes del cierre del buque', 'کات‌آف: بار و مدارک ۴۸ ساعت پیش از بسته شدن کشتی'],
  obl: ['Original B/L released after all charges are paid', 'B/L original se entrega tras el pago de todos los gastos', 'بارنامه اصلی پس از پرداخت همه هزینه‌ها تحویل می‌شود'],
  collect: ['Freight: usually collect (paid at Bandar Abbas before DO release)', 'Flete: normalmente a cobrar (pagado en Bandar Abbas antes del DO)', 'کرایه: معمولاً پس‌کرایه (پرداخت در بندرعباس پیش از ترخیصیه)'],
  prepaid: ['Freight: prepaid at origin', 'Flete: prepagado en origen', 'کرایه: پیش‌کرایه در مبدأ'],
  cheques: ['Guarantee cheques', 'Cheques de garantía', 'چک‌های تضمین'],
  chqDem: ['demurrage cheque per B/L', 'cheque de demora por B/L', 'چک دموراژ برای هر بارنامه'],
  chqCntr: ['container cheque per container', 'cheque de contenedor por contenedor', 'چک کانتینر برای هر کانتینر'],
  chqBack: ['returned when the empties are back', 'se devuelven al retornar los vacíos', 'پس از برگشت کانتینر خالی عودت می‌شود'],
  loi: ['LOI (letter of indemnity) required for DO release', 'Se requiere LOI (carta de indemnidad) para el DO', 'برای ترخیصیه، تعهدنامه (LOI) لازم است'],
  tbcLine: ['to confirm with the line', 'a confirmar con la naviera', 'با خط کشتیرانی تأیید شود'],
  agentAt: ['Origin agent', 'Agente en origen', 'نماینده مبدأ'],
  lineCompare: ['Options compare shipping lines', 'Las opciones comparan navieras', 'گزینه‌ها خطوط کشتیرانی را مقایسه می‌کنند'],
  agentCompare: ['Options compare overseas agents at origin', 'Las opciones comparan agentes en origen', 'گزینه‌ها نمایندگان خارجی مبدأ را مقایسه می‌کنند'],
};
const I: Record<L3, number> = { en: 0, es: 1, fa: 2 };
export const tl3 = (lang: L3, k: keyof typeof T) => T[k][I[lang]];

export interface TradeLine { label: string; amount: number | null; note: string; included: boolean }
export interface TradeBlock { dir: TradeDir; title: string; localTitle: string; lines: TradeLine[]; notes: string[]; currency: string }

export function tradeBlock(dir: TradeDir, f: QuoteFields, q: Quote | null, t: Tariffs, lang: L3, payment?: string | null): TradeBlock {
  const L = (k: keyof typeof T) => tl3(lang, k);
  const eq = f.equipment ?? {};
  const n20 = eq['20GP'] ?? 0;
  const n40 = (eq['40GP'] ?? 0) + (eq['40HC'] ?? 0) + (eq['45HC'] ?? 0);
  const n = n20 + n40 || (f.mode === 'fcl' ? 1 : 0);
  const homeSide = dir === 'export' ? 'origin' : 'destination';
  const inQuote = (re: RegExp) => !!q?.lines.some((l) => l.side === homeSide && re.test(l.charge));
  const thc = n20 * t.thc20 + n40 * t.thc40;
  const lines: TradeLine[] = dir === 'export'
    ? [
      { label: L('thc'), amount: thc, note: `${n20 ? `${n20}×20' ${t.thc20}` : ''}${n20 && n40 ? ' + ' : ''}${n40 ? `${n40}×40' ${t.thc40}` : ''}`, included: inQuote(/THC/i) },
      { label: L('bl'), amount: t.blFee, note: '1 B/L', included: inQuote(/B\/L/i) },
      { label: L('seal'), amount: n * t.sealFee, note: `${n}× ${t.sealFee}`, included: inQuote(/seal/i) },
    ]
    : [
      { label: L('thc'), amount: thc, note: `${n20 ? `${n20}×20' ${t.thc20}` : ''}${n20 && n40 ? ' + ' : ''}${n40 ? `${n40}×40' ${t.thc40}` : ''}`, included: inQuote(/THC/i) },
      { label: L('doFee'), amount: t.doFee, note: '1 B/L', included: inQuote(/\bDO\b|delivery order/i) },
      { label: L('warehouse'), amount: null, note: L('atCost'), included: false },
    ];
  const free = q?.freeDays != null ? `${q.freeDays} ${L('days')}` : L('tbcLine');
  const chq = t.chequeDemurrage + n20 * t.chequeContainer20 + n40 * t.chequeContainer40;
  const notes = dir === 'export'
    ? [`${L('freeOrigin')}: ${free}`, L('cutoff'), L('obl')]
    : [
      (payment ? /collect/i.test(payment) : /^(EXW|FCA|FAS|FOB)$/.test(f.incoterm ?? 'FOB')) ? L('collect') : L('prepaid'),
      `${L('freeDest')}: ${free}`,
      `${L('cheques')}: ${t.currency} ${chq.toLocaleString('en-US')} — ${L('chqDem')} ${t.chequeDemurrage.toLocaleString('en-US')}${n20 ? ` + ${n20}× ${t.chequeContainer20.toLocaleString('en-US')} (20')` : ''}${n40 ? ` + ${n40}× ${t.chequeContainer40.toLocaleString('en-US')} (40')` : ''} ${L('chqCntr')}; ${L('chqBack')}`,
      L('loi'),
    ];
  return { dir, title: L(dir), localTitle: `${dir === 'export' ? L('localExp') : L('localImp')} — ${L('tariffSrc')}`, lines, notes, currency: t.currency };
}

export function tradeText(b: TradeBlock, lang: L3): string[] {
  const L = (k: keyof typeof T) => tl3(lang, k);
  return [
    `${b.localTitle}:`,
    ...b.lines.map((l) => `  ${l.label}: ${l.amount != null ? `${b.currency} ${l.amount.toLocaleString('en-US')}` : '—'}${l.note ? ` (${l.note})` : ''} — ${l.included ? L('included') : l.amount != null ? L('local') : ''}`.replace(/ — $/, '')),
    ...b.notes.map((x) => `• ${x}`),
  ];
}
