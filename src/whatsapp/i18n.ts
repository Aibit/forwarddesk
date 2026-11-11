import type { UiLang } from '../ui/lang';

const T = {
  wa: ['WhatsApp', 'WhatsApp', 'واتساپ', 'واتساب'],
  waTo: ['WhatsApp to', 'WhatsApp a', 'واتساپ به', 'واتساب إلى'],
  title: ['Message on WhatsApp', 'Mensaje por WhatsApp', 'پیام در واتساپ', 'رسالة عبر واتساب'],
  to: ['To', 'Para', 'گیرنده', 'إلى'],
  template: ['Template', 'Plantilla', 'قالب', 'القالب'],
  msgLang: ['Message language', 'Idioma del mensaje', 'زبان پیام', 'لغة الرسالة'],
  recipLang: ['recipient’s language', 'idioma del destinatario', 'زبان گیرنده', 'لغة المستلم'],
  message: ['Message (edit before opening)', 'Mensaje (puede editarlo antes de abrir)', 'متن پیام (پیش از باز کردن قابل ویرایش است)', 'نص الرسالة (يمكن تعديله قبل الفتح)'],
  open: ['Open in WhatsApp', 'Abrir en WhatsApp', 'باز کردن در واتساپ', 'فتح في واتساب'],
  copy: ['Copy text', 'Copiar texto', 'کپی متن', 'نسخ النص'],
  copied: ['Copied', 'Copiado', 'کپی شد', 'تم النسخ'],
  cancel: ['Cancel', 'Cancelar', 'انصراف', 'إلغاء'],
  how: [
    'Opens your own WhatsApp (phone app, WhatsApp Desktop or WhatsApp Web) with this text ready. You press Send there. ForwardDesk logs it as “opened in WhatsApp”; it cannot see whether the message was sent or delivered.',
    'Abre su propio WhatsApp (app del móvil, WhatsApp Desktop o WhatsApp Web) con este texto listo. Usted pulsa Enviar allí. ForwardDesk lo registra como «abierto en WhatsApp»; no puede ver si el mensaje se envió o se entregó.',
    'واتساپ خودتان (اپ گوشی، واتساپ دسکتاپ یا واتساپ وب) با همین متن باز می‌شود و ارسال را خودتان می‌زنید. ForwardDesk آن را «باز شده در واتساپ» ثبت می‌کند و نمی‌تواند ببیند پیام ارسال یا تحویل شده است یا نه.',
    'يفتح واتساب الخاص بك (تطبيق الهاتف أو واتساب لسطح المكتب أو واتساب ويب) والنص جاهز، ثم تضغط «إرسال» بنفسك. يسجّل ForwardDesk ذلك على أنه «فُتح في واتساب»، ولا يمكنه معرفة ما إذا أُرسلت الرسالة أو وصلت.',
  ],
  noNumber: ['No WhatsApp number in international format (+ country code). Add it to the contact first.', 'Sin número de WhatsApp en formato internacional (+ prefijo del país). Añádalo primero al contacto.', 'شماره واتساپ با فرمت بین‌المللی (+ کد کشور) ثبت نشده است. ابتدا آن را برای مخاطب وارد کنید.', 'لا يوجد رقم واتساب بالصيغة الدولية (+ رمز الدولة). أضفه إلى جهة الاتصال أولًا.'],
  noRecipients: ['No contact with a phone or WhatsApp number yet.', 'Todavía no hay ningún contacto con teléfono o WhatsApp.', 'هنوز مخاطبی با شماره تلفن یا واتساپ ثبت نشده است.', 'لا توجد بعد جهة اتصال لديها رقم هاتف أو واتساب.'],
  needsData: ['no data for this yet', 'sin datos todavía', 'هنوز داده‌ای ندارد', 'لا توجد بيانات بعد'],
  log: ['WhatsApp log', 'Registro de WhatsApp', 'سوابق واتساپ', 'سجل واتساب'],
  logNote: ['Opened in WhatsApp by staff. Delivery is not confirmed.', 'Abierto en WhatsApp por el equipo. La entrega no está confirmada.', 'توسط همکاران در واتساپ باز شده است. تحویل پیام تأیید نشده است.', 'فتحه الفريق في واتساب. لم يتم تأكيد التسليم.'],
  opened: ['Opened in WhatsApp', 'Abierto en WhatsApp', 'باز شده در واتساپ', 'فُتح في واتساب'],
  openedTo: ['WhatsApp opened to', 'WhatsApp abierto para', 'واتساپ باز شد برای', 'فُتح واتساب إلى'],
  withTpl: ['template', 'plantilla', 'قالب', 'القالب'],
  noLog: ['Nothing opened in WhatsApp yet.', 'Todavía no se ha abierto nada en WhatsApp.', 'هنوز پیامی در واتساپ باز نشده است.', 'لم يُفتح شيء في واتساب بعد.'],
  showText: ['Text', 'Texto', 'متن', 'النص'],
  // recipients
  rContact: ['Client contact', 'Contacto del cliente', 'مخاطب مشتری', 'جهة اتصال العميل'],
  rBroker: ['Customs broker', 'Agente de aduanas', 'ترخیص‌کار', 'المخلّص الجمركي'],
  rOffice: ['Port office contact', 'Contacto en la oficina del puerto', 'مخاطب دفتر بندر', 'جهة الاتصال في مكتب الميناء'],
  rAgent: ['Overseas agent', 'Agente en destino/origen', 'نماینده خارجی', 'الوكيل الخارجي'],
  rGeneral: ['General number', 'Número general', 'شماره عمومی', 'الرقم العام'],
  // phone field
  waNumber: ['WhatsApp number', 'Número de WhatsApp', 'شماره واتساپ', 'رقم واتساب'],
  sameAsPhone: ['Empty = same as the phone number', 'Vacío = igual que el teléfono', 'خالی = همان شماره تلفن', 'فارغ = نفس رقم الهاتف'],
  badPhone: ['Use international format: + country code and number', 'Use el formato internacional: + prefijo del país y número', 'از فرمت بین‌المللی استفاده کنید: + کد کشور و شماره', 'استخدم الصيغة الدولية: + رمز الدولة ثم الرقم'],
  otherCode: ['Other (+code)', 'Otro (+prefijo)', 'سایر (+کد)', 'أخرى (+رمز)'],
  countryCode: ['Country code', 'Prefijo del país', 'کد کشور', 'رمز الدولة'],
  // settings placeholder
  inboxH: ['WhatsApp inbox (coming soon)', 'Bandeja de WhatsApp (próximamente)', 'صندوق واتساپ (به‌زودی)', 'صندوق واتساب (قريبًا)'],
  inboxP: [
    'Today ForwardDesk opens messages in your own WhatsApp and logs them on the job, client or agent. Planned next: a two-way WhatsApp inbox through an official WhatsApp Business provider, so client replies appear on the job. It will start with Gulf and EU business numbers.',
    'Hoy ForwardDesk abre los mensajes en su propio WhatsApp y los registra en el expediente, el cliente o el agente. Próximo paso: una bandeja de WhatsApp bidireccional a través de un proveedor oficial de WhatsApp Business, para que las respuestas del cliente aparezcan en el expediente. Empezará con números de empresa del Golfo y de la UE.',
    'ForwardDesk امروز پیام‌ها را در واتساپ خودتان باز می‌کند و آن‌ها را روی پرونده، مشتری یا نماینده ثبت می‌کند. گام بعدی: صندوق دوطرفه واتساپ از طریق یک ارائه‌دهنده رسمی WhatsApp Business تا پاسخ مشتری روی پرونده دیده شود. شروع آن با شماره‌های تجاری کشورهای خلیج فارس و اتحادیه اروپا خواهد بود.',
    'يفتح ForwardDesk اليوم الرسائل في واتساب الخاص بك ويسجّلها على الشحنة أو العميل أو الوكيل. الخطوة التالية: صندوق واتساب ثنائي الاتجاه عبر مزوّد رسمي لـ WhatsApp Business، لتظهر ردود العملاء على الشحنة. سيبدأ مع أرقام الأعمال في دول الخليج والاتحاد الأوروبي.',
  ],
  soon: ['Coming soon', 'Próximamente', 'به‌زودی', 'قريبًا'],
} satisfies Record<string, [string, string, string, string]>;
export type WKey = keyof typeof T;
const LI: Record<UiLang, 0 | 1 | 2 | 3> = { en: 0, es: 1, fa: 2, ar: 3 };
export const wt = (lang: UiLang, k: WKey) => T[k][LI[lang]] ?? T[k][0];
export const W_STRINGS = T;
