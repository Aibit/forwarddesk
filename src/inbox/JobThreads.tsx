import { useUiLang } from '../ui/lang';
import { useInbox, openInInbox } from './state';
import { it } from './i18n';
import { convTitle, lastPreview } from './InboxView';
import { when } from './i18n';

/** WhatsApp conversations linked to a job, shown in the job drawer. */
export function JobWaThreads({ jobId }: { jobId: string }) {
  const [lang] = useUiLang();
  const ib = useInbox();
  const mine = ib.convs.filter((c) => c.jobId === jobId);
  if (!ib.backend || mine.length === 0) return null;
  return (
    <section className="ib-job" data-testid="job-wa-threads">
      <h4>{it(lang, 'jobThreads')}</h4>
      {mine.map((c) => (
        <div key={c.id} className="ib-job-row" data-testid={`job-wa-thread-${c.id}`}>
          <div className="ib-job-main">
            <strong data-ud=""><bdi>{c.contactName ?? convTitle(c)}</bdi></strong>
            {c.sample && <span className="j-sample sm">{it(lang, 'sample')}</span>}
            {c.unread > 0 && <span className="ib-badge">{c.unread}</span>}
            <span className="ib-job-last" dir="auto" data-ud="">{lastPreview(c, lang)}</span>
            <time className="c-muted">{c.lastMessageAt ? when(lang, c.lastMessageAt) : ''}</time>
          </div>
          <button type="button" className="btn sm" onClick={() => openInInbox(c.id)} data-testid="job-wa-open-inbox">{it(lang, 'openInbox')}</button>
        </div>
      ))}
    </section>
  );
}
