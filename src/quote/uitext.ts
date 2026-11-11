// Quote screen chrome in the UI language (EN / ES / FA). The customer quote text keeps its own language switch.
import type { UiLang } from '../ui/lang';

const T = {
  pasteH: ['Paste a customer request (email / WhatsApp)', 'Pega la solicitud del cliente (email / WhatsApp)', 'درخواست مشتری را بچسبانید (ایمیل / واتس‌اپ)'],
  timerTitle: ['From paste to copied quote', 'Desde pegar hasta copiar la cotización', 'از چسباندن تا کپی قیمت'],
  readyIn: ['QUOTE READY IN ', 'COTIZACIÓN LISTA EN ', 'قیمت آماده در '],
  timeTo: ['TIME TO QUOTE ', 'TIEMPO DE COTIZACIÓN ', 'زمان قیمت‌دهی '],
  client: ['Client', 'Cliente', 'مشتری'],
  none: ['— none —', '— ninguno —', '— هیچ —'],
  sample: [' (sample)', ' (ejemplo)', ' (نمونه)'],
  anyLine: ['any line', 'cualquier naviera', 'هر خط کشتیرانی'],
  ask: ['ask', 'pedir', 'درخواست'],
  dFree: ['d free', 'días libres', 'روز آزاد'],
  dashboard: ['dashboard →', 'panel →', 'داشبورد ←'],
  pickClient: ['pick one to apply their margin, Incoterm, language and lines', 'elige uno para aplicar su margen, Incoterm, idioma y navieras', 'یکی را انتخاب کنید تا حاشیه، اینکوترم، زبان و خطوط او اعمال شود'],
  lanes: ['Lanes', 'Rutas', 'مسیرها'],
  placeholder: ['e.g. hi need price 2x40HC Shanghai to Barcelona, ready 20 Nov, FOB…', 'p. ej. hola, precio 2x40HC Shanghai a Barcelona, listo 20 nov, FOB…', 'مثلاً: سلام، قیمت 2x40HC از Shanghai به Barcelona، آماده ۲۰ نوامبر، FOB…'],
  trySample: ['Try a sample:', 'Prueba un ejemplo:', 'یک نمونه را امتحان کنید:'],
  clear: ['Clear', 'Borrar', 'پاک کردن'],
  priced: ['PRICED', 'CON PRECIO', 'قیمت‌گذاری شد'],
  sellU: ['SELL', 'VENTA', 'فروش'],
  margin: ['margin', 'margen', 'حاشیه'],
  optionsFrom: ['options from', 'opciones desde', 'گزینه، از'],
  allPresent: ['all details present — ready to send', 'todos los datos presentes — lista para enviar', 'همه جزئیات موجود است — آماده ارسال'],
  toConfirmCust: ['to confirm with customer', 'por confirmar con el cliente', 'مورد برای تأیید با مشتری'],
  missing: ['missing', 'faltan', 'ناقص'],
  toConfirm: ['to confirm', 'por confirmar', 'برای تأیید'],
  assumed: ['assumed', 'supuestos', 'فرض‌شده'],
  viewQuote: ['View quote →', 'Ver cotización →', 'مشاهده قیمت ←'],
  notPriced: ['NOT PRICED', 'SIN PRECIO', 'قیمت‌گذاری نشده'],
  needsMode: ['Needs mode, origin and destination.', 'Faltan modo, origen y destino.', 'حالت حمل، مبدأ و مقصد لازم است.'],
  noRateFor: ['No freight rate for', 'No hay tarifa de flete para', 'نرخ کرایه‌ای وجود ندارد برای'],
  inSheet: ['in this rate sheet.', 'en esta hoja de tarifas.', 'در این جدول نرخ.'],
  whatRead: ['What it read', 'Lo que ha leído', 'آنچه خوانده شد'],
  clickFix: ['click any field to fix it', 'pulsa un campo para corregirlo', 'برای اصلاح روی هر فیلد کلیک کنید'],
  fMode: ['Mode', 'Modo', 'حالت حمل'],
  fOrigin: ['Origin', 'Origen', 'مبدأ'],
  fDest: ['Destination', 'Destino', 'مقصد'],
  fEquip: ['Equipment', 'Equipo', 'تجهیزات'],
  fWeight: ['Weight', 'Peso', 'وزن'],
  fVolume: ['Volume', 'Volumen', 'حجم'],
  fCharge: ['Chargeable', 'Tasable', 'وزن قابل محاسبه'],
  fPieces: ['Pieces', 'Bultos', 'تعداد بسته'],
  fInco: ['Incoterm', 'Incoterm', 'اینکوترم'],
  fReady: ['Ready', 'Lista', 'آمادگی'],
  fCargo: ['Cargo', 'Mercancía', 'کالا'],
  fDg: ['DG', 'Peligrosa (DG)', 'کالای خطرناک (DG)'],
  perCntr: [' / cntr', ' / cntr', ' / کانتینر'],
  perTruck: [' / truck', ' / camión', ' / کامیون'],
  yesDg: ['Yes — DG', 'Sí — DG', 'بله — DG'],
  no: ['No', 'No', 'خیر'],
  unknown: ['Unknown', 'Desconocido', 'نامشخص'],
  hsGuessed: [' (guessed from commodity)', ' (deducido de la mercancía)', ' (از روی کالا حدس زده شد)'],
  hsLane: [' (lane profile)', ' (perfil de ruta)', ' (پروفایل مسیر)'],
  noHs: [' · no HS code', ' · sin código HS', ' · بدون کد HS'],
  savedOn: ['saved on the lane profile of', 'guardada en el perfil de ruta de', 'ذخیره‌شده در پروفایل مسیر'],
  askH: ['What to ask the customer', 'Qué preguntar al cliente', 'چه چیزی از مشتری بپرسیم'],
  tagMissing: ['MISSING', 'FALTA', 'ناقص'],
  tagAssumed: ['ASSUMED', 'SUPUESTO', 'فرض شده'],
  tagConfirm: ['TO CONFIRM', 'POR CONFIRMAR', 'برای تأیید'],
  copied: ['Copied ✓', 'Copiado ✓', 'کپی شد ✓'],
  copyQ: ['Copy questions for customer', 'Copiar preguntas para el cliente', 'کپی سؤال‌ها برای مشتری'],
  sampleRates: ['SAMPLE RATES', 'TARIFAS DE EJEMPLO', 'نرخ‌های نمونه'],
  sampleRatesNote: ['— illustrative numbers, not market rates. Load your own rate sheet to quote for real.', '— cifras ilustrativas, no son tarifas de mercado. Carga tu propia hoja de tarifas para cotizar de verdad.', '— اعداد نمایشی، نه نرخ بازار. برای قیمت‌دهی واقعی جدول نرخ خودتان را بارگذاری کنید.'],
  yourSheet: ['YOUR RATE SHEET', 'TU HOJA DE TARIFAS', 'جدول نرخ شما'],
  rows: ['rows', 'filas', 'ردیف'],
  loadSheet: ['Load rate sheet (CSV)', 'Cargar hoja de tarifas (CSV)', 'بارگذاری جدول نرخ (CSV)'],
  dlTemplate: ['Download rate sheet template', 'Descargar plantilla de tarifas', 'دانلود قالب جدول نرخ'],
  useSample: ['Use sample rates', 'Usar tarifas de ejemplo', 'استفاده از نرخ‌های نمونه'],
  hideFormat: ['Hide format', 'Ocultar formato', 'پنهان کردن قالب'],
  csvFormat: ['CSV format', 'Formato CSV', 'قالب CSV'],
  couldNotLoad: ['Could not load this file — ', 'No se pudo cargar el archivo — ', 'این فایل بارگذاری نشد — '],
  rowsSkipped: ['row(s) skipped — ', 'fila(s) omitidas — ', 'ردیف نادیده گرفته شد — '],
  line: ['line', 'línea', 'خط'],
  fmtIntro: ['One row per charge. Columns (header row required, comma or semicolon separated):', 'Una fila por cargo. Columnas (fila de cabecera obligatoria, separadas por coma o punto y coma):', 'هر هزینه یک ردیف. ستون‌ها (ردیف عنوان الزامی، جداشده با ویرگول یا نقطه‌ویرگول):'],
  fmt1: ['mode: fcl · lcl · air · road — side: origin · freight · destination · customs', 'mode: fcl · lcl · air · road — side: origin · freight · destination · customs', 'mode: fcl · lcl · air · road — side: origin · freight · destination · customs'],
  fmt2: ['basis: per_container · per_kg (air = chargeable kg) · per_wm (LCL) · per_truck · per_shipment', 'basis: per_container · per_kg (aéreo = kg tasables) · per_wm (LCL) · per_truck · per_shipment', 'basis: per_container · per_kg (هوایی = کیلوی قابل محاسبه) · per_wm (LCL) · per_truck · per_shipment'],
  fmt3: ['origin / destination: port or city name; * = any (for local charges). equipment: 20GP, 40GP, 40HC, FTL or *', 'origin / destination: nombre de puerto o ciudad; * = cualquiera (para cargos locales). equipment: 20GP, 40GP, 40HC, FTL o *', 'origin / destination: نام بندر یا شهر؛ * = هر کدام (برای هزینه‌های محلی). equipment: 20GP، 40GP، 40HC، FTL یا *'],
  fmt4: ['valid_until: YYYY-MM-DD (or DD/MM/YYYY) — past dates are flagged STALE. Amounts are taken as-is (no FX conversion).', 'valid_until: AAAA-MM-DD (o DD/MM/AAAA) — las fechas pasadas se marcan como CADUCADAS. Los importes se toman tal cual (sin conversión de divisa).', 'valid_until: YYYY-MM-DD (یا DD/MM/YYYY) — تاریخ‌های گذشته «منقضی» علامت می‌خورند. مبالغ همان‌طور که هست استفاده می‌شوند (بدون تبدیل ارز).'],
  fmt5: ['carrier: each distinct carrier with freight rows on a lane becomes a quote option. Optional per line: routing (Direct, via Port Klang…), free_days (10/14/21), sails (Mon…Sun or daily).', 'carrier: cada naviera con filas de flete en una ruta se convierte en una opción. Opcional por línea: routing (Directo, vía Port Klang…), free_days (10/14/21), sails (lun…dom o diario).', 'carrier: هر حمل‌کننده‌ای که در یک مسیر ردیف کرایه دارد یک گزینه قیمت می‌شود. اختیاری برای هر ردیف: routing (مستقیم، از طریق Port Klang…)، free_days (۱۰/۱۴/۲۱)، sails (روزهای حرکت یا روزانه).'],
  emptyH: ['Paste a request or pick a sample.', 'Pega una solicitud o elige un ejemplo.', 'یک درخواست بچسبانید یا نمونه‌ای انتخاب کنید.'],
  emptyP: ["ForwardDesk reads the request, flags what's missing or ambiguous, prices it from the rate sheet, and writes the customer quote.", 'ForwardDesk lee la solicitud, marca lo que falta o es ambiguo, la cotiza con la hoja de tarifas y redacta la cotización para el cliente.', 'ForwardDesk درخواست را می‌خواند، موارد ناقص یا مبهم را مشخص می‌کند، از جدول نرخ قیمت می‌دهد و متن قیمت مشتری را می‌نویسد.'],
  needH: ['Need a mode, origin and destination to price.', 'Hacen falta modo, origen y destino para cotizar.', 'برای قیمت‌دهی حالت حمل، مبدأ و مقصد لازم است.'],
  fixLeft: ['Fix the flagged fields on the left.', 'Corrige los campos marcados a la izquierda.', 'فیلدهای علامت‌خورده را اصلاح کنید.'],
  noEquip: ['no equipment', 'sin equipo', 'بدون تجهیزات'],
  addRow: ['Add a freight row for this lane to the CSV, or change the lane on the left.', 'Añade una fila de flete para esta ruta al CSV, o cambia la ruta a la izquierda.', 'یک ردیف کرایه برای این مسیر به CSV اضافه کنید یا مسیر را تغییر دهید.'],
  recheckH: ['RATE TO RE-CHECK', 'TARIFA A REVISAR', 'نرخ نیازمند بازبینی'],
  expired: ['expired', 'caducó el', 'منقضی شده'],
  recheckP: ['Re-check with the carrier before sending.', 'Revísala con la naviera antes de enviar.', 'پیش از ارسال با حمل‌کننده بررسی کنید.'],
  quoteH: ['Quote', 'Cotización', 'قیمت'],
  laneProfile: ['lane profile', 'perfil de ruta', 'پروفایل مسیر'],
  target: ['target', 'objetivo', 'هدف'],
  thisOption: ['this option', 'esta opción', 'این گزینه'],
  setByHand: ['set by hand', 'fijado a mano', 'دستی تعیین شد'],
  auto: ['auto:', 'auto:', 'خودکار:'],
  homePort: ['client home port', 'puerto base del cliente', 'بندر اصلی مشتری'],
  noLeg: ['no leg at', 'sin tramo en', 'بدون مسیر در'],
  pickOne: ['pick one', 'elige uno', 'یکی را انتخاب کنید'],
  agentDest: ['Agent at destination', 'Agente en destino', 'نماینده در مقصد'],
  screened: [' · screened, see Agents', ' · revisado, ver Agentes', ' · غربال‌شده، به نمایندگان مراجعه کنید'],
  rateLogged: [' · ✓ rate request logged', ' · ✓ solicitud de tarifa registrada', ' · ✓ درخواست نرخ ثبت شد'],
  logRate: ['log rate request', 'registrar solicitud de tarifa', 'ثبت درخواست نرخ'],
  noneOnFile: [' — none on file for this port (add in Agents or client setup)', ' — ninguno registrado para este puerto (añádelo en Agentes o en la ficha del cliente)', ' — برای این بندر موردی ثبت نشده (در نمایندگان یا تنظیمات مشتری اضافه کنید)'],
  askOther: ['Ask another CRM agent (logs a rate request)…', 'Pedir a otro agente del CRM (registra la solicitud)…', 'درخواست از نماینده دیگر CRM (ثبت درخواست نرخ)…'],
  agentNote: ["Agent buy rates are not in the sample rate sheet: option prices above are line-based; request the agent's rate and add the margin. Blacklisted and archived CRM agents are not offered.", 'Las tarifas de compra de agentes no están en la hoja de ejemplo: los precios de arriba son de naviera; pide la tarifa al agente y añade el margen. Los agentes en lista negra o archivados no se ofrecen.', 'نرخ خرید نمایندگان در جدول نمونه نیست: قیمت گزینه‌های بالا بر اساس خط کشتیرانی است؛ نرخ نماینده را بگیرید و حاشیه را اضافه کنید. نمایندگان لیست سیاه یا بایگانی‌شده پیشنهاد نمی‌شوند.'],
  agentOf: ['Agent of', 'Agente de', 'نماینده'],
  at: ['at', 'en', 'در'],
  thCharge: ['Charge', 'Cargo', 'هزینه'],
  thQty: ['Qty', 'Cant.', 'تعداد'],
  thBuy: ['Buy', 'Compra', 'خرید'],
  thSell: ['Sell', 'Venta', 'فروش'],
  thValid: ['Valid until', 'Válido hasta', 'اعتبار تا'],
  stale: ['STALE', 'CADUCADA', 'منقضی'],
  notInScope: ['Not in scope for', 'Fuera de alcance con', 'خارج از محدوده برای'],
  fobAssumed: ['FOB (assumed)', 'FOB (supuesto)', 'FOB (فرض شده)'],
  marginTarget: ['Margin target', 'Margen objetivo', 'حاشیه هدف'],
  tBuy: ['BUY', 'COMPRA', 'خرید'],
  tMargin: ['MARGIN', 'MARGEN', 'حاشیه'],
  tTransit: ['TRANSIT', 'TRÁNSITO', 'ترانزیت'],
  tValid: ['VALID TO', 'VÁLIDO HASTA', 'اعتبار تا'],
  d: ['d', 'd', 'روز'],
  validTitle: ['Earliest rate validity, capped at 14 days', 'Validez más próxima de las tarifas, máximo 14 días', 'زودترین اعتبار نرخ، حداکثر ۱۴ روز'],
  mixed: ['Mixed currencies in rate sheet', 'Monedas mezcladas en la hoja de tarifas', 'ارزهای مختلف در جدول نرخ'],
  notConverted: ['totals are not converted.', 'los totales no se convierten.', 'جمع‌ها تبدیل نمی‌شوند.'],
  compareEx: ['Compare ex', 'Comparar desde', 'مقایسه از'],
  ratesCurrent: [' · rates current', ' · tarifas vigentes', ' · نرخ‌ها معتبر'],
  custQuote: ['Customer quote', 'Cotización para el cliente', 'متن قیمت برای مشتری'],
  quoteLangHint: ['language of the text sent', 'idioma del texto que se envía', 'زبان متن ارسالی'],
  copyQuote: ['Copy quote', 'Copiar cotización', 'کپی متن قیمت'],
  pdfBusy: ['Building PDF…', 'Generando PDF…', 'در حال ساخت PDF…'],
  pdfDone: ['PDF downloaded ✓', 'PDF descargado ✓', 'PDF دانلود شد ✓'],
  pdfErr: ['PDF failed — retry', 'Error en el PDF — reintentar', 'خطا در PDF — دوباره امتحان کنید'],
  pdfGen: ['Generate PDF', 'Generar PDF', 'ساخت PDF'],
  options: ['options', 'opciones', 'گزینه'],
  pdfFa: ['PDF is generated in English when FA is selected.', 'Con FA seleccionado, el PDF se genera en inglés.', 'وقتی فارسی انتخاب شده، PDF به انگلیسی ساخته می‌شود.'],
  internalTitle: ['Adds buy and margin columns. Never send this version to the customer.', 'Añade columnas de compra y margen. Nunca envíes esta versión al cliente.', 'ستون‌های خرید و حاشیه را اضافه می‌کند. این نسخه را هرگز برای مشتری نفرستید.'],
  internal: ['Internal (with buy/margin)', 'Interno (con compra/margen)', 'داخلی (با خرید/حاشیه)'],
  targetTitle: ["The client's target rate is internal by default. Tick to show it on the customer PDF and copied quote.", 'El precio objetivo del cliente es interno por defecto. Márcalo para mostrarlo en el PDF y en la cotización copiada.', 'نرخ هدف مشتری به‌طور پیش‌فرض داخلی است. برای نمایش در PDF و متن کپی‌شده تیک بزنید.'],
  showTarget: ['Show target on customer copy', 'Mostrar objetivo en la copia del cliente', 'نمایش هدف در نسخه مشتری'],
  humanSends: ['Human sends it. Nothing is booked or emailed from here.', 'La envía una persona. Desde aquí no se reserva ni se envía nada.', 'ارسال با شماست. از اینجا هیچ رزرو یا ایمیلی انجام نمی‌شود.'],
  logged: ['Logged', 'Registrada', 'ثبت شد'],
  noClient: ['without a client (pick one to attribute it)', 'sin cliente (elige uno para asignarla)', 'بدون مشتری (برای انتساب یکی را انتخاب کنید)'],
  toDash: ['on the dashboard of', 'en el panel de', 'در داشبورد'],
  open: ['open', 'abrir', 'باز کردن'],
  savedLocal: ['saved in this browser only', 'guardada solo en este navegador', 'فقط در همین مرورگر ذخیره شد'],
  savedLive: ['saved to your account', 'guardada en tu cuenta', 'در حساب شما ذخیره شد'],
  export: ['Export', 'Exportación', 'صادرات'],
  import: ['Import', 'Importación', 'واردات'],
  stPreferred: ['Preferred', 'Preferente', 'ترجیحی'],
  stActive: ['Active', 'Activo', 'فعال'],
  stProspect: ['Prospect', 'Potencial', 'بالقوه'],
  stOnHold: ['On hold', 'En pausa', 'متوقف'],
  modeFcl: ['Ocean FCL', 'Marítimo FCL', 'دریایی FCL'],
  modeLcl: ['Ocean LCL', 'Marítimo LCL', 'دریایی LCL'],
  modeAir: ['Air', 'Aéreo', 'هوایی'],
  modeRoad: ['Road', 'Carretera', 'جاده‌ای'],
  sideOrigin: ['Origin', 'Origen', 'مبدأ'],
  sideFreight: ['Main freight', 'Flete principal', 'کرایه اصلی'],
  sideDest: ['Destination', 'Destino', 'مقصد'],
  sideCustoms: ['Customs', 'Aduanas', 'گمرک'],
  bCntr: ['cntr', 'cntr', 'کانتینر'],
  bKg: ['kg', 'kg', 'کیلو'],
  bWm: ['W/M', 'W/M', 'W/M'],
  bTruck: ['truck', 'camión', 'کامیون'],
  bShpt: ['shpt', 'envío', 'محموله'],
} as const;

