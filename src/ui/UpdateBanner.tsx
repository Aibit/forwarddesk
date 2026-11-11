import { useEffect, useState } from 'react';
import { useUiLang } from './lang';

declare const __FD_BUILD__: string;

const TX = {
  msg: ['A newer version of ForwardDesk is available.', 'Hay una versión más reciente de ForwardDesk.', 'نسخه جدیدتری از ForwardDesk در دسترس است.', 'يتوفر إصدار أحدث من ForwardDesk.'],
  reload: ['Reload', 'Recargar', 'بارگذاری دوباره', 'إعادة التحميل'],
  later: ['Later', 'Más tarde', 'بعداً', 'لاحقًا'],
} as const;
const IDX = { en: 0, es: 1, fa: 2, ar: 3 } as const;

/** Tells people on an old (cached) build to reload: compares this build's id with the deployed version.json. */
export function UpdateBanner() {
  const [lang] = useUiLang();
  const [stale, setStale] = useState(false);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!import.meta.env.PROD || typeof __FD_BUILD__ === 'undefined') return;
    let alive = true;
    const check = async () => {
      try {
        const r = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!r.ok) return;
        const v = (await r.json()) as { build?: string };
        if (alive && v.build && v.build !== __FD_BUILD__) setStale(true);
      } catch { /* offline: try later */ }
    };
    void check();
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') void check(); }, 10 * 60 * 1000);
    const onVis = () => { if (document.visibilityState === 'visible') void check(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { alive = false; window.clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, []);
  if (!stale || hidden) return null;
  const i = IDX[lang];
  return (
    <div className="fd-update" role="status" dir={lang === 'fa' || lang === 'ar' ? 'rtl' : 'ltr'} data-testid="update-banner">
      <span>{TX.msg[i]}</span>
      <button type="button" className="btn primary sm" onClick={() => window.location.reload()} data-testid="update-reload">{TX.reload[i]}</button>
      <button type="button" className="btn ghost sm" onClick={() => setHidden(true)}>{TX.later[i]}</button>
    </div>
  );
}
