import type { Lang } from './steps';

const S = {
  jobs: ['Jobs', 'Expedientes', 'پرونده‌ها'],
  sampleData: ['SAMPLE DATA', 'DATOS DE EJEMPLO', 'داده نمونه'],
  sampleNote: [
    'Sample jobs, lines, containers and tariffs — illustrative only. Built from the client\'s process map (E1–E23, I1–I16). Read-only: it alerts, people act.',
    'Expedientes, navieras, contenedores y tarifas de ejemplo — solo ilustrativo. Basado en el mapa de procesos del cliente (E1–E23, I1–I16). Solo lectura: avisa, las personas actúan.',
    'پرونده‌ها، خطوط، کانتینرها و تعرفه‌ها نمونه هستند. بر اساس نقشه فرایند مشتری (E1–E23، I1–I16). فقط نمایش و هشدار؛ تصمیم با افراد است.',
  ],
  jobsLive: ['Jobs live', 'Expedientes activos', 'پرونده‌های فعال'],
  inFreeTime: ['Containers in free time', 'Contenedores en free time', 'کانتینر در فری‌تایم'],
  atRisk: ['At demurrage risk', 'Riesgo de demora', 'در خطر حق توقف'],
  cutoffs72: ['Cut-offs next 72 h', 'Cut-offs próximas 72 h', 'کات‌آف ۷۲ ساعت آینده'],
  unpaidBl: ['Unpaid before B/L', 'Impagado antes del B/L', 'پرداخت‌نشده پیش از اصل بارنامه'],
  chequesHeld: ['Guarantee cheques held', 'Cheques de garantía retenidos', 'چک‌های تضمین نزد خط'],
  board: ['Job board', 'Tablero de expedientes', 'تابلوی پرونده‌ها'],
  deadlines: ['Deadline tracker', 'Control de plazos', 'پیگیری مهلت‌ها'],
  money: ['Money at risk', 'Dinero en riesgo', 'پول در معرض خطر'],
  export: ['Export', 'Exportación', 'صادرات'],
  import: ['Import', 'Importación', 'واردات'],
  all: ['All', 'Todos', 'همه'],
  job: ['Job', 'Expediente', 'پرونده'],
  customer: ['Customer', 'Cliente', 'صاحب‌کالا'],
  route: ['Route', 'Ruta', 'مسیر'],
  line: ['Shipping line', 'Naviera', 'خط کشتیرانی'],
  containers: ['Containers', 'Contenedores', 'کانتینرها'],
  step: ['Current step', 'Paso actual', 'مرحله فعلی'],
  owner: ['Owner', 'Responsable', 'مسئول'],
  next: ['Next deadline', 'Próximo plazo', 'مهلت بعدی'],
  sales: ['Sales', 'Ventas', 'بازاریابی'],
  ops: ['Operations', 'Operaciones', 'قسمت عملیات'],
  freeTime: ['Free time', 'Free time', 'فری‌تایم'],
  demurrage: ['Demurrage', 'Demora', 'حق توقف'],
  cutoff: ['Cut-off', 'Cut-off', 'کات‌آف'],
  docCutoff: ['48 h document cut-off', 'Cut-off documental 48 h', 'کات‌آف ۴۸ ساعته اسناد'],
  shippingOrder: ['Shipping order', 'Shipping order', 'دستور حمل'],
  releaseOrder: ['Release order', 'Orden de entrega', 'حواله تحویل کانتینر'],
  draftBl: ['Draft B/L', 'Borrador B/L', 'درفت بارنامه'],
  originalBl: ['Original B/L', 'B/L original', 'اصل بارنامه'],
  arrival: ['Arrival notice', 'Aviso de llegada', 'آرایوال نوتیس'],
  do: ['Delivery order (DO)', 'Orden de entrega (DO)', 'دی‌او (ترخیصیه)'],
  warehouse: ['Warehouse receipt', 'Recibo de almacén', 'قبض انبار'],
  seals: ['Seals', 'Precintos', 'پلمپ'],
  seal: ['Seal', 'Precinto', 'پلمپ'],
  booking: ['Booking', 'Reserva', 'بوکینگ'],
  declaration: ['Customs declaration', 'Declaración aduanera', 'اظهار گمرکی'],
  packing: ['Packing list', 'Packing list', 'پکینگ‌لیست'],
  loi: ['LOI (line\'s form)', 'LOI (formulario naviera)', 'تعهدنامه (LOI)'],
  cheque: ['Guarantee cheque', 'Cheque de garantía', 'چک تضمین'],
  chequeDem: ['Demurrage cheque', 'Cheque de demora', 'چک تضمین حق توقف'],
  chequeCntr: ['Container cheque', 'Cheque de contenedor', 'چک تضمین کانتینر'],
  heldBy: ['held by', 'en poder de', 'نزد'],
  returnsWhen: ['returns when empty is back on time and undamaged (I14–I16)', 'se devuelven si el vacío vuelve a tiempo y sin daños (I14–I16)', 'در صورت برگشت به‌موقع و سالم کانتینر خالی مسترد می‌شود (I14–I16)'],
  toLodge: ['to lodge with line', 'por entregar', 'باید تحویل شود'],
  held: ['held', 'retenido', 'نزد خط'],
  returned: ['returned', 'devuelto', 'مسترد شد'],
  collectFreight: ['Collect freight', 'Flete collect', 'کرایه کالکت'],
  rebate: ['Line rebate', 'Comisión naviera', 'سهم خط'],
  collected: ['collected', 'cobrado', 'وصول شد'],
  notCollected: ['not collected', 'sin cobrar', 'وصول نشده'],
  paid: ['paid', 'pagado', 'پرداخت‌شده'],
  unpaid: ['unpaid', 'impagado', 'پرداخت‌نشده'],
  blocksBl: ['blocks original B/L release (E21–E22)', 'bloquea el B/L original (E21–E22)', 'مانع صدور اصل بارنامه (E21–E22)'],
  daysLeft: ['left', 'restan', 'مانده'],
  over: ['over', 'de exceso', 'تأخیر'],
  inDemurrage: ['IN DEMURRAGE', 'EN DEMORA', 'در حق توقف'],
  estDemurrage: ['est. demurrage (sample tariff)', 'demora est. (tarifa ejemplo)', 'برآورد حق توقف (تعرفه نمونه)'],
  notStarted: ['clock not started', 'reloj sin iniciar', 'شروع نشده'],
  stopped: ['stopped in time', 'parado a tiempo', 'به‌موقع متوقف شد'],
  loaded: ['loaded', 'cargado', 'بارگیری شد'],
  returnedEmpty: ['empty returned', 'vacío devuelto', 'خالی برگشت'],
  vessel: ['Vessel', 'Buque', 'کشتی'],
  eta: ['ETA', 'ETA', 'زمان رسیدن'],
  sailed: ['sailed', 'zarpó', 'حرکت کرد'],
  timeline: ['Steps', 'Pasos', 'مراحل'],
  documents: ['Documents', 'Documentos', 'اسناد'],
  charges: ['Charges', 'Gastos', 'هزینه‌ها'],
  alerts: ['Alerts', 'Alertas', 'هشدارها'],
  close: ['Close', 'Cerrar', 'بستن'],
  draftQuote: ['Draft quote', 'Borrador de oferta', 'پیش‌نویس قیمت'],
  clientDash: ['Client dashboard', 'Panel del cliente', 'داشبورد مشتری'],
  agent: ['Client\'s agent', 'Agente del cliente', 'نماینده مشتری'],
  tariffs: ['Tariffs', 'Tarifas', 'تعرفه‌ها'],
  tariffsNote: [
    'SAMPLE · set yearly by the Shipping Association (انجمن کشتیرانی) and Ports Organization (سازمان بنادر). Edit here; every clock and total updates. Saved in this browser only.',
    'EJEMPLO · fijadas cada año por la Shipping Association (انجمن کشتیرانی) y la Ports Organization (سازمان بنادر). Edítalas aquí; todo se recalcula. Solo se guardan en este navegador.',
    'نمونه · هر سال توسط انجمن کشتیرانی و سازمان بنادر تعیین می‌شود. اینجا ویرایش کنید؛ همه محاسبات به‌روز می‌شود. فقط در همین مرورگر ذخیره می‌شود.',
  ],
  reset: ['Reset to sample', 'Restablecer', 'بازگشت به نمونه'],
  glossary: ['Glossary', 'Glosario', 'واژه‌نامه'],
  docDelay: ['Document delay (40–60 day case)', 'Retraso documental (caso 40–60 días)', 'تأخیر اسناد (۴۰ تا ۶۰ روز)'],
  rounds: ['rounds', 'rondas', 'دور'],
  done: ['done', 'hecho', 'انجام شد'],
  waiting: ['waiting', 'esperando', 'در انتظار'],
  pending: ['not yet', 'pendiente', 'هنوز نه'],
  blocked: ['blocked', 'bloqueado', 'متوقف'],
  setBySa: ['Shipping Association', 'Shipping Association', 'انجمن کشتیرانی'],
  setByPo: ['Ports Organization', 'Ports Organization', 'سازمان بنادر'],
  setByLine: ['Shipping line', 'Naviera', 'خط کشتیرانی'],
  notBooked: ['not booked yet', 'sin reservar', 'هنوز بوک نشده'],
  nothingUrgent: ['Nothing due', 'Nada urgente', 'مورد فوری نیست'],
  total: ['Total', 'Total', 'جمع'],
  cntr: ['cntr', 'cont.', 'کانتینر'],
  open: ['Open', 'Abrir', 'باز کردن'],
  buildOrder: ['Her build order: 1 Dashboard · 2 Deadline tracker · 3 Documents & billing agents · 4 Booking & rates', 'Orden de construcción: 1 Dashboard · 2 Plazos · 3 Agentes de documentos y facturación · 4 Reservas y tarifas', 'ترتیب ساخت: ۱ داشبورد · ۲ پیگیری مهلت‌ها · ۳ عامل اسناد و صورتحساب · ۴ بوکینگ و نرخ'],
} as const;

