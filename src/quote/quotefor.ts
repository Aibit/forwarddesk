/** "Quotation for" block shared by Copy quote and the PDF: client, lane profile, target (internal / opt-in), MSDS status. */
export interface QuoteFor {
  client: { name: string; contactName: string; email: string; phone: string; address: string } | null;
  lane: { pol: string; pod: string; commodity: string; hs: string; volume: string; payment: string } | null;
  /** Only filled when the version may show it (internal PDF, or "show target" ticked). */
  target: string | null;
  msds: { status: 'required' | 'optional' | 'received'; file?: string } | null;
}
type L3 = 'en' | 'es' | 'fa';
const T: Record<string, [string, string, string]> = {
  for: ['Quotation for', 'Cotización para', 'پیش‌فاکتور برای'],
  contact: ['Contact', 'Contacto', 'تماس'],
  address: ['Address', 'Dirección', 'آدرس'],
  lane: ['Lane profile', 'Perfil de ruta', 'مشخصات مسیر'],
  pol: ['POL', 'POL', 'بندر بارگیری'],
  pod: ['POD', 'POD', 'بندر تخلیه'],
  commodity: ['Commodity', 'Mercancía', 'کالا'],
  hs: ['HS code', 'Código HS', 'کد HS'],
  volume: ['Volume', 'Volumen', 'حجم'],
  payment: ['Term of payment', 'Forma de pago', 'شرایط پرداخت'],
  target: ['Target freight rate', 'Tarifa objetivo', 'نرخ هدف کرایه'],
  msds: ['MSDS', 'MSDS', 'MSDS'],
  required: ['required — not received yet', 'obligatoria — pendiente de recibir', 'لازم — هنوز دریافت نشده'],
  optional: ['optional', 'opcional', 'اختیاری'],
  received: ['received', 'recibida', 'دریافت شد'],
};
const I: Record<L3, number> = { en: 0, es: 1, fa: 2 };
export const qfl = (lang: L3, k: keyof typeof T) => T[k][I[lang]];
export const msdsText = (qf: QuoteFor, lang: L3) => (qf.msds ? `${qfl(lang, qf.msds.status)}${qf.msds.file ? ` (${qf.msds.file})` : ''}` : '');

export function quoteForText(qf: QuoteFor | null | undefined, lang: L3): string[] {
  if (!qf || (!qf.client && !qf.lane && !qf.msds)) return [];
  const L = (k: keyof typeof T) => qfl(lang, k);
  const out: string[] = [];
  if (qf.client) {
    out.push(`${L('for')}: ${qf.client.name}`);
    const c = [qf.client.contactName, qf.client.email, qf.client.phone].filter(Boolean).join(' · ');
    if (c) out.push(`  ${L('contact')}: ${c}`);
    if (qf.client.address) out.push(`  ${L('address')}: ${qf.client.address}`);
  }
  if (qf.lane) {
    out.push(`${L('lane')}: ${L('pol')} ${qf.lane.pol} → ${L('pod')} ${qf.lane.pod}`);
    out.push(`  ${L('commodity')}: ${qf.lane.commodity}${qf.lane.hs ? ` · ${L('hs')} ${qf.lane.hs}` : ''}`);
    out.push(`  ${L('volume')}: ${qf.lane.volume} · ${L('payment')}: ${qf.lane.payment || '—'}`);
  }
  if (qf.target) out.push(`  ${L('target')}: ${qf.target}`);
  if (qf.msds) out.push(`${qf.lane ? '  ' : ''}${L('msds')}: ${msdsText(qf, lang)}`);
  return out;
}
