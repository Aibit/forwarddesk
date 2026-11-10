import { useSyncExternalStore } from 'react';
import { LIVE_MSDS_MAX, bridge } from '../backend/bridge';
import type { CLang } from './store';

/** Editable MSDS rule list (sample — confirm with the line). A rule matches when the HS code starts with `prefix`. */
export interface MsdsRule { prefix: string; label: string }
export interface MsdsMeta { id: string; name: string; size: number; type: string; at: number }
export type MsdsNeed = 'required' | 'optional';

export const DEFAULT_MSDS_RULES: MsdsRule[] = [
  { prefix: '27', label: 'Mineral fuels, oils, bitumen (incl. 2713 petroleum bitumen, 2715 bituminous mixtures)' },
  { prefix: '28', label: 'Inorganic chemicals' },
  { prefix: '29', label: 'Organic chemicals' },
  { prefix: '32', label: 'Paints, varnishes, inks, dyes' },
  { prefix: '33', label: 'Essential oils, cosmetics, perfumes' },
  { prefix: '34', label: 'Soaps, lubricants, waxes' },
  { prefix: '36', label: 'Explosives, matches, pyrotechnics' },
  { prefix: '38', label: 'Miscellaneous chemical products' },
  { prefix: '39', label: 'Plastics in primary forms (granules, resins)' },
  { prefix: '40', label: 'Rubber' },
  { prefix: '8507', label: 'Batteries / accumulators' },
];

const RULES_KEY = 'fd.msds.rules.v1';
let rules: MsdsRule[] = (() => {
  try {
    const r = JSON.parse(localStorage.getItem(RULES_KEY) || 'null');
    return Array.isArray(r) ? r : DEFAULT_MSDS_RULES;
  } catch {
    return DEFAULT_MSDS_RULES;
  }
})();
const subs = new Set<() => void>();
export function setMsdsRules(r: MsdsRule[] | null) {
  rules = r ?? DEFAULT_MSDS_RULES;
  if (bridge.w) { bridge.w.setMsdsRules(rules); subs.forEach((f) => f()); return; }
  try {
    if (r) localStorage.setItem(RULES_KEY, JSON.stringify(r));
    else localStorage.removeItem(RULES_KEY);
  } catch { /* storage full / blocked */ }
  subs.forEach((f) => f());
}
export const getMsdsRules = () => rules;
/** Live mode: rules from Firestore (not persisted locally). */
export function hydrateMsdsRules(r: MsdsRule[] | null) {
  rules = r && r.length ? r : DEFAULT_MSDS_RULES;
  subs.forEach((f) => f());
}
export function reloadMsdsRules() {
  try {
    const r = JSON.parse(localStorage.getItem(RULES_KEY) || 'null');
    rules = Array.isArray(r) ? r : DEFAULT_MSDS_RULES;
  } catch { rules = DEFAULT_MSDS_RULES; }
  subs.forEach((f) => f());
}
export const useMsdsRules = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => rules);

export function msdsNeed(hs: string | null | undefined, dg?: string | null): { need: MsdsNeed; rule: MsdsRule | null; dg: boolean } {
  const d = (hs ?? '').replace(/\D/g, '');
  const rule = d ? rules.filter((r) => r.prefix && d.startsWith(r.prefix.replace(/\D/g, ''))).sort((a, b) => b.prefix.length - a.prefix.length)[0] ?? null : null;
  const isDg = dg === 'yes';
  return { need: rule || isDg ? 'required' : 'optional', rule, dg: isDg };
}

