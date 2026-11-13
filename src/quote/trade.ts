import type { QuoteFields } from './parser';
import type { Quote } from './rates';
import type { Tariffs } from '../jobs/tariffs';

/** Export / import quote sections around the forwarder's home port. Tariffs are SAMPLE data. */
export const HOME_PORT = 'Jebel Ali';
export type TradeDir = 'export' | 'import';
type L3 = 'en' | 'es' | 'fa' | 'ar';
const base = (s: string | null) => (s ?? '').toLowerCase().replace(/\s*\(.*\)$/, '').trim();
export function autoDir(f: Pick<QuoteFields, 'origin' | 'destination'>): TradeDir | null {
  const h = base(HOME_PORT);
  if (base(f.destination) === h) return 'import';
  if (base(f.origin) === h) return 'export';
  return null;
}

const T: Record<string, [string, string, string, string]> = {
  export: ['EXPORT QUOTATION', 'COTIZACIÓN DE EXPORTACIÓN', 'پیش‌فاکتور صادرات', 'عرض سعر تصدير'],
  import: ['IMPORT QUOTATION', 'COTIZACIÓN DE IMPORTACIÓN', 'پیش‌فاکتور واردات', 'عرض سعر استيراد'],
  localExp: ['Origin charges at Jebel Ali', 'Gastos en origen en Jebel Ali', 'هزینه‌های مبدأ در جبل علی', 'رسوم المنشأ في جبل علي'],
  localImp: ['Destination charges at Jebel Ali', 'Gastos en destino en Jebel Ali', 'هزینه‌های مقصد در جبل علی', 'رسوم الوجهة في جبل علي'],
  crossTitle: ['Cross-trade: no leg at Jebel Ali, so no Jebel Ali local charges. Origin and destination charges for the ports on this lane are in the lines above (SAMPLE).', 'Cross-trade: sin tramo en Jebel Ali, así que no hay gastos locales de Jebel Ali. Los gastos en origen y destino de los puertos de esta ruta están en las líneas de arriba (EJEMPLO).', 'حمل بین دو بندر خارجی: مسیری در جبل علی نیست، پس هزینه محلی جبل علی ندارد. هزینه‌های مبدأ و مقصد بنادر این مسیر در ردیف‌های بالا آمده است (نمونه).', 'شحن بين ميناءين آخرين: لا مسار في جبل علي، فلا رسوم محلية لجبل علي. رسوم المنشأ والوجهة لموانئ هذا المسار في البنود أعلاه (عيّنة).'],
  tariffSrc: ['per port and line / agent tariffs (sample figures — confirm)', 'según tarifas del puerto y de la naviera / agente (cifras de ejemplo — confirmar)', 'طبق تعرفه بندر و خط / نماینده (ارقام نمونه — تأیید شود)', 'وفق تعرفة الميناء والخط / الوكيل (أرقام عيّنة — للتأكيد)'],
  thc: ['THC (port tariff)', 'THC (tarifa portuaria)', 'THC (تعرفه بندر)', 'THC (تعرفة الميناء)'],
  bl: ['B/L fee (line / agent)', 'Emisión B/L (naviera / agente)', 'هزینه بارنامه (خط / نماینده)', 'رسوم بوليصة الشحن (الخط / الوكيل)'],
  seal: ['Seal fee', 'Precinto', 'هزینه پلمب', 'رسوم الختم'],
  doFee: ['DO fee (line / agent)', 'Despacho DO (naviera / agente)', 'هزینه دی‌او (خط / نماینده)', 'رسوم إذن التسليم (الخط / الوكيل)'],
  warehouse: ['Port warehouse / storage', 'Almacén / almacenaje portuario', 'انبارداری بندر', 'مستودع / تخزين الميناء'],
  atCost: ['at cost, after the free storage period', 'al coste, tras el periodo libre', 'به قیمت تمام‌شده، پس از دوره رایگان', 'بالتكلفة، بعد فترة التخزين المجانية'],
  included: ['included in the totals above', 'incluido en los totales', 'در جمع بالا منظور شده', 'مشمولة في الإجماليات أعلاه'],
  local: ['payable locally — not in the totals above', 'pagadero en destino — no incluido en los totales', 'محلی پرداخت می‌شود — در جمع بالا نیست', 'تُدفع محليًا — غير مشمولة في الإجماليات أعلاه'],
  freeOrigin: ['Free time at origin', 'Días libres en origen', 'زمان آزاد در مبدأ', 'الفترة المجانية في المنشأ'],
  freeDest: ['Free time at destination', 'Días libres en destino', 'زمان آزاد در مقصد', 'الفترة المجانية في الوجهة'],
  days: ['days', 'días', 'روز', 'أيام'],
  cutoff: ['Cut-off: cargo and documents 48 h before vessel closing', 'Cut-off: mercancía y documentos 48 h antes del cierre del buque', 'کات‌آف: بار و مدارک ۴۸ ساعت پیش از بسته شدن کشتی', 'Cut-off: البضائع والمستندات قبل ٤٨ ساعة من إغلاق السفينة'],
  obl: ['Original B/L released after all charges are paid', 'B/L original se entrega tras el pago de todos los gastos', 'بارنامه اصلی پس از پرداخت همه هزینه‌ها تحویل می‌شود', 'تُسلَّم بوليصة الشحن الأصلية بعد دفع جميع الرسوم'],
  collect: ['Freight: usually collect (paid at Jebel Ali before DO release)', 'Flete: normalmente a cobrar (pagado en Jebel Ali antes del DO)', 'کرایه: معمولاً پس‌کرایه (پرداخت در جبل علی پیش از صدور دی‌او)', 'أجرة الشحن: عادةً تُحصَّل عند الوصول (تُدفع في جبل علي قبل الإفراج عن إذن التسليم)'],
  prepaid: ['Freight: prepaid at origin', 'Flete: prepagado en origen', 'کرایه: پیش‌کرایه در مبدأ', 'أجرة الشحن: مدفوعة مسبقًا في المنشأ'],
  cheques: ['Guarantee cheques', 'Cheques de garantía', 'چک‌های تضمین', 'شيكات الضمان'],
  chqDem: ['demurrage cheque per B/L', 'cheque de demora por B/L', 'چک دموراژ برای هر بارنامه', 'شيك غرامة تأخير لكل بوليصة'],
  chqCntr: ['container cheque per container', 'cheque de contenedor por contenedor', 'چک کانتینر برای هر کانتینر', 'شيك حاوية لكل حاوية'],
  chqBack: ['returned when the empties are back', 'se devuelven al retornar los vacíos', 'پس از برگشت کانتینر خالی عودت می‌شود', 'تُعاد عند إرجاع الحاويات الفارغة'],
  loi: ['LOI (letter of indemnity) required for DO release', 'Se requiere LOI (carta de indemnidad) para el DO', 'برای ترخیصیه، تعهدنامه (LOI) لازم است', 'خطاب ضمان (LOI) مطلوب للإفراج عن إذن التسليم'],
  tbcLine: ['to confirm with the line', 'a confirmar con la naviera', 'با خط کشتیرانی تأیید شود', 'للتأكيد مع الخط'],
  agentAt: ['Origin agent', 'Agente en origen', 'نماینده مبدأ', 'وكيل المنشأ'],
  lineCompare: ['Options compare shipping lines', 'Las opciones comparan navieras', 'گزینه‌ها خطوط کشتیرانی را مقایسه می‌کنند', 'الخيارات تقارن الخطوط الملاحية'],
  agentCompare: ['Options compare overseas agents at origin', 'Las opciones comparan agentes en origen', 'گزینه‌ها نمایندگان خارجی مبدأ را مقایسه می‌کنند', 'الخيارات تقارن الوكلاء الخارجيين في المنشأ'],
};
const I: Record<L3, number> = { en: 0, es: 1, fa: 2, ar: 3 };
export const tl3 = (lang: L3, k: keyof typeof T) => T[k][I[lang]];

