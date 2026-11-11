import type { Lang } from './steps';

const S = {
  jobs: ['Bookings', 'Reservas', 'بوکینگ‌ها', 'الحجوزات'],
  sampleData: ['SAMPLE DATA', 'DATOS DE EJEMPLO', 'داده نمونه', 'بيانات عيّنة'],
  sampleNote: [
    'Sample bookings, lines, containers and tariffs — illustrative only. Steps E1–E23 (export) and I1–I16 (import).',
    'Reservas, navieras, contenedores y tarifas de ejemplo — solo ilustrativo. Pasos E1–E23 (exportación) e I1–I16 (importación).',
    'بوکینگ‌ها، خطوط، کانتینرها و تعرفه‌ها نمونه هستند. مراحل E1–E23 (صادرات) و I1–I16 (واردات).', 'حجوزات وخطوط وحاويات وتعرفات عيّنة — للتوضيح فقط. الخطوات E1–E23 (تصدير) وI1–I16 (استيراد).',
  ],
  newJob: ['+ New booking', '+ Nueva reserva', '+ بوکینگ جدید', '+ حجز جديد'],
  createJob: ['Create booking', 'Crear reserva', 'ایجاد بوکینگ', 'إنشاء حجز'],
  cancelJ: ['Cancel', 'Cancelar', 'انصراف', 'إلغاء'],
  pol: ['Port of loading', 'Puerto de carga', 'بندر بارگیری', 'ميناء التحميل'],
  pod: ['Port of discharge', 'Puerto de descarga', 'بندر تخلیه', 'ميناء التفريغ'],
  commodityJ: ['Commodity', 'Mercancía', 'کالا', 'السلعة'],
  lineJ: ['Shipping line', 'Naviera', 'خط کشتیرانی', 'خط ملاحي'],
  equipment: ['Equipment (planned)', 'Equipo (previsto)', 'تجهیزات (برنامه)', 'المعدّات (المخطّطة)'],
  dirJ: ['Direction', 'Dirección', 'جهت', 'الاتجاه'],
  startStep: ['Current step', 'Paso actual', 'مرحله فعلی', 'الخطوة الحالية'],
  newJobNote: ['Containers, charges and documents are added as the booking moves. Saved', 'Contenedores, cargos y documentos se añaden según avanza. Guardado', 'کانتینرها، هزینه‌ها و اسناد با پیشرفت بوکینگ اضافه می‌شوند. ذخیره', 'تُضاف الحاويات والرسوم والمستندات مع تقدّم الحجز. محفوظة'],
  savedLive: ['online (staff of this org + this client only)', 'en línea (personal de la empresa + este cliente)', 'آنلاین (کارکنان و همین مشتری)', 'عبر الإنترنت (موظفو هذه المؤسسة + هذا العميل فقط)'],
  savedLocal: ['in this browser only', 'solo en este navegador', 'فقط در همین مرورگر', 'في هذا المتصفح فقط'],
  portalApproved: ['Client approved the draft B/L in the portal', 'El cliente aprobó el borrador de B/L en el portal', 'مشتری پیش‌نویس بارنامه را در پورتال تأیید کرد', 'وافق العميل على مسودة بوليصة الشحن في البوابة'],
  jobsLive: ['Live bookings', 'Reservas activas', 'بوکینگ‌های فعال', 'الحجوزات النشطة'],
  inFreeTime: ['Containers in free time', 'Contenedores en free time', 'کانتینر در فری‌تایم', 'حاويات ضمن الفترة المجانية'],
  atRisk: ['At demurrage risk', 'Riesgo de demora', 'در خطر حق توقف', 'معرّضة لغرامة التأخير'],
  cutoffs72: ['Cut-offs next 72 h', 'Cut-offs próximas 72 h', 'کات‌آف ۷۲ ساعت آینده', 'مواعيد Cut-off خلال ٧٢ ساعة'],
  unpaidBl: ['Unpaid, blocks release', 'Impagado, bloquea la entrega', 'پرداخت‌نشده، مانع ترخیص اسناد', 'غير مدفوع، يحجب الإفراج'],
  chequesHeld: ['Guarantee cheques held', 'Cheques de garantía retenidos', 'چک‌های تضمین نزد خط', 'شيكات ضمان محتجزة'],
  board: ['Booking board', 'Tablero de reservas', 'تابلوی بوکینگ‌ها', 'لوحة الحجوزات'],
  deadlines: ['Deadline tracker', 'Control de plazos', 'پیگیری مهلت‌ها', 'متتبّع المواعيد النهائية'],
  money: ['Money at risk', 'Dinero en riesgo', 'پول در معرض خطر', 'أموال معرّضة للخطر'],
  export: ['Export', 'Exportación', 'صادرات', 'تصدير'],
  import: ['Import', 'Importación', 'واردات', 'استيراد'],
  all: ['All', 'Todos', 'همه', 'الكل'],
  job: ['Booking', 'Reserva', 'بوکینگ', 'الحجز'],
  customer: ['Customer', 'Cliente', 'صاحب‌کالا', 'العميل'],
  route: ['Route', 'Ruta', 'مسیر', 'المسار'],
  line: ['Shipping line', 'Naviera', 'خط کشتیرانی', 'خط ملاحي'],
  containers: ['Containers', 'Contenedores', 'کانتینرها', 'الحاويات'],
  step: ['Current step', 'Paso actual', 'مرحله فعلی', 'الخطوة الحالية'],
  owner: ['Owner', 'Responsable', 'مسئول', 'المالك'],
  next: ['Next deadline', 'Próximo plazo', 'مهلت بعدی', 'الموعد النهائي التالي'],
  sales: ['Sales', 'Ventas', 'بازاریابی', 'المبيعات'],
  ops: ['Operations', 'Operaciones', 'قسمت عملیات', 'العمليات'],
  freeTime: ['Free time', 'Free time', 'فری‌تایم', 'الفترة المجانية'],
  demurrage: ['Demurrage', 'Demora', 'حق توقف', 'غرامة التأخير (Demurrage)'],
  cutoff: ['Cut-off', 'Cut-off', 'کات‌آف', 'الموعد النهائي (Cut-off)'],
  docCutoff: ['48 h document cut-off', 'Cut-off documental 48 h', 'کات‌آف ۴۸ ساعته اسناد', 'موعد المستندات قبل ٤٨ ساعة'],
  shippingOrder: ['Shipping order', 'Shipping order', 'دستور حمل', 'أمر الشحن'],
  releaseOrder: ['Release order', 'Orden de entrega', 'حواله تحویل کانتینر', 'أمر الإفراج'],
  draftBl: ['Draft B/L', 'Borrador B/L', 'درفت بارنامه', 'مسودة بوليصة الشحن'],
  originalBl: ['Original B/L', 'B/L original', 'اصل بارنامه', 'بوليصة الشحن الأصلية'],
  arrival: ['Arrival notice', 'Aviso de llegada', 'آرایوال نوتیس', 'إشعار الوصول'],
  do: ['Delivery order (DO)', 'Orden de entrega (DO)', 'دی‌او (ترخیصیه)', 'إذن التسليم (DO)'],
  warehouse: ['Warehouse receipt', 'Recibo de almacén', 'قبض انبار', 'إيصال المستودع'],
  seals: ['Seals', 'Precintos', 'پلمپ', 'الأختام'],
  seal: ['Seal', 'Precinto', 'پلمپ', 'الختم'],
  booking: ['Booking', 'Reserva', 'بوکینگ', 'الحجز'],
  declaration: ['Customs declaration', 'Declaración aduanera', 'اظهار گمرکی', 'البيان الجمركي'],
  packing: ['Packing list', 'Packing list', 'پکینگ‌لیست', 'قائمة التعبئة'],
  loi: ['LOI (line\'s form)', 'LOI (formulario naviera)', 'تعهدنامه (LOI)', 'خطاب ضمان LOI (نموذج الخط)'],
  cheque: ['Guarantee cheque', 'Cheque de garantía', 'چک تضمین', 'شيك ضمان'],
  chequeDem: ['Demurrage cheque', 'Cheque de demora', 'چک تضمین حق توقف', 'شيك غرامة التأخير'],
  chequeCntr: ['Container cheque', 'Cheque de contenedor', 'چک تضمین کانتینر', 'شيك الحاوية'],
  heldBy: ['held by', 'en poder de', 'نزد', 'يحتجزها'],
  returnsWhen: ['returns when empty is back on time and undamaged (I14–I16)', 'se devuelven si el vacío vuelve a tiempo y sin daños (I14–I16)', 'در صورت برگشت به‌موقع و سالم کانتینر خالی مسترد می‌شود (I14–I16)', 'يُعاد عند إرجاع الفارغة في الموعد وبلا أضرار (I14–I16)'],
  toLodge: ['to lodge with line', 'por entregar', 'باید تحویل شود', 'للإيداع لدى الخط'],
  held: ['held', 'retenido', 'نزد خط', 'محتجز'],
  returned: ['returned', 'devuelto', 'مسترد شد', 'مُعاد'],
  collectFreight: ['Collect freight', 'Flete collect', 'کرایه کالکت', 'أجرة شحن تُحصَّل'],
  rebate: ['Line rebate', 'Comisión naviera', 'سهم خط', 'خصم الخط'],
  collected: ['collected', 'cobrado', 'وصول شد', 'مُحصَّل'],
  notCollected: ['not collected', 'sin cobrar', 'وصول نشده', 'غير مُحصَّل'],
  paid: ['paid', 'pagado', 'پرداخت‌شده', 'مدفوع'],
  unpaid: ['unpaid', 'impagado', 'پرداخت‌نشده', 'غير مدفوع'],
  blocksBl: ['blocks original B/L release (E21–E22)', 'bloquea el B/L original (E21–E22)', 'مانع صدور اصل بارنامه (E21–E22)', 'يحجب الإفراج عن بوليصة الشحن الأصلية (E21–E22)'],
  blocksDo: ['blocks the delivery order (I11–I12)', 'bloquea la orden de entrega (I11–I12)', 'مانع صدور دی‌او (I11–I12)', 'يحجب إذن التسليم (I11–I12)'],
  openInvoices: ['Open invoices', 'Facturas pendientes', 'فاکتورهای باز', 'فواتير مفتوحة'],
  releaseDocBl: ['Original B/L', 'B/L original', 'اصل بارنامه', 'بوليصة الشحن الأصلية'],
  releaseDocDo: ['Delivery order (DO)', 'Orden de entrega (DO)', 'دی‌او (ترخیصیه)', 'إذن التسليم (DO)'],
  noOpen: ['Nothing unpaid', 'Nada pendiente', 'بدهی باز ندارد', 'لا شيء غير مدفوع'],
  seeBilling: ['Charges and invoices are in the Billing tab.', 'Los cargos y facturas están en la pestaña Facturación.', 'هزینه‌ها و فاکتورها در زبانه صورتحساب است.', 'الرسوم والفواتير في تبويب الفوترة.'],
  noRate: ['no rate entered', 'sin tipo de cambio', 'نرخ ارز وارد نشده', 'لم يُدخل سعر صرف'],
  daysLeft: ['left', 'restan', 'مانده', 'متبقٍ'],
  over: ['over', 'de exceso', 'تأخیر', 'متجاوز'],
  inDemurrage: ['IN DEMURRAGE', 'EN DEMORA', 'در حق توقف', 'في غرامة التأخير'],
  estDemurrage: ['est. demurrage (sample tariff)', 'demora est. (tarifa ejemplo)', 'برآورد حق توقف (تعرفه نمونه)', 'غرامة تأخير تقديرية (تعرفة عيّنة)'],
  notStarted: ['clock not started', 'reloj sin iniciar', 'شروع نشده', 'العدّاد لم يبدأ'],
  stopped: ['stopped in time', 'parado a tiempo', 'به‌موقع متوقف شد', 'توقّف في الوقت'],
  loaded: ['loaded', 'cargado', 'بارگیری شد', 'محمّلة'],
  returnedEmpty: ['empty returned', 'vacío devuelto', 'خالی برگشت', 'أُعيدت فارغة'],
  vessel: ['Vessel', 'Buque', 'کشتی', 'السفينة'],
  eta: ['ETA', 'ETA', 'زمان رسیدن', 'موعد الوصول المتوقع'],
  sailed: ['sailed', 'zarpó', 'حرکت کرد', 'أبحرت'],
  timeline: ['Steps', 'Pasos', 'مراحل', 'الخطوات'],
  documents: ['Documents', 'Documentos', 'اسناد', 'المستندات'],
  charges: ['Charges', 'Gastos', 'هزینه‌ها', 'الرسوم'],
  alerts: ['Alerts', 'Alertas', 'هشدارها', 'التنبيهات'],
  close: ['Close', 'Cerrar', 'بستن', 'إغلاق'],
  draftQuote: ['Draft quote', 'Borrador de oferta', 'پیش‌نویس قیمت', 'مسودة عرض سعر'],
  clientDash: ['Client dashboard', 'Panel del cliente', 'داشبورد مشتری', 'لوحة العميل'],
  agent: ['Client\'s agent', 'Agente del cliente', 'نماینده مشتری', 'وكيل العميل'],
  tariffs: ['Tariffs', 'Tarifas', 'تعرفه‌ها', 'التعرفات'],
  tariffsNote: [
    'SAMPLE · set yearly by the Shipping Association and the Ports Organization. Edit here; every clock and total updates. Saved in this browser only.',
    'EJEMPLO · fijadas cada año por la asociación de navieras y la autoridad portuaria. Edítalas aquí; todo se recalcula. Solo se guardan en este navegador.',
    'نمونه · هر سال توسط انجمن کشتیرانی و سازمان بنادر تعیین می‌شود. اینجا ویرایش کنید؛ همه محاسبات به‌روز می‌شود. فقط در همین مرورگر ذخیره می‌شود.', 'عيّنة · تُحدَّد سنويًا من جمعية الملاحة وهيئة الموانئ. عدّل هنا؛ يتحدّث كل عدّاد وإجمالي. محفوظة في هذا المتصفح فقط.',
  ],
  reset: ['Reset to sample', 'Restablecer', 'بازگشت به نمونه', 'إعادة إلى بيانات العيّنة'],
  glossary: ['Glossary', 'Glosario', 'واژه‌نامه', 'مسرد المصطلحات'],
  docDelay: ['Document delay (40–60 day case)', 'Retraso documental (caso 40–60 días)', 'تأخیر اسناد (۴۰ تا ۶۰ روز)', 'تأخّر المستندات (حالة ٤٠–٦٠ يومًا)'],
  rounds: ['rounds', 'rondas', 'دور', 'جولات'],
  done: ['done', 'hecho', 'انجام شد', 'تم'],
  waiting: ['waiting', 'esperando', 'در انتظار', 'بانتظار'],
  pending: ['not yet', 'pendiente', 'هنوز نه', 'ليس بعد'],
  blocked: ['blocked', 'bloqueado', 'متوقف', 'محجوب'],
  setBySa: ['Shipping Association', 'Shipping Association', 'انجمن کشتیرانی', 'جمعية الملاحة'],
  setByPo: ['Ports Organization', 'Ports Organization', 'سازمان بنادر', 'منظمة الموانئ'],
  setByLine: ['Shipping line', 'Naviera', 'خط کشتیرانی', 'خط ملاحي'],
  notBooked: ['not booked yet', 'sin reservar', 'هنوز بوک نشده', 'لم يُحجز بعد'],
  nothingUrgent: ['Nothing due', 'Nada urgente', 'مورد فوری نیست', 'لا شيء مستحق'],
  total: ['Total', 'Total', 'جمع', 'الإجمالي'],
  cntr: ['cntr', 'cont.', 'کانتینر', 'حاوية'],
  open: ['Open', 'Abrir', 'باز کردن', 'فتح'],
  buildOrder: ['Her build order: 1 Dashboard · 2 Deadline tracker · 3 Documents & billing agents · 4 Booking & rates', 'Orden de construcción: 1 Dashboard · 2 Plazos · 3 Agentes de documentos y facturación · 4 Reservas y tarifas', 'ترتیب ساخت: ۱ داشبورد · ۲ پیگیری مهلت‌ها · ۳ عامل اسناد و صورتحساب · ۴ بوکینگ و نرخ', 'ترتيب بنائها: ١ لوحة المعلومات · ٢ متتبّع المواعيد · ٣ المستندات وفوترة الوكلاء · ٤ الحجز والأسعار'],
} as const;

