import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';
const KEY = 'fd-theme';
const subs = new Set<() => void>();
let cur: Theme = (() => {
  try { return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
})();
const apply = () => { document.documentElement.dataset.theme = cur; document.documentElement.style.colorScheme = cur; };
apply();

export function setTheme(t: Theme) {
  cur = t;
  try { localStorage.setItem(KEY, t); } catch { /* private mode */ }
  apply();
  subs.forEach((f) => f());
}
export function useTheme(): [Theme, (t: Theme) => void] {
  const t = useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => cur, () => cur);
  return [t, setTheme];
}