export interface TradeLine { label: string; amount: number | null; note: string; included: boolean }
export interface TradeBlock { dir: TradeDir; title: string; localTitle: string; lines: TradeLine[]; notes: string[]; currency: string; cross?: boolean }

/** cross = the home port is neither POL nor POD: no home-port local charges at all (only the lane's own charges, in the quote lines). */
export function tradeBlock(dir: TradeDir, f: QuoteFields, q: Quote | null, t: Tariffs, lang: L3, payment?: string | null, cross = false): TradeBlock {
  const L = (k: keyof typeof T) => tl3(lang, k);
  if (cross) {
    const free = q?.freeDays != null ? `${q.freeDays} ${L('days')}` : L('tbcLine');
    return { dir, title: L(dir), localTitle: L('crossTitle'), lines: [], notes: [`${L('freeDest')}: ${free}`, L('cutoff'), L('obl')], currency: t.currency, cross: true };
  }
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
  if (b.cross) return [b.localTitle, ...b.notes.map((x) => `• ${x}`)];
  return [
    `${b.localTitle}:`,
    ...b.lines.map((l) => `  ${l.label}: ${l.amount != null ? `${b.currency} ${l.amount.toLocaleString('en-US')}` : '—'}${l.note ? ` (${l.note})` : ''} — ${l.included ? L('included') : l.amount != null ? L('local') : ''}`.replace(/ — $/, '')),
    ...b.notes.map((x) => `• ${x}`),
  ];
}
