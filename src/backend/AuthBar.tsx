import { useUiLang } from '../ui/lang';
import { Art } from '../ui/Art';
import { useState, type FormEvent } from 'react';
import { backendAvailable } from './config';
import { getSession, signIn, signOut, setSession, useSession } from './session';
import './auth.css';

type L3 = 'en' | 'es' | 'fa';
const T = {
  demo: ['Demo mode', 'Modo demo', 'حالت نمایشی'],
  demoTip: ['Sample data, kept in this browser only. No login needed.', 'Datos de ejemplo, solo en este navegador. Sin login.', 'داده نمونه، فقط در همین مرورگر. ورود لازم نیست.'],
  signIn: ['Sign in', 'Iniciar sesión', 'ورود'],
  signOut: ['Sign out', 'Cerrar sesión', 'خروج'],
  backToDemo: ['Back to demo mode', 'Volver al modo demo', 'بازگشت به حالت نمایشی'],
  live: ['Live', 'En vivo', 'آنلاین'],
  staff: ['staff', 'personal', 'کارمند'],
  client: ['client', 'cliente', 'مشتری'],
  connecting: ['Connecting…', 'Conectando…', 'در حال اتصال…'],
  title: ['Sign in to ForwardDesk', 'Entrar en ForwardDesk', 'ورود به ForwardDesk'],
  sub: ['Staff use the forwarder desk. Clients see only their own shipments and quotes.', 'El personal usa el escritorio del transitario. Los clientes solo ven sus envíos y cotizaciones.', 'کارکنان از میز فورواردر استفاده می‌کنند. مشتری فقط محموله‌ها و قیمت‌های خودش را می‌بیند.'],
  email: ['Email', 'Correo', 'ایمیل'],
  password: ['Password', 'Contraseña', 'رمز عبور'],
  cancel: ['Cancel', 'Cancelar', 'انصراف'],
  stayDemo: ['Visitors: no account needed — close this and keep using Demo mode.', 'Visitantes: no hace falta cuenta — cierra y sigue en modo demo.', 'بازدیدکنندگان: حساب لازم نیست — این را ببندید و در حالت نمایشی بمانید.'],
  badLogin: ['Email or password not recognised.', 'Correo o contraseña no reconocidos.', 'ایمیل یا رمز عبور درست نیست.'],
  noOrg: ['This account is not linked to a ForwardDesk organisation yet. Ask your forwarder.', 'Esta cuenta aún no está vinculada a una organización. Consulta a tu transitario.', 'این حساب هنوز به سازمانی وصل نشده است. از فورواردر بپرسید.'],
  denied: ['That change is not allowed for this account (security rules). Nothing was saved.', 'Ese cambio no está permitido para esta cuenta (reglas de seguridad). No se guardó nada.', 'این تغییر برای این حساب مجاز نیست (قواعد امنیتی). چیزی ذخیره نشد.'],
  offline: ['Cannot reach the server. Check the connection.', 'No se puede conectar con el servidor.', 'اتصال به سرور برقرار نشد.'],
  off: ['Online accounts are not configured in this build — Demo mode only.', 'Las cuentas en línea no están configuradas en esta versión — solo modo demo.', 'حساب آنلاین در این نسخه فعال نیست — فقط حالت نمایشی.'],
  compliance: [
    'Compliance: the online backend is Google Firebase (US company; Firebase Auth data is processed in the US). Use sample / demo data only until the sanctions questions are cleared.',
    'Cumplimiento: el backend en línea es Google Firebase (empresa de EE. UU.; los datos de Firebase Auth se procesan en EE. UU.). Usa solo datos de ejemplo hasta resolver las cuestiones de sanciones.',
    'انطباق: سرور آنلاین Google Firebase است (شرکت آمریکایی؛ داده‌های ورود در آمریکا پردازش می‌شود). تا روشن شدن مسائل تحریم فقط از داده نمونه استفاده کنید.',
  ],
  dismiss: ['Dismiss', 'Cerrar', 'بستن'],
} as const;
type K = keyof typeof T;
const I: Record<L3, 0 | 1 | 2> = { en: 0, es: 1, fa: 2 };
export const at = (lang: L3, k: K) => T[k][I[lang]];
export const errText = (lang: L3, e: string | null) =>
  !e ? '' : e === 'bad-login' ? at(lang, 'badLogin') : e === 'no-org' ? at(lang, 'noOrg') : e === 'denied' ? at(lang, 'denied') : e === 'offline' ? at(lang, 'offline') : e === 'backend-off' ? at(lang, 'off') : e;