export type Key = keyof typeof S;
const IDX: Record<Lang, number> = { en: 0, es: 1, fa: 2, ar: 3 };
export const tr = (lang: Lang, k: Key): string => S[k][IDX[lang]];


export const GLOSSARY: [string, string, string][] = [
  ['صاحب‌کالا', 'Cargo owner, the customer', 'صاحب البضاعة، العميل'],
  ['ترخیص‌کار', 'Customs clearance agent', 'مخلّص جمركي'],
  ['بازاریابی', 'Sales, the marketing team', 'المبيعات، فريق التسويق'],
  ['قسمت عملیات', 'Operations', 'العمليات'],
  ['خط کشتیرانی، شرکت کشتیرانی', 'Shipping line', 'خط ملاحي'],
  ['بوکینگ', 'Booking', 'الحجز'],
  ['فری‌تایم', 'Free time', 'الفترة المجانية'],
  ['حق توقف', 'Demurrage', 'غرامة التأخير'],
  ['حواله تحویل کانتینر', 'Container release order', 'أمر الإفراج عن الحاوية'],
  ['پلمپ', 'Seal', 'ختم (سيل)'],
  ['اظهار', 'Customs declaration', 'بيان جمركي'],
  ['تالی', 'Tally', 'عدّ البضاعة (تالي)'],
  ['شیپینگ اوردر، دستور حمل', 'Shipping order', 'أمر الشحن'],
  ['درفت بارنامه', 'Draft bill of lading', 'مسودة بوليصة الشحن'],
  ['اصل بارنامه', 'Original bill of lading', 'بوليصة الشحن الأصلية'],
  ['پکینگ‌لیست', 'Packing list', 'قائمة التعبئة'],
  ['گواهی مبدأ', 'Certificate of origin', 'شهادة المنشأ'],
  ['آرایوال نوتیس', 'Arrival notice', 'إشعار الوصول'],
  ['دی‌او، ترخیصیه', 'Delivery order (DO)', 'إذن التسليم (DO)'],
  ['قبض انبار', 'Warehouse receipt', 'إيصال المستودع'],
  ['چک تضمین', 'Guarantee cheque', 'شيك ضمان'],
  ['تعهدنامه', 'LOI, letter of indemnity', 'خطاب ضمان (LOI)'],
  ['کالکت، پری‌پید', 'Freight collect, prepaid', 'شحن عند الوصول، مدفوع مسبقاً'],
  ['کات‌آف', 'Cut-off', 'الموعد النهائي (Cut-off)'],
  ['ریلیز', 'Container release, on import', 'الإفراج عن الحاوية، عند الاستيراد'],
  ['نماینده', 'Agent', 'وكيل'],
  ['انجمن کشتیرانی', 'Shipping Association', 'جمعية الشحن'],
  ['سازمان بنادر', 'Ports Organization', 'هيئة الموانئ'],
];

