// Template registry for WhatsApp utility alerts. Single source for the server AND the ForwardDesk app
// (the app imports this file), so keep it free of Node imports.
// Each template is submitted to Meta (or via 360dialog) for approval as category UTILITY, one per language.
// Rules followed: lowercase snake_case names, numbered {{n}} body variables, no variable at the very start or end,
// an example value for every variable, no promotional wording.
// FA and AR wording needs review by a native speaker before submission.

export type TplLang = 'en' | 'es' | 'fa' | 'ar';
export const TPL_LANGS: TplLang[] = ['en', 'es', 'fa', 'ar'];
export type WaTemplateKey = 'freeTime' | 'cutoff48' | 'payBeforeBl' | 'draftBl' | 'invoiceIssued' | 'arrival';

export interface WaTemplate {
  key: WaTemplateKey;
  /** Name registered with Meta (same name for every language). */
  name: string;
  category: 'UTILITY';
  /** Optional document header (lets a PDF go out with the template, even outside the 24 h window). */
  header?: 'document';
  /** Variable names in {{1}}, {{2}}, ... order (used by the app to fill them from the job). */
  params: string[];
  example: string[];
  body: Record<TplLang, string>;
  label: Record<TplLang, string>;
}

export const WA_TEMPLATES: WaTemplate[] = [
  {
    key: 'freeTime', name: 'fd_free_time_ending', category: 'UTILITY',
    params: ['name', 'containers', 'job', 'freeEnd'],
    example: ['Ana', 'MSKU1234567', 'FD-E-1042', '14 Nov'],
    label: { en: 'Free time ending', es: 'Fin del tiempo libre', fa: 'پایان فری‌تایم', ar: 'انتهاء الفترة المجانية' },
    body: {
      en: 'Hello {{1}}, free time for container(s) {{2}} on shipment {{3}} ends on {{4}}. Please arrange collection or return in time to avoid demurrage charges.',
      es: 'Hola {{1}}, el tiempo libre del contenedor o contenedores {{2}} del envío {{3}} termina el {{4}}. Organice la recogida o devolución a tiempo para evitar cargos por demora.',
      fa: 'سلام {{1}}، فری‌تایم کانتینر(های) {{2}} در محموله {{3}} در تاریخ {{4}} تمام می‌شود. لطفاً برای جلوگیری از هزینه دموراژ، تخلیه یا عودت را به‌موقع انجام دهید.',
      ar: 'مرحبًا {{1}}، تنتهي الفترة المجانية للحاوية أو الحاويات {{2}} في الشحنة {{3}} بتاريخ {{4}}. يُرجى ترتيب الاستلام أو الإرجاع في الوقت المناسب لتجنّب رسوم التأخير.',
    },
  },
  {
    key: 'cutoff48', name: 'fd_cutoff_reminder', category: 'UTILITY',
    params: ['job', 'vessel', 'cutoff'],
    example: ['FD-E-1042', 'SAMPLE VESSEL', '12 Nov 14:00'],
    label: { en: 'Cut-off reminder (48 h)', es: 'Recordatorio de cut-off (48 h)', fa: 'یادآوری کات‌آف (۴۸ ساعت)', ar: 'تذكير بالموعد النهائي (٤٨ ساعة)' },
    body: {
      en: 'Reminder for shipment {{1}}: the document cut-off for vessel {{2}} is {{3}}. Please send the shipping instructions and any missing documents before then.',
      es: 'Recordatorio del envío {{1}}: el cut-off documental del buque {{2}} es el {{3}}. Envíe las instrucciones de embarque y los documentos pendientes antes de esa hora.',
      fa: 'یادآوری محموله {{1}}: کات‌آف اسناد کشتی {{2}} در {{3}} است. لطفاً دستور حمل و مدارک باقی‌مانده را پیش از آن ارسال کنید.',
      ar: 'تذكير بالشحنة {{1}}: الموعد النهائي لمستندات السفينة {{2}} هو {{3}}. يُرجى إرسال تعليمات الشحن وأي مستندات ناقصة قبل ذلك.',
    },
  },
  {
    key: 'payBeforeBl', name: 'fd_payment_before_bl', category: 'UTILITY',
    params: ['job', 'amount'],
    example: ['FD-E-1042', 'USD 1,420'],
    label: { en: 'Pay before B/L release', es: 'Pago antes de liberar el B/L', fa: 'پرداخت پیش از صدور بارنامه', ar: 'الدفع قبل الإفراج عن البوليصة' },
    body: {
      en: 'Shipment {{1}}: the original B/L will be released once payment of {{2}} is received. Please share the payment confirmation when done.',
      es: 'Envío {{1}}: el B/L original se liberará cuando recibamos el pago de {{2}}. Envíenos el justificante de pago cuando lo haya realizado.',
      fa: 'محموله {{1}}: بارنامه اصلی پس از دریافت مبلغ {{2}} صادر می‌شود. لطفاً پس از پرداخت، رسید آن را ارسال کنید.',
      ar: 'الشحنة {{1}}: سيتم الإفراج عن البوليصة الأصلية فور استلام دفعة بقيمة {{2}}. يُرجى إرسال تأكيد الدفع بعد إتمامه.',
    },
  },
  {
    key: 'draftBl', name: 'fd_bl_draft_ready', category: 'UTILITY', header: 'document',
    params: ['job', 'due'],
    example: ['FD-E-1042', '13 Nov'],
    label: { en: 'Draft B/L ready', es: 'Borrador de B/L listo', fa: 'پیش‌نویس بارنامه آماده است', ar: 'مسودة البوليصة جاهزة' },
    body: {
      en: 'The draft B/L for shipment {{1}} is ready. Please review it and confirm or send corrections by {{2}}.',
      es: 'El borrador del B/L del envío {{1}} está listo. Revíselo y confírmelo o envíe correcciones antes del {{2}}.',
      fa: 'پیش‌نویس بارنامه محموله {{1}} آماده است. لطفاً آن را بررسی کنید و تا {{2}} تأیید یا اصلاحات را ارسال کنید.',
      ar: 'مسودة البوليصة للشحنة {{1}} جاهزة. يُرجى مراجعتها وتأكيدها أو إرسال التصحيحات قبل {{2}}.',
    },
  },
  {
    key: 'invoiceIssued', name: 'fd_invoice_issued', category: 'UTILITY', header: 'document',
    params: ['invoiceNo', 'job', 'amount', 'due'],
    example: ['INV-1042', 'FD-E-1042', 'USD 1,420', '20 Nov'],
    label: { en: 'Invoice issued', es: 'Factura emitida', fa: 'صدور فاکتور', ar: 'إصدار فاتورة' },
    body: {
      en: 'Invoice {{1}} for shipment {{2}} has been issued for {{3}}, due on {{4}}. Thank you.',
      es: 'Se ha emitido la factura {{1}} del envío {{2}} por {{3}}, con vencimiento el {{4}}. Gracias.',
      fa: 'فاکتور {{1}} برای محموله {{2}} به مبلغ {{3}} با سررسید {{4}} صادر شد. سپاس.',
      ar: 'صدرت الفاتورة {{1}} للشحنة {{2}} بقيمة {{3}} وتستحق في {{4}}. شكرًا لكم.',
    },
  },
  {
    key: 'arrival', name: 'fd_arrival_notice', category: 'UTILITY',
    params: ['job', 'vessel', 'pod', 'eta'],
    example: ['FD-I-0877', 'SAMPLE VESSEL', 'Port Two', '18 Nov'],
    label: { en: 'Arrival notice', es: 'Aviso de llegada', fa: 'اعلام ورود کالا', ar: 'إشعار وصول' },
    body: {
      en: 'Arrival notice for shipment {{1}}: vessel {{2}} is expected at {{3}} on {{4}}. Please prepare the documents needed for customs clearance.',
      es: 'Aviso de llegada del envío {{1}}: el buque {{2}} llegará a {{3}} el {{4}}. Prepare los documentos necesarios para el despacho de aduanas.',
      fa: 'اعلام ورود محموله {{1}}: کشتی {{2}} به {{3}} در تاریخ {{4}} می‌رسد. لطفاً مدارک لازم برای ترخیص را آماده کنید.',
      ar: 'إشعار وصول للشحنة {{1}}: من المتوقع وصول السفينة {{2}} إلى {{3}} في {{4}}. يُرجى تجهيز المستندات اللازمة للتخليص الجمركي.',
    },
  },
];

