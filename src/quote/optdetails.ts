// "Quote details" sheet of the options export (label/value pairs in the UI language).
import type { QuoteFields } from './parser';
import { MODE_L, type QLang } from './optlabels';
export type { History } from './optrows';

type L4 = readonly [string, string, string, string];
const IX: Record<QLang, number> = { en: 0, es: 1, fa: 2, ar: 3 };
const D = {
  ref: ['Quote reference', 'Referencia de la oferta', 'شماره پیشنهاد', 'مرجع العرض'],
  date: ['Exported on', 'Exportado el', 'تاریخ خروجی', 'تاريخ التصدير'],
  client: ['Client', 'Cliente', 'مشتری', 'العميل'],
  origin: ['Origin', 'Origen', 'مبدأ', 'المنشأ'],
  destination: ['Destination', 'Destino', 'مقصد', 'الوجهة'],
  mode: ['Mode', 'Modo', 'نوع حمل', 'نوع الشحن'],
  incoterm: ['Incoterm', 'Incoterm', 'اینکوترم', 'شرط التسليم (Incoterm)'],
  equipment: ['Equipment', 'Equipo', 'تجهیزات', 'المعدات'],
  weight: ['Weight (kg)', 'Peso (kg)', 'وزن (کیلوگرم)', 'الوزن (كغ)'],
  volume: ['Volume (cbm)', 'Volumen (m³)', 'حجم (متر مکعب)', 'الحجم (م³)'],
  cargo: ['Cargo', 'Mercancía', 'کالا', 'البضاعة'],
  ready: ['Cargo ready', 'Mercancía lista', 'آمادگی بار', 'جاهزية البضاعة'],
  margin: ['Target margin %', 'Margen objetivo %', 'درصد سود هدف', 'نسبة الهامش المستهدفة'],
  cur: ['Quote currency', 'Moneda de la oferta', 'ارز پیشنهاد', 'عملة العرض'],
  fx: ['Exchange rate used', 'Tipo de cambio usado', 'نرخ تبدیل', 'سعر الصرف المستخدم'],
  count: ['Options on screen', 'Opciones en pantalla', 'گزینه‌های روی صفحه', 'الخيارات المعروضة'],
  note: ['Note', 'Nota', 'یادداشت', 'ملاحظة'],
  noteV: ['Demo options and rates are SAMPLE figures, not real carrier rates. Buy figures are internal: do not send this file to the customer.', 'Las opciones y tarifas de la demo son de MUESTRA, no tarifas reales. Las compras son internas: no envíe este archivo al cliente.', 'گزینه‌ها و نرخ‌های دمو نمونه هستند، نه نرخ واقعی خطوط. ارقام خرید داخلی است: این فایل را برای مشتری نفرستید.', 'خيارات وأسعار العرض التجريبي أرقام عيّنة وليست أسعارًا حقيقية. أرقام الشراء داخلية: لا ترسل هذا الملف إلى العميل.'],
  asap: ['ASAP', 'Lo antes posible', 'در اسرع وقت', 'في أقرب وقت'],
} as const satisfies Record<string, L4>;

export function exportDetailsFor(lang: QLang, x: { ref: string; fields: QuoteFields; client: string | null; margin: number; cur: string; fxText: string; count: number }): [string, string | number][] {
  const l = (k: keyof typeof D) => D[k][IX[lang]];
  const f = x.fields;
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const out: [string, string | number][] = [
    [l('ref'), x.ref], [l('date'), today], [l('client'), x.client ?? '—'],
    [l('origin'), f.origin ?? '—'], [l('destination'), f.destination ?? '—'], [l('mode'), f.mode ? MODE_L[lang][f.mode] : '—'],
    [l('incoterm'), f.incoterm ?? '—'], [l('equipment'), Object.entries(f.equipment).map(([k, n]) => `${n}×${k}`).join(' + ') || '—'],
  ];
  if (f.weightKg != null) out.push([l('weight'), f.weightKg]);
  if (f.volumeCbm != null) out.push([l('volume'), f.volumeCbm]);
  if (f.cargo) out.push([l('cargo'), f.cargo]);
  out.push([l('ready'), f.readyDate === 'ASAP' ? l('asap') : f.readyDate ?? '—'], [l('margin'), x.margin], [l('cur'), x.cur], [l('fx'), x.fxText], [l('count'), x.count], [l('note'), l('noteV')]);
  return out;
}
