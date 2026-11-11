import type { QMode } from './locations';
import type { Badge } from './rates';

export type QLang = 'en' | 'es' | 'fa' | 'ar';

export const MODE_L: Record<QLang, Record<QMode, string>> = {
  en: { fcl: 'Ocean FCL', lcl: 'Ocean LCL', air: 'Air', road: 'Road' },
  es: { fcl: 'Marítimo FCL', lcl: 'Marítimo LCL (grupaje)', air: 'Aéreo', road: 'Carretera' },
  fa: { fcl: 'دریایی FCL', lcl: 'دریایی LCL (خرده‌بار)', air: 'هوایی', road: 'زمینی' },
  ar: { fcl: 'بحري FCL', lcl: 'بحري LCL (شحنة جزئية)', air: 'جوي', road: 'بري' },
};

export const BADGE_L: Record<QLang, Record<Badge, string>> = {
  en: { recommended: 'Recommended', cheapest: 'Cheapest', fastest: 'Fastest', mostFree: 'Most free time' },
  es: { recommended: 'Recomendada', cheapest: 'Más barata', fastest: 'Más rápida', mostFree: 'Más free time' },
  fa: { recommended: 'پیشنهادی', cheapest: 'ارزان‌ترین', fastest: 'سریع‌ترین', mostFree: 'بیشترین فری‌تایم' },
  ar: { recommended: 'مُوصى به', cheapest: 'الأرخص', fastest: 'الأسرع', mostFree: 'أطول فترة مجانية' },
};

const O = {
  options: ['Options', 'Opciones', 'گزینه‌ها', 'الخيارات'],
  optionsSub: ['one per line on this lane (E3: ask several lines, take the best)', 'una por naviera en esta ruta (E3: pedir a varias navieras)', 'یک گزینه برای هر خط (E3: استعلام از چند خط)', 'واحد لكل خط في هذا المسار (E3: اسأل عدة خطوط وخذ الأفضل)'],
  option: ['Option', 'Opción', 'گزینه', 'الخيار'],
  inQuote: ['In customer quote', 'En la oferta', 'در پیشنهاد مشتری', 'في عرض العميل'],
  sell: ['Sell', 'Venta', 'فروش', 'بيع'],
  buy: ['Buy', 'Compra', 'خرید', 'شراء'],
  margin: ['Margin', 'Margen', 'سود', 'الهامش'],
  transit: ['Transit', 'Tránsito', 'زمان حمل', 'مدة العبور'],
  days: ['days', 'días', 'روز', 'أيام'],
  d: ['d', 'd', 'روز', 'يوم'],
  sailing: ['Sailing', 'Salida', 'حرکت', 'الإبحار'],
  freeTime: ['Free time', 'Free time', 'فری‌تایم', 'الفترة المجانية'],
  validTo: ['Valid to', 'Válida hasta', 'اعتبار تا', 'صالح حتى'],
  routing: ['Routing', 'Ruta', 'مسیر', 'المسار'],
  included: ['Included', 'Incluye', 'شامل', 'مشمول'],
  excluded: ['Not in scope', 'No incluido', 'خارج از محدوده', 'خارج النطاق'],
  common: ['common charges', 'gastos comunes', 'هزینه مشترک', 'رسوم مشتركة'],
  cheapest: ['cheapest', 'la más barata', 'ارزان‌ترین', 'الأرخص'],
  vsCheapest: ['vs cheapest', 'vs la más barata', 'نسبت به ارزان‌ترین', 'مقارنة بالأرخص'],
  recheck: ['RATE TO RE-CHECK', 'TARIFA A REVISAR', 'نرخ نیاز به بررسی', 'سعر يحتاج إلى مراجعة'],
  breakdown: ['Breakdown', 'Desglose', 'جزئیات', 'التفاصيل'],
  showing: ['showing', 'mostrando', 'نمایش', 'يُعرض'],
  recRule: [
    'Recommended = lowest price after adding 1% per extra transit day vs the fastest, current rates only.',
    'Recomendada = precio más bajo sumando 1% por día extra de tránsito, solo tarifas vigentes.',
    'پیشنهادی = کمترین قیمت با احتساب ۱٪ برای هر روز حمل بیشتر، فقط نرخ‌های معتبر.', 'المُوصى به = أقل سعر بعد إضافة ١٪ لكل يوم عبور إضافي مقارنة بالأسرع، بالأسعار السارية فقط.',
  ],
  pickOne: ['Pick at least one option for the customer quote.', 'Elige al menos una opción.', 'حداقل یک گزینه را انتخاب کنید.', 'اختر خيارًا واحدًا على الأقل لعرض العميل.'],
  nSelected: ['in customer quote', 'en la oferta', 'در پیشنهاد', 'في عرض العميل'],
  pdfFa: ['PDF is generated in English when FA is selected.', 'El PDF se genera en inglés con FA.', 'PDF به انگلیسی ساخته می‌شود.', 'عند اختيار الفارسية أو العربية يُنشأ ملف PDF بالإنجليزية.'],
  na: ['n/a', 'n/a', '—', '—'],
} as const;
export type OKey = keyof typeof O;
const IDX: Record<QLang, number> = { en: 0, es: 1, fa: 2, ar: 3 };
export const ol = (lang: QLang, k: OKey) => O[k][IDX[lang]];