export type Key = keyof typeof S;
const IDX: Record<Lang, number> = { en: 0, es: 1, fa: 2 };
export const tr = (lang: Lang, k: Key): string => S[k][IDX[lang]];

/** Persian term to show beside the English one (EN/ES views). */
export const FA_TERM: Partial<Record<Key, string>> = {
  freeTime: 'فری‌تایم', demurrage: 'حق توقف', originalBl: 'اصل بارنامه', draftBl: 'درفت بارنامه', cheque: 'چک تضمین',
  shippingOrder: 'دستور حمل', cutoff: 'کات‌آف', docCutoff: 'کات‌آف', releaseOrder: 'حواله تحویل کانتینر', arrival: 'آرایوال نوتیس',
  do: 'دی‌او', warehouse: 'قبض انبار', seals: 'پلمپ', collectFreight: 'کالکت', customer: 'صاحب‌کالا', line: 'خط کشتیرانی',
  sales: 'بازاریابی', ops: 'قسمت عملیات', tariffs: 'تعرفه', booking: 'بوکینگ', declaration: 'اظهار', loi: 'تعهدنامه',
  chequeDem: 'چک تضمین', chequeCntr: 'چک تضمین',
};

export const GLOSSARY: [string, string][] = [
  ['صاحب‌کالا', 'Cargo owner, the customer'],
  ['ترخیص‌کار', 'Customs clearance agent'],
  ['بازاریابی', 'Sales, the marketing team'],
  ['قسمت عملیات', 'Operations'],
  ['خط کشتیرانی، شرکت کشتیرانی', 'Shipping line'],
  ['بوکینگ', 'Booking'],
  ['فری‌تایم', 'Free time'],
  ['حق توقف', 'Demurrage'],
  ['حواله تحویل کانتینر', 'Container release order'],
  ['پلمپ', 'Seal'],
  ['اظهار', 'Customs declaration'],
  ['تالی', 'Tally'],
  ['شیپینگ اوردر، دستور حمل', 'Shipping order'],
  ['درفت بارنامه', 'Draft bill of lading'],
  ['اصل بارنامه', 'Original bill of lading'],
  ['پکینگ‌لیست', 'Packing list'],
  ['گواهی مبدأ', 'Certificate of origin'],
  ['آرایوال نوتیس', 'Arrival notice'],
  ['دی‌او، ترخیصیه', 'Delivery order (DO)'],
  ['قبض انبار', 'Warehouse receipt'],
  ['چک تضمین', 'Guarantee cheque'],
  ['تعهدنامه', 'LOI, letter of indemnity'],
  ['کالکت، پری‌پید', 'Freight collect, prepaid'],
  ['کات‌آف', 'Cut-off'],
  ['ریلیز', 'Container release, on import'],
  ['نماینده', 'Agent'],
  ['انجمن کشتیرانی', 'Shipping Association'],
  ['سازمان بنادر', 'Ports Organization'],
];