/** HS code mentioned in free text ("HS 2713.20", "HS code: 271320"). */
export function hsFromText(t: string): string | null {
  const m = t.match(/\bHS(?:\s*code)?\s*[:#]?\s*(\d{4}[.\s]?\d{2}(?:[.\s]?\d{2}){0,2})\b/i);
  return m ? m[1] : null;
}
/** Rough HS guess from a commodity name, used only when no lane profile / HS code is known. */
export function hsFromCommodity(c: string): string | null {
  const s = c.toLowerCase();
  const map: [RegExp, string][] = [[/bitumen|asphalt|قیر/, '2713'], [/lubric|base oil|motor oil/, '2710'], [/batter/, '8507'], [/paint|ink|varnish/, '3208'], [/polyethylene|polymer|resin|granule|pvc|\bpe\b|\bpp\b/, '3901'], [/methanol|urea|chemical/, '2905'], [/rice|برنج/, '1006'], [/stone|marble|granite|سنگ/, '2516'], [/tile|ceramic/, '6907'], [/spare|machinery|pump/, '8431'], [/furniture/, '9403'], [/pistachio|dates|raisin/, '0802']];
  return map.find(([r]) => r.test(s))?.[1] ?? null;
}

// ── file storage: IndexedDB (browser only) ──
const DB = 'fd-msds';
function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((res, rej) => {
    const q = fn(d.transaction('files', mode).objectStore('files'));
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
}
export const MSDS_MAX = 8 * 1024 * 1024;
export async function saveMsds(file: File, clientId: string | null = null): Promise<MsdsMeta> {
  if (bridge.w) return bridge.w.saveMsds(file, clientId);
  const id = `msds-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await tx('readwrite', (s) => s.put(file, id));
  return { id, name: file.name, size: file.size, type: file.type || 'application/octet-stream', at: Date.now() };
}
export const loadMsds = (id: string) => (bridge.w ? bridge.w.loadMsds(id) : tx<Blob | undefined>('readonly', (s) => s.get(id) as IDBRequest<Blob | undefined>));
export const deleteMsds = (id: string) => (bridge.w ? bridge.w.deleteMsds(id).catch(() => undefined) : tx('readwrite', (s) => s.delete(id)).catch(() => undefined));
export const msdsMax = () => (bridge.w ? LIVE_MSDS_MAX : MSDS_MAX);
export const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

const ML: Record<string, [string, string, string]> = {
  required: ['MSDS required', 'MSDS obligatoria', 'MSDS لازم است'],
  optional: ['MSDS optional', 'MSDS opcional', 'MSDS اختیاری'],
  received: ['MSDS received', 'MSDS recibida', 'MSDS دریافت شد'],
  missing: ['MSDS missing', 'Falta MSDS', 'MSDS ارسال نشده'],
  upload: ['Upload MSDS (PDF / image)', 'Subir MSDS (PDF / imagen)', 'بارگذاری MSDS (PDF / تصویر)'],
  replace: ['Replace', 'Sustituir', 'جایگزینی'],
  view: ['View', 'Ver', 'مشاهده'],
  remove: ['Remove', 'Quitar', 'حذف'],
  browserOnly: ['stored in this browser only', 'guardada solo en este navegador', 'فقط در همین مرورگر ذخیره می‌شود'],
  online: ['stored online (sample/demo data only)', 'guardada en línea (solo datos de ejemplo)', 'ذخیرهٔ آنلاین (فقط داده نمونه)'],
  tooBigLive: ['File too large for online storage (max 640 KB)', 'Archivo demasiado grande para guardar en línea (máx. 640 KB)', 'فایل برای ذخیرهٔ آنلاین بزرگ است (حداکثر ۶۴۰ کیلوبایت)'],
  sampleRule: ['sample rule — confirm with line', 'regla de ejemplo — confirmar con la naviera', 'قاعده نمونه — با خط کشتیرانی تأیید شود'],
  dgRule: ['dangerous goods', 'mercancía peligrosa', 'کالای خطرناک'],
  tooBig: ['File too large (max 8 MB)', 'Archivo demasiado grande (máx. 8 MB)', 'فایل خیلی بزرگ است (حداکثر ۸ مگابایت)'],
  badType: ['PDF or image only', 'Solo PDF o imagen', 'فقط PDF یا تصویر'],
  rulesH: ['MSDS rules by HS code', 'Reglas MSDS por código HS', 'قواعد MSDS بر اساس کد HS'],
  hsNote: ['MSDS / UN number', 'MSDS / número UN', 'MSDS / شماره UN'],
};
const LI: Record<CLang, number> = { en: 0, es: 1, fa: 2 };
export const ml = (lang: CLang, k: keyof typeof ML) => ML[k][LI[lang]];
