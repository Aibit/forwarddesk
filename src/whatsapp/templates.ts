// WhatsApp message templates, filled from job / invoice / quote data, in the recipient's language.
// Wording: professional, short, one ask per message. FA and AR wording was written in-house:
// have a native speaker review it before regular use.
import type { UiLang } from '../ui/lang';
import { stepDef, stepIndex, stepsFor } from '../jobs/steps';
export type WaLang = UiLang;
export type TplKey = 'stepUpdate' | 'freeTime' | 'cutoff48' | 'payBeforeBl' | 'draftBl' | 'invoiceIssued' | 'arrival' | 'quoteSent' | 'general';
export const JOB_TPLS: TplKey[] = ['stepUpdate', 'freeTime', 'cutoff48', 'payBeforeBl', 'draftBl', 'invoiceIssued', 'arrival', 'general'];
export const ALL_TPLS: TplKey[] = ['stepUpdate', 'freeTime', 'cutoff48', 'payBeforeBl', 'draftBl', 'invoiceIssued', 'arrival', 'quoteSent', 'general'];

export interface TplCtx {
  name?: string;
  company?: string;
  job?: string;
  route?: string;
  dir?: 'export' | 'import';
  vessel?: string;
  pod?: string;
  containers?: string[];
  /** end of free time (ms) */
  freeEnd?: number | null;
  cutoff?: number | null;
  eta?: number | null;
  amount?: number | null;
  currency?: string;
  invoiceNo?: string;
  /** invoice total (invoice issued); `amount` is the open balance */
  invoiceAmount?: number | null;
  due?: number | null;
  release?: 'hbl' | 'do';
  quoteText?: string;
  quoteRef?: string;
  /** booking step code (E1–E23 / I1–I16) for the booking update message */
  step?: string;
  now?: number;
}

/** Template names, shown in the staff member's UI language. */
export const TPL_NAME: Record<TplKey, [string, string, string, string]> = {
  stepUpdate: ['Booking update (step)', 'Novedades de la reserva (paso)', 'به‌روزرسانی بوکینگ (مرحله)', 'تحديث الحجز (المرحلة)'],
  freeTime: ['Free time ending', 'Fin del tiempo libre', 'پایان فری‌تایم', 'انتهاء الفترة المجانية'],
  cutoff48: ['Cut-off reminder (48 h)', 'Recordatorio de cut-off (48 h)', 'یادآوری کات‌آف (۴۸ ساعت)', 'تذكير بالموعد النهائي (٤٨ ساعة)'],
  payBeforeBl: ['Pay before B/L release', 'Pago antes de liberar el B/L', 'پرداخت پیش از صدور بارنامه', 'الدفع قبل الإفراج عن بوليصة الشحن'],
  draftBl: ['Draft B/L ready for approval', 'Borrador de B/L listo para aprobar', 'درفت بارنامه آماده تأیید', 'مسودة بوليصة الشحن جاهزة للموافقة'],
  invoiceIssued: ['Invoice issued', 'Factura emitida', 'صدور فاکتور', 'إصدار فاتورة'],
  arrival: ['Arrival notice', 'Aviso de llegada', 'آرایوال نوتیس', 'إشعار وصول'],
  quoteSent: ['Quote sent', 'Cotización enviada', 'ارسال پیشنهاد قیمت', 'إرسال عرض السعر'],
  general: ['Blank message', 'Mensaje en blanco', 'پیام خالی', 'رسالة فارغة'],
};
const LI: Record<WaLang, 0 | 1 | 2 | 3> = { en: 0, es: 1, fa: 2, ar: 3 };
export const tplName = (k: TplKey, lang: WaLang) => TPL_NAME[k][LI[lang]] ?? TPL_NAME[k][0];

