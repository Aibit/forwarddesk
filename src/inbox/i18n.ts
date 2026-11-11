import type { UiLang } from '../ui/lang';

type L4 = [string, string, string, string];
const S = {
  sample: ['SAMPLE', 'MUESTRA', 'نمونه', 'نموذج'],
  sampleNote: ['Sample conversations with a mock provider. Nothing is sent to anyone and no delivery status here is real.', 'Conversaciones de muestra con un proveedor simulado. No se envía nada a nadie y ningún estado de entrega es real.', 'گفت‌وگوهای نمونه با ارائه‌دهنده آزمایشی. چیزی برای کسی ارسال نمی‌شود و هیچ وضعیت تحویلی واقعی نیست.', 'محادثات نموذجية مع مزوّد تجريبي. لا يُرسل أي شيء لأي أحد، ولا توجد حالة تسليم حقيقية هنا.'],
  serverNote: ['Connected to your WhatsApp service · provider {p}', 'Conectado a su servicio de WhatsApp · proveedor {p}', 'متصل به سرویس واتساپ شما · ارائه‌دهنده {p}', 'متصل بخدمة واتساب الخاصة بك · المزوّد {p}'],
  mockServer: ['Your service runs the mock provider: nothing is sent and statuses are simulated.', 'Su servicio usa el proveedor simulado: no se envía nada y los estados son simulados.', 'سرویس شما با ارائه‌دهنده آزمایشی کار می‌کند: چیزی ارسال نمی‌شود و وضعیت‌ها شبیه‌سازی‌اند.', 'تعمل خدمتك بالمزوّد التجريبي: لا يُرسل شيء والحالات محاكاة.'],
  offline: ['Cannot reach the WhatsApp service: {e}', 'No se puede contactar con el servicio de WhatsApp: {e}', 'دسترسی به سرویس واتساپ ممکن نیست: {e}', 'تعذّر الوصول إلى خدمة واتساب: {e}'],
  notConfiguredH: ['Connect a WhatsApp Business number', 'Conecte un número de WhatsApp Business', 'اتصال یک شماره واتساپ بیزینس', 'اربط رقم واتساب للأعمال'],
  notConfiguredP: ['The two-way inbox needs the ForwardDesk WhatsApp service and an official WhatsApp Business number (Cloud API or 360dialog). Until then, the WhatsApp buttons on bookings, clients, agents, invoices and quotes open your own WhatsApp with the message ready.', 'La bandeja bidireccional necesita el servicio de WhatsApp de ForwardDesk y un número oficial de WhatsApp Business (Cloud API o 360dialog). Mientras tanto, los botones de WhatsApp en reservas, clientes, agentes, facturas y cotizaciones abren su propio WhatsApp con el mensaje listo.', 'صندوق پیام دوطرفه به سرویس واتساپ ForwardDesk و یک شماره رسمی واتساپ بیزینس (Cloud API یا 360dialog) نیاز دارد. تا آن زمان، دکمه‌های واتساپ در بوکینگ‌ها، مشتریان، نمایندگان، فاکتورها و قیمت‌ها واتساپ خودتان را با پیام آماده باز می‌کنند.', 'يحتاج صندوق الوارد ثنائي الاتجاه إلى خدمة واتساب من ForwardDesk ورقم واتساب للأعمال رسمي (Cloud API أو 360dialog). وحتى ذلك الحين، تفتح أزرار واتساب في الحجوزات والعملاء والوكلاء والفواتير والعروض واتساب الخاص بك والرسالة جاهزة.'],
  search: ['Search conversations', 'Buscar conversaciones', 'جست‌وجوی گفت‌وگوها', 'ابحث في المحادثات'],
  fAll: ['All', 'Todas', 'همه', 'الكل'],
  fUnread: ['Unread', 'Sin leer', 'خوانده‌نشده', 'غير مقروءة'],
  fUnlinked: ['Not linked', 'Sin vincular', 'بدون پیوند', 'غير مرتبطة'],
  noConvs: ['No conversations yet.', 'Todavía no hay conversaciones.', 'هنوز گفت‌وگویی نیست.', 'لا توجد محادثات بعد.'],
  pick: ['Pick a conversation on the left.', 'Elija una conversación de la lista.', 'یک گفت‌وگو را از فهرست انتخاب کنید.', 'اختر محادثة من القائمة.'],
  client: ['Client', 'Cliente', 'مشتری', 'عميل'],
  agent: ['Agent', 'Agente', 'نماینده', 'وكيل'],
  unlinked: ['Not linked', 'Sin vincular', 'بدون پیوند', 'غير مرتبط'],
  job: ['Booking', 'Reserva', 'بوکینگ', 'الحجز'],
  noJob: ['No booking', 'Sin reserva', 'بدون بوکینگ', 'بلا حجز'],
  linkJob: ['Link to booking', 'Vincular a reserva', 'پیوند به بوکینگ', 'ربط بحجز'],
  byText: ['found in a message', 'detectado en un mensaje', 'از متن پیام', 'من نص رسالة'],
  byStaff: ['set by staff', 'elegido por el equipo', 'انتخاب کارمند', 'اختيار الموظف'],
  winOpen: ['Reply window open · {t} left', 'Ventana de respuesta abierta · quedan {t}', 'پنجره پاسخ باز است · {t} مانده', 'نافذة الرد مفتوحة · متبقٍ {t}'],
  winClosed: ['Reply window closed: send an approved template', 'Ventana de respuesta cerrada: envíe una plantilla aprobada', 'پنجره پاسخ بسته است: یک قالب تأییدشده بفرستید', 'نافذة الرد مغلقة: أرسل قالبًا معتمدًا'],
  winNever: ['No message from this contact yet: start with an approved template', 'Este contacto aún no ha escrito: empiece con una plantilla aprobada', 'این مخاطب هنوز پیامی نداده است: با یک قالب تأییدشده شروع کنید', 'لم يراسلك هذا الشخص بعد: ابدأ بقالب معتمد'],
  winHelp: ['WhatsApp allows free text and documents for 24 hours after the contact’s last message. Outside that window only approved templates can be sent.', 'WhatsApp permite texto libre y documentos durante 24 horas desde el último mensaje del contacto. Fuera de esa ventana solo se pueden enviar plantillas aprobadas.', 'واتساپ تا ۲۴ ساعت پس از آخرین پیام مخاطب، متن آزاد و سند را مجاز می‌داند. خارج از این بازه فقط قالب‌های تأییدشده ارسال می‌شوند.', 'يسمح واتساب بالنص الحر والمستندات خلال ٢٤ ساعة من آخر رسالة من جهة الاتصال. وخارج هذه النافذة لا يمكن إرسال إلا القوالب المعتمدة.'],
  hours: ['{n} h', '{n} h', '{n} ساعت', '{n} ساعة'],
  minutes: ['{n} min', '{n} min', '{n} دقیقه', '{n} دقيقة'],
  typeMsg: ['Write a message…', 'Escriba un mensaje…', 'پیام بنویسید…', 'اكتب رسالة…'],
  send: ['Send', 'Enviar', 'ارسال', 'إرسال'],
  attach: ['Attach PDF', 'Adjuntar PDF', 'پیوست PDF', 'إرفاق PDF'],
  attachFrom: ['Documents from {job}', 'Documentos de {job}', 'اسناد {job}', 'مستندات {job}'],
  noDocs: ['This booking has no invoices or B/L documents yet.', 'Esta reserva aún no tiene facturas ni documentos de B/L.', 'این بوکینگ هنوز فاکتور یا سند بارنامه ندارد.', 'لا توجد فواتير أو مستندات بوليصة لهذا الحجز بعد.'],
  linkFirst: ['Link a booking to attach its PDFs.', 'Vincule una reserva para adjuntar sus PDF.', 'برای پیوست PDF، گفت‌وگو را به یک بوکینگ پیوند دهید.', 'اربط المحادثة بحجز لإرفاق ملفاتها.'],
  invoice: ['Invoice', 'Factura', 'فاکتور', 'فاتورة'],
  template: ['Template', 'Plantilla', 'قالب', 'القالب'],
  msgLang: ['Message language', 'Idioma del mensaje', 'زبان پیام', 'لغة الرسالة'],
  vars: ['Values', 'Valores', 'مقادیر', 'القيم'],
  preview: ['Preview', 'Vista previa', 'پیش‌نمایش', 'معاينة'],
  sendTpl: ['Send template', 'Enviar plantilla', 'ارسال قالب', 'إرسال القالب'],
  attachHeader: ['Attach a PDF to this template', 'Adjuntar un PDF a esta plantilla', 'پیوست یک PDF به این قالب', 'إرفاق ملف PDF بهذا القالب'],
  none: ['None', 'Ninguno', 'هیچ', 'لا شيء'],
  tplApproved: ['Templates must be approved by WhatsApp before they can be used with a real number.', 'Las plantillas deben estar aprobadas por WhatsApp antes de usarlas con un número real.', 'قالب‌ها باید پیش از استفاده با شماره واقعی توسط واتساپ تأیید شوند.', 'يجب أن يعتمد واتساب القوالب قبل استخدامها مع رقم حقيقي.'],
  st_queued: ['Accepted, waiting for status', 'Aceptado, esperando estado', 'پذیرفته شد، در انتظار وضعیت', 'مقبولة، بانتظار الحالة'],
  st_sent: ['Sent', 'Enviado', 'ارسال شد', 'أُرسلت'],
  st_delivered: ['Delivered', 'Entregado', 'تحویل شد', 'سُلّمت'],
  st_read: ['Read', 'Leído', 'خوانده شد', 'قُرئت'],
  st_failed: ['Not delivered', 'No entregado', 'تحویل نشد', 'لم تُسلَّم'],
  st_sample: ['Sample: not sent', 'Muestra: no enviado', 'نمونه: ارسال نشد', 'نموذج: لم يُرسل'],
  statusFrom: ['Status reported by WhatsApp', 'Estado informado por WhatsApp', 'وضعیت گزارش‌شده از واتساپ', 'الحالة كما أبلغ عنها واتساب'],
  statusSample: ['Sample status: no real message', 'Estado de muestra: no hay mensaje real', 'وضعیت نمونه: پیام واقعی نیست', 'حالة نموذجية: لا توجد رسالة حقيقية'],
  tplTag: ['Template', 'Plantilla', 'قالب', 'قالب'],
  open: ['Open', 'Abrir', 'باز کردن', 'فتح'],
  sampleFile: ['Sample file', 'Archivo de muestra', 'فایل نمونه', 'ملف نموذجي'],
  back: ['Conversations', 'Conversaciones', 'گفت‌وگوها', 'المحادثات'],
  unreadN: ['{n} unread', '{n} sin leer', '{n} خوانده‌نشده', '{n} غير مقروءة'],
  jobThreads: ['WhatsApp conversations', 'Conversaciones de WhatsApp', 'گفت‌وگوهای واتساپ', 'محادثات واتساب'],
  openInbox: ['Open in Inbox', 'Abrir en la bandeja', 'باز کردن در صندوق پیام', 'فتح في صندوق الوارد'],
  sendFailed: ['Could not send: {e}', 'No se pudo enviar: {e}', 'ارسال نشد: {e}', 'تعذّر الإرسال: {e}'],
  closedRefused: ['The reply window is closed. Choose an approved template.', 'La ventana de respuesta está cerrada. Elija una plantilla aprobada.', 'پنجره پاسخ بسته است. یک قالب تأییدشده انتخاب کنید.', 'نافذة الرد مغلقة. اختر قالبًا معتمدًا.'],
  settingsH: ['WhatsApp inbox', 'Bandeja de WhatsApp', 'صندوق پیام واتساپ', 'صندوق وارد واتساب'],
  settingsP: ['Connect this device to your ForwardDesk WhatsApp service: an official WhatsApp Business number through the Cloud API or 360dialog.', 'Conecte este dispositivo a su servicio de WhatsApp de ForwardDesk: un número oficial de WhatsApp Business mediante la Cloud API o 360dialog.', 'این دستگاه را به سرویس واتساپ ForwardDesk وصل کنید: یک شماره رسمی واتساپ بیزینس از طریق Cloud API یا 360dialog.', 'اربط هذا الجهاز بخدمة واتساب من ForwardDesk: رقم واتساب للأعمال رسمي عبر Cloud API أو 360dialog.'],
  url: ['Service URL', 'URL del servicio', 'آدرس سرویس', 'عنوان الخدمة'],
  key: ['API key', 'Clave de API', 'کلید API', 'مفتاح API'],
  test: ['Test connection', 'Probar conexión', 'آزمایش اتصال', 'اختبار الاتصال'],
  save: ['Save', 'Guardar', 'ذخیره', 'حفظ'],
  disconnect: ['Disconnect', 'Desconectar', 'قطع اتصال', 'قطع الاتصال'],
  stored: ['Saved on this device only.', 'Se guarda solo en este dispositivo.', 'فقط روی همین دستگاه ذخیره می‌شود.', 'يُحفظ على هذا الجهاز فقط.'],
  connOk: ['Connected · provider {p}', 'Conectado · proveedor {p}', 'متصل · ارائه‌دهنده {p}', 'متصل · المزوّد {p}'],
  connProblems: ['Connected, but not ready: {p}', 'Conectado, pero no listo: {p}', 'متصل است ولی آماده نیست: {p}', 'متصل لكنه غير جاهز: {p}'],
  connFail: ['No connection: {e}', 'Sin conexión: {e}', 'اتصال برقرار نشد: {e}', 'لا يوجد اتصال: {e}'],
  demoSettings: ['The demo inbox uses sample conversations and a mock provider. Connect a service here to use your own WhatsApp Business number.', 'La bandeja de la demo usa conversaciones de muestra y un proveedor simulado. Conecte aquí un servicio para usar su propio número de WhatsApp Business.', 'صندوق پیام دمو از گفت‌وگوهای نمونه و ارائه‌دهنده آزمایشی استفاده می‌کند. برای استفاده از شماره واتساپ بیزینس خودتان، اینجا سرویس را وصل کنید.', 'يستخدم صندوق العرض التجريبي محادثات نموذجية ومزوّدًا تجريبيًا. اربط خدمة هنا لاستخدام رقم واتساب للأعمال الخاص بك.'],
  fallbackNote: ['Without a service, the WhatsApp buttons keep opening your own WhatsApp (nothing is sent automatically).', 'Sin servicio, los botones de WhatsApp siguen abriendo su propio WhatsApp (no se envía nada automáticamente).', 'بدون سرویس، دکمه‌های واتساپ همچنان واتساپ خودتان را باز می‌کنند (هیچ پیامی خودکار ارسال نمی‌شود).', 'من دون خدمة، تبقى أزرار واتساب تفتح واتساب الخاص بك (لا يُرسل شيء تلقائيًا).'],
  you: ['You', 'Usted', 'شما', 'أنت'],
  doc: ['Document', 'Documento', 'سند', 'مستند'],
  image: ['Photo', 'Foto', 'عکس', 'صورة'],
  sending: ['Sending…', 'Enviando…', 'در حال ارسال…', 'جارٍ الإرسال…'],
} satisfies Record<string, L4>;

export type IKey = keyof typeof S;
const LI: Record<UiLang, 0 | 1 | 2 | 3> = { en: 0, es: 1, fa: 2, ar: 3 };
export const it = (l: UiLang, k: IKey, vars?: Record<string, string | number>) => {
  let s = S[k][LI[l]];
  if (vars) for (const [a, b] of Object.entries(vars)) s = s.replace(`{${a}}`, String(b));
  return s;
};
export const I_STRINGS = S;
const LOC: Record<UiLang, string> = { en: 'en-GB', es: 'es-ES', fa: 'fa-IR-u-ca-gregory', ar: 'ar-EG' };
export const num = (l: UiLang, n: number) => n.toLocaleString(LOC[l]);
export const when = (l: UiLang, ms: number, now = Date.now()) => {
  const d = new Date(ms);
  const same = new Date(now).toDateString() === d.toDateString();
  return new Intl.DateTimeFormat(LOC[l], same ? { hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);
};
export const left = (l: UiLang, ms: number) => {
  const h = Math.floor(ms / 3600000);
  return h >= 1 ? it(l, 'hours', { n: num(l, h) }) : it(l, 'minutes', { n: num(l, Math.max(1, Math.round(ms / 60000))) });
};
