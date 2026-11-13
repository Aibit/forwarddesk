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
    version: '0.12', date: '2026-11-13',
    title: ['Fuller demo quotes, region-neutral demo', 'Cotizaciones de demo más completas y demo neutral', 'پیش‌فاکتورهای کامل‌تر در دمو، دموی بی‌طرف', 'عروض أسعار أكمل في العرض التجريبي، وعرض محايد'],
    bullets: [
      ['Cross-trade lanes (for example Shanghai → Barcelona) no longer show home-port local charges; only the charges of the real loading and discharge ports appear.', 'Las rutas cross-trade (por ejemplo Shanghái → Barcelona) ya no muestran gastos locales del puerto base; solo aparecen los gastos de los puertos reales de carga y descarga.', 'مسیرهای کراس‌ترید (مثلاً شانگهای → بارسلونا) دیگر هزینه‌های محلی بندر مبدأ شرکت را نشان نمی‌دهند؛ فقط هزینه‌های بنادر واقعی بارگیری و تخلیه نمایش داده می‌شود.', 'لم تعد مسارات التجارة العابرة (مثل شنغهاي → برشلونة) تعرض الرسوم المحلية لميناء الشركة؛ تظهر فقط رسوم ميناءي التحميل والتفريغ الفعليين.'],
      ['The demo prices China → Jebel Ali in 20′, 40′ and 40′ HC, and when a reasonable lane has no sample rate it shows a SAMPLE estimate instead of “not priced”.', 'La demo cotiza China → Jebel Ali en 20′, 40′ y 40′ HC, y si una ruta razonable no tiene tarifa de ejemplo muestra una estimación de EJEMPLO en vez de «sin precio».', 'دمو برای چین → جبل علی در ۲۰، ۴۰ و ۴۰ HC قیمت می‌دهد و اگر مسیری معقول نرخ نمونه نداشته باشد، به‌جای «بدون قیمت» یک برآورد نمونه نشان می‌دهد.', 'يسعّر العرض التجريبي الصين → جبل علي بحاويات 20 و40 و40 HC، وإذا لم يكن لمسار معقول سعر عيّنة يعرض تقدير عيّنة بدل «غير مسعّر».'],
      ['Services you ask for in the request (cargo insurance, customs clearance at origin or destination, trucking) appear as quote lines, marked SAMPLE estimate: insurance as a % of the cargo value with a minimum, customs as a flat fee per declaration.', 'Los servicios pedidos en la solicitud (seguro de carga, despacho de aduanas en origen o destino, transporte por camión) aparecen como líneas de la cotización, marcadas como estimación de EJEMPLO: el seguro como % del valor con un mínimo y la aduana como tarifa fija por declaración.', 'خدماتی که در درخواست آمده (بیمه بار، ترخیص گمرکی در مبدأ یا مقصد، حمل با کامیون) به‌صورت ردیف‌های پیش‌فاکتور با برچسب «برآورد نمونه» نمایش داده می‌شود: بیمه به‌صورت درصدی از ارزش بار با حداقل، و گمرک به‌صورت مبلغ ثابت برای هر اظهارنامه.', 'تظهر الخدمات المطلوبة في الطلب (تأمين البضائع، التخليص الجمركي في المنشأ أو الوجهة، النقل بالشاحنات) كبنود في عرض السعر بعلامة «تقدير عيّنة»: التأمين كنسبة من قيمة البضاعة مع حد أدنى، والجمارك كرسم ثابت لكل بيان.'],
      ['One clear note when a container type falls back to standard GP rates: “Priced using standard GP rates; confirm with the line.”', 'Un único aviso claro cuando un tipo de contenedor usa tarifas GP estándar: «Cotizado con tarifas GP estándar; confírmelo con la naviera».', 'وقتی نوع کانتینر با نرخ استاندارد GP قیمت‌گذاری شود، فقط یک پیام روشن نمایش داده می‌شود: «با نرخ استاندارد GP قیمت‌گذاری شد؛ با خط کشتیرانی تأیید کنید».', 'ملاحظة واحدة واضحة عندما يُسعَّر نوع الحاوية بأسعار GP القياسية: «سُعّر بأسعار GP القياسية؛ أكّد مع الخط الملاحي».'],
      ['The demo is region-neutral: Jebel Ali is the sample home port, with sample UAE phone numbers, AED/USD currencies and a neutral company name. Saved demo data from older versions is refreshed automatically.', 'La demo es neutral: Jebel Ali es el puerto base de ejemplo, con teléfonos de ejemplo de EAU, monedas AED/USD y un nombre de empresa neutro. Los datos de demo guardados de versiones anteriores se renuevan solos.', 'دمو بی‌طرف است: جبل علی بندر نمونه شرکت است، با شماره‌تلفن‌های نمونه امارات، ارزهای AED/USD و نام شرکتی خنثی. داده‌های دموی ذخیره‌شده از نسخه‌های قبلی خودکار تازه می‌شود.', 'العرض التجريبي محايد: جبل علي هو ميناء الشركة النموذجي، مع أرقام هواتف إماراتية نموذجية وعملات AED/USD واسم شركة محايد. تُحدَّث بيانات العرض المحفوظة من الإصدارات السابقة تلقائيًا.'],
      ['Internal notes were removed from the Bookings page and elsewhere.', 'Se quitaron notas internas de la página de Reservas y de otras partes.', 'یادداشت‌های داخلی از صفحه بوکینگ‌ها و بخش‌های دیگر حذف شد.', 'أُزيلت الملاحظات الداخلية من صفحة الحجوزات ومن أماكن أخرى.'],
    ],
    commits: [],
  },
  {
    version: '0.11', date: '2026-11-12',
    title: ['Update the client as the booking moves on', 'Actualizar al cliente cuando avanza la reserva', 'اطلاع به مشتری با پیشرفت بوکینگ', 'تحديث العميل مع تقدّم الحجز'],
    bullets: [
      ['New booking no longer asks for a step: a new booking starts at the first step of its direction.', 'Nueva reserva ya no pide un paso: una reserva nueva empieza en el primer paso de su sentido.', 'فرم بوکینگ جدید دیگر مرحله نمی‌پرسد: بوکینگ جدید از مرحله اول جهت خود شروع می‌شود.', 'لم يعد نموذج الحجز الجديد يطلب خطوة: يبدأ الحجز الجديد من الخطوة الأولى لاتجاهه.'],
      ['In the booking, “Update client” moves it to the next step (or one you pick) and opens the matching client message, ready to send on WhatsApp or from the Inbox. The step timeline stays in view.', 'En la reserva, «Actualizar al cliente» la pasa al siguiente paso (o al que elija) y abre el mensaje para el cliente, listo para enviar por WhatsApp o desde la bandeja. La línea de pasos sigue a la vista.', 'در بوکینگ، «اطلاع به مشتری» آن را به مرحله بعد (یا مرحله دلخواه) می‌برد و پیام مناسب مشتری را باز می‌کند تا از واتساپ یا صندوق پیام بفرستید. خط زمانی مراحل همچنان دیده می‌شود.', 'في الحجز، ينقل «تحديث العميل» الحجز إلى الخطوة التالية (أو التي تختارها) ويفتح رسالة العميل المناسبة، جاهزة للإرسال عبر واتساب أو من صندوق الوارد. يبقى الخط الزمني للخطوات ظاهرًا.'],
      ['Tariffs on phones: one tariff per row, with the name, who sets it, then the amount and unit, nothing overlapping. The table is labelled 2026/27.', 'Tarifas en el móvil: una tarifa por fila, con el nombre, quién la fija y después el importe y la unidad, sin solaparse. La tabla se titula 2026/27.', 'تعرفه‌ها در گوشی: هر تعرفه در یک ردیف، با نام، مرجع تعیین و سپس مبلغ و واحد، بدون هم‌پوشانی. عنوان جدول ۲۰۲۶/۲۷ است.', 'التعرفات على الهاتف: تعرفة واحدة في كل صف، بالاسم والجهة التي تحددها ثم المبلغ والوحدة، دون تداخل. عنوان الجدول ٢٠٢٦/٢٧.'],
      ['The Inbox list fits narrow phone screens, and booking rows wrap instead of cutting text.', 'La lista de la bandeja cabe en pantallas estrechas y las filas de reservas se ajustan en vez de cortar el texto.', 'فهرست صندوق پیام در صفحه‌های باریک گوشی جا می‌شود و ردیف‌های بوکینگ به‌جای بریدن متن، به خط بعد می‌روند.', 'تتسع قائمة صندوق الوارد لشاشات الهاتف الضيقة، وتلتف صفوف الحجوزات بدل قطع النص.'],
      ['If you are on an older copy of the app, a note asks you to reload.', 'Si está usando una copia antigua de la app, un aviso le pide recargar.', 'اگر نسخه قدیمی برنامه باز باشد، پیامی برای بارگذاری دوباره نمایش داده می‌شود.', 'إذا كنت تستخدم نسخة أقدم من التطبيق، يطلب منك تنبيه إعادة التحميل.'],
    ],
    commits: [],
  },
  {
    version: '0.10', date: '2026-11-11',
    title: ['Compare shipping options, export to Excel, Bookings', 'Comparar opciones de envío, exportar a Excel, Reservas', 'مقایسه گزینه‌های حمل، خروجی اکسل، بوکینگ‌ها', 'مقارنة خيارات الشحن والتصدير إلى إكسل والحجوزات'],
    bullets: [
      ['Quote: the shipping options (lines, overseas agents, air and road) are now one comparison table: route and transhipment port, ETD/ETA, transit, frequency, 48 h cut-off, free time, equipment, buy breakdown, buy, sell, margin, validity, rate source, the agent’s history from the CRM and notes.', 'Cotizar: las opciones de envío (navieras, agentes en destino, aéreo y carretera) se ven en una tabla comparativa: ruta y puerto de transbordo, ETD/ETA, tránsito, frecuencia, cut-off de 48 h, free time, equipo, desglose de compra, compra, venta, margen, validez, origen de la tarifa, historial del agente en el CRM y notas.', 'قیمت‌دهی: گزینه‌های حمل (خطوط، نمایندگان خارجی، هوایی و زمینی) اکنون در یک جدول مقایسه‌ای هستند: مسیر و بندر ترانشیپ، ETD/ETA، زمان حمل، تواتر، کات‌آف ۴۸ ساعته، فری‌تایم، تجهیزات، جزئیات خرید، خرید، فروش، سود، اعتبار، منبع نرخ، سابقه نماینده از CRM و یادداشت.', 'عرض السعر: خيارات الشحن (الخطوط والوكلاء في الخارج والجوي والبري) أصبحت في جدول مقارنة واحد: المسار وميناء المسافنة، ETD/ETA، مدة العبور، التكرار، الموعد النهائي خلال ٤٨ ساعة، الفترة المجانية، المعدات، تفاصيل الشراء، الشراء، البيع، الهامش، الصلاحية، مصدر السعر، سجل الوكيل من CRM والملاحظات.'],
      ['Sort by any column, filter (mode, direct only, valid rates only), choose which columns to show (remembered), and see Cheapest, Fastest, Best margin and Longest free time at a glance. Select an option for the quote, or tick 2–4 to compare side by side. On a phone the options show as cards.', 'Ordene por cualquier columna, filtre (modo, solo directos, solo tarifas vigentes), elija qué columnas ver (se recuerda) y vea de un vistazo la más barata, la más rápida, el mejor margen y el mayor free time. Elija una opción para la oferta o marque 2–4 para compararlas. En el móvil las opciones se ven como tarjetas.', 'مرتب‌سازی با هر ستون، فیلتر (نوع حمل، فقط مستقیم، فقط نرخ معتبر)، انتخاب ستون‌های نمایان (به خاطر سپرده می‌شود) و دیدن ارزان‌ترین، سریع‌ترین، بیشترین سود و بیشترین فری‌تایم در یک نگاه. یک گزینه را برای پیشنهاد انتخاب کنید یا ۲ تا ۴ گزینه را کنار هم مقایسه کنید. در گوشی گزینه‌ها به‌صورت کارت نمایش داده می‌شوند.', 'رتّب حسب أي عمود، وصفِّ (نوع الشحن، المباشر فقط، الأسعار السارية فقط)، واختر الأعمدة الظاهرة (تُحفظ)، وشاهد الأرخص والأسرع وأفضل هامش وأطول فترة مجانية بنظرة واحدة. اختر خيارًا للعرض أو حدّد من ٢ إلى ٤ للمقارنة جنبًا إلى جنب. على الهاتف تظهر الخيارات كبطاقات.'],
      ['Export the options to Excel (.xlsx with real numbers, currency formats, a frozen header, filters and a quote-details sheet) or CSV. The export follows your filters, sort and visible columns, or all columns.', 'Exporte las opciones a Excel (.xlsx con números reales, formato de moneda, cabecera fija, filtros y una hoja con los datos de la oferta) o CSV. La exportación sigue sus filtros, orden y columnas visibles, o todas las columnas.', 'خروجی گزینه‌ها به اکسل (.xlsx با عدد واقعی، قالب ارز، سرستون ثابت، فیلتر و برگه جزئیات پیشنهاد) یا CSV. خروجی از فیلتر، ترتیب و ستون‌های نمایان شما پیروی می‌کند، یا همه ستون‌ها.', 'صدّر الخيارات إلى إكسل (.xlsx بأرقام حقيقية وتنسيق العملة ورأس ثابت وفلاتر وورقة لتفاصيل العرض) أو CSV. يتبع التصدير الفلاتر والترتيب والأعمدة الظاهرة، أو كل الأعمدة.'],
      ['“Jobs” are now called “Bookings” everywhere: sidebar, page, drawer, buttons, WhatsApp messages and the inbox.', 'Los «expedientes» ahora se llaman «Reservas» en toda la app: menú, página, panel, botones, mensajes de WhatsApp y bandeja.', '«پرونده‌ها» اکنون در همه جا «بوکینگ‌ها» نام دارند: نوار کناری، صفحه، پنل، دکمه‌ها، پیام‌های واتساپ و صندوق پیام.', 'أصبحت «الشحنات» تُسمّى «الحجوزات» في كل مكان: الشريط الجانبي والصفحة واللوحة والأزرار ورسائل واتساب وصندوق الوارد.'],
      ['Dates are written the same way in every language, with that language’s month names and digits.', 'Las fechas se escriben igual en todos los idiomas, con los nombres de mes y cifras de cada idioma.', 'تاریخ‌ها در همه زبان‌ها یکسان نوشته می‌شوند، با نام ماه‌ها و ارقام همان زبان.', 'تُكتب التواريخ بالطريقة نفسها في كل اللغات، بأسماء الأشهر والأرقام الخاصة بكل لغة.'],
      ['Demo options and rates are SAMPLE figures, not real carrier rates.', 'Las opciones y tarifas de la demo son de MUESTRA, no tarifas reales.', 'گزینه‌ها و نرخ‌های دمو نمونه هستند، نه نرخ واقعی خطوط.', 'خيارات وأسعار العرض التجريبي أرقام عيّنة وليست أسعارًا حقيقية لشركات الشحن.'],
    ],
    commits: ['7c0aedf'],
  },
  {
    version: '0.9', date: '2026-11-11',
    title: ['WhatsApp inbox', 'Bandeja de WhatsApp', 'صندوق پیام واتساپ', 'صندوق وارد واتساب'],
    bullets: [
      ['New Inbox page: two-way WhatsApp conversations with clients and agents, with unread counts and delivery ticks from the statuses WhatsApp reports.', 'Nueva página Bandeja: conversaciones de WhatsApp en ambos sentidos con clientes y agentes, con contador de no leídos y marcas de entrega según los estados que informa WhatsApp.', 'صفحه جدید صندوق پیام: گفت‌وگوی دوطرفه واتساپ با مشتریان و نمایندگان، با شمار پیام‌های خوانده‌نشده و تیک تحویل بر اساس وضعیت گزارش‌شده از واتساپ.', 'صفحة صندوق الوارد الجديدة: محادثات واتساب ثنائية الاتجاه مع العملاء والوكلاء، مع عدد الرسائل غير المقروءة وعلامات التسليم وفق الحالات التي يبلغ عنها واتساب.'],
      ['A 24-hour reply-window indicator; when the window is closed you pick an approved template in the client’s language (EN/ES/FA/AR).', 'Indicador de la ventana de respuesta de 24 horas; con la ventana cerrada se elige una plantilla aprobada en el idioma del cliente (EN/ES/FA/AR).', 'نشانگر پنجره پاسخ ۲۴ ساعته؛ وقتی پنجره بسته است، یک قالب تأییدشده به زبان مشتری (EN/ES/FA/AR) انتخاب می‌کنید.', 'مؤشر لنافذة الرد خلال ٢٤ ساعة؛ وعند إغلاقها تختار قالبًا معتمدًا بلغة العميل (EN/ES/FA/AR).'],
      ['Conversations link to the client or agent by phone number and to a booking by its reference in the message, or by your choice. Attach the booking’s invoice or B/L PDF.', 'Las conversaciones se vinculan al cliente o agente por el número y a una reserva por su referencia en el mensaje, o a su elección. Adjunte el PDF de la factura o del B/L de la reserva.', 'گفت‌وگوها با شماره تلفن به مشتری یا نماینده و با شماره بوکینگ در متن پیام (یا انتخاب شما) به بوکینگ پیوند می‌خورند. PDF فاکتور یا بارنامه بوکینگ را پیوست کنید.', 'ترتبط المحادثات بالعميل أو الوكيل عبر رقم الهاتف، وبالحجز عبر مرجعها في الرسالة أو باختيارك. أرفق ملف PDF للفاتورة أو البوليصة.'],
      ['WhatsApp threads also appear in the booking drawer.', 'Las conversaciones de WhatsApp también aparecen en el panel de la reserva.', 'گفت‌وگوهای واتساپ در پنل بوکینگ هم دیده می‌شوند.', 'تظهر محادثات واتساب أيضًا في لوحة الحجز.'],
      ['The demo shows sample conversations with a mock provider; nothing is sent. Real use needs the ForwardDesk WhatsApp service and an official WhatsApp Business number; until then the WhatsApp buttons keep opening your own WhatsApp.', 'La demo muestra conversaciones de muestra con un proveedor simulado; no se envía nada. Para uso real hace falta el servicio de WhatsApp de ForwardDesk y un número oficial de WhatsApp Business; mientras tanto, los botones de WhatsApp siguen abriendo su propio WhatsApp.', 'دمو گفت‌وگوهای نمونه با ارائه‌دهنده آزمایشی نشان می‌دهد و چیزی ارسال نمی‌شود. استفاده واقعی به سرویس واتساپ ForwardDesk و یک شماره رسمی واتساپ بیزینس نیاز دارد؛ تا آن زمان دکمه‌های واتساپ همچنان واتساپ خودتان را باز می‌کنند.', 'يعرض العرض التجريبي محادثات نموذجية مع مزوّد تجريبي ولا يُرسل شيئًا. يتطلب الاستخدام الفعلي خدمة واتساب من ForwardDesk ورقم واتساب للأعمال رسميًا؛ وحتى ذلك الحين تبقى أزرار واتساب تفتح واتساب الخاص بك.'],
    ],
    commits: [],
  },
  {
    version: '0.8', date: '2026-11-11',
    title: ['WhatsApp messages, English-only screens, What’s new', 'Mensajes de WhatsApp, pantallas sin mezcla de idiomas y Novedades', 'پیام واتساپ، صفحه‌های تک‌زبانه و «تازه‌ها»', 'رسائل واتساب وشاشات بلغة واحدة وصفحة «الجديد»'],
    bullets: [
      ['WhatsApp buttons on the booking, client, agent, invoice and quote screens open your own WhatsApp with the message ready; you press Send.', 'Botones de WhatsApp en reserva, cliente, agente, factura y cotización: abren su propio WhatsApp con el mensaje listo; usted pulsa Enviar.', 'دکمه واتساپ در بوکینگ، مشتری، نماینده، فاکتور و قیمت‌دهی؛ واتساپ خودتان با پیام آماده باز می‌شود و ارسال را خودتان می‌زنید.', 'أزرار واتساب في شاشات الحجز والعميل والوكيل والفاتورة وعرض السعر تفتح واتساب الخاص بك والرسالة جاهزة، ثم تضغط «إرسال».'],
      ['Message templates in the client’s language (EN/ES/FA/AR): free time ending, 48 h cut-off, pay before B/L release, draft B/L, invoice issued, arrival notice, quote sent. You can edit the text first.', 'Plantillas en el idioma del cliente (EN/ES/FA/AR): fin del tiempo libre, cut-off de 48 h, pago antes del B/L, borrador de B/L, factura emitida, aviso de llegada y cotización enviada. Puede editar el texto antes.', 'قالب پیام به زبان مشتری (EN/ES/FA/AR): پایان فری‌تایم، کات‌آف ۴۸ ساعته، پرداخت پیش از بارنامه، درفت بارنامه، صدور فاکتور، آرایوال نوتیس و ارسال قیمت. متن پیش از ارسال قابل ویرایش است.', 'قوالب رسائل بلغة العميل (EN/ES/FA/AR): انتهاء الفترة المجانية، الموعد النهائي خلال ٤٨ ساعة، الدفع قبل الإفراج عن البوليصة، مسودة البوليصة، إصدار فاتورة، إشعار وصول، إرسال عرض سعر. يمكنك تعديل النص أولًا.'],
      ['Each opened message is logged on the booking, client or agent as “opened in WhatsApp” (delivery cannot be confirmed).', 'Cada mensaje abierto queda registrado en la reserva, cliente o agente como «abierto en WhatsApp» (la entrega no se puede confirmar).', 'هر پیام باز شده روی بوکینگ، مشتری یا نماینده با عنوان «باز شده در واتساپ» ثبت می‌شود (تحویل قابل تأیید نیست).', 'تُسجَّل كل رسالة مفتوحة على الحجز أو العميل أو الوكيل بعبارة «فُتح في واتساب» (لا يمكن تأكيد التسليم).'],
      ['WhatsApp number fields with a country-code picker for clients, contacts and agents.', 'Campos de número de WhatsApp con selector de prefijo para clientes, contactos y agentes.', 'فیلد شماره واتساپ با انتخاب کد کشور برای مشتریان، مخاطبان و نمایندگان.', 'حقول رقم واتساب مع اختيار رمز الدولة للعملاء وجهات الاتصال والوكلاء.'],
      ['Persian terms now appear only when the app is in Persian.', 'Los términos en persa solo aparecen cuando la app está en persa.', 'اصطلاحات فارسی فقط وقتی برنامه فارسی است نمایش داده می‌شوند.', 'لم تعد المصطلحات الفارسية تظهر إلا عندما تكون الواجهة بالفارسية.'],
      ['This “What’s new” page.', 'Esta página de «Novedades».', 'همین صفحه «تازه‌ها».', 'صفحة «الجديد» هذه.'],
    ],
    commits: ['9ebb314'],
  },
  {
    version: '0.7', date: '2026-11-11',
    title: ['Arabic', 'Árabe', 'زبان عربی', 'اللغة العربية'],
    bullets: [
      ['The app now speaks English, Spanish, Persian and Arabic: Arabic is the fourth language, with Arabic-Indic digits and an Arabic font.', 'La app ya está en inglés, español, persa y árabe: el árabe es el cuarto idioma, con cifras arábigo-índicas y fuente árabe.', 'برنامه اکنون به انگلیسی، اسپانیایی، فارسی و عربی است؛ عربی چهارمین زبان است، با ارقام عربی و قلم عربی.', 'التطبيق متاح الآن بالإنجليزية والإسبانية والفارسية والعربية: العربية هي اللغة الرابعة، بأرقام عربية هندية وخط عربي.'],
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
      ['Per-booking House B/L, arrival notice, delivery order and booking confirmation as PDF; release blocked until paid.', 'House B/L, aviso de llegada, orden de entrega y confirmación de reserva en PDF por reserva; liberación bloqueada hasta el pago.', 'بارنامه هاوس، آرایوال نوتیس، ترخیصیه و تأیید بوکینگ به‌صورت PDF برای هر بوکینگ؛ صدور تا پرداخت متوقف است.', 'بوليصة الشحن الفرعية وإشعار الوصول وإذن التسليم وتأكيد الحجز بصيغة PDF لكل حجز؛ الإفراج محجوب حتى الدفع.'],
      ['Charges, invoices, vendor bills, payments, manual exchange rates and booking profit; a Finance page with ageing and balance by client.', 'Cargos, facturas, facturas de proveedores, cobros, tipos de cambio manuales y beneficio por reserva; página de Finanzas con antigüedad y saldo por cliente.', 'هزینه‌ها، فاکتورها، صورتحساب تأمین‌کنندگان، پرداخت‌ها، نرخ ارز دستی و سود بوکینگ؛ صفحه مالی با سنی‌بندی و مانده هر مشتری.', 'الرسوم والفواتير وفواتير الموردين والمدفوعات وأسعار الصرف اليدوية وربح الحجز؛ صفحة مالية بأعمار الديون والرصيد لكل عميل.'],
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
    title: ['Bookings, deadline tracker and clients', 'Reservas, seguimiento de plazos y clientes', 'بوکینگ‌ها، ردیاب مهلت‌ها و مشتریان', 'الحجوزات ومتتبّع المواعيد والعملاء'],
    bullets: [
      ['Bookings page with every export and import step, a deadline tracker for free time, 48 h cut-off and demurrage, and money at risk.', 'Página de reservas con cada paso de exportación e importación, seguimiento de tiempo libre, cut-off de 48 h y demora, y dinero en riesgo.', 'صفحه بوکینگ‌ها با همه مراحل صادرات و واردات، ردیاب فری‌تایم، کات‌آف ۴۸ ساعته و حق توقف، و پول در خطر.', 'صفحة الحجوزات بكل خطوات التصدير والاستيراد، ومتتبّع للفترة المجانية والموعد النهائي خلال ٤٨ ساعة وغرامات التأخير، والأموال المعرّضة للخطر.'],
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
