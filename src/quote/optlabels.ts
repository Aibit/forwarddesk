import type { QMode } from './locations';
import type { Badge } from './rates';

export type QLang = 'en' | 'es' | 'fa';

export const MODE_L: Record<QLang, Record<QMode, string>> = {
  en: { fcl: 'Ocean FCL', lcl: 'Ocean LCL', air: 'Air', road: 'Road' },
  es: { fcl: 'Marítimo FCL', lcl: 'Marítimo LCL (grupaje)', air: 'Aéreo', road: 'Carretera' },
  fa: { fcl: 'دریایی FCL', lcl: 'دریایی LCL (خرده‌بار)', air: 'هوایی', road: 'زمینی' },
};

export const BADGE_L: Record<QLang, Record<Badge, string>> = {
  en: { recommended: 'Recommended', cheapest: 'Cheapest', fastest: 'Fastest', mostFree: 'Most free time' },
  es: { recommended: 'Recomendada', cheapest: 'Más barata', fastest: 'Más rápida', mostFree: 'Más free time' },
  fa: { recommended: 'پیشنهادی', cheapest: 'ارزان‌ترین', fastest: 'سریع‌ترین', mostFree: 'بیشترین فری‌تایم' },
};

const O = {
  options: ['Options', 'Opciones', 'گزینه‌ها'],
  optionsSub: ['one per line on this lane (E3: ask several lines, take the best)', 'una por naviera en esta ruta (E3: pedir a varias navieras)', 'یک گزینه برای هر خط (E3: استعلام از چند خط)'],
  option: ['Option', 'Opción', 'گزینه'],
  inQuote: ['In customer quote', 'En la oferta', 'در پیشنهاد مشتری'],
  sell: ['Sell', 'Venta', 'فروش'],
  buy: ['Buy', 'Compra', 'خرید'],
  margin: ['Margin', 'Margen', 'سود'],
  transit: ['Transit', 'Tránsito', 'زمان حمل'],
  days: ['days', 'días', 'روز'],
  d: ['d', 'd', 'روز'],
  sailing: ['Sailing', 'Salida', 'حرکت'],
  freeTime: ['Free time', 'Free time', 'فری‌تایم'],
  validTo: ['Valid to', 'Válida hasta', 'اعتبار تا'],
  routing: ['Routing', 'Ruta', 'مسیر'],
  included: ['Included', 'Incluye', 'شامل'],
  excluded: ['Not in scope', 'No incluido', 'خارج از محدوده'],
  common: ['common charges', 'gastos comunes', 'هزینه مشترک'],
  cheapest: ['cheapest', 'la más barata', 'ارزان‌ترین'],
  vsCheapest: ['vs cheapest', 'vs la más barata', 'نسبت به ارزان‌ترین'],
  recheck: ['RATE TO RE-CHECK', 'TARIFA A REVISAR', 'نرخ نیاز به بررسی'],
  breakdown: ['Breakdown', 'Desglose', 'جزئیات'],
  showing: ['showing', 'mostrando', 'نمایش'],
  recRule: [
    'Recommended = lowest price after adding 1% per extra transit day vs the fastest, current rates only.',
    'Recomendada = precio más bajo sumando 1% por día extra de tránsito, solo tarifas vigentes.',
    'پیشنهادی = کمترین قیمت با احتساب ۱٪ برای هر روز حمل بیشتر، فقط نرخ‌های معتبر.',
  ],
  pickOne: ['Pick at least one option for the customer quote.', 'Elige al menos una opción.', 'حداقل یک گزینه را انتخاب کنید.'],
  nSelected: ['in customer quote', 'en la oferta', 'در پیشنهاد'],
  pdfFa: ['PDF is generated in English when FA is selected.', 'El PDF se genera en inglés con FA.', 'PDF به انگلیسی ساخته می‌شود.'],
  na: ['n/a', 'n/a', '—'],
} as const;
export type OKey = keyof typeof O;
const IDX: Record<QLang, number> = { en: 0, es: 1, fa: 2 };
export const ol = (lang: QLang, k: OKey) => O[k][IDX[lang]];