export const tplByKey = (k: string) => WA_TEMPLATES.find((t) => t.key === k);

/** Text of a template with its variables filled (for previews and for the stored copy of a sent message). */
export function renderTemplate(t: WaTemplate, lang: TplLang, values: string[]): string {
  return t.body[lang].replace(/\{\{(\d+)\}\}/g, (_, n) => values[Number(n) - 1] ?? `{{${n}}}`);
}

/** Cloud API "template" message object (Meta and 360dialog use the same shape). */
export function templateMessage(t: WaTemplate, lang: TplLang, values: string[], headerDocument?: { id: string; filename: string }) {
  if (values.length !== t.params.length) throw new Error(`template ${t.name} needs ${t.params.length} values, got ${values.length}`);
  if (values.some((v) => !String(v).trim())) throw new Error(`template ${t.name}: empty variable`);
  const components: unknown[] = [];
  if (t.header === 'document' && headerDocument) components.push({ type: 'header', parameters: [{ type: 'document', document: { id: headerDocument.id, filename: headerDocument.filename } }] });
  components.push({ type: 'body', parameters: values.map((v) => ({ type: 'text', text: String(v).replace(/[\n\t]+/g, ' ').replace(/ {5,}/g, '    ') })) });
  return { name: t.name, language: { code: lang }, components };
}

/** Payloads for Meta's POST /{WABA_ID}/message_templates (one per template and language). */
export function metaSubmissions() {
  const out: unknown[] = [];
  for (const t of WA_TEMPLATES) for (const lang of TPL_LANGS) {
    const components: unknown[] = [];
    if (t.header === 'document') components.push({ type: 'HEADER', format: 'DOCUMENT', example: { header_handle: ['<upload a sample PDF via the Resumable Upload API and put its handle here>'] } });
    components.push({ type: 'BODY', text: t.body[lang], example: { body_text: [t.example] } });
    out.push({ name: t.name, language: lang, category: t.category, components });
  }
  return out;
}
