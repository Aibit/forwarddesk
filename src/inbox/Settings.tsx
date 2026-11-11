import { useState } from 'react';
import { useUiLang } from '../ui/lang';
import { WaIcon } from '../whatsapp/WhatsApp';
import { serverBackend } from './backend';
import { readServerCfg, saveServerCfg, useInbox } from './state';
import { it, type IKey } from './i18n';

/** WhatsApp inbox connection (replaces the step-1 "coming soon" note). The key is stored on this device only. */
export function WaServerSettings({ compact = false }: { compact?: boolean }) {
  const [lang] = useUiLang();
  const L = (k: IKey, v?: Record<string, string>) => it(lang, k, v);
  const ib = useInbox();
  const cur = readServerCfg();
  const [url, setUrl] = useState(cur?.url ?? '');
  const [key, setKey] = useState(cur?.key ?? '');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const test = async () => {
    setMsg(null);
    try {
      const s = await serverBackend(url.trim(), key.trim()).status();
      setMsg(s.problems.length ? { ok: false, text: L('connProblems', { p: s.problems.join('; ') }) } : { ok: true, text: L('connOk', { p: s.provider }) });
    } catch (e) { setMsg({ ok: false, text: L('connFail', { e: String((e as Error).message ?? e) }) }); }
  };
  return (
    <section className={`wa-inbox ${compact ? 'compact' : ''}`} data-testid="wa-inbox-note">
      <span className="wa-head-ic"><WaIcon size={22} /></span>
      <div className="wa-srv" data-testid="wa-server-settings">
        <h3>{L('settingsH')}</h3>
        <p>{ib.mode === 'sample' ? L('demoSettings') : L('settingsP')}</p>
        <div className="wa-srv-row">
          <label><span>{L('url')}</span><input className="c-in" dir="ltr" placeholder="https://wa.example.com" value={url} onChange={(e) => setUrl(e.target.value)} data-testid="wa-server-url" /></label>
          <label><span>{L('key')}</span><input className="c-in" dir="ltr" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} data-testid="wa-server-key" /></label>
        </div>
        <div className="wa-srv-btns">
          <button type="button" className="btn sm" disabled={!/^https?:\/\//.test(url.trim()) || !key.trim()} onClick={() => void test()} data-testid="wa-server-test">{L('test')}</button>
          <button type="button" className="btn sm primary" disabled={!/^https?:\/\//.test(url.trim()) || !key.trim()} onClick={() => { saveServerCfg({ url: url.trim(), key: key.trim() }); void test(); }} data-testid="wa-server-save">{L('save')}</button>
          {cur && <button type="button" className="btn sm ghost" onClick={() => { saveServerCfg(null); setUrl(''); setKey(''); setMsg(null); }} data-testid="wa-server-disconnect">{L('disconnect')}</button>}
          <small className="c-muted">{L('stored')}</small>
        </div>
        {msg && <p className={msg.ok ? 'wa-ok' : 'wa-warn'} data-testid="wa-server-status">{msg.text}</p>}
        <p className="c-muted wa-srv-fallback">{L('fallbackNote')}</p>
      </div>
    </section>
  );
}
