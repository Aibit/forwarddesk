// Phone helpers. WhatsApp IDs (wa_id) are E.164 digits without '+'.
export const digits = (s: string | null | undefined): string => {
  let t = String(s ?? '').trim();
  if (t.startsWith('00')) t = t.slice(2);
  return t.replace(/\D/g, '');
};
export const isE164Digits = (d: string) => /^[1-9]\d{7,14}$/.test(d);

export interface DirEntry { kind: 'client' | 'agent'; id: string; name: string; contact?: string; phones: string[] }
export interface DirMatch { kind: 'client' | 'agent'; id: string; name: string; contact?: string; how: 'exact' | 'suffix' }

/**
 * Find the client/agent whose number matches a WhatsApp ID.
 * Exact E.164 match first; otherwise a unique match on the last 9 digits
 * (covers numbers saved in national format, e.g. "0501 234 567").
 */
export function matchPhone(waId: string, dir: DirEntry[]): DirMatch | null {
  const w = digits(waId);
  if (!w) return null;
  for (const e of dir) for (const p of e.phones) if (digits(p) === w) return { kind: e.kind, id: e.id, name: e.name, contact: e.contact, how: 'exact' };
  const tail = w.slice(-9);
  if (tail.length < 9) return null;
  const hits: DirMatch[] = [];
  for (const e of dir) {
    if (e.phones.some((p) => { const d = digits(p).replace(/^0+/, ''); return d.length >= 9 && d.slice(-9) === tail; })) hits.push({ kind: e.kind, id: e.id, name: e.name, contact: e.contact, how: 'suffix' });
  }
  const uniq = new Map(hits.map((h) => [`${h.kind}:${h.id}`, h]));
  return uniq.size === 1 ? [...uniq.values()][0] : null;
}

/** First job reference in a text, normalised to upper case. */
export function findJobRef(text: string | null | undefined, re: RegExp): string | null {
  const m = String(text ?? '').match(re);
  return m ? m[0].toUpperCase() : null;
}
