export function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Stable per-day quote number from the request text (same request → same number). */
export function quoteNumber(text: string): string {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `FD-Q-${isoToday().replace(/-/g, '')}-${String(h % 1000).padStart(3, '0')}`;
}
