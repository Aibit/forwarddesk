import { useEffect, useState } from 'react';
import { useUiLang, type UiLang } from './ui/lang';
import { RELEASES, LATEST, pick, seenVersion, markSeen } from './releaseNotes';

const LOCALE: Record<UiLang, string> = { en: 'en-GB', es: 'es-ES', fa: 'fa-IR-u-ca-gregory', ar: 'ar-EG' };
const T = {
  version: ['Version', 'Versión', 'نسخه', 'الإصدار'],
  new: ['New', 'Nuevo', 'جدید', 'جديد'],
} as const;
const LI: Record<UiLang, 0 | 1 | 2 | 3> = { en: 0, es: 1, fa: 2, ar: 3 };

/** Release date shown in Europe/Madrid. */
export function relDate(d: string, l: UiLang) {
  const dt = new Date(`${d}T12:00:00+01:00`);
  return new Intl.DateTimeFormat(LOCALE[l], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' }).format(dt);
}

export function WhatsNewView() {
  const [lang] = useUiLang();
  // Remember what was unread when the page opened, then mark everything seen.
  const [prevSeen] = useState(seenVersion);
  useEffect(() => { markSeen(); window.dispatchEvent(new Event('fd-whatsnew-seen')); }, []);
  const rtl = lang === 'fa' || lang === 'ar';
  const isNew = (v: string) => !prevSeen ? v === LATEST : v.localeCompare(prevSeen, undefined, { numeric: true }) > 0;
  return (
    <section className="wn-list" data-testid="whatsnew" dir={rtl ? 'rtl' : 'ltr'} lang={lang}>
      {RELEASES.map((r) => (
        <article key={r.version} className="wn-rel" data-testid={`wn-rel-${r.version}`}>
          <div className="wn-meta">
            <span className="wn-ver">{T.version[LI[lang]]} <bdi>{r.version}</bdi></span>
            <time dateTime={r.date} data-testid="wn-date">{relDate(r.date, lang)}</time>
            {isNew(r.version) && <span className="wn-new" data-testid="wn-new">{T.new[LI[lang]]}</span>}
          </div>
          <h2>{pick(r.title, lang)}</h2>
          <ul>
            {r.bullets.map((b, i) => <li key={i}>{pick(b, lang)}</li>)}
          </ul>
        </article>
      ))}
    </section>
  );
}
