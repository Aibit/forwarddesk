// Quote screen chrome in the UI language (EN / ES / FA). The customer quote text keeps its own language switch.
import type { UiLang } from '../ui/lang';

const T = {
  pasteH: ['Paste a customer request (email / WhatsApp)', 'Pega la solicitud del cliente (email / WhatsApp)', 'درخواست مشتری را بچسبانید (ایمیل / واتس‌اپ)', 'الصق طلب العميل (بريد إلكتروني / واتساب)'],
  timerTitle: ['From paste to copied quote', 'Desde pegar hasta copiar la cotización', 'از چسباندن تا کپی قیمت', 'من اللصق إلى نسخ العرض'],
  readyIn: ['QUOTE READY IN ', 'COTIZACIÓN LISTA EN ', 'قیمت آماده در ', 'العرض جاهز خلال '],
  timeTo: ['TIME TO QUOTE ', 'TIEMPO DE COTIZACIÓN ', 'زمان قیمت‌دهی ', 'وقت التسعير '],
  client: ['Client', 'Cliente', 'مشتری', 'عميل'],
  none: ['— none —', '— ninguno —', '— هیچ —', '— لا شيء —'],
  sample: [' (sample)', ' (ejemplo)', ' (نمونه)', ' (عيّنة)'],
  anyLine: ['any line', 'cualquier naviera', 'هر خط کشتیرانی', 'أي خط'],
  ask: ['ask', 'pedir', 'درخواست', 'طلب'],
  dFree: ['d free', 'días libres', 'روز آزاد', 'يوم مجاني'],
  dashboard: ['dashboard →', 'panel →', 'داشبورد ←', 'اللوحة ←'],
  pickClient: ['pick one to apply their margin, Incoterm, language and lines', 'elige uno para aplicar su margen, Incoterm, idioma y navieras', 'یکی را انتخاب کنید تا حاشیه، اینکوترم، زبان و خطوط او اعمال شود', 'اختر واحدًا لتطبيق هامشه وIncoterm ولغته وخطوطه'],
  lanes: ['Lanes', 'Rutas', 'مسیرها', 'المسارات'],
  placeholder: ['e.g. hi need price 2x40HC Shanghai to Barcelona, ready 20 Nov, FOB…', 'p. ej. hola, precio 2x40HC Shanghai a Barcelona, listo 20 nov, FOB…', 'مثلاً: سلام، قیمت 2x40HC از Shanghai به Barcelona، آماده ۲۰ نوامبر، FOB…', 'مثال: مرحبًا، أحتاج سعر 2x40HC من Shanghai إلى Barcelona، جاهزة ٢٠ نوفمبر، FOB…'],
  trySample: ['Try a sample:', 'Prueba un ejemplo:', 'یک نمونه را امتحان کنید:', 'جرّب عيّنة:'],
  clear: ['Clear', 'Borrar', 'پاک کردن', 'مسح'],
  priced: ['PRICED', 'CON PRECIO', 'قیمت‌گذاری شد', 'تم التسعير'],
  sellU: ['SELL', 'VENTA', 'فروش', 'بيع'],
  margin: ['margin', 'margen', 'حاشیه', 'الهامش'],
  optionsFrom: ['options from', 'opciones desde', 'گزینه، از', 'خيارات، ابتداءً من'],
  allPresent: ['all details present — ready to send', 'todos los datos presentes — lista para enviar', 'همه جزئیات موجود است — آماده ارسال', 'جميع التفاصيل متوفرة — جاهز للإرسال'],
  toConfirmCust: ['to confirm with customer', 'por confirmar con el cliente', 'مورد برای تأیید با مشتری', 'للتأكيد مع العميل'],
  missing: ['missing', 'faltan', 'ناقص', 'ناقص'],
  toConfirm: ['to confirm', 'por confirmar', 'برای تأیید', 'للتأكيد'],
  assumed: ['assumed', 'supuestos', 'فرض‌شده', 'مفترض'],
  viewQuote: ['View quote →', 'Ver cotización →', 'مشاهده قیمت ←', 'عرض العرض ←'],
  notPriced: ['NOT PRICED', 'SIN PRECIO', 'قیمت‌گذاری نشده', 'غير مُسعَّر'],
  needsMode: ['Needs mode, origin and destination.', 'Faltan modo, origen y destino.', 'حالت حمل، مبدأ و مقصد لازم است.', 'يلزم وسيلة النقل والمنشأ والوجهة.'],
  noRateFor: ['No freight rate for', 'No hay tarifa de flete para', 'نرخ کرایه‌ای وجود ندارد برای', 'لا يوجد سعر شحن لـ'],
  inSheet: ['in this rate sheet.', 'en esta hoja de tarifas.', 'در این جدول نرخ.', 'في جدول الأسعار هذا.'],
  whatRead: ['What it read', 'Lo que ha leído', 'آنچه خوانده شد', 'ما تمت قراءته'],
  clickFix: ['click any field to fix it', 'pulsa un campo para corregirlo', 'برای اصلاح روی هر فیلد کلیک کنید', 'انقر أي حقل لتصحيحه'],
  fMode: ['Mode', 'Modo', 'حالت حمل', 'وسيلة النقل'],
  fOrigin: ['Origin', 'Origen', 'مبدأ', 'المنشأ'],
  fDest: ['Destination', 'Destino', 'مقصد', 'الوجهة'],
  fEquip: ['Equipment', 'Equipo', 'تجهیزات', 'المعدّات'],
  fWeight: ['Weight', 'Peso', 'وزن', 'الوزن'],
  fVolume: ['Volume', 'Volumen', 'حجم', 'الحجم'],
  fCharge: ['Chargeable', 'Tasable', 'وزن قابل محاسبه', 'الوزن المحتسب'],
  fPieces: ['Pieces', 'Bultos', 'تعداد بسته', 'عدد الطرود'],
  fInco: ['Incoterm', 'Incoterm', 'اینکوترم', 'Incoterm'],
  fReady: ['Ready', 'Lista', 'آمادگی', 'جاهز'],
  fCargo: ['Cargo', 'Mercancía', 'کالا', 'البضاعة'],
  fDg: ['DG', 'Peligrosa (DG)', 'کالای خطرناک (DG)', 'بضائع خطرة (DG)'],
  perCntr: [' / cntr', ' / cntr', ' / کانتینر', ' / حاوية'],
  perTruck: [' / truck', ' / camión', ' / کامیون', ' / شاحنة'],
  yesDg: ['Yes — DG', 'Sí — DG', 'بله — DG', 'نعم — DG'],
  no: ['No', 'No', 'خیر', 'لا'],
  unknown: ['Unknown', 'Desconocido', 'نامشخص', 'غير معروف'],
  hsGuessed: [' (guessed from commodity)', ' (deducido de la mercancía)', ' (از روی کالا حدس زده شد)', ' (مُستنتج من السلعة)'],
  hsLane: [' (lane profile)', ' (perfil de ruta)', ' (پروفایل مسیر)', ' (ملف المسار)'],
  noHs: [' · no HS code', ' · sin código HS', ' · بدون کد HS', ' · بلا رمز HS'],
  savedOn: ['saved on the lane profile of', 'guardada en el perfil de ruta de', 'ذخیره‌شده در پروفایل مسیر', 'محفوظ في ملف المسار لـ'],
  askH: ['What to ask the customer', 'Qué preguntar al cliente', 'چه چیزی از مشتری بپرسیم', 'ماذا نسأل العميل'],
  tagMissing: ['MISSING', 'FALTA', 'ناقص', 'ناقص'],
  tagAssumed: ['ASSUMED', 'SUPUESTO', 'فرض شده', 'مفترض'],
  tagConfirm: ['TO CONFIRM', 'POR CONFIRMAR', 'برای تأیید', 'للتأكيد'],
  copied: ['Copied ✓', 'Copiado ✓', 'کپی شد ✓', 'تم النسخ ✓'],
  copyQ: ['Copy questions for customer', 'Copiar preguntas para el cliente', 'کپی سؤال‌ها برای مشتری', 'نسخ الأسئلة للعميل'],
  sampleRates: ['SAMPLE RATES', 'TARIFAS DE EJEMPLO', 'نرخ‌های نمونه', 'أسعار عيّنة'],
  sampleRatesNote: ['— illustrative numbers, not market rates. Load your own rate sheet to quote for real.', '— cifras ilustrativas, no son tarifas de mercado. Carga tu propia hoja de tarifas para cotizar de verdad.', '— اعداد نمایشی، نه نرخ بازار. برای قیمت‌دهی واقعی جدول نرخ خودتان را بارگذاری کنید.', '— أرقام توضيحية، ليست أسعار السوق. حمّل جدول أسعارك للتسعير الفعلي.'],
  yourSheet: ['YOUR RATE SHEET', 'TU HOJA DE TARIFAS', 'جدول نرخ شما', 'جدول أسعارك'],
  rows: ['rows', 'filas', 'ردیف', 'صفوف'],
  loadSheet: ['Load rate sheet (CSV)', 'Cargar hoja de tarifas (CSV)', 'بارگذاری جدول نرخ (CSV)', 'تحميل جدول الأسعار (CSV)'],
  dlTemplate: ['Download rate sheet template', 'Descargar plantilla de tarifas', 'دانلود قالب جدول نرخ', 'تنزيل قالب جدول الأسعار'],
  useSample: ['Use sample rates', 'Usar tarifas de ejemplo', 'استفاده از نرخ‌های نمونه', 'استخدام أسعار العيّنة'],
  hideFormat: ['Hide format', 'Ocultar formato', 'پنهان کردن قالب', 'إخفاء الصيغة'],
  csvFormat: ['CSV format', 'Formato CSV', 'قالب CSV', 'صيغة CSV'],
  couldNotLoad: ['Could not load this file — ', 'No se pudo cargar el archivo — ', 'این فایل بارگذاری نشد — ', 'تعذّر تحميل هذا الملف — '],
  rowsSkipped: ['row(s) skipped — ', 'fila(s) omitidas — ', 'ردیف نادیده گرفته شد — ', 'صف(وف) تم تخطيها — '],
  line: ['line', 'línea', 'خط', 'السطر'],
  fmtIntro: ['One row per charge. Columns (header row required, comma or semicolon separated):', 'Una fila por cargo. Columnas (fila de cabecera obligatoria, separadas por coma o punto y coma):', 'هر هزینه یک ردیف. ستون‌ها (ردیف عنوان الزامی، جداشده با ویرگول یا نقطه‌ویرگول):', 'صف واحد لكل رسم. الأعمدة (صف العناوين مطلوب، مفصولة بفاصلة أو فاصلة منقوطة):'],
  fmt1: ['mode: fcl · lcl · air · road — side: origin · freight · destination · customs', 'mode: fcl · lcl · air · road — side: origin · freight · destination · customs', 'mode: fcl · lcl · air · road — side: origin · freight · destination · customs', 'mode: fcl · lcl · air · road — side: origin · freight · destination · customs'],
  fmt2: ['basis: per_container · per_kg (air = chargeable kg) · per_wm (LCL) · per_truck · per_shipment', 'basis: per_container · per_kg (aéreo = kg tasables) · per_wm (LCL) · per_truck · per_shipment', 'basis: per_container · per_kg (هوایی = کیلوی قابل محاسبه) · per_wm (LCL) · per_truck · per_shipment', 'basis: per_container · per_kg (جوي = الكيلوغرامات المحتسبة) · per_wm (LCL) · per_truck · per_shipment'],
  fmt3: ['origin / destination: port or city name; * = any (for local charges). equipment: 20GP, 40GP, 40HC, FTL or *', 'origin / destination: nombre de puerto o ciudad; * = cualquiera (para cargos locales). equipment: 20GP, 40GP, 40HC, FTL o *', 'origin / destination: نام بندر یا شهر؛ * = هر کدام (برای هزینه‌های محلی). equipment: 20GP، 40GP، 40HC، FTL یا *', 'origin / destination: اسم الميناء أو المدينة؛ * = أي (للرسوم المحلية). equipment: 20GP أو 40GP أو 40HC أو FTL أو *'],
  fmt4: ['valid_until: YYYY-MM-DD (or DD/MM/YYYY) — past dates are flagged STALE. Amounts are taken as-is (no FX conversion).', 'valid_until: AAAA-MM-DD (o DD/MM/AAAA) — las fechas pasadas se marcan como CADUCADAS. Los importes se toman tal cual (sin conversión de divisa).', 'valid_until: YYYY-MM-DD (یا DD/MM/YYYY) — تاریخ‌های گذشته «منقضی» علامت می‌خورند. مبالغ همان‌طور که هست استفاده می‌شوند (بدون تبدیل ارز).', 'valid_until: YYYY-MM-DD (أو DD/MM/YYYY) — التواريخ الماضية تُعلَّم «منتهي». المبالغ تؤخذ كما هي (بلا تحويل عملات).'],
  fmt5: ['carrier: each distinct carrier with freight rows on a lane becomes a quote option. Optional per line: routing (Direct, via Port Klang…), free_days (10/14/21), sails (Mon…Sun or daily).', 'carrier: cada naviera con filas de flete en una ruta se convierte en una opción. Opcional por línea: routing (Directo, vía Port Klang…), free_days (10/14/21), sails (lun…dom o diario).', 'carrier: هر حمل‌کننده‌ای که در یک مسیر ردیف کرایه دارد یک گزینه قیمت می‌شود. اختیاری برای هر ردیف: routing (مستقیم، از طریق Port Klang…)، free_days (۱۰/۱۴/۲۱)، sails (روزهای حرکت یا روزانه).', 'carrier: كل ناقل مختلف لديه صفوف شحن على مسار يصبح خيار عرض. اختياري لكل سطر: routing (مباشر، عبر Port Klang…)، free_days (10/14/21)، sails (أيام الإبحار أو يوميًا).'],
  emptyH: ['Paste a request or pick a sample.', 'Pega una solicitud o elige un ejemplo.', 'یک درخواست بچسبانید یا نمونه‌ای انتخاب کنید.', 'الصق طلبًا أو اختر عيّنة.'],
  emptyP: ["ForwardDesk reads the request, flags what's missing or ambiguous, prices it from the rate sheet, and writes the customer quote.", 'ForwardDesk lee la solicitud, marca lo que falta o es ambiguo, la cotiza con la hoja de tarifas y redacta la cotización para el cliente.', 'ForwardDesk درخواست را می‌خواند، موارد ناقص یا مبهم را مشخص می‌کند، از جدول نرخ قیمت می‌دهد و متن قیمت مشتری را می‌نویسد.', 'يقرأ ForwardDesk الطلب، ويُعلّم الناقص أو الغامض، ويسعّره من جدول الأسعار، ويكتب عرض العميل.'],
  needH: ['Need a mode, origin and destination to price.', 'Hacen falta modo, origen y destino para cotizar.', 'برای قیمت‌دهی حالت حمل، مبدأ و مقصد لازم است.', 'يلزم وسيلة النقل والمنشأ والوجهة للتسعير.'],
  fixLeft: ['Fix the flagged fields on the left.', 'Corrige los campos marcados a la izquierda.', 'فیلدهای علامت‌خورده را اصلاح کنید.', 'صحّح الحقول المُعلَّمة.'],
  noEquip: ['no equipment', 'sin equipo', 'بدون تجهیزات', 'بلا معدّات'],
  addRow: ['Add a freight row for this lane to the CSV, or change the lane on the left.', 'Añade una fila de flete para esta ruta al CSV, o cambia la ruta a la izquierda.', 'یک ردیف کرایه برای این مسیر به CSV اضافه کنید یا مسیر را تغییر دهید.', 'أضف صف شحن لهذا المسار في ملف CSV، أو غيّر المسار.'],
  recheckH: ['RATE TO RE-CHECK', 'TARIFA A REVISAR', 'نرخ نیازمند بازبینی', 'سعر يحتاج إلى مراجعة'],
  expired: ['expired', 'caducó el', 'منقضی شده', 'انتهى في'],
  recheckP: ['Re-check with the carrier before sending.', 'Revísala con la naviera antes de enviar.', 'پیش از ارسال با حمل‌کننده بررسی کنید.', 'راجِع مع الناقل قبل الإرسال.'],
  quoteH: ['Quote', 'Cotización', 'قیمت', 'عرض سعر'],
  laneProfile: ['lane profile', 'perfil de ruta', 'پروفایل مسیر', 'ملف المسار'],
  target: ['target', 'objetivo', 'هدف', 'المستهدف'],
  thisOption: ['this option', 'esta opción', 'این گزینه', 'هذا الخيار'],
  setByHand: ['set by hand', 'fijado a mano', 'دستی تعیین شد', 'مُحدَّد يدويًا'],
  auto: ['auto:', 'auto:', 'خودکار:', 'تلقائي:'],
  homePort: ['client home port', 'puerto base del cliente', 'بندر اصلی مشتری', 'ميناء العميل الرئيسي'],
  noLeg: ['no leg at', 'sin tramo en', 'بدون مسیر در', 'بلا مسار في'],
  pickOne: ['pick one', 'elige uno', 'یکی را انتخاب کنید', 'اختر واحدًا'],
  crossTrade: ['cross-trade', 'cross-trade', 'حمل بین دو بندر خارجی', 'شحن بين ميناءين آخرين'],
  requested: ['requested', 'solicitado', 'درخواستی', 'مطلوب'],
  sampleEst: ['SAMPLE estimate', 'Estimación de EJEMPLO', 'برآورد نمونه', 'تقدير عيّنة'],
  sampleEstNote: ['Lines marked SAMPLE estimate are illustrative figures made by the demo, not real prices. Confirm with the line, insurer, customs broker or trucker before sending.', 'Las líneas marcadas como Estimación de EJEMPLO son cifras ilustrativas de la demo, no precios reales. Confírmalas con la naviera, la aseguradora, el agente de aduanas o el transportista antes de enviar.', 'ردیف‌های «برآورد نمونه» ارقام نمایشی دمو هستند، نه قیمت واقعی. پیش از ارسال با خط کشتیرانی، بیمه‌گر، ترخیص‌کار یا شرکت حمل تأیید کنید.', 'البنود المعلَّمة «تقدير عيّنة» أرقام توضيحية من العرض التجريبي وليست أسعارًا حقيقية. أكّدها مع الخط أو شركة التأمين أو المخلّص الجمركي أو الناقل قبل الإرسال.'],
  agentDest: ['Agent at destination', 'Agente en destino', 'نماینده در مقصد', 'الوكيل في الوجهة'],
  screened: [' · screened, see Agents', ' · revisado, ver Agentes', ' · غربال‌شده، به نمایندگان مراجعه کنید', ' · تم الفحص، انظر الوكلاء'],
  rateLogged: [' · ✓ rate request logged', ' · ✓ solicitud de tarifa registrada', ' · ✓ درخواست نرخ ثبت شد', ' · ✓ تم تسجيل طلب السعر'],
  logRate: ['log rate request', 'registrar solicitud de tarifa', 'ثبت درخواست نرخ', 'تسجيل طلب سعر'],
  noneOnFile: [' — none on file for this port (add in Agents or client setup)', ' — ninguno registrado para este puerto (añádelo en Agentes o en la ficha del cliente)', ' — برای این بندر موردی ثبت نشده (در نمایندگان یا تنظیمات مشتری اضافه کنید)', ' — لا يوجد مسجّل لهذا الميناء (أضِف في الوكلاء أو إعداد العميل)'],
  askOther: ['Ask another CRM agent (logs a rate request)…', 'Pedir a otro agente del CRM (registra la solicitud)…', 'درخواست از نماینده دیگر CRM (ثبت درخواست نرخ)…', 'اطلب من وكيل آخر في CRM (يُسجِّل طلب سعر)…'],
  agentNote: ["Agent buy rates are not in the sample rate sheet: option prices above are line-based; request the agent's rate and add the margin. Blacklisted and archived CRM agents are not offered.", 'Las tarifas de compra de agentes no están en la hoja de ejemplo: los precios de arriba son de naviera; pide la tarifa al agente y añade el margen. Los agentes en lista negra o archivados no se ofrecen.', 'نرخ خرید نمایندگان در جدول نمونه نیست: قیمت گزینه‌های بالا بر اساس خط کشتیرانی است؛ نرخ نماینده را بگیرید و حاشیه را اضافه کنید. نمایندگان لیست سیاه یا بایگانی‌شده پیشنهاد نمی‌شوند.', 'أسعار شراء الوكلاء ليست في جدول العيّنة: أسعار الخيارات أعلاه مبنية على الخطوط؛ اطلب سعر الوكيل وأضِف الهامش. لا يُعرض وكلاء CRM المدرجون في القائمة السوداء أو المؤرشفون.'],
  agentOf: ['Agent of', 'Agente de', 'نماینده', 'وكيل'],
  at: ['at', 'en', 'در', 'في'],
  thCharge: ['Charge', 'Cargo', 'هزینه', 'الرسم'],
  thQty: ['Qty', 'Cant.', 'تعداد', 'الكمية'],
  thBuy: ['Buy', 'Compra', 'خرید', 'شراء'],
  thSell: ['Sell', 'Venta', 'فروش', 'بيع'],
  thValid: ['Valid until', 'Válido hasta', 'اعتبار تا', 'صالح حتى'],
  stale: ['STALE', 'CADUCADA', 'منقضی', 'منتهي'],
  notInScope: ['Not in scope for', 'Fuera de alcance con', 'خارج از محدوده برای', 'خارج النطاق لـ'],
  fobAssumed: ['FOB (assumed)', 'FOB (supuesto)', 'FOB (فرض شده)', 'FOB (مفترض)'],
  marginTarget: ['Margin target', 'Margen objetivo', 'حاشیه هدف', 'الهامش المستهدف'],
  tBuy: ['BUY', 'COMPRA', 'خرید', 'شراء'],
  tMargin: ['MARGIN', 'MARGEN', 'حاشیه', 'الهامش'],
  tTransit: ['TRANSIT', 'TRÁNSITO', 'ترانزیت', 'العبور'],
  tValid: ['VALID TO', 'VÁLIDO HASTA', 'اعتبار تا', 'صالح حتى'],
  d: ['d', 'd', 'روز', 'يوم'],
  validTitle: ['Earliest rate validity, capped at 14 days', 'Validez más próxima de las tarifas, máximo 14 días', 'زودترین اعتبار نرخ، حداکثر ۱۴ روز', 'أقرب صلاحية للأسعار، بحد أقصى ١٤ يومًا'],
  mixed: ['Mixed currencies in rate sheet', 'Monedas mezcladas en la hoja de tarifas', 'ارزهای مختلف در جدول نرخ', 'عملات مختلطة في جدول الأسعار'],
  notConverted: ['totals are not converted.', 'los totales no se convierten.', 'جمع‌ها تبدیل نمی‌شوند.', 'الإجماليات غير محوّلة.'],
  compareEx: ['Compare ex', 'Comparar desde', 'مقایسه از', 'مقارنة من'],
  ratesCurrent: [' · rates current', ' · tarifas vigentes', ' · نرخ‌ها معتبر', ' · الأسعار سارية'],
  custQuote: ['Customer quote', 'Cotización para el cliente', 'متن قیمت برای مشتری', 'عرض العميل'],
  quoteLangHint: ['language of the text sent', 'idioma del texto que se envía', 'زبان متن ارسالی', 'لغة النص المُرسَل'],
  copyQuote: ['Copy quote', 'Copiar cotización', 'کپی متن قیمت', 'نسخ العرض'],
  pdfBusy: ['Building PDF…', 'Generando PDF…', 'در حال ساخت PDF…', 'جارٍ إنشاء PDF…'],
  pdfDone: ['PDF downloaded ✓', 'PDF descargado ✓', 'PDF دانلود شد ✓', 'تم تنزيل PDF ✓'],
  pdfErr: ['PDF failed — retry', 'Error en el PDF — reintentar', 'خطا در PDF — دوباره امتحان کنید', 'فشل PDF — أعِد المحاولة'],
  pdfGen: ['Generate PDF', 'Generar PDF', 'ساخت PDF', 'إنشاء PDF'],
  options: ['options', 'opciones', 'گزینه', 'خيارات'],
  pdfFa: ['PDF is generated in English when FA is selected.', 'Con FA seleccionado, el PDF se genera en inglés.', 'وقتی فارسی انتخاب شده، PDF به انگلیسی ساخته می‌شود.', 'عند اختيار الفارسية أو العربية يُنشأ ملف PDF بالإنجليزية.'],
  internalTitle: ['Adds buy and margin columns. Never send this version to the customer.', 'Añade columnas de compra y margen. Nunca envíes esta versión al cliente.', 'ستون‌های خرید و حاشیه را اضافه می‌کند. این نسخه را هرگز برای مشتری نفرستید.', 'يضيف أعمدة الشراء والهامش. لا ترسل هذه النسخة إلى العميل أبدًا.'],
  internal: ['Internal (with buy/margin)', 'Interno (con compra/margen)', 'داخلی (با خرید/حاشیه)', 'داخلي (مع الشراء/الهامش)'],
  targetTitle: ["The client's target rate is internal by default. Tick to show it on the customer PDF and copied quote.", 'El precio objetivo del cliente es interno por defecto. Márcalo para mostrarlo en el PDF y en la cotización copiada.', 'نرخ هدف مشتری به‌طور پیش‌فرض داخلی است. برای نمایش در PDF و متن کپی‌شده تیک بزنید.', 'السعر المستهدف للعميل داخلي افتراضيًا. حدّد لإظهاره في PDF العميل والعرض المنسوخ.'],
  showTarget: ['Show target on customer copy', 'Mostrar objetivo en la copia del cliente', 'نمایش هدف در نسخه مشتری', 'إظهار المستهدف في نسخة العميل'],
  humanSends: ['Human sends it. Nothing is booked or emailed from here.', 'La envía una persona. Desde aquí no se reserva ni se envía nada.', 'ارسال با شماست. از اینجا هیچ رزرو یا ایمیلی انجام نمی‌شود.', 'الإرسال يتم بواسطتك. لا يُحجز أو يُرسَل شيء من هنا.'],
  logged: ['Logged', 'Registrada', 'ثبت شد', 'سُجِّل'],
  noClient: ['without a client (pick one to attribute it)', 'sin cliente (elige uno para asignarla)', 'بدون مشتری (برای انتساب یکی را انتخاب کنید)', 'بلا عميل (اختر واحدًا لنسبته إليه)'],
  toDash: ['on the dashboard of', 'en el panel de', 'در داشبورد', 'في لوحة'],
  open: ['open', 'abrir', 'باز کردن', 'فتح'],
  savedLocal: ['saved in this browser only', 'guardada solo en este navegador', 'فقط در همین مرورگر ذخیره شد', 'محفوظ في هذا المتصفح فقط'],
  savedLive: ['saved to your account', 'guardada en tu cuenta', 'در حساب شما ذخیره شد', 'محفوظ في حسابك'],
  export: ['Export', 'Exportación', 'صادرات', 'تصدير'],
  import: ['Import', 'Importación', 'واردات', 'استيراد'],
  stPreferred: ['Preferred', 'Preferente', 'ترجیحی', 'مفضّل'],
  stActive: ['Active', 'Activo', 'فعال', 'نشط'],
  stProspect: ['Prospect', 'Potencial', 'بالقوه', 'محتمل'],
  stOnHold: ['On hold', 'En pausa', 'متوقف', 'معلّق'],
  modeFcl: ['Ocean FCL', 'Marítimo FCL', 'دریایی FCL', 'بحري FCL'],
  modeLcl: ['Ocean LCL', 'Marítimo LCL', 'دریایی LCL', 'بحري LCL'],
  modeAir: ['Air', 'Aéreo', 'هوایی', 'جوي'],
  modeRoad: ['Road', 'Carretera', 'جاده‌ای', 'بري'],
  sideOrigin: ['Origin', 'Origen', 'مبدأ', 'المنشأ'],
  sideFreight: ['Main freight', 'Flete principal', 'کرایه اصلی', 'أجرة الشحن الرئيسية'],
  sideDest: ['Destination', 'Destino', 'مقصد', 'الوجهة'],
  sideCustoms: ['Customs', 'Aduanas', 'گمرک', 'الجمارك'],
  sideServices: ['Requested services', 'Servicios solicitados', 'خدمات درخواستی', 'الخدمات المطلوبة'],
  bCntr: ['cntr', 'cntr', 'کانتینر', 'حاوية'],
  bKg: ['kg', 'kg', 'کیلو', 'كجم'],
  bWm: ['W/M', 'W/M', 'W/M', 'W/M'],
  bTruck: ['truck', 'camión', 'کامیون', 'شاحنة'],
  bShpt: ['shpt', 'envío', 'محموله', 'شحنة'],
} as const;