export type UKey = keyof typeof T;
const IX: Record<UiLang, 0 | 1 | 2> = { en: 0, es: 1, fa: 2 };
export const qu = (lang: UiLang, k: UKey): string => T[k][IX[lang] ?? 0];

export const modeLabel = (lang: UiLang, m: string) => qu(lang, ({ fcl: 'modeFcl', lcl: 'modeLcl', air: 'modeAir', road: 'modeRoad' } as Record<string, UKey>)[m] ?? 'modeFcl');
export const sideLabel = (lang: UiLang, s: string) => qu(lang, ({ origin: 'sideOrigin', freight: 'sideFreight', destination: 'sideDest', customs: 'sideCustoms' } as Record<string, UKey>)[s] ?? 'sideOrigin');
export const basisLabel = (lang: UiLang, b: string) => {
  const k = ({ per_container: 'bCntr', per_kg: 'bKg', per_wm: 'bWm', per_truck: 'bTruck', per_shipment: 'bShpt' } as Record<string, UKey>)[b];
  return k ? qu(lang, k) : b;
};
export const agentStLabel = (lang: UiLang, s: string) => {
  const k = ({ preferred: 'stPreferred', active: 'stActive', prospect: 'stProspect', on_hold: 'stOnHold' } as Record<string, UKey>)[s];
  return k ? qu(lang, k) : s;
};