const nf = (lang: Lang, opts?: Intl.NumberFormatOptions) => new Intl.NumberFormat(lang === 'fa' ? 'fa-IR' : 'en-US', opts);
export const num = (lang: Lang, n: number) => nf(lang, { maximumFractionDigits: 0 }).format(n);
export const usd = (lang: Lang, n: number) => (lang === 'fa' ? `${num(lang, n)} دلار` : `$${num(lang, n)}`);

/** Live countdown text. */
export function dur(lang: Lang, ms: number, withSeconds = true): string {
  const a = Math.abs(ms);
  const d = Math.floor(a / 86400000);
  const h = Math.floor((a % 86400000) / 3600000);
  const m = Math.floor((a % 3600000) / 60000);
  const s = Math.floor((a % 60000) / 1000);
  const p = (n: number) => (lang === 'fa' ? num(lang, n) : String(n).padStart(2, '0'));
  if (lang === 'fa') {
    if (d >= 2) return `${num(lang, d)} روز ${num(lang, h)} ساعت`;
    const p2 = (n: number) => n.toLocaleString('fa-IR', { minimumIntegerDigits: 2 });
    return `${p2(d * 24 + h)}:${p2(m)}${withSeconds ? `:${p2(s)}` : ''}`;
  }
  if (d >= 2) return `${d}d ${h}h`;
  return `${d * 24 + h}h ${p(m)}m${withSeconds ? ` ${p(s)}s` : ''}`;
}

export function fmtDay(lang: Lang, ms: number): string {
  const loc = lang === 'fa' ? 'fa-IR' : lang === 'es' ? 'es-ES' : 'en-GB';
  return new Date(ms).toLocaleDateString(loc, { day: 'numeric', month: 'short' });
}
export function fmtWhen(lang: Lang, ms: number): string {
  const loc = lang === 'fa' ? 'fa-IR' : lang === 'es' ? 'es-ES' : 'en-GB';
  return new Date(ms).toLocaleString(loc, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
