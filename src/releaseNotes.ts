// Release notes ("What's new"). Newest first. To publish a release, add one entry at the top.
// Seeded only from the git history of github.com/Aibit/forwarddesk; `commits` lists the commits grouped into each release.
// Dates are Europe/Madrid (the commit dates). Version numbers are labels for these groups.
import type { UiLang } from './ui/lang';

type L4 = [string, string, string, string]; // en, es, fa, ar
export interface Release {
  version: string;
  /** yyyy-mm-dd, Europe/Madrid */
  date: string;
  title: L4;
  bullets: L4[];
  commits: string[];
}

export const RELEASES: Release[] = [
  {
    version: '0.8', date: '2026-11-11',
    title: ['WhatsApp messages, English-only screens, What’s new', 'Mensajes de WhatsApp, pantallas sin mezcla de idiomas y Novedades', 'پیام واتساپ، صفحه‌های تک‌زبانه و «تازه‌ها»', 'رسائل واتساب وشاشات بلغة واحدة وصفحة «الجديد»'],
    bullets: [
      ['WhatsApp buttons on the job, client, agent, invoice and quote screens open your own WhatsApp with the message ready; you press Send.', 'Botones de WhatsApp en expediente, cliente, agente, factura y cotización: abren su propio WhatsApp con el mensaje listo; usted pulsa Enviar.', 'دکمه واتساپ در پرونده، مشتری، نماینده، فاکتور و قیمت‌دهی؛ واتساپ خودتان با پیام آماده باز می‌شود و ارسال را خودتان می‌زنید.', 'أزرار واتساب في شاشات الشحنة والعميل والوكيل والفاتورة وعرض السعر تفتح واتساب الخاص بك والرسالة جاهزة، ثم تضغط «إرسال».'],
      ['Message templates in the client’s language (EN/ES/FA/AR): free time ending, 48 h cut-off, pay before B/L release, draft B/L, invoice issued, arrival notice, quote sent. You can edit the text first.', 'Plantillas en el idioma del cliente (EN/ES/FA/AR): fin del tiempo libre, cut-off de 48 h, pago antes del B/L, borrador de B/L, factura emitida, aviso de llegada y cotización enviada. Puede editar el texto antes.', 'قالب پیام به زبان مشتری (EN/ES/FA/AR): پایان فری‌تایم، کات‌آف ۴۸ ساعته، پرداخت پیش از بارنامه، درفت بارنامه، صدور فاکتور، آرایوال نوتیس و ارسال قیمت. متن پیش از ارسال قابل ویرایش است.', 'قوالب رسائل بلغة العميل (EN/ES/FA/AR): انتهاء الفترة المجانية، الموعد النهائي خلال ٤٨ ساعة، الدفع قبل الإفراج عن البوليصة، مسودة البوليصة، إصدار فاتورة، إشعار وصول، إرسال عرض سعر. يمكنك تعديل النص أولًا.'],
      ['Each opened message is logged on the job, client or agent as “opened in WhatsApp” (delivery cannot be confirmed).', 'Cada mensaje abierto queda registrado en el expediente, cliente o agente como «abierto en WhatsApp» (la entrega no se puede confirmar).', 'هر پیام باز شده روی پرونده، مشتری یا نماینده با عنوان «باز شده در واتساپ» ثبت می‌شود (تحویل قابل تأیید نیست).', 'تُسجَّل كل رسالة مفتوحة على الشحنة أو العميل أو الوكيل بعبارة «فُتح في واتساب» (لا يمكن تأكيد التسليم).'],
      ['WhatsApp number fields with a country-code picker for clients, contacts and agents.', 'Campos de número de WhatsApp con selector de prefijo para clientes, contactos y agentes.', 'فیلد شماره واتساپ با انتخاب کد کشور برای مشتریان، مخاطبان و نمایندگان.', 'حقول رقم واتساب مع اختيار رمز الدولة للعملاء وجهات الاتصال والوكلاء.'],
      ['Persian terms now appear only when the app is in Persian.', 'Los términos en persa solo aparecen cuando la app está en persa.', 'اصطلاحات فارسی فقط وقتی برنامه فارسی است نمایش داده می‌شوند.', 'لم تعد المصطلحات الفارسية تظهر إلا عندما تكون الواجهة بالفارسية.'],
      ['This “What’s new” page.', 'Esta página de «Novedades».', 'همین صفحه «تازه‌ها».', 'صفحة «الجديد» هذه.'],
    ],
    commits: [],
  },
  {
    version: '0.7', date: '2026-11-11',
    title: ['Arabic', 'Árabe', 'زبان عربی', 'اللغة العربية'],
    bullets: [
      ['Arabic is the fourth app language, right-to-left, with Arabic-Indic digits and an Arabic font.', 'El árabe es el cuarto idioma de la app, de derecha a izquierda, con cifras arábigo-índicas y fuente árabe.', 'عربی چهارمین زبان برنامه است؛ راست‌به‌چپ، با ارقام عربی و قلم عربی.', 'العربية هي اللغة الرابعة في التطبيق، من اليمين إلى اليسار، بأرقام عربية هندية وخط عربي.'],
      ['The phone top bar fits in every language, and each page opens at the top.', 'La barra superior del móvil cabe en todos los idiomas y cada página se abre arriba.', 'نوار بالای گوشی در همه زبان‌ها جا می‌شود و هر صفحه از بالا باز می‌شود.', 'يتّسع الشريط العلوي في الهاتف لكل اللغات، وتُفتح كل صفحة من أعلاها.'],
    ],
    commits: ['0626c86'],
  },
  {
    version: '0.6', date: '2026-11-11',
    title: ['New logo, Sales pipeline and review fixes', 'Nuevo logo, embudo de ventas y correcciones', 'لوگوی جدید، قیف فروش و اصلاحات', 'شعار جديد ومسار المبيعات وإصلاحات المراجعة'],
    bullets: [
      ['New ForwardDesk logo in the sidebar, start screen, sign-in, portal, app icon and PDFs (when you have no logo of your own).', 'Nuevo logo de ForwardDesk en la barra lateral, inicio, acceso, portal, icono de la app y PDF (si no tiene logo propio).', 'لوگوی جدید ForwardDesk در نوار کناری، صفحه شروع، ورود، پرتال، آیکون برنامه و PDF (اگر لوگوی خودتان را نگذاشته‌اید).', 'شعار ForwardDesk الجديد في الشريط الجانبي وشاشة البدء وتسجيل الدخول والبوابة وأيقونة التطبيق وملفات PDF (إن لم يكن لديك شعار).'],
      ['Sales pipeline replaces the Desk and Pitch pages: inquiries, quotes and bookings by stage with value and margin.', 'El embudo de ventas sustituye a Desk y Pitch: consultas, cotizaciones y reservas por etapa con valor y margen.', 'قیف فروش جای صفحه‌های Desk و Pitch را گرفت: استعلام، قیمت و رزرو به تفکیک مرحله با ارزش و حاشیه سود.', 'مسار المبيعات يحل محل صفحتي Desk وPitch: الاستفسارات والعروض والحجوزات حسب المرحلة مع القيمة والهامش.'],
      ['Unpaid amounts and the B/L / delivery-order release block now come from the invoices, so every page shows the same figure.', 'Los importes pendientes y el bloqueo del B/L u orden de entrega salen ahora de las facturas: todas las páginas muestran la misma cifra.', 'مبالغ پرداخت‌نشده و توقف صدور بارنامه یا ترخیصیه اکنون از فاکتورها می‌آید و همه صفحه‌ها یک عدد را نشان می‌دهند.', 'المبالغ غير المدفوعة وحجب الإفراج عن البوليصة أو إذن التسليم تأتي الآن من الفواتير، فتعرض كل الصفحات الرقم نفسه.'],
      ['Imports block the delivery order until paid; the deadline tracker comes first on smaller screens; Quote and pipeline in Spanish and Persian.', 'Las importaciones bloquean la orden de entrega hasta el pago; el seguimiento de plazos va primero en pantallas pequeñas; Cotizar y embudo en español y persa.', 'در واردات، ترخیصیه تا پرداخت متوقف می‌ماند؛ ردیاب مهلت‌ها در صفحه‌های کوچک‌تر اول می‌آید؛ قیمت‌دهی و قیف فروش به اسپانیایی و فارسی.', 'في الاستيراد يُحجب إذن التسليم حتى الدفع؛ يظهر متتبّع المواعيد أولًا في الشاشات الأصغر؛ عرض السعر ومسار المبيعات بالإسبانية والفارسية.'],
      ['Review fixes: Finance totals on a first demo visit, one language switch, clearer “local charges” labels, matching demurrage figures.', 'Correcciones: totales de Finanzas en la primera visita a la demo, un solo selector de idioma, etiquetas de «gastos locales» más claras y cifras de demora coherentes.', 'اصلاحات: جمع‌های مالی در اولین بازدید دمو، یک انتخابگر زبان، برچسب روشن‌تر «هزینه‌های محلی» و ارقام یکسان حق توقف.', 'إصلاحات: إجماليات المالية في أول زيارة للعرض التجريبي، مبدّل لغة واحد، تسميات أوضح لـ«الرسوم المحلية»، وأرقام غرامات تأخير متطابقة.'],
    ],
    commits: ['abded19', '77ed671', '87f7735', '6381c7a', '874548e', '6748883'],
  },
  {
    version: '0.5', date: '2026-11-11',
    title: ['Agent CRM, documents & billing, accounts', 'CRM de agentes, documentos y facturación, cuentas', 'CRM نمایندگان، اسناد و صورتحساب، حساب‌ها', 'CRM الوكلاء والمستندات والفوترة والحسابات'],
    bullets: [
      ['Agent CRM: agents, contacts, activity timeline, KYC documents with expiry flags, win and response stats, CSV import/export.', 'CRM de agentes: agentes, contactos, actividad, documentos KYC con avisos de caducidad, estadísticas de éxito y respuesta, importación/exportación CSV.', 'CRM نمایندگان: نمایندگان، مخاطبان، سابقه فعالیت، مدارک KYC با هشدار انقضا، آمار موفقیت و پاسخ‌گویی، ورود و خروج CSV.', 'CRM الوكلاء: الوكلاء وجهات الاتصال وسجل النشاط ومستندات KYC مع تنبيهات الانتهاء وإحصاءات الفوز والاستجابة واستيراد/تصدير CSV.'],
      ['Per-job House B/L, arrival notice, delivery order and booking confirmation as PDF; release blocked until paid.', 'House B/L, aviso de llegada, orden de entrega y confirmación de reserva en PDF por expediente; liberación bloqueada hasta el pago.', 'بارنامه هاوس، آرایوال نوتیس، ترخیصیه و تأیید بوکینگ به‌صورت PDF برای هر پرونده؛ صدور تا پرداخت متوقف است.', 'بوليصة الشحن الفرعية وإشعار الوصول وإذن التسليم وتأكيد الحجز بصيغة PDF لكل شحنة؛ الإفراج محجوب حتى الدفع.'],
      ['Charges, invoices, vendor bills, payments, manual exchange rates and job profit; a Finance page with ageing and balance by client.', 'Cargos, facturas, facturas de proveedores, cobros, tipos de cambio manuales y beneficio por expediente; página de Finanzas con antigüedad y saldo por cliente.', 'هزینه‌ها، فاکتورها، صورتحساب تأمین‌کنندگان، پرداخت‌ها، نرخ ارز دستی و سود پرونده؛ صفحه مالی با سنی‌بندی و مانده هر مشتری.', 'الرسوم والفواتير وفواتير الموردين والمدفوعات وأسعار الصرف اليدوية وربح الشحنة؛ صفحة مالية بأعمار الديون والرصيد لكل عميل.'],
      ['Start screen with the demo or your own account: sign-up, onboarding, team invites and an Account page (accounts open shortly).', 'Pantalla de inicio con la demo o una cuenta propia: registro, configuración inicial, invitaciones al equipo y página de Cuenta (las cuentas abren pronto).', 'صفحه شروع با دمو یا حساب خودتان: ثبت‌نام، راه‌اندازی، دعوت تیم و صفحه حساب (حساب‌ها به‌زودی باز می‌شوند).', 'شاشة بدء للعرض التجريبي أو لحسابك: التسجيل والإعداد ودعوات الفريق وصفحة الحساب (تُفتح الحسابات قريبًا).'],
    ],
    commits: ['eb4e517', 'cfe5ca3', 'a0757ec', 'f8a4314'],
  },
  {
    version: '0.4', date: '2026-11-10',
    title: ['Notion-style redesign', 'Rediseño al estilo Notion', 'طراحی تازه به سبک Notion', 'تصميم جديد بأسلوب Notion'],
    bullets: [
      ['Left sidebar, page headers with shipping drawings, empty-state art and dark mode.', 'Barra lateral, cabeceras con dibujos de transporte, ilustraciones en pantallas vacías y modo oscuro.', 'نوار کناری، سرصفحه‌ها با طرح‌های حمل‌ونقل، تصویر برای صفحه‌های خالی و حالت تیره.', 'شريط جانبي وترويسات صفحات برسومات الشحن ورسومات للحالات الفارغة ووضع داكن.'],
      ['One language setting for the whole app, a phone menu, and soft amber/red alerts.', 'Un único ajuste de idioma para toda la app, menú en el móvil y avisos suaves en ámbar/rojo.', 'یک تنظیم زبان برای کل برنامه، منوی گوشی و هشدارهای ملایم کهربایی و قرمز.', 'إعداد لغة واحد للتطبيق كله وقائمة للهاتف وتنبيهات هادئة بالكهرماني والأحمر.'],
    ],
    commits: ['8e6c751'],
  },
  {
    version: '0.3', date: '2026-11-10',
    title: ['Jobs, deadline tracker and clients', 'Expedientes, seguimiento de plazos y clientes', 'پرونده‌ها، ردیاب مهلت‌ها و مشتریان', 'الشحنات ومتتبّع المواعيد والعملاء'],
    bullets: [
      ['Jobs page with every export and import step, a deadline tracker for free time, 48 h cut-off and demurrage, and money at risk.', 'Página de expedientes con cada paso de exportación e importación, seguimiento de tiempo libre, cut-off de 48 h y demora, y dinero en riesgo.', 'صفحه پرونده‌ها با همه مراحل صادرات و واردات، ردیاب فری‌تایم، کات‌آف ۴۸ ساعته و حق توقف، و پول در خطر.', 'صفحة الشحنات بكل خطوات التصدير والاستيراد، ومتتبّع للفترة المجانية والموعد النهائي خلال ٤٨ ساعة وغرامات التأخير، والأموال المعرّضة للخطر.'],
      ['Compare line options side by side in a quote, with badges and differences against the cheapest.', 'Comparación de opciones de naviera en la cotización, con etiquetas y diferencias frente a la más barata.', 'مقایسه گزینه‌های خطوط کنار هم در قیمت‌دهی، با نشان‌ها و اختلاف با ارزان‌ترین.', 'مقارنة خيارات الخطوط جنبًا إلى جنب في عرض السعر، مع شارات والفرق عن الأرخص.'],
      ['Clients with dashboards, lane profiles, MSDS by HS code, a client portal and an agents database.', 'Clientes con panel, perfiles de ruta, MSDS por código HS, portal del cliente y base de agentes.', 'مشتریان با داشبورد، پروفایل مسیر، MSDS بر اساس کد HS، پرتال مشتری و پایگاه نمایندگان.', 'العملاء مع لوحات ومسارات وMSDS حسب رمز HS وبوابة للعميل وقاعدة بيانات للوكلاء.'],
      ['Optional live mode with an online database; demo mode stays the default.', 'Modo en vivo opcional con base de datos en línea; la demo sigue siendo el modo por defecto.', 'حالت زنده اختیاری با پایگاه داده آنلاین؛ حالت دمو همچنان پیش‌فرض است.', 'وضع مباشر اختياري بقاعدة بيانات على الإنترنت، ويبقى العرض التجريبي هو الافتراضي.'],
    ],
    commits: ['cf00956', '62e7d4b', '76cf8d1', '923d83c', '6a708c3', '240842b', 'e29a0c5'],
  },
  {
    version: '0.2', date: '2026-11-09',
    title: ['Quote from a pasted request', 'Cotizar a partir de una solicitud pegada', 'قیمت‌دهی از روی درخواست چسبانده‌شده', 'عرض سعر من طلب ملصوق'],
    bullets: [
      ['Paste a messy customer request; ForwardDesk reads it, flags what to confirm and prices it from your rate sheet.', 'Pegue una solicitud desordenada; ForwardDesk la lee, marca lo que hay que confirmar y la cotiza con su tarifa.', 'درخواست نامرتب مشتری را بچسبانید؛ ForwardDesk آن را می‌خواند، موارد نیازمند تأیید را مشخص می‌کند و از روی نرخ‌نامه شما قیمت می‌دهد.', 'الصق طلب العميل كما هو؛ يقرؤه ForwardDesk ويحدّد ما يلزم تأكيده ويسعّره من جدول أسعارك.'],
      ['Branded A4 PDF quote with route map, timeline and sell-only charges.', 'Cotización en PDF A4 con su marca, mapa de ruta, cronograma y solo precios de venta.', 'PDF قیمت A4 با نشان شما، نقشه مسیر، زمان‌بندی و فقط هزینه‌های فروش.', 'عرض سعر PDF بمقاس A4 بعلامتك مع خريطة المسار والجدول الزمني ورسوم البيع فقط.'],
    ],
    commits: ['7676d73', '0bdeec7', '0f5db48', '425e949'],
  },
  {
    version: '0.1', date: '2026-09-25',
    title: ['First version of ForwardDesk', 'Primera versión de ForwardDesk', 'نخستین نسخه ForwardDesk', 'الإصدار الأول من ForwardDesk'],
    bullets: [
      ['The product is named ForwardDesk and published as a web app.', 'El producto pasa a llamarse ForwardDesk y se publica como aplicación web.', 'نام محصول ForwardDesk شد و به‌صورت برنامه وب منتشر شد.', 'سُمّي المنتج ForwardDesk ونُشر كتطبيق ويب.'],
      ['Larger, easier-to-read screens and a first sales “Pitch” page.', 'Pantallas más grandes y fáciles de leer, y una primera página de ventas «Pitch».', 'صفحه‌های بزرگ‌تر و خواناتر و نخستین صفحه فروش «Pitch».', 'شاشات أكبر وأسهل قراءة وأول صفحة مبيعات «Pitch».'],
    ],
    commits: ['bd152ba', '2c21ed5', '58d9b9d', '8e50918', 'a9709e6', 'b4f4b7a'],
  },
];

const LI: Record<UiLang, 0 | 1 | 2 | 3> = { en: 0, es: 1, fa: 2, ar: 3 };
export const pick = (t: L4, l: UiLang) => t[LI[l]];
export const LATEST = RELEASES[0].version;

const SEEN_KEY = 'fd.whatsnew.seen';
export const seenVersion = (): string | null => { try { return localStorage.getItem(SEEN_KEY); } catch { return null; } };
export const markSeen = () => { try { localStorage.setItem(SEEN_KEY, LATEST); } catch { /* private mode */ } };
const vnum = (v: string) => v.split('.').map(Number).reduce((a, n) => a * 1000 + n, 0);
export const hasUnread = () => { const s = seenVersion(); return !s || vnum(LATEST) > vnum(s); };