// Parser issue messages are written in English; translate them for the screen.
const FIXED: Record<string, [string, string]> = {
  'Mode not clear (sea / air / road).': ['Modo no claro (mar / aéreo / carretera).', 'حالت حمل مشخص نیست (دریایی / هوایی / جاده‌ای).'],
  'Origin not found.': ['Origen no encontrado.', 'مبدأ پیدا نشد.'],
  'Destination not found.': ['Destino no encontrado.', 'مقصد پیدا نشد.'],
  'Container count / type missing.': ['Falta número / tipo de contenedor.', 'تعداد / نوع کانتینر مشخص نیست.'],
  'Gross weight per container not given — priced anyway; needed for VGM / overweight check.': ['Sin peso bruto por contenedor — cotizado igualmente; hace falta para el VGM / control de sobrepeso.', 'وزن ناخالص هر کانتینر داده نشده — قیمت داده شد؛ برای VGM / کنترل اضافه‌وزن لازم است.'],
  'Gross weight not given.': ['Sin peso bruto.', 'وزن ناخالص داده نشده.'],
  'Volume / dimensions missing — chargeable weight can’t be checked.': ['Faltan volumen / medidas — no se puede comprobar el peso tasable.', 'حجم / ابعاد داده نشده — وزن قابل محاسبه قابل بررسی نیست.'],
  'Trailer type not stated.': ['Tipo de tráiler no indicado.', 'نوع تریلر مشخص نشده.'],
  'Incoterm not given — priced as FOB.': ['Sin Incoterm — cotizado como FOB.', 'اینکوترم داده نشده — به‌صورت FOB قیمت داده شد.'],
  'Cargo ready date not given.': ['Sin fecha de mercancía lista.', 'تاریخ آمادگی بار داده نشده.'],
  'Commodity not described.': ['Mercancía no descrita.', 'کالا توضیح داده نشده.'],
  'DG status unknown.': ['No se sabe si es mercancía peligrosa (DG).', 'وضعیت کالای خطرناک (DG) نامشخص است.'],
  'Dangerous goods — DG surcharges and carrier acceptance not in sample rates.': ['Mercancía peligrosa — los recargos DG y la aceptación de la naviera no están en las tarifas de ejemplo.', 'کالای خطرناک — هزینه‌های DG و پذیرش حمل‌کننده در نرخ‌های نمونه نیست.'],
  'Container type not stated — priced as standard (GP).': ['Tipo de contenedor no indicado — cotizado como estándar (GP).', 'نوع کانتینر مشخص نشده — به‌صورت استاندارد (GP) قیمت داده شد.'],
};
const PAT: [RegExp, string, string][] = [
  [/^Mode not stated — assumed AIR \(urgent, (.+) kg\)\.$/, 'Modo no indicado — se asume AÉREO (urgente, $1 kg).', 'حالت حمل ذکر نشده — هوایی فرض شد (فوری، $1 کیلو).'],
  [/^"(.+)" read as (.+) for (.+)\.$/, '«$1» leído como $2 para $3.', '«$1» به‌عنوان $2 برای $3 خوانده شد.'],
  [/^"(.+)" — assumed Monday (.+)\.$/, '«$1» — se asume el lunes $2.', '«$1» — دوشنبه $2 فرض شد.'],
  [/^(.+) has (\d+) container ports — (.+)\. Different trucking, tolls and terminal fees\.$/, '$1 tiene $2 puertos de contenedores — $3. Cambian el transporte, los peajes y las tasas de terminal.', '$1 دارای $2 بندر کانتینری است — $3. حمل زمینی، عوارض و هزینه ترمینال متفاوت است.'],
  [/^(.+): choose port \((.+)\)\.$/, '$1: elige puerto ($2).', '$1: بندر را انتخاب کنید ($2).'],
  [/^No Incoterm in the request — using (.+)'s default (.+) \(client setup\)\.$/, 'Sin Incoterm en la solicitud — se usa el de $1 por defecto, $2 (ficha del cliente).', 'اینکوترم در درخواست نیست — پیش‌فرض $1 یعنی $2 استفاده شد (تنظیمات مشتری).'],
  [/^MSDS required \((.+) — sample rule, confirm with line\) and not attached yet\.$/, 'MSDS obligatoria ($1 — regla de ejemplo, confirmar con la naviera) y aún no adjunta.', 'MSDS الزامی است ($1 — قاعده نمونه، با خط کشتیرانی تأیید شود) و هنوز پیوست نشده.'],
];
export function issueText(lang: UiLang, msg: string): string {
  if (lang === 'en') return msg;
  const j = lang === 'es' ? 0 : 1;
  let tail = '';
  const m = msg.match(/^(.*) MSDS received \((.+)\)\.$/);
  if (m) {
    msg = m[1];
    tail = j === 0 ? ` MSDS recibida (${m[2]}).` : ` MSDS دریافت شد (${m[2]}).`;
  }
  if (FIXED[msg]) return FIXED[msg][j] + tail;
  for (const [re, es, fa] of PAT) if (re.test(msg)) return msg.replace(re, j === 0 ? es : fa).replace(/ or /g, j === 0 ? ' o ' : ' یا ') + tail;
  return msg + tail;
}

/** Agent tags are built in English ("Client preferred", "Agent CRM · Active · sample"); localise for display. */
export function agentTag(lang: UiLang, tag: string): string {
  if (lang === 'en') return tag;
  const es = lang === 'es';
  return tag
    .replace('Client preferred', es ? 'Preferido del cliente' : 'ترجیح مشتری')
    .replace('Client allowed', es ? 'Permitido por el cliente' : 'مجاز از نظر مشتری')
    .replace('Agent CRM', es ? 'CRM de agentes' : 'CRM نمایندگان')
    .replace(/· (Preferred|Active|Prospect|On hold)/, (_m, s: string) => `· ${agentStLabel(lang, s === 'On hold' ? 'on_hold' : s.toLowerCase())}`)
    .replace(' · sample', es ? ' · ejemplo' : ' · نمونه')
    .replace(' · public info, verify', es ? ' · info pública, verificar' : ' · اطلاعات عمومی، بررسی شود');
}

/** Scope line under the quote title (rates.ts writes it in English). */
export function scopeText(lang: UiLang, incoterm: string | null, note: string): string {
  if (lang === 'en') return note;
  const es = lang === 'es';
  switch (incoterm) {
    case 'EXW': return es ? 'EXW: recogida, gastos en origen, flete principal, gastos en destino y despacho de importación.' : 'EXW: جمع‌آوری بار، هزینه‌های مبدأ، کرایه اصلی، هزینه‌های مقصد و ترخیص واردات.';
    case 'FCA': case 'FAS': case 'FOB': return es ? `${incoterm}: el vendedor paga los gastos en origen; la cotización cubre flete principal, gastos en destino y despacho de importación.` : `${incoterm}: فروشنده هزینه‌های مبدأ را می‌پردازد؛ قیمت شامل کرایه اصلی، هزینه‌های مقصد و ترخیص واردات است.`;
    case 'CFR': case 'CIF': case 'CPT': case 'CIP': return es ? `${incoterm}: el vendedor paga el flete; la cotización cubre solo gastos en destino y despacho de importación.` : `${incoterm}: فروشنده کرایه را می‌پردازد؛ قیمت فقط شامل هزینه‌های مقصد و ترخیص واردات است.`;
    case 'DAP': case 'DPU': return es ? `${incoterm}: el vendedor paga hasta destino; el despacho de importación y los aranceles son del destinatario.` : `${incoterm}: فروشنده تا مقصد می‌پردازد؛ ترخیص واردات و حقوق گمرکی با گیرنده است.`;
    case 'DDP': return es ? 'DDP: todos los gastos incl. despacho de importación — aranceles e impuestos NO incluidos en esta cotización.' : 'DDP: همه هزینه‌ها از جمله ترخیص واردات — حقوق و عوارض گمرکی در این قیمت لحاظ نشده است.';
    default: return es ? 'Sin Incoterm — cotizado como FOB (flete + destino). Confirmar con el cliente.' : 'اینکوترم داده نشده — به‌صورت FOB (کرایه + مقصد) قیمت داده شد. با مشتری تأیید شود.';
  }
}
export const unitsText = (lang: UiLang, units: string) => (lang === 'en' ? units : units.replace(' kg chargeable', lang === 'es' ? ' kg tasables' : ' کیلو قابل محاسبه'));

/** "Customer A's preferred lines shown first…" note over the options. */
export function linesText(lang: UiLang, k: 'pref' | 'showing' | 'hidden' | 'hide' | 'show', name: string, n: number, list = ''): string {
  const pl = n > 1;
  if (lang === 'es') return { pref: `Primero ${pl ? 'las navieras preferidas' : 'la naviera preferida'} de ${name}. `, showing: `Mostrando ${n} naviera${pl ? 's' : ''} que ${name} evita. `, hidden: `${n} opci${pl ? 'ones' : 'ón'} de navieras que ${name} evita, ocultas (${list}). `, hide: 'ocultar', show: 'mostrar' }[k];
  if (lang === 'fa') return { pref: `خطوط ترجیحی ${name} اول نمایش داده می‌شوند. `, showing: `نمایش ${n} خط که ${name} از آن پرهیز می‌کند. `, hidden: `${n} گزینه از خطوطی که ${name} از آن پرهیز می‌کند پنهان است (${list}). `, hide: 'پنهان کردن', show: 'نمایش' }[k];
  return { pref: `${name}'s preferred line${pl ? 's' : ''} shown first. `, showing: `Showing ${n} line${pl ? 's' : ''} ${name} avoids. `, hidden: `${n} option${pl ? 's' : ''} from line${pl ? 's' : ''} ${name} avoids hidden (${list}). `, hide: 'hide', show: 'show' }[k];
}
