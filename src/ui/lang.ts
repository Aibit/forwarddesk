import { useSyncExternalStore } from 'react';

/** App-wide UI language (EN / ES / FA). Jobs, Clients, Agents, the sidebar and page headers share it. */
export type UiLang = 'en' | 'es' | 'fa' | 'ar';
const KEY = 'fd-ui-lang';
const subs = new Set<() => void>();
let cur: UiLang = (() => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'es' || v === 'fa' || v === 'ar' ? v : 'en';
  } catch {
    return 'en';
  }
})();

export const getUiLang = () => cur;
export function setUiLang(l: UiLang) {
  if (l === cur) return;
  cur = l;
  try { localStorage.setItem(KEY, l); } catch { /* private mode */ }
  subs.forEach((f) => f());
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

/** Drop-in for `useState<Lang>('en')`. */
export function useUiLang<T extends UiLang = UiLang>(): [T, (l: T) => void] {
  const l = useSyncExternalStore(subscribe, getUiLang, getUiLang) as T;
  return [l, setUiLang as (l: T) => void];
}
