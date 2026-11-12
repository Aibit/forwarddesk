import { useUiLang } from '../ui/lang';
import { Art } from '../ui/Art';
import { useState, type FormEvent } from 'react';
import { backendAvailable } from './config';
import { getSession, signIn, signOut, setSession, useSession } from './session';
import './auth.css';
import { AccountDialog } from './Accounts';

type L3 = 'en' | 'es' | 'fa' | 'ar';
const T = {
  demo: ['Demo mode', 'Modo demo', 'حالت نمایشی', 'الوضع التجريبي'],
  demoTip: ['Sample data, kept in this browser only. No login needed.', 'Datos de ejemplo, solo en este navegador. Sin login.', 'داده نمونه، فقط در همین مرورگر. ورود لازم نیست.', 'بيانات عيّنة، محفوظة في هذا المتصفح فقط. لا حاجة لتسجيل الدخول.'],
  signIn: ['Sign in', 'Entrar', 'ورود', 'دخول'],
  signOut: ['Sign out', 'Cerrar sesión', 'خروج', 'تسجيل الخروج'],
  backToDemo: ['Back to demo mode', 'Volver al modo demo', 'بازگشت به حالت نمایشی', 'العودة إلى الوضع التجريبي'],
  live: ['Live', 'En vivo', 'آنلاین', 'مباشر'],
  staff: ['staff', 'personal', 'کارمند', 'موظف'],
  client: ['client', 'cliente', 'مشتری', 'عميل'],
  connecting: ['Connecting…', 'Conectando…', 'در حال اتصال…', 'جارٍ الاتصال…'],
  title: ['Sign in to ForwardDesk', 'Entrar en ForwardDesk', 'ورود به ForwardDesk', 'سجّل الدخول إلى ForwardDesk'],
  sub: ['Staff use the forwarder desk. Clients see only their own shipments and quotes.', 'El personal usa el escritorio del transitario. Los clientes solo ven sus envíos y cotizaciones.', 'کارکنان از میز فورواردر استفاده می‌کنند. مشتری فقط محموله‌ها و قیمت‌های خودش را می‌بیند.', 'الموظفون يستخدمون مكتب الشحن. العملاء يرون شحناتهم وعروض أسعارهم فقط.'],
  email: ['Email', 'Correo', 'ایمیل', 'البريد الإلكتروني'],
  password: ['Password', 'Contraseña', 'رمز عبور', 'كلمة المرور'],
  cancel: ['Cancel', 'Cancelar', 'انصراف', 'إلغاء'],
  stayDemo: ['Visitors: no account needed — close this and keep using Demo mode.', 'Visitantes: no hace falta cuenta — cierra y sigue en modo demo.', 'بازدیدکنندگان: حساب لازم نیست — این را ببندید و در حالت نمایشی بمانید.', 'الزوار: لا حاجة لحساب — أغلق هذا وواصل استخدام الوضع التجريبي.'],
  badLogin: ['Email or password not recognised.', 'Correo o contraseña no reconocidos.', 'ایمیل یا رمز عبور درست نیست.', 'البريد الإلكتروني أو كلمة المرور غير معروفين.'],
  noOrg: ['This account is not linked to a ForwardDesk organisation yet. Ask your forwarder.', 'Esta cuenta aún no está vinculada a una organización. Consulta a tu transitario.', 'این حساب هنوز به سازمانی وصل نشده است. از فورواردر بپرسید.', 'هذا الحساب غير مرتبط بمؤسسة على ForwardDesk بعد. اسأل وكيل الشحن الخاص بك.'],
  denied: ['That change is not allowed for this account (security rules). Nothing was saved.', 'Ese cambio no está permitido para esta cuenta (reglas de seguridad). No se guardó nada.', 'این تغییر برای این حساب مجاز نیست (قواعد امنیتی). چیزی ذخیره نشد.', 'هذا التغيير غير مسموح لهذا الحساب (قواعد الأمان). لم يُحفظ شيء.'],
  offline: ['Cannot reach the server. Check the connection.', 'No se puede conectar con el servidor.', 'اتصال به سرور برقرار نشد.', 'تعذّر الوصول إلى الخادم. تحقّق من الاتصال.'],
  off: ['Online accounts are not configured in this build — Demo mode only.', 'Las cuentas en línea no están configuradas en esta versión — solo modo demo.', 'حساب آنلاین در این نسخه فعال نیست — فقط حالت نمایشی.', 'الحسابات عبر الإنترنت غير مهيّأة في هذا الإصدار — الوضع التجريبي فقط.'],
  compliance: [
    'Real accounts are in preview. Until they officially open, use sample data only — don\'t enter confidential customer data.',
    'Las cuentas reales están en versión preliminar. Hasta su apertura oficial, usa solo datos de ejemplo; no introduzcas datos confidenciales de clientes.',
    'حساب‌های واقعی در مرحله پیش‌نمایش هستند. تا افتتاح رسمی فقط از داده نمونه استفاده کنید و اطلاعات محرمانه مشتری وارد نکنید.', 'الحسابات الحقيقية في مرحلة المعاينة. إلى أن تُفتح رسميًا، استخدم بيانات عيّنة فقط — لا تُدخل بيانات عملاء سرّية.',
  ],
  dismiss: ['Dismiss', 'Cerrar', 'بستن', 'تجاهل'],
  create: ['Create account', 'Crear cuenta', 'ساخت حساب', 'إنشاء حساب'],
  owner: ['owner', 'propietario', 'مالک', 'المالك'],
  ended: ['You were signed out. Sign in again to continue.', 'Se cerró tu sesión. Vuelve a entrar para continuar.', 'از حساب خارج شدید. برای ادامه دوباره وارد شوید.', 'تم تسجيل خروجك. سجّل الدخول مجددًا للمتابعة.'],
  limited: ['Too many attempts. Wait a few minutes and try again.', 'Demasiados intentos. Espera unos minutos y vuelve a probar.', 'تلاش‌ها زیاد بود. چند دقیقه صبر کنید و دوباره امتحان کنید.', 'محاولات كثيرة. انتظر بضع دقائق ثم أعد المحاولة.'],
} as const;
type K = keyof typeof T;
const I: Record<L3, 0 | 1 | 2 | 3> = { en: 0, es: 1, fa: 2, ar: 3 };
export const at = (lang: L3, k: K) => T[k][I[lang]];
export const errText = (lang: L3, e: string | null) =>
  !e ? '' : e === 'bad-login' ? at(lang, 'badLogin') : e === 'no-org' ? at(lang, 'noOrg') : e === 'denied' ? at(lang, 'denied') : e === 'offline' ? at(lang, 'offline') : e === 'backend-off' ? at(lang, 'off') : e === 'session-ended' ? at(lang, 'ended') : e === 'rate-limited' ? at(lang, 'limited') : e;