const nf = (lang: Lang, opts?: Intl.NumberFormatOptions) => new Intl.NumberFormat(lang === 'fa' ? 'fa-IR-u-ca-gregory' : lang === 'ar' ? 'ar-EG' : 'en-US', opts);
export const num = (lang: Lang, n: number) => nf(lang, { maximumFractionDigits: 0 }).format(n);
export const usd = (lang: Lang, n: number) => (lang === 'fa' ? `${num(lang, n)} دلار` : lang === 'ar' ? `${num(lang, n)} دولار` : `$${num(lang, n)}`);

/** Live countdown text. */
export function dur(lang: Lang, ms: number, withSeconds = true): string {
  const a = Math.abs(ms);
  const d = Math.floor(a / 86400000);
  const h = Math.floor((a % 86400000) / 3600000);
  const m = Math.floor((a % 3600000) / 60000);
  const s = Math.floor((a % 60000) / 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  if (lang === 'fa' || lang === 'ar') {
    if (d >= 2) return lang === 'fa' ? `${num(lang, d)} روز ${num(lang, h)} ساعت` : `${num(lang, d)} يوم ${num(lang, h)} ساعة`;
    const p2 = (n: number) => n.toLocaleString(lang === 'fa' ? 'fa-IR-u-ca-gregory' : 'ar-EG', { minimumIntegerDigits: 2 });
    return `${p2(d * 24 + h)}:${p2(m)}${withSeconds ? `:${p2(s)}` : ''}`;
  }
  if (d >= 2) return `${d}d ${h}h`;
  return `${d * 24 + h}h ${p(m)}m${withSeconds ? ` ${p(s)}s` : ''}`;
}

export function fmtDay(lang: Lang, ms: number): string {
  const loc = lang === 'fa' ? 'fa-IR-u-ca-gregory' : lang === 'ar' ? 'ar-EG' : lang === 'es' ? 'es-ES' : 'en-GB';
  return new Date(ms).toLocaleDateString(loc, { day: 'numeric', month: 'short' });
}
export function fmtWhen(lang: Lang, ms: number): string {
  const loc = lang === 'fa' ? 'fa-IR-u-ca-gregory' : lang === 'ar' ? 'ar-EG' : lang === 'es' ? 'es-ES' : 'en-GB';
  return new Date(ms).toLocaleString(loc, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const UNIT_W: Record<string, [string, string, string]> = { day: ['día', 'روز', 'يوم'], days: ['días', 'روز', 'أيام'], cntr: ['cont.', 'کانتینر', 'حاوية'] };
export const unitTx = (lang: Lang, u: string) =>
  lang === 'en' ? u : u.replace(/\b(days|day|cntr)\b/g, (w) => UNIT_W[w][lang === 'es' ? 0 : lang === 'fa' ? 1 : 2]);
