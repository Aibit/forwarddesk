// WhatsApp step 1: phone numbers in E.164 and wa.me click-to-chat links.
// No WhatsApp Business account and no unofficial libraries: the link opens the staff member's own
// WhatsApp (app on a phone, WhatsApp Desktop / Web on a computer) with the text filled in. Staff press Send.

/** Country calling codes offered in the picker. Region-agnostic list of common trade partners; "Other" accepts any +code. */
export const CALLING_CODES: { cc: string; iso: string; name: string }[] = [
  { cc: '34', iso: 'ES', name: 'Spain' },
  { cc: '971', iso: 'AE', name: 'United Arab Emirates' },
  { cc: '966', iso: 'SA', name: 'Saudi Arabia' },
  { cc: '968', iso: 'OM', name: 'Oman' },
  { cc: '974', iso: 'QA', name: 'Qatar' },
  { cc: '965', iso: 'KW', name: 'Kuwait' },
  { cc: '973', iso: 'BH', name: 'Bahrain' },
  { cc: '964', iso: 'IQ', name: 'Iraq' },
  { cc: '90', iso: 'TR', name: 'Türkiye' },
  { cc: '20', iso: 'EG', name: 'Egypt' },
  { cc: '91', iso: 'IN', name: 'India' },
  { cc: '92', iso: 'PK', name: 'Pakistan' },
  { cc: '86', iso: 'CN', name: 'China' },
  { cc: '65', iso: 'SG', name: 'Singapore' },
  { cc: '60', iso: 'MY', name: 'Malaysia' },
  { cc: '49', iso: 'DE', name: 'Germany' },
  { cc: '31', iso: 'NL', name: 'Netherlands' },
  { cc: '39', iso: 'IT', name: 'Italy' },
  { cc: '33', iso: 'FR', name: 'France' },
  { cc: '44', iso: 'GB', name: 'United Kingdom' },
  { cc: '1', iso: 'US', name: 'USA / Canada' },
];

/** Normalise what people type ("00971 50-123 4567", "+34 (600) 11 22 33") to "+<digits>"; '' when empty. */
export function normalizePhone(raw: string | null | undefined): string {
  const s = (raw ?? '').trim();
  if (!s) return '';
  let d = s.replace(/[^\d+]/g, '');
  if (d.startsWith('00')) d = `+${d.slice(2)}`;
  if (!d.startsWith('+')) return d; // no country code: keep as typed, isE164 says no
  return `+${d.slice(1).replace(/\+/g, '')}`;
}
/** E.164: "+", country code not starting with 0, 8–15 digits in total. */
export const isE164 = (s: string | null | undefined) => /^\+[1-9]\d{7,14}$/.test(normalizePhone(s));
/** Digits for wa.me (no "+", no spaces); null when the number is not usable. */
export const waDigits = (s: string | null | undefined): string | null => (isE164(s) ? normalizePhone(s).slice(1) : null);
/** https://wa.me/<digits>?text=<url-encoded text> — the official click-to-chat link. */
export const waLink = (digits: string, text: string) => `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

/** Split "+971501234567" into a picker code + the rest. Longest matching code wins; unknown codes → 'other'. */
export function splitPhone(raw: string): { cc: string; rest: string } {
  const n = normalizePhone(raw);
  if (!n.startsWith('+')) return { cc: '', rest: raw };
  const d = n.slice(1);
  const hit = [...CALLING_CODES].sort((a, b) => b.cc.length - a.cc.length).find((c) => d.startsWith(c.cc));
  return hit ? { cc: hit.cc, rest: d.slice(hit.cc.length) } : { cc: 'other', rest: n };
}
/** Pretty print for display: "+971 50 123 4567"-ish grouping (display only). */
export function fmtPhone(raw: string): string {
  const n = normalizePhone(raw);
  if (!isE164(n)) return raw;
  const { cc, rest } = splitPhone(n);
  if (cc === 'other' || !cc) return n;
  return `+${cc} ${rest.replace(/(\d{2,3})(?=(\d{3})+$)/g, '$1 ').trim()}`;
}
/** WhatsApp number of a contact: the separate WhatsApp number if set, else the phone. */
export const waNumberOf = (c: { whatsapp?: string | null; phone?: string | null }) => (c.whatsapp && c.whatsapp.trim() ? c.whatsapp : c.phone ?? '');