export function ComplianceNote({ lang = 'en' }: { lang?: L3 }) {
  return <p className="fd-compliance" data-testid="compliance-note" dir={(lang === 'fa' || lang === 'ar') ? 'rtl' : 'ltr'}>{at(lang, 'compliance')}</p>;
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
      <form className="fd-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit} dir={(lang === 'fa' || lang === 'ar') ? 'rtl' : 'ltr'} lang={lang} data-testid="signin-dialog">
        <Art name="crane" className="fd-modal-art" />
        <div className="fd-modal-head">
          <h2>{at(lang, 'title')}</h2>
          <div className="q-lang" role="group" aria-label="Language">
            {(['en', 'es', 'fa', 'ar'] as L3[]).map((l) => (
              <button key={l} type="button" className={lang === l ? 'active' : ''} onClick={() => setLang(l)}>{l === 'fa' ? 'FA فا' : l === 'ar' ? 'AR عر' : l.toUpperCase()}</button>
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
  const [open, setOpen] = useState<false | 'signin' | 'create'>(false);
  const [lang] = useUiLang<L3>();
  return (
    <div className="fd-auth" data-testid="auth-bar">
      {s.mode === 'live' ? (
        <>
          <span className="fd-pill live" title={s.email ?? ''} data-testid="auth-live">● <bdi>{s.orgName ?? at(lang, 'live')}</bdi> · <bdi>{s.email}</bdi> · {s.owner ? at(lang, 'owner') : at(lang, s.role === 'client' ? 'client' : 'staff')}</span>
          <button type="button" className="btn ghost sm" onClick={() => void signOut()} data-testid="auth-signout">{at(lang, 'signOut')}</button>
        </>
      ) : s.mode === 'connecting' ? (
        <span className="fd-pill">{at(lang, 'connecting')}</span>
      ) : (
        <>
          <span className="fd-pill demo" title={at(lang, 'demoTip')} data-testid="auth-demo">{at(lang, 'demo')}</span>
          <button type="button" className="btn ghost sm" onClick={() => setOpen('signin')} data-testid="auth-signin">{at(lang, 'signIn')}</button>
          <button type="button" className="btn primary sm" onClick={() => setOpen('create')} data-testid="auth-create">{at(lang, 'create')}</button>
        </>
      )}
      {s.error && s.mode !== 'connecting' && !open && (
        <span className="fd-toast" data-testid="auth-error">{errText(lang, s.error)} <button type="button" className="q-linklike" onClick={() => setSession({ error: null })}>{at(lang, 'dismiss')}</button></span>
      )}
      {open && <AccountDialog tab={open} onClose={() => setOpen(false)} />}
    </div>
  );
}
