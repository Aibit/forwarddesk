import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useUiLang, type UiLang } from '../ui/lang';
import { wt } from './i18n';
import { CALLING_CODES, fmtPhone, isE164, normalizePhone, splitPhone, waDigits, waLink } from './phone';
import { fillTpl, tplName, tplReady, type TplCtx, type TplKey, type WaLang } from './templates';
import { waLog, type WaLogEntry } from './log';
import type { WaRecipient } from './context';
import './whatsapp.css';

const LANGS: WaLang[] = ['en', 'es', 'fa', 'ar'];
const rtl = (l: string) => l === 'fa' || l === 'ar';

/** Line-style chat bubble with a handset: generic "WhatsApp-style" icon (no brand artwork). */
export function WaIcon({ size = 18, className = '' }: { size?: number; className?: string }) {
  return (
    <svg className={`wa-ic ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 20.5l1.4-4.1A8.5 8.5 0 1 1 8 19.3z" />
      <path d="M9.2 8.3c-.4 0-.8.4-.8 1 0 2.6 3 5.6 5.7 5.7.6 0 1-.4 1-.8v-.9l-1.6-.7-.8.8c-1-.4-2.1-1.5-2.5-2.5l.8-.8-.7-1.6z" />
    </svg>
  );
}

export interface WaButtonProps {
  recipients: WaRecipient[];
  templates: TplKey[];
  ctx: TplCtx;
  defaultTpl?: TplKey;
  /** what the log entry links to (the recipient adds client/agent links) */
  link?: { jobId?: string | null; clientId?: string | null; agentId?: string | null };
  /** message language when no recipient language applies (manual number) */
  fallbackLang?: WaLang;
  label?: ReactNode;
  className?: string;
  testid: string;
  onOpened?: (e: WaLogEntry) => void;
}

/** "WhatsApp" button that opens the template picker. */
export function WaButton(p: WaButtonProps) {
  const [ui] = useUiLang();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={`btn wa-btn ${p.className ?? 'ghost'}`} onClick={(e) => { e.stopPropagation(); setOpen(true); }} data-testid={`wa-btn-${p.testid}`}>
        <WaIcon /> <span>{p.label ?? wt(ui, 'wa')}</span>
      </button>
      {open && <WaDialog {...p} onClose={() => setOpen(false)} />}
    </>
  );
}

export function WaDialog({ recipients, templates, ctx, defaultTpl, link, fallbackLang = 'en', onClose, onOpened }: WaButtonProps & { onClose: () => void }) {
  const [ui] = useUiLang();
  const firstOk = recipients.find((r) => isE164(r.number)) ?? recipients[0] ?? null;
  const [rid, setRid] = useState<string>(firstOk?.id ?? 'manual');
  const [manual, setManual] = useState('');
  const rec = rid === 'manual' ? null : recipients.find((r) => r.id === rid) ?? null;
  const pickTpl = (k?: TplKey) => (k && templates.includes(k) && tplReady(k, ctx) ? k : templates.find((t) => tplReady(t, ctx)) ?? 'general');
  const [tpl, setTpl] = useState<TplKey>(pickTpl(defaultTpl));
  const [mlang, setMlang] = useState<WaLang>(rec?.lang ?? fallbackLang);
  const firstName = (n: string) => n.split(' · ')[0];
  const make = (k: TplKey, l: WaLang, r: WaRecipient | null) => fillTpl(k, l, { ...ctx, name: r ? firstName(r.name) : '' });
  const [text, setText] = useState(() => make(tpl, mlang, rec));
  const [copied, setCopied] = useState(false);
  // Re-fill when the recipient, template or language changes (staff edits apply to the current choice).
  useEffect(() => { setText(make(tpl, mlang, rec)); }, [tpl, mlang, rid]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [onClose]);
  const number = rec ? rec.number : normalizePhone(manual);
  const digits = waDigits(number);
  const href = digits ? waLink(digits, text) : null;
  const pickRec = (r: WaRecipient | null) => { setRid(r ? r.id : 'manual'); if (r) setMlang(r.lang); };
  const opened = () => {
    if (!digits) return;
    const e = waLog.add({
      jobId: link?.jobId ?? null, clientId: rec?.clientId ?? link?.clientId ?? null, agentId: rec?.agentId ?? link?.agentId ?? null,
      toName: rec ? `${rec.name} (${wt('en', rec.role)})` : 'Manual number', toNumber: `+${digits}`, template: tpl, lang: mlang, text,
    });
    onOpened?.(e);
    window.setTimeout(onClose, 50);
  };
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { /* blocked */ } };
  return createPortal(
    <div className="wa-modal-bg" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="wa-modal" role="dialog" aria-modal="true" aria-label={wt(ui, 'title')} dir={rtl(ui) ? 'rtl' : 'ltr'} lang={ui} onClick={(e) => e.stopPropagation()} data-testid="wa-dialog">
        <header className="wa-head">
          <span className="wa-head-ic"><WaIcon size={22} /></span>
          <h2>{wt(ui, 'title')}</h2>
          <button type="button" className="btn ghost sm" onClick={onClose} aria-label={wt(ui, 'cancel')}>✕</button>
        </header>
        <div className="wa-sec">
          <div className="wa-label">{wt(ui, 'to')}</div>
          {recipients.length === 0 && <p className="wa-hint">{wt(ui, 'noRecipients')}</p>}
          <div className="wa-recips" role="radiogroup">
            {recipients.map((r) => (
              <button key={r.id} type="button" role="radio" aria-checked={rid === r.id} className={`wa-recip ${rid === r.id ? 'on' : ''} ${isE164(r.number) ? '' : 'bad'}`} onClick={() => pickRec(r)} data-testid={`wa-recipient-${r.id}`}>
                <span className="wa-recip-role">{wt(ui, r.role)}</span>
                <span className="wa-recip-name">{r.name}</span>
                <bdi dir="ltr" className="wa-recip-num">{fmtPhone(r.number)}</bdi>
              </button>
            ))}
            <button type="button" role="radio" aria-checked={rid === 'manual'} className={`wa-recip ${rid === 'manual' ? 'on' : ''}`} onClick={() => pickRec(null)} data-testid="wa-recipient-manual">
              <span className="wa-recip-role">{wt(ui, 'otherCode').replace(/\s*\(.*\)/, '')} · {wt(ui, 'waNumber')}</span>
            </button>
          </div>
          {rid === 'manual' && <PhoneField value={manual} onChange={setManual} label={wt(ui, 'waNumber')} testid="wa-manual" />}
          {!digits && (rec || manual) && <p className="wa-warn" data-testid="wa-nonumber">{wt(ui, 'noNumber')}</p>}
        </div>
        <div className="wa-row">
          <label className="wa-field">
            <span className="wa-label">{wt(ui, 'template')}</span>
            <select className="c-in wa-select" value={tpl} onChange={(e) => setTpl(e.target.value as TplKey)} data-testid="wa-tpl">
              {templates.map((k) => <option key={k} value={k} disabled={!tplReady(k, ctx)}>{tplName(k, ui)}{tplReady(k, ctx) ? '' : ` (${wt(ui, 'needsData')})`}</option>)}
            </select>
          </label>
          <div className="wa-field">
            <span className="wa-label">{wt(ui, 'msgLang')}{rec && rec.lang === mlang ? <span className="wa-muted"> · {wt(ui, 'recipLang')}</span> : null}</span>
            <div className="q-lang wa-langs" role="group" aria-label={wt(ui, 'msgLang')}>
              {LANGS.map((l) => <button key={l} type="button" className={mlang === l ? 'active' : ''} onClick={() => setMlang(l)} data-testid={`wa-lang-${l}`}>{l === 'fa' ? 'FA فا' : l === 'ar' ? 'AR عر' : l.toUpperCase()}</button>)}
            </div>
          </div>
        </div>
        <label className="wa-field">
          <span className="wa-label">{wt(ui, 'message')}</span>
          <textarea className="c-in wa-text" value={text} onChange={(e) => setText(e.target.value)} dir={rtl(mlang) ? 'rtl' : 'ltr'} lang={mlang} rows={9} data-testid="wa-text" />
        </label>
        <p className="wa-how">{wt(ui, 'how')}</p>
        <footer className="wa-foot">
          <button type="button" className="btn ghost" onClick={() => void copy()} data-testid="wa-copy">{copied ? wt(ui, 'copied') : wt(ui, 'copy')}</button>
          <span className="wa-flex" />
          <button type="button" className="btn ghost" onClick={onClose}>{wt(ui, 'cancel')}</button>
          {href
            ? <a className="btn primary wa-open" href={href} target="_blank" rel="noopener noreferrer" onClick={opened} data-testid="wa-open"><WaIcon /> {wt(ui, 'open')}</a>
            : <button type="button" className="btn primary wa-open" disabled data-testid="wa-open"><WaIcon /> {wt(ui, 'open')}</button>}
        </footer>
      </div>
    </div>,
    document.body,
  );
}

/** Log of WhatsApp opens for a job / client / agent. Always "opened in WhatsApp", never "delivered". */
export function WaLogList({ entries, testid, compact }: { entries: WaLogEntry[]; testid: string; compact?: boolean }) {
  const [ui] = useUiLang();
  if (!entries.length) return compact ? null : <p className="wa-muted" data-testid={`${testid}-empty`}>{wt(ui, 'noLog')}</p>;
  return (
    <ul className="wa-log" data-testid={testid}>
      {entries.map((e) => <WaLogItem key={e.id} e={e} ui={ui} />)}
    </ul>
  );
}
export function WaLogItem({ e, ui }: { e: WaLogEntry; ui: UiLang }) {
  const loc = ui === 'fa' ? 'fa-IR-u-ca-gregory' : ui === 'ar' ? 'ar-EG' : ui === 'es' ? 'es-ES' : 'en-GB';
  return (
    <li className="wa-log-item" data-testid="wa-log-item">
      <span className="wa-log-ic"><WaIcon size={16} /></span>
      <div className="wa-log-body">
        <div className="wa-log-head">
          <span className="wa-pill" data-testid="wa-log-opened">{wt(ui, 'opened')}</span>
          <span><span data-ud="">{e.toName}</span> · <bdi dir="ltr" className="mono">{fmtPhone(e.toNumber)}</bdi></span>
          <span className="wa-muted">{wt(ui, 'withTpl')}: {tplName(e.template, ui)} · {e.lang.toUpperCase()}</span>
          <bdi className="wa-muted mono">{new Date(e.at).toLocaleString(loc, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</bdi>
        </div>
        <details className="wa-log-text">
          <summary>{wt(ui, 'showText')}</summary>
          <pre dir={rtl(e.lang) ? 'rtl' : 'ltr'} lang={e.lang} data-ud="">{e.text}</pre>
        </details>
      </div>
    </li>
  );
}

/** Phone input with a country-code picker; stores E.164 ("+34600112233"). Amber hint, never red. */
export function PhoneField({ value, onChange, label, hint, testid }: { value: string; onChange: (v: string) => void; label: string; hint?: string; testid: string }) {
  const [ui] = useUiLang();
  const sp = useMemo(() => splitPhone(value ?? ''), [value]);
  const [cc, setCc] = useState(sp.cc || '');
  useEffect(() => { if (sp.cc) setCc(sp.cc); }, [sp.cc]);
  const names = useMemo(() => {
    let dn: Intl.DisplayNames | null = null;
    try { dn = new Intl.DisplayNames([ui], { type: 'region' }); } catch { dn = null; }
    return Object.fromEntries(CALLING_CODES.map((c) => [c.cc, dn?.of(c.iso) ?? c.name]));
  }, [ui]);
  const rest = sp.cc && sp.cc !== 'other' ? sp.rest : value ?? '';
  const set = (code: string, r: string) => {
    setCc(code);
    const digits = r.replace(/[^\d+]/g, '');
    if (!digits) return onChange('');
    if (!code || code === 'other' || digits.startsWith('+') || digits.startsWith('00')) return onChange(normalizePhone(digits.startsWith('+') || digits.startsWith('00') ? digits : r));
    onChange(`+${code}${digits.replace(/^0+/, '')}`);
  };
  const bad = !!(value && value.trim()) && !isE164(value);
  return (
    <label className="c-field wa-phone">
      <span>{label}</span>
      <span className="wa-phone-row" dir="ltr">
        <select className="c-in wa-cc" value={cc} onChange={(e) => set(e.target.value, rest)} aria-label={wt(ui, 'countryCode')} data-testid={`${testid}-cc`}>
          <option value="">+ …</option>
          {CALLING_CODES.map((c) => <option key={c.cc + c.iso} value={c.cc}>+{c.cc} · {names[c.cc]}</option>)}
          <option value="other">{wt(ui, 'otherCode')}</option>
        </select>
        <input className="c-in wa-num" inputMode="tel" dir="ltr" value={rest} placeholder={cc && cc !== 'other' ? '600 112 233' : '+34 600 112 233'} onChange={(e) => set(cc, e.target.value)} data-testid={testid} />
      </span>
      {bad ? <span className="wa-warn sm" data-testid={`${testid}-bad`}>{wt(ui, 'badPhone')}</span> : hint ? <span className="wa-muted sm">{hint}</span> : null}
    </label>
  );
}

/** Settings placeholder for step 2 (two-way inbox via an official WhatsApp Business provider). */