const LOC: Record<WaLang, string> = { en: 'en-GB', es: 'es-ES', fa: 'fa-IR-u-ca-gregory', ar: 'ar-EG' };
const nf = (lang: WaLang, n: number, max = 0) => new Intl.NumberFormat(LOC[lang], { maximumFractionDigits: max, minimumFractionDigits: 0 }).format(n);
const day = (lang: WaLang, ms: number) => new Date(ms).toLocaleDateString(LOC[lang], { day: 'numeric', month: 'long' });
const when = (lang: WaLang, ms: number) => new Date(ms).toLocaleString(LOC[lang], { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
export function waMoney(lang: WaLang, n: number, ccy = 'USD') {
  const s = nf(lang, n, 2);
  return lang === 'fa' || lang === 'ar' ? `${s} ${ccy}` : `${ccy} ${s}`;
}
function daysText(lang: WaLang, n: number): string {
  if (lang === 'en') return n === 0 ? 'less than a day' : `${n} ${n === 1 ? 'day' : 'days'}`;
  if (lang === 'es') return n === 0 ? 'menos de un día' : `${n} ${n === 1 ? 'día' : 'días'}`;
  if (lang === 'fa') return n === 0 ? 'کمتر از یک روز' : `${nf('fa', n)} روز`;
  if (n === 0) return 'أقل من يوم';
  if (n === 1) return 'يوم واحد';
  if (n === 2) return 'يومين';
  return `${nf('ar', n)} ${n <= 10 ? 'أيام' : 'يومًا'}`;
}
const RELEASE: Record<WaLang, Record<'hbl' | 'do', string>> = {
  en: { hbl: 'the original B/L', do: 'the delivery order' },
  es: { hbl: 'el B/L original', do: 'la orden de entrega' },
  fa: { hbl: 'اصل بارنامه', do: 'ترخیصیه (دی‌او)' },
  ar: { hbl: 'بوليصة الشحن الأصلية', do: 'إذن التسليم' },
};

/** Which data a template needs; templates without it are shown but disabled. */
export function tplReady(k: TplKey, c: TplCtx): boolean {
  switch (k) {
    case 'freeTime': return !!c.containers?.length && c.freeEnd != null;
    case 'cutoff48': return c.cutoff != null;
    case 'payBeforeBl': return (c.amount ?? 0) > 0.005;
    case 'draftBl': return !!c.job;
    case 'invoiceIssued': return !!c.invoiceNo && (c.invoiceAmount ?? c.amount) != null;
    case 'arrival': return c.eta != null && !!c.vessel;
    case 'quoteSent': return !!c.quoteText;
    case 'stepUpdate': return !!c.step && !!stepDef(c.step);
    default: return true;
  }
}

/** The filled message text. Never leaves "{placeholders}" behind. */
export function fillTpl(k: TplKey, lang: WaLang, c: TplCtx): string {
  const now = c.now ?? Date.now();
  const name = (c.name ?? '').trim();
  const co = (c.company ?? '').trim();
  const job = c.job ?? '';
  const route = c.route ? ` (${c.route})` : '';
  const cn = (c.containers ?? []).join(', ');
  const left = c.freeEnd != null ? Math.max(0, Math.floor((c.freeEnd - now) / 86400000)) : 0;
  const fe = c.freeEnd != null ? day(lang, c.freeEnd) : '';
  const amt = c.amount != null ? waMoney(lang, c.amount, c.currency) : '';
  const invAmt = (c.invoiceAmount ?? c.amount) != null ? waMoney(lang, (c.invoiceAmount ?? c.amount)!, c.currency) : '';
  const rel = RELEASE[lang][c.release ?? 'hbl'];
  const ref = c.quoteRef ? ` ${c.quoteRef}` : '';
  const exp = c.dir === 'export';
  const hi = { en: name ? `Hello ${name},` : 'Hello,', es: name ? `Hola, ${name}:` : 'Hola:', fa: name ? `${name} گرامی، سلام.` : 'سلام،', ar: name ? `مرحبًا ${name}،` : 'مرحبًا،' }[lang];
  const bye = { en: 'Best regards,', es: 'Saludos cordiales,', fa: 'با احترام،', ar: 'مع خالص التحية،' }[lang] + (co ? `\n${co}` : '');
  const body: Record<TplKey, Record<WaLang, string>> = {
    freeTime: {
      en: `Booking ${job}${route}: free time for container(s) ${cn} ends in ${daysText(lang, left)}, on ${fe}.\n${exp ? `Please make sure the container(s) are at the terminal for loading by ${fe} to avoid demurrage charges.` : `Please return the empty container(s) by ${fe} to avoid demurrage charges.`}`,
      es: `Reserva ${job}${route}: el tiempo libre de los contenedores ${cn} termina en ${daysText(lang, left)}, el ${fe}.\n${exp ? `Por favor, asegúrense de que los contenedores estén en la terminal para la carga antes del ${fe} para evitar cargos de demora.` : `Por favor, devuelvan los contenedores vacíos antes del ${fe} para evitar cargos de demora.`}`,
      fa: `بوکینگ ${job}${route}: فری‌تایم کانتینر(های) ${cn} تا ${daysText(lang, left)} دیگر، در تاریخ ${fe}، تمام می‌شود.\n${exp ? `لطفاً تا ${fe} کانتینر(ها) را برای بارگیری به ترمینال برسانید تا مشمول حق توقف (دموراژ) نشوید.` : `لطفاً کانتینر(های) خالی را تا ${fe} عودت دهید تا مشمول حق توقف (دموراژ) نشوید.`}`,
      ar: `الحجز ${job}${route}: تنتهي الفترة المجانية للحاوية/الحاويات ${cn} خلال ${daysText(lang, left)}، في ${fe}.\n${exp ? `يُرجى التأكد من وصول الحاويات إلى المحطة للتحميل قبل ${fe} لتجنّب غرامات التأخير.` : `يُرجى إعادة الحاويات الفارغة قبل ${fe} لتجنّب غرامات التأخير.`}`,
    },
    cutoff48: {
      en: `Reminder for booking ${job}${route}: the document cut-off for vessel ${c.vessel ?? ''} is ${c.cutoff != null ? when(lang, c.cutoff) : ''}, within the next 48 hours.\nPlease send any outstanding documents (shipping instructions, VGM, export declaration) before then.`,
      es: `Recordatorio de la reserva ${job}${route}: el cut-off documental del buque ${c.vessel ?? ''} es el ${c.cutoff != null ? when(lang, c.cutoff) : ''}, dentro de las próximas 48 horas.\nPor favor, envíen la documentación pendiente (instrucciones de embarque, VGM, declaración de exportación) antes de esa hora.`,
      fa: `یادآوری بوکینگ ${job}${route}: کات‌آف مدارک کشتی ${c.vessel ?? ''} در ${c.cutoff != null ? when(lang, c.cutoff) : ''} است (کمتر از ۴۸ ساعت دیگر).\nلطفاً مدارک باقی‌مانده (دستور حمل، VGM، اظهارنامه صادراتی) را پیش از آن ارسال کنید.`,
      ar: `تذكير بخصوص الحجز ${job}${route}: الموعد النهائي لتسليم المستندات للسفينة ${c.vessel ?? ''} هو ${c.cutoff != null ? when(lang, c.cutoff) : ''}، أي خلال الـ٤٨ ساعة القادمة.\nيُرجى إرسال المستندات المتبقية (تعليمات الشحن، VGM، بيان التصدير الجمركي) قبل ذلك.`,
    },
    payBeforeBl: {
      en: `Booking ${job}${route}: ${c.invoiceNo ? `invoice ${c.invoiceNo} has` : 'there is'} an open balance of ${amt}.\nWe will release ${rel} as soon as payment is received.`,
      es: `Reserva ${job}${route}: ${c.invoiceNo ? `la factura ${c.invoiceNo} tiene` : 'hay'} un saldo pendiente de ${amt}.\nLiberaremos ${rel} en cuanto recibamos el pago.`,
      fa: `بوکینگ ${job}${route}: ${c.invoiceNo ? `مانده فاکتور ${c.invoiceNo}` : 'مانده حساب'} به مبلغ ${amt} هنوز پرداخت نشده است.\nپس از دریافت وجه، ${rel} بلافاصله صادر می‌شود.`,
      ar: `الحجز ${job}${route}: يوجد رصيد مستحق${c.invoiceNo ? ` على الفاتورة ${c.invoiceNo}` : ''} بقيمة ${amt}.\nسنُفرج عن ${rel} فور استلام الدفعة.`,
    },
    draftBl: {
      en: `The draft B/L for booking ${job}${route} is ready for your approval.\nPlease check all details and reply with your approval or any corrections.`,
      es: `El borrador del B/L de la reserva ${job}${route} está listo para su aprobación.\nPor favor, revisen todos los datos y respondan con su aprobación o las correcciones necesarias.`,
      fa: `درفت بارنامه بوکینگ ${job}${route} برای تأیید شما آماده است.\nلطفاً همه مشخصات را بررسی کنید و تأیید یا اصلاحات را اعلام فرمایید.`,
      ar: `مسودة بوليصة الشحن للحجز ${job}${route} جاهزة لموافقتكم.\nيُرجى مراجعة جميع البيانات والرد بالموافقة أو بالتعديلات المطلوبة.`,
    },
    invoiceIssued: {
      en: `We have issued invoice ${c.invoiceNo ?? ''} for booking ${job}: ${invAmt}${c.due != null ? `, due ${day(lang, c.due)}` : ''}.\nThank you for your business.`,
      es: `Hemos emitido la factura ${c.invoiceNo ?? ''} de la reserva ${job}: ${invAmt}${c.due != null ? `, con vencimiento el ${day(lang, c.due)}` : ''}.\nGracias por su confianza.`,
      fa: `فاکتور ${c.invoiceNo ?? ''} برای بوکینگ ${job} صادر شد: مبلغ ${invAmt}${c.due != null ? `، سررسید ${day(lang, c.due)}` : ''}.\nاز همکاری شما سپاسگزاریم.`,
      ar: `أصدرنا الفاتورة ${c.invoiceNo ?? ''} للحجز ${job}: بقيمة ${invAmt}${c.due != null ? `، تاريخ الاستحقاق ${day(lang, c.due)}` : ''}.\nشكرًا لتعاملكم معنا.`,
    },
    arrival: {
      en: `Arrival notice, booking ${job}: vessel ${c.vessel ?? ''} is expected at ${c.pod ?? ''} on ${c.eta != null ? day(lang, c.eta) : ''}${cn ? `, with container(s) ${cn}` : ''}.\nPlease prepare the documents for customs clearance and delivery.`,
      es: `Aviso de llegada, reserva ${job}: el buque ${c.vessel ?? ''} tiene llegada prevista a ${c.pod ?? ''} el ${c.eta != null ? day(lang, c.eta) : ''}${cn ? `, con los contenedores ${cn}` : ''}.\nPor favor, preparen la documentación para el despacho de aduanas y la entrega.`,
      fa: `آرایوال نوتیس بوکینگ ${job}: کشتی ${c.vessel ?? ''}${cn ? ` با کانتینر(های) ${cn}` : ''} در تاریخ ${c.eta != null ? day(lang, c.eta) : ''} به ${c.pod ?? ''} می‌رسد.\nلطفاً مدارک ترخیص و تحویل را آماده کنید.`,
      ar: `إشعار وصول، الحجز ${job}: من المتوقع وصول السفينة ${c.vessel ?? ''} إلى ${c.pod ?? ''} في ${c.eta != null ? day(lang, c.eta) : ''}${cn ? `، وعليها الحاوية/الحاويات ${cn}` : ''}.\nيُرجى تجهيز مستندات التخليص الجمركي والتسليم.`,
    },
    quoteSent: {
      en: `As requested, here is our quotation${ref}:\n\n${c.quoteText ?? ''}\n\nPlease let us know if you would like to go ahead.`,
      es: `Según lo solicitado, les enviamos nuestra cotización${ref}:\n\n${c.quoteText ?? ''}\n\nQuedamos a la espera de su confirmación.`,
      fa: `طبق درخواست شما، پیشنهاد قیمت ما${ref}:\n\n${c.quoteText ?? ''}\n\nدر صورت تأیید، لطفاً اطلاع دهید.`,
      ar: `بناءً على طلبكم، نرسل لكم عرض السعر${ref}:\n\n${c.quoteText ?? ''}\n\nيُرجى إعلامنا بموافقتكم للمتابعة.`,
    },
    stepUpdate: (() => {
      const sd = c.step ? stepDef(c.step) : undefined;
      if (!sd) return { en: '', es: '', fa: '', ar: '' };
      const all = stepsFor(c.step!.startsWith('E') ? 'export' : 'import');
      const nx = all[stepIndex(c.step!)];
      return {
        en: `Update on booking ${job}${route}.\nNow: ${sd.en} (${sd.code}).${nx ? `\nNext: ${nx.en} (${nx.code}).` : ''}\nWe will keep you posted.`,
        es: `Novedades de la reserva ${job}${route}.\nAhora: ${sd.es} (${sd.code}).${nx ? `\nSiguiente: ${nx.es} (${nx.code}).` : ''}\nLes mantendremos informados.`,
        fa: `به‌روزرسانی بوکینگ ${job}${route}.\nمرحله فعلی: ${sd.fa} (${sd.code}).${nx ? `\nمرحله بعد: ${nx.fa} (${nx.code}).` : ''}\nشما را در جریان خواهیم گذاشت.`,
        ar: `تحديث بشأن الحجز ${job}${route}.\nالمرحلة الحالية: ${sd.ar} (${sd.code}).${nx ? `\nالمرحلة التالية: ${nx.ar} (${nx.code}).` : ''}\nسنبقيكم على اطلاع.`,
      };
    })(),
    general: { en: '', es: '', fa: '', ar: '' },
  };
  return `${hi}\n\n${body[k][lang] ? `${body[k][lang]}\n\n` : '\n\n'}${bye}`;
}

/** Best template for a job right now (what staff most likely want to send). */
export function suggestTpl(c: TplCtx, step?: { draftBlPending?: boolean; blocking?: boolean; isImportArrival?: boolean }): TplKey {
  const now = c.now ?? Date.now();
  if (c.freeEnd != null && c.freeEnd - now < 3 * 86400000 && c.freeEnd > now - 86400000 && tplReady('freeTime', c)) return 'freeTime';
  if (c.cutoff != null && c.cutoff > now && c.cutoff - now < 48 * 3600000) return 'cutoff48';
  if (step?.blocking && tplReady('payBeforeBl', c)) return 'payBeforeBl';
  if (step?.draftBlPending) return 'draftBl';
  if (step?.isImportArrival && tplReady('arrival', c)) return 'arrival';
  if (tplReady('invoiceIssued', c)) return 'invoiceIssued';
  return 'general';
}

/** The client message that matches a booking moving to `step`: a specific alert when the step has one and its data is there, else the step update. */
export function tplForStep(step: string, c: TplCtx): TplKey {
  const ctx = { ...c, step };
  const want: Partial<Record<string, TplKey>> = { E8: 'freeTime', E17: 'cutoff48', E18: 'cutoff48', E19: 'draftBl', E20: 'draftBl', E21: 'payBeforeBl', I10: 'arrival', I11: 'payBeforeBl', I12: 'payBeforeBl', I14: 'freeTime' };
  const k = want[step];
  return k && tplReady(k, ctx) ? k : 'stepUpdate';
}