export type UKey = keyof typeof T;
const IX: Record<UiLang, 0 | 1 | 2 | 3> = { en: 0, es: 1, fa: 2, ar: 3 };
export const qu = (lang: UiLang, k: UKey): string => T[k][IX[lang] ?? 0];

export const modeLabel = (lang: UiLang, m: string) => qu(lang, ({ fcl: 'modeFcl', lcl: 'modeLcl', air: 'modeAir', road: 'modeRoad' } as Record<string, UKey>)[m] ?? 'modeFcl');
export const sideLabel = (lang: UiLang, s: string) => qu(lang, ({ origin: 'sideOrigin', freight: 'sideFreight', destination: 'sideDest', customs: 'sideCustoms', services: 'sideServices' } as Record<string, UKey>)[s] ?? 'sideOrigin');
export const basisLabel = (lang: UiLang, b: string) => {
  const k = ({ per_container: 'bCntr', per_kg: 'bKg', per_wm: 'bWm', per_truck: 'bTruck', per_shipment: 'bShpt' } as Record<string, UKey>)[b];
  return k ? qu(lang, k) : b;
};
export const agentStLabel = (lang: UiLang, s: string) => {
  const k = ({ preferred: 'stPreferred', active: 'stActive', prospect: 'stProspect', on_hold: 'stOnHold' } as Record<string, UKey>)[s];
  return k ? qu(lang, k) : s;
};