export function ComplianceNote({ lang = 'en' }: { lang?: L3 }) {
  return <p className="fd-compliance" data-testid="compliance-note" dir={lang === 'fa' ? 'rtl' : 'ltr'}>⚠ {at(lang, 'compliance')}</p>;
}

export function SignInDialog({ onClose, initialLang = 'en' }: { onClose: () => void; initialLang?: L3 }) {
  const [lang, setLang] = useState<L3>(initialLang);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await signIn(email, pw);
      onClose();
    } catch {
      setErr(getSession().error ?? 'bad-login');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fd-modal-bg" onClick={onClose}>
      <form className="fd-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit} dir={lang === 'fa' ? 'rtl' : 'ltr'} lang={lang} data-testid="signin-dialog">
        <Art name="crane" className="fd-modal-art" />
        <div className="fd-modal-head">
          <h2>{at(lang, 'title')}</h2>
          <div className="q-lang" role="group" aria-label="Language">
            {(['en', 'es', 'fa'] as L3[]).map((l) => (
              <button key={l} type="button" className={lang === l ? 'active' : ''} onClick={() => setLang(l)}>{l === 'fa' ? 'FA فا' : l.toUpperCase()}</button>
            ))}
          </div>
        </div>
        <p className="fd-muted">{at(lang, 'sub')}</p>
        {!backendAvailable ? <p className="fd-amber">{at(lang, 'off')}</p> : (
          <>
            <label className="fd-field"><span>{at(lang, 'email')}</span><input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" required data-testid="signin-email" /></label>
            <label className="fd-field"><span>{at(lang, 'password')}</span><input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} dir="ltr" required data-testid="signin-password" /></label>
            {err && <p className="fd-amber" data-testid="signin-error">{errText(lang, err)}</p>}
          </>
        )}
        <ComplianceNote lang={lang} />
        <p className="fd-muted fd-small">{at(lang, 'stayDemo')}</p>
        <div className="fd-modal-actions">
          <button type="button" className="btn ghost sm" onClick={onClose}>{at(lang, 'cancel')}</button>
          {backendAvailable && <button type="submit" className="btn primary sm" disabled={busy} data-testid="signin-submit">{busy ? at(lang, 'connecting') : at(lang, 'signIn')}</button>}
        </div>
      </form>
    </div>
  );
}

/** Header control: Demo mode (default) ↔ signed-in live account. */
export function AuthBar() {
  const s = useSession();
  const [open, setOpen] = useState(false);
  const [lang] = useUiLang<L3>();
  return (
    <div className="fd-auth" data-testid="auth-bar">
      {s.mode === 'live' ? (
        <>
          <span className="fd-pill live" title={s.email ?? ''} data-testid="auth-live">● {at(lang, 'live')} · <bdi>{s.email}</bdi> · {at(lang, s.role === 'client' ? 'client' : 'staff')}</span>
          <button type="button" className="btn ghost sm" onClick={() => void signOut()} data-testid="auth-signout">{at(lang, 'backToDemo')}</button>
        </>
      ) : s.mode === 'connecting' ? (
        <span className="fd-pill">{at(lang, 'connecting')}</span>
      ) : (
        <>
          <span className="fd-pill demo" title={at(lang, 'demoTip')} data-testid="auth-demo">{at(lang, 'demo')}</span>
          <button type="button" className="btn ghost sm" onClick={() => setOpen(true)} data-testid="auth-signin">{at(lang, 'signIn')}</button>
        </>
      )}
      {s.error && s.mode !== 'connecting' && !open && (
        <span className="fd-toast" data-testid="auth-error">{errText(lang, s.error)} <button type="button" className="q-linklike" onClick={() => setSession({ error: null })}>{at(lang, 'dismiss')}</button></span>
      )}
      {open && <SignInDialog onClose={() => setOpen(false)} initialLang={lang} />}
    </div>
  );
}