// Parser issue messages are written in English; translate them for the screen.
const FIXED: Record<string, [string, string, string]> = {
  'Mode not clear (sea / air / road).': ['Modo no claro (mar / aéreo / carretera).', 'حالت حمل مشخص نیست (دریایی / هوایی / جاده‌ای).', 'وسيلة النقل غير واضحة (بحري / جوي / بري).'],
  'Origin not found.': ['Origen no encontrado.', 'مبدأ پیدا نشد.', 'لم يُعثر على المنشأ.'],
  'Destination not found.': ['Destino no encontrado.', 'مقصد پیدا نشد.', 'لم يُعثر على الوجهة.'],
  'Container count / type missing.': ['Falta número / tipo de contenedor.', 'تعداد / نوع کانتینر مشخص نیست.', 'عدد / نوع الحاويات ناقص.'],
  'Gross weight per container not given — needed for VGM / overweight check.': ['Sin peso bruto por contenedor — hace falta para el VGM / control de sobrepeso.', 'وزن ناخالص هر کانتینر داده نشده — برای VGM / کنترل اضافه‌وزن لازم است.', 'لم يُذكر الوزن الإجمالي لكل حاوية — مطلوب لـ VGM / فحص الوزن الزائد.'],
  'Gross weight not given.': ['Sin peso bruto.', 'وزن ناخالص داده نشده.', 'لم يُذكر الوزن الإجمالي.'],
  'Volume / dimensions missing — chargeable weight can’t be checked.': ['Faltan volumen / medidas — no se puede comprobar el peso tasable.', 'حجم / ابعاد داده نشده — وزن قابل محاسبه قابل بررسی نیست.', 'الحجم / الأبعاد ناقصة — لا يمكن التحقق من الوزن المحتسب.'],
  'Trailer type not stated.': ['Tipo de tráiler no indicado.', 'نوع تریلر مشخص نشده.', 'نوع المقطورة غير مذكور.'],
  'Incoterm not given — priced as FOB.': ['Sin Incoterm — cotizado como FOB.', 'اینکوترم داده نشده — به‌صورت FOB قیمت داده شد.', 'لم يُذكر Incoterm — تم التسعير على أساس FOB.'],
  'Cargo ready date not given.': ['Sin fecha de mercancía lista.', 'تاریخ آمادگی بار داده نشده.', 'لم يُذكر تاريخ جاهزية البضاعة.'],
  'Commodity not described.': ['Mercancía no descrita.', 'کالا توضیح داده نشده.', 'لم تُوصف السلعة.'],
  'DG status unknown.': ['No se sabe si es mercancía peligrosa (DG).', 'وضعیت کالای خطرناک (DG) نامشخص است.', 'حالة البضائع الخطرة (DG) غير معروفة.'],
  'Dangerous goods — DG surcharges and carrier acceptance not in sample rates.': ['Mercancía peligrosa — los recargos DG y la aceptación de la naviera no están en las tarifas de ejemplo.', 'کالای خطرناک — هزینه‌های DG و پذیرش حمل‌کننده در نرخ‌های نمونه نیست.', 'بضائع خطرة — رسوم DG الإضافية وقبول الناقل غير مشمولة في أسعار العيّنة.'],
  'Container type not stated — priced using standard GP rates; confirm with the line.': ['Tipo de contenedor no indicado — cotizado con tarifas estándar GP; confirmar con la naviera.', 'نوع کانتینر مشخص نشده — با نرخ استاندارد GP قیمت داده شد؛ با خط کشتیرانی تأیید شود.', 'نوع الحاوية غير مذكور — سُعِّر بأسعار GP القياسية؛ للتأكيد مع الخط.'],
  'No rate on file for this lane — main freight is a SAMPLE estimate; get line rates before sending.': ['No hay tarifa para esta ruta — el flete principal es una estimación de EJEMPLO; pide tarifas a las navieras antes de enviar.', 'نرخی برای این مسیر ثبت نشده — کرایه اصلی برآورد نمونه است؛ پیش از ارسال از خطوط نرخ بگیرید.', 'لا يوجد سعر مسجّل لهذا المسار — أجرة الشحن الرئيسية تقدير عيّنة؛ اطلب أسعار الخطوط قبل الإرسال.'],
  'Requested services are priced as SAMPLE estimates — confirm with the insurer / customs broker / trucker before sending.': ['Los servicios solicitados tienen precios de EJEMPLO — confírmalos con la aseguradora / agente de aduanas / transportista antes de enviar.', 'خدمات درخواستی با برآورد نمونه قیمت‌گذاری شده‌اند — پیش از ارسال با بیمه‌گر / ترخیص‌کار / شرکت حمل تأیید کنید.', 'الخدمات المطلوبة مسعّرة بتقديرات عيّنة — أكّدها مع شركة التأمين / المخلّص الجمركي / الناقل قبل الإرسال.'],
  'Cargo value not given — insurance shows the SAMPLE minimum.': ['Sin valor de la mercancía — el seguro muestra el mínimo de EJEMPLO.', 'ارزش کالا داده نشده — بیمه حداقل نمونه را نشان می‌دهد.', 'لم تُذكر قيمة البضاعة — يظهر التأمين بالحد الأدنى للعيّنة.'],
};
const PAT: [RegExp, string, string, string][] = [
  [/^(.+): priced using standard GP rates; confirm with the line\.$/, '$1: cotizado con tarifas estándar GP; confirmar con la naviera.', '$1: با نرخ استاندارد GP قیمت داده شد؛ با خط کشتیرانی تأیید شود.', '$1: سُعِّر بأسعار GP القياسية؛ للتأكيد مع الخط.'],
  [/^Mode not stated — assumed AIR \(urgent, (.+) kg\)\.$/, 'Modo no indicado — se asume AÉREO (urgente, $1 kg).', 'حالت حمل ذکر نشده — هوایی فرض شد (فوری، $1 کیلو).', 'وسيلة النقل غير مذكورة — افتُرض الشحن الجوي (عاجل، $1 كجم).'],
  [/^"(.+)" read as (.+) for (.+)\.$/, '«$1» leído como $2 para $3.', '«$1» به‌عنوان $2 برای $3 خوانده شد.', 'قُرئ «$1» على أنه $2 لـ $3.'],
  [/^"(.+)" — assumed Monday (.+)\.$/, '«$1» — se asume el lunes $2.', '«$1» — دوشنبه $2 فرض شد.', '«$1» — افتُرض يوم الاثنين $2.'],
  [/^(.+) has (\d+) container ports — (.+)\. Different trucking, tolls and terminal fees\.$/, '$1 tiene $2 puertos de contenedores — $3. Cambian el transporte, los peajes y las tasas de terminal.', '$1 دارای $2 بندر کانتینری است — $3. حمل زمینی، عوارض و هزینه ترمینال متفاوت است.', '$1 فيها $2 موانئ حاويات — $3. يختلف النقل البري والرسوم ورسوم المحطة.'],
  [/^(.+): choose port \((.+)\)\.$/, '$1: elige puerto ($2).', '$1: بندر را انتخاب کنید ($2).', '$1: اختر الميناء ($2).'],
  [/^No Incoterm in the request — using (.+)'s default (.+) \(client setup\)\.$/, 'Sin Incoterm en la solicitud — se usa el de $1 por defecto, $2 (ficha del cliente).', 'اینکوترم در درخواست نیست — پیش‌فرض $1 یعنی $2 استفاده شد (تنظیمات مشتری).', 'لا يوجد Incoterm في الطلب — يُستخدم الافتراضي لـ $1 وهو $2 (إعداد العميل).'],
  [/^MSDS required \((.+) — sample rule, confirm with line\) and not attached yet\.$/, 'MSDS obligatoria ($1 — regla de ejemplo, confirmar con la naviera) y aún no adjunta.', 'MSDS الزامی است ($1 — قاعده نمونه، با خط کشتیرانی تأیید شود) و هنوز پیوست نشده.', 'MSDS مطلوبة ($1 — قاعدة عيّنة، تأكّد مع الخط) ولم تُرفق بعد.'],
];
export function issueText(lang: UiLang, msg: string): string {
  if (lang === 'en') return msg;
  const j = lang === 'es' ? 0 : lang === 'fa' ? 1 : 2;
  let tail = '';
  const m = msg.match(/^(.*) MSDS received \((.+)\)\.$/);
  if (m) {
    msg = m[1];
    tail = [` MSDS recibida (${m[2]}).`, ` MSDS دریافت شد (${m[2]}).`, ` تم استلام MSDS (${m[2]}).`][j];
  }
  if (FIXED[msg]) return FIXED[msg][j] + tail;
  for (const [re, ...tr] of PAT) if (re.test(msg)) return msg.replace(re, tr[j]).replace(/ or /g, [' o ', ' یا ', ' أو '][j]) + tail;
  return msg + tail;
}

/** Agent tags are built in English ("Client preferred", "Agent CRM · Active · sample"); localise for display. */
export function agentTag(lang: UiLang, tag: string): string {
  if (lang === 'en') return tag;
  if (lang === 'ar') return tag
    .replace('Client preferred', 'مفضّل لدى العميل')
    .replace('Client allowed', 'مسموح من العميل')
    .replace('Agent CRM', 'CRM الوكلاء')
    .replace(/· (Preferred|Active|Prospect|On hold)/, (_m, s: string) => `· ${agentStLabel(lang, s === 'On hold' ? 'on_hold' : s.toLowerCase())}`)
    .replace(' · sample', ' · عيّنة')
    .replace(' · public info, verify', ' · معلومات عامة، تحقّق');
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
  if (lang === 'ar') switch (incoterm) {
    case 'EXW': return 'EXW: الاستلام، ورسوم المنشأ، وأجرة الشحن الرئيسية، ورسوم الوجهة، والتخليص الجمركي للاستيراد.';
    case 'FCA': case 'FAS': case 'FOB': return `${incoterm}: البائع يدفع رسوم المنشأ؛ العرض يشمل أجرة الشحن الرئيسية ورسوم الوجهة والتخليص الجمركي للاستيراد.`;
    case 'CFR': case 'CIF': case 'CPT': case 'CIP': return `${incoterm}: البائع يدفع أجرة الشحن؛ العرض يشمل رسوم الوجهة والتخليص الجمركي للاستيراد فقط.`;
    case 'DAP': case 'DPU': return `${incoterm}: البائع يدفع حتى الوجهة؛ التخليص الجمركي والرسوم على المرسل إليه.`;
    case 'DDP': return 'DDP: جميع الرسوم بما فيها التخليص الجمركي — الرسوم الجمركية والضرائب غير مشمولة في هذا العرض.';
    default: return 'لا يوجد Incoterm — تم التسعير على أساس FOB (أجرة الشحن + الوجهة). يُرجى التأكيد مع العميل.';
  }
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
export const unitsText = (lang: UiLang, units: string) => (lang === 'en' ? units : units.replace(' kg chargeable', lang === 'es' ? ' kg tasables' : lang === 'ar' ? ' كجم محتسبة' : ' کیلو قابل محاسبه'));

/** "Customer A's preferred lines shown first…" note over the options. */
export function linesText(lang: UiLang, k: 'pref' | 'showing' | 'hidden' | 'hide' | 'show', name: string, n: number, list = ''): string {
  const pl = n > 1;
  if (lang === 'es') return { pref: `Primero ${pl ? 'las navieras preferidas' : 'la naviera preferida'} de ${name}. `, showing: `Mostrando ${n} naviera${pl ? 's' : ''} que ${name} evita. `, hidden: `${n} opci${pl ? 'ones' : 'ón'} de navieras que ${name} evita, ocultas (${list}). `, hide: 'ocultar', show: 'mostrar' }[k];
  if (lang === 'ar') return { pref: `الخطوط المفضّلة لدى ${name} معروضة أولًا. `, showing: `عرض ${n} خط يتجنّبه ${name}. `, hidden: `${n} خيار من خطوط يتجنّبها ${name} مخفية (${list}). `, hide: 'إخفاء', show: 'عرض' }[k];
  if (lang === 'fa') return { pref: `خطوط ترجیحی ${name} اول نمایش داده می‌شوند. `, showing: `نمایش ${n} خط که ${name} از آن پرهیز می‌کند. `, hidden: `${n} گزینه از خطوطی که ${name} از آن پرهیز می‌کند پنهان است (${list}). `, hide: 'پنهان کردن', show: 'نمایش' }[k];
  return { pref: `${name}'s preferred line${pl ? 's' : ''} shown first. `, showing: `Showing ${n} line${pl ? 's' : ''} ${name} avoids. `, hidden: `${n} option${pl ? 's' : ''} from line${pl ? 's' : ''} ${name} avoids hidden (${list}). `, hide: 'hide', show: 'show' }[k];
}

/** Sample-request button labels ("Ocean FCL (messy) · Shanghai"). Place names stay as written. */
export function sampleLabel(lang: UiLang, label: string): string {
  if (lang === 'en') return label;
  const es = lang === 'es';
  return label
    .replace('Ocean FCL', modeLabel(lang, 'fcl'))
    .replace(/^LCL/, modeLabel(lang, 'lcl'))
    .replace(/^Air/, modeLabel(lang, 'air'))
    .replace(/^Road FTL/, `${modeLabel(lang, 'road')} FTL`)
    .replace('(messy)', es ? '(desordenado)' : lang === 'ar' ? '(غير مرتب)' : '(نامرتب)')
    .replace('(Spanish)', es ? '(en español)' : lang === 'ar' ? '(بالإسبانية)' : '(اسپانیایی)')
    .replace(' → ', (lang === 'fa' || lang === 'ar') ? ' ← ' : ' → ');
}
