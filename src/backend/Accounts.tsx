// Two-mode entry (demo vs real account), self-serve sign-up, email verification, onboarding wizard,
// getting-started checklist and the Account settings page (company profile + team + invites).
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useUiLang, setUiLang, type UiLang } from '../ui/lang';
import { Art } from '../ui/Art';
import { backendAvailable, GOOGLE_SIGNIN } from './config';
import { accounts, act, getSession, signIn, signOut, useSession } from './session';
import { ComplianceNote, errText } from './AuthBar';
import { useAgentsDb } from '../agents/db';
import { useStore } from '../clients/store';
import { useJobs } from '../jobs/store';
import type { AccountProfile, TeamState } from './bridge';
import './accounts.css';

const T = {
  brandSub: ['The freight forwarder’s desk: deadlines, agents, documents and billing in one place.', 'El escritorio del transitario: plazos, agentes, documentos y facturación en un solo lugar.', 'میز کار فورواردر: مهلت‌ها، نمایندگان، اسناد و صورتحساب در یک جا.'],
  demoT: ['Try the demo', 'Probar la demo', 'امتحان نسخه نمایشی'],
  demoD: ['Explore with SAMPLE shipments, clients and agents. Nothing to sign up for; it stays in this browser.', 'Explora con envíos, clientes y agentes de EJEMPLO. Sin registro; se queda en este navegador.', 'با محموله، مشتری و نماینده نمونه کار کنید. ثبت‌نام لازم نیست؛ فقط در همین مرورگر می‌ماند.'],
  demoB: ['Open the demo', 'Abrir la demo', 'باز کردن نسخه نمایشی'],
  realT: ['Your own account', 'Tu propia cuenta', 'حساب خودتان'],
  realD: ['Create your company account, add your agents, clients and jobs, and invite your team. Starts empty — your data only.', 'Crea la cuenta de tu empresa, añade tus agentes, clientes y expedientes e invita a tu equipo. Empieza vacía: solo tus datos.', 'حساب شرکت خود را بسازید، نمایندگان، مشتریان و پرونده‌ها را اضافه کنید و تیم را دعوت کنید. خالی شروع می‌شود — فقط داده‌های شما.'],
  create: ['Create account', 'Crear cuenta', 'ساخت حساب'],
  signIn: ['Sign in', 'Iniciar sesión', 'ورود'],
  soon: ['Accounts open shortly — try the demo in the meantime.', 'Las cuentas abren muy pronto — mientras tanto, prueba la demo.', 'حساب‌ها به‌زودی باز می‌شوند — فعلاً نسخه نمایشی را امتحان کنید.'],
  name: ['Your name', 'Tu nombre', 'نام شما'],
  email: ['Email', 'Correo', 'ایمیل'],
  password: ['Password (8+ characters)', 'Contraseña (8+ caracteres)', 'رمز عبور (۸+ نویسه)'],
  pw: ['Password', 'Contraseña', 'رمز عبور'],
  google: ['Continue with Google', 'Continuar con Google', 'ادامه با گوگل'],
  or: ['or', 'o', 'یا'],
  forgot: ['Forgot password?', '¿Olvidaste la contraseña?', 'رمز را فراموش کرده‌اید؟'],
  resetT: ['Reset your password', 'Restablecer contraseña', 'بازنشانی رمز عبور'],
  resetB: ['Send reset link', 'Enviar enlace', 'ارسال لینک'],
  resetOk: ['If an account exists for that email, a reset link is on its way.', 'Si existe una cuenta con ese correo, te llega un enlace.', 'اگر حسابی با این ایمیل باشد، لینک بازنشانی ارسال شد.'],
  back: ['Back', 'Atrás', 'بازگشت'],
  cancel: ['Cancel', 'Cancelar', 'انصراف'],
  working: ['Working…', 'Procesando…', 'در حال انجام…'],
  createT: ['Create your ForwardDesk account', 'Crea tu cuenta de ForwardDesk', 'حساب ForwardDesk خود را بسازید'],
  signInT: ['Sign in to ForwardDesk', 'Entrar en ForwardDesk', 'ورود به ForwardDesk'],
  haveAcc: ['Already have an account? Sign in', '¿Ya tienes cuenta? Inicia sesión', 'حساب دارید؟ وارد شوید'],
  noAcc: ['New here? Create an account', '¿Nuevo? Crea una cuenta', 'تازه‌وارد هستید؟ حساب بسازید'],
  invited: ['You were invited to a team. Sign up or sign in with the invited email to join.', 'Te invitaron a un equipo. Regístrate o entra con el correo invitado para unirte.', 'به یک تیم دعوت شده‌اید. با همان ایمیل دعوت ثبت‌نام کنید یا وارد شوید.'],
  verifyT: ['Check your inbox', 'Revisa tu correo', 'صندوق ایمیل را ببینید'],
  verifyD: ['We sent a verification link to', 'Enviamos un enlace de verificación a', 'لینک تأیید فرستادیم به'],
  verifyD2: ['Open it, then come back and continue.', 'Ábrelo y vuelve para continuar.', 'آن را باز کنید و برگردید.'],
  verifyGo: ['I’ve verified — continue', 'Ya verifiqué — continuar', 'تأیید کردم — ادامه'],
  verifyNot: ['Not verified yet. Open the link in the email first.', 'Aún sin verificar. Abre primero el enlace del correo.', 'هنوز تأیید نشده. اول لینک ایمیل را باز کنید.'],
  resend: ['Resend email', 'Reenviar correo', 'ارسال دوباره'],
  resent: ['Sent again.', 'Enviado de nuevo.', 'دوباره ارسال شد.'],
  signOut: ['Sign out', 'Cerrar sesión', 'خروج'],
  onbT: ['Set up your company', 'Configura tu empresa', 'شرکت خود را تنظیم کنید'],
  onbD: ['You’ll be the owner. You can change all of this later in Account settings.', 'Serás el propietario. Puedes cambiarlo todo luego en Ajustes de la cuenta.', 'شما مالک حساب خواهید بود. بعداً در تنظیمات حساب قابل تغییر است.'],
  step: ['Step', 'Paso', 'مرحله'],
  of: ['of', 'de', 'از'],
  company: ['Company name', 'Nombre de la empresa', 'نام شرکت'],
  country: ['Country', 'País', 'کشور'],
  currency: ['Base currency', 'Moneda base', 'ارز پایه'],
  ports: ['Main ports (comma separated)', 'Puertos principales (separados por comas)', 'بندرهای اصلی (با کاما جدا کنید)'],
  lang: ['Language', 'Idioma', 'زبان'],
  next: ['Continue', 'Continuar', 'ادامه'],
  review: ['Review', 'Revisar', 'بازبینی'],
  createAcc: ['Create company account', 'Crear cuenta de empresa', 'ساخت حساب شرکت'],
  joinT: ['Joining a team instead?', '¿Te unes a un equipo?', 'به تیمی می‌پیوندید؟'],
  joinD: ['Paste the invite link or code your colleague sent you.', 'Pega el enlace o código de invitación que te enviaron.', 'لینک یا کد دعوت همکارتان را بچسبانید.'],
  joinB: ['Join team', 'Unirme', 'پیوستن'],
  role: ['Role', 'Rol', 'نقش'],
  owner: ['Owner', 'Propietario', 'مالک'],
  staff: ['Staff', 'Personal', 'کارمند'],
  client: ['Client', 'Cliente', 'مشتری'],
  gsT: ['Get started', 'Primeros pasos', 'شروع کار'],
  gsD: ['Your account is empty — no sample data. Add your own:', 'Tu cuenta está vacía, sin datos de ejemplo. Añade lo tuyo:', 'حساب شما خالی است — بدون داده نمونه. موارد خود را اضافه کنید:'],
  gsAgents: ['Add your first agents', 'Añade tus primeros agentes', 'اولین نمایندگان را اضافه کنید'],
  gsAgentsD: ['Type them in or import a CSV.', 'Escríbelos o importa un CSV.', 'دستی وارد کنید یا CSV وارد کنید.'],
  gsClients: ['Add a client', 'Añade un cliente', 'یک مشتری اضافه کنید'],
  gsJob: ['Open your first job', 'Abre tu primer expediente', 'اولین پرونده را باز کنید'],
  gsTeam: ['Invite your team', 'Invita a tu equipo', 'تیم را دعوت کنید'],
  open: ['Open', 'Abrir', 'باز کردن'],
  done: ['Done', 'Hecho', 'انجام شد'],
  hide: ['Hide', 'Ocultar', 'پنهان'],
  acctT: ['Company account', 'Cuenta de empresa', 'حساب شرکت'],
  save: ['Save', 'Guardar', 'ذخیره'],
  saved: ['Saved.', 'Guardado.', 'ذخیره شد.'],
  onlyOwner: ['Only the owner can change these.', 'Solo el propietario puede cambiar esto.', 'فقط مالک می‌تواند این‌ها را تغییر دهد.'],
  team: ['Team', 'Equipo', 'تیم'],
  you: ['you', 'tú', 'شما'],
  remove: ['Remove', 'Quitar', 'حذف'],
  removeQ: ['Remove this person from the account? They lose access immediately.', '¿Quitar a esta persona de la cuenta? Pierde el acceso al instante.', 'این شخص از حساب حذف شود؟ دسترسی فوراً قطع می‌شود.'],
  invite: ['Invite someone', 'Invitar a alguien', 'دعوت از کسی'],
  inviteD: ['ForwardDesk does not send this email — copy the link and send it yourself (WhatsApp, email…). It works once, for that email, for 14 days.', 'ForwardDesk no envía este correo: copia el enlace y envíalo tú (WhatsApp, correo…). Sirve una vez, para ese correo, 14 días.', 'ForwardDesk این ایمیل را نمی‌فرستد — لینک را کپی کنید و خودتان بفرستید (واتساپ، ایمیل…). یک بار، برای همان ایمیل، ۱۴ روز معتبر است.'],
  forClient: ['Client login for', 'Acceso de cliente para', 'ورود مشتری برای'],
  pickClient: ['Pick a client', 'Elige un cliente', 'یک مشتری انتخاب کنید'],
  createInv: ['Create invite link', 'Crear enlace de invitación', 'ساخت لینک دعوت'],
  pending: ['Pending invites', 'Invitaciones pendientes', 'دعوت‌های در انتظار'],
  none: ['None yet.', 'Ninguna aún.', 'هنوز هیچ.'],
  copy: ['Copy link', 'Copiar enlace', 'کپی لینک'],
  copied: ['Copied', 'Copiado', 'کپی شد'],
  revoke: ['Revoke', 'Revocar', 'لغو'],
  expires: ['expires', 'caduca', 'انقضا'],
  used: ['used', 'usada', 'استفاده شد'],
  staffOnlyTeam: ['Ask the account owner to invite staff. You can invite client logins.', 'Pide al propietario que invite al personal. Tú puedes invitar accesos de cliente.', 'برای دعوت کارمند از مالک بخواهید. شما می‌توانید مشتری دعوت کنید.'],
  tryDemo: ['Try the demo', 'Probar la demo', 'نسخه نمایشی'],
} as const;
type K = keyof typeof T;
const LI: Record<UiLang, 0 | 1 | 2> = { en: 0, es: 1, fa: 2 };
const useT = () => {
  const [lang] = useUiLang();
  return { lang, t: (k: K) => T[k][LI[lang]], dir: lang === 'fa' ? 'rtl' as const : 'ltr' as const };
};
const ERR: Record<string, [string, string, string]> = {
  'email-used': ['That email already has an account — sign in instead.', 'Ese correo ya tiene cuenta: inicia sesión.', 'این ایمیل قبلاً حساب دارد — وارد شوید.'],
  'weak-password': ['Use at least 8 characters.', 'Usa al menos 8 caracteres.', 'حداقل ۸ نویسه.'],
  popup: ['The Google window was closed before finishing.', 'La ventana de Google se cerró antes de terminar.', 'پنجره گوگل قبل از پایان بسته شد.'],
  'provider-off': ['That sign-in method is not switched on yet.', 'Ese método de acceso aún no está activado.', 'این روش ورود هنوز فعال نیست.'],
  'bad-code': ['That invite link or code was not found.', 'No se encontró ese enlace o código.', 'این لینک یا کد دعوت پیدا نشد.'],
  'used-code': ['That invite was already used.', 'Esa invitación ya se usó.', 'این دعوت قبلاً استفاده شده است.'],
  'wrong-email': ['That invite is for a different email address.', 'Esa invitación es para otro correo.', 'این دعوت برای ایمیل دیگری است.'],
};
const errMsg = (lang: UiLang, e: string | null) => (!e ? '' : ERR[e] ? ERR[e][LI[lang]] : errText(lang, e));

function LangSwitch() {
  const [lang] = useUiLang();
  return (
    <div className="q-lang" role="group" aria-label="Language">
      {(['en', 'es', 'fa'] as UiLang[]).map((l) => (
        <button key={l} type="button" className={lang === l ? 'active' : ''} onClick={() => setUiLang(l)} data-testid={`acc-lang-${l}`}>{l === 'fa' ? 'فا' : l.toUpperCase()}</button>
      ))}
    </div>
  );
}
function Page({ children, testid }: { children: ReactNode; testid: string }) {
  const { lang, dir } = useT();
  return (
    <div className="fd-entry" dir={dir} lang={lang} data-testid={testid}>
      <div className="fd-entry-top">
        <span className="fd-entry-brand"><span className="nd-logo">FD</span><strong>ForwardDesk</strong></span>
        <LangSwitch />
      </div>
      {children}
    </div>
  );
}

// ───────── Start screen ─────────
export const JOIN_KEY = 'fd.join';
export function StartScreen({ onDemo, onAccount }: { onDemo: () => void; onAccount: (tab: 'create' | 'signin') => void }) {
  const { t } = useT();
  return (
    <Page testid="start-screen">
      <div className="fd-entry-hero">
        <Art name="ship" className="fd-entry-art" />
        <h1>ForwardDesk</h1>
        <p>{t('brandSub')}</p>
      </div>
      <div className="fd-entry-cards">
        <section className="fd-entry-card">
          <Art name="containers" className="fd-entry-card-art" />
          <h2>{t('demoT')}</h2>
          <p>{t('demoD')}</p>
          <button type="button" className="btn primary" onClick={onDemo} data-testid="start-demo">{t('demoB')}</button>
        </section>
        <section className="fd-entry-card">
          <Art name="crane" className="fd-entry-card-art" />
          <h2>{t('realT')}</h2>
          <p>{t('realD')}</p>
          {backendAvailable ? (
            <div className="fd-entry-btns">
              <button type="button" className="btn primary" onClick={() => onAccount('create')} data-testid="start-create">{t('create')}</button>
              <button type="button" className="btn ghost" onClick={() => onAccount('signin')} data-testid="start-signin">{t('signIn')}</button>
            </div>
          ) : (
            <>
              <p className="fd-amber" data-testid="start-accounts-soon">{t('soon')}</p>
              <div className="fd-entry-btns">
                <button type="button" className="btn ghost" disabled data-testid="start-create">{t('create')}</button>
                <button type="button" className="btn ghost" disabled data-testid="start-signin">{t('signIn')}</button>
              </div>
            </>
          )}
        </section>
      </div>
    </Page>
  );
}

// ───────── Sign in / create / reset dialog ─────────
export function AccountDialog({ tab: tab0, onClose }: { tab: 'create' | 'signin'; onClose: () => void }) {
  const { lang, t, dir } = useT();
  const [tab, setTab] = useState<'create' | 'signin' | 'reset'>(tab0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const invited = !!sessionStorage.getItem(JOIN_KEY);
  const run = async (f: () => Promise<unknown>) => {
    setBusy(true); setErr(null); setNote(null);
    try { await f(); onClose(); } catch { setErr(getSession().error ?? 'bad-login'); } finally { setBusy(false); }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (tab === 'signin') void run(() => signIn(email, pw));
    else if (tab === 'create') {
      if (pw.length < 8) { setErr('weak-password'); return; }
      void run(() => act((m) => m.signUp(email, pw, name)));
    } else {
      setBusy(true); setErr(null);
      void act((m) => m.resetPassword(email), true).then(() => setNote(t('resetOk'))).catch(() => setNote(t('resetOk'))).finally(() => setBusy(false));
    }
  };
  return (
    <div className="fd-modal-bg" onClick={onClose}>
      <form className="fd-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit} dir={dir} lang={lang} data-testid="signin-dialog" data-tab={tab}>
        <Art name="crane" className="fd-modal-art" />
        <div className="fd-modal-head">
          <h2>{tab === 'create' ? t('createT') : tab === 'signin' ? t('signInT') : t('resetT')}</h2>
          <LangSwitch />
        </div>
        {invited && tab !== 'reset' && <p className="fd-note" data-testid="signin-invited">{t('invited')}</p>}
        {!backendAvailable ? (
          <>
            <p className="fd-amber" data-testid="signin-soon">{t('soon')}</p>
            <div className="fd-modal-actions">
              <button type="button" className="btn ghost sm" onClick={onClose}>{t('cancel')}</button>
              <button type="button" className="btn primary sm" onClick={onClose} data-testid="signin-try-demo">{t('tryDemo')}</button>
            </div>
          </>
        ) : (
          <>
            {tab !== 'reset' && GOOGLE_SIGNIN && (
              <>
                <button type="button" className="btn ghost fd-google" disabled={busy} onClick={() => void run(() => act((m) => m.googleSignIn!()))} data-testid="signin-google">
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" /><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" /><path fill="#FBBC05" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2z" /><path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.7 9.4 6 12 6z" /></svg>
                  {t('google')}
                </button>
                <div className="fd-or"><span>{t('or')}</span></div>
              </>
            )}
            {tab === 'create' && <label className="fd-field"><span>{t('name')}</span><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" data-testid="signup-name" /></label>}
            <label className="fd-field"><span>{t('email')}</span><input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" required data-testid="signin-email" /></label>
            {tab !== 'reset' && <label className="fd-field"><span>{tab === 'create' ? t('password') : t('pw')}</span><input type="password" autoComplete={tab === 'create' ? 'new-password' : 'current-password'} value={pw} onChange={(e) => setPw(e.target.value)} dir="ltr" required minLength={tab === 'create' ? 8 : undefined} data-testid="signin-password" /></label>}
            {err && <p className="fd-amber" data-testid="signin-error">{errMsg(lang, err)}</p>}
            {note && <p className="fd-note" data-testid="signin-note">{note}</p>}
            <div className="fd-links">
              {tab === 'signin' && <button type="button" className="q-linklike" onClick={() => setTab('reset')} data-testid="signin-forgot">{t('forgot')}</button>}
              {tab === 'signin' && <button type="button" className="q-linklike" onClick={() => setTab('create')} data-testid="signin-to-create">{t('noAcc')}</button>}
              {tab === 'create' && <button type="button" className="q-linklike" onClick={() => setTab('signin')} data-testid="signin-to-signin">{t('haveAcc')}</button>}
              {tab === 'reset' && <button type="button" className="q-linklike" onClick={() => setTab('signin')}>{t('back')}</button>}
            </div>
            <div className="fd-modal-actions">
              <button type="button" className="btn ghost sm" onClick={onClose}>{t('cancel')}</button>
              <button type="submit" className="btn primary sm" disabled={busy} data-testid="signin-submit">{busy ? t('working') : tab === 'create' ? t('create') : tab === 'signin' ? t('signIn') : t('resetB')}</button>
            </div>
          </>
        )}
        <ComplianceNote lang={lang} />
      </form>
    </div>
  );
}

// ───────── Verify email ─────────
export function VerifyScreen() {
  const { lang, t } = useT();
  const s = useSession();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const go = async () => {
    setBusy(true); setMsg(null);
    try { const ok = await act((m) => m.recheckVerified(), true); if (!ok) setMsg(t('verifyNot')); } catch { setMsg(errMsg(lang, getSession().error)); } finally { setBusy(false); }
  };
  return (
    <Page testid="verify-screen">
      <section className="fd-entry-panel">
        <Art name="clock" className="fd-entry-card-art" />
        <h2>{t('verifyT')}</h2>
        <p>{t('verifyD')} <bdi><strong data-testid="verify-email">{s.email}</strong></bdi>. {t('verifyD2')}</p>
        {msg && <p className="fd-amber" data-testid="verify-msg">{msg}</p>}
        <div className="fd-entry-btns">
          <button type="button" className="btn primary" disabled={busy} onClick={() => void go()} data-testid="verify-continue">{busy ? t('working') : t('verifyGo')}</button>
          <button type="button" className="btn ghost" onClick={() => void act((m) => m.resendVerification(), true).then(() => setMsg(t('resent'))).catch(() => undefined)} data-testid="verify-resend">{t('resend')}</button>
          <button type="button" className="btn ghost" onClick={() => void signOut()} data-testid="verify-signout">{t('signOut')}</button>
        </div>
      </section>
    </Page>
  );
}

// ───────── Onboarding wizard ─────────
const CURRENCIES = ['USD', 'EUR', 'AED', 'IRR', 'CNY', 'INR', 'TRY', 'GBP', 'SAR', 'OMR', 'QAR', 'PKR'];
export function ProfileFields({ p, set, disabled }: { p: AccountProfile; set: (p: AccountProfile) => void; disabled?: boolean }) {
  const { t } = useT();
  return (
    <div className="fd-form">
      <label className="fd-field"><span>{t('company')}</span><input value={p.name} disabled={disabled} onChange={(e) => set({ ...p, name: e.target.value })} required maxLength={120} data-testid="onb-name" /></label>
      <label className="fd-field"><span>{t('country')}</span><input value={p.country} disabled={disabled} onChange={(e) => set({ ...p, country: e.target.value })} maxLength={80} data-testid="onb-country" /></label>
      <label className="fd-field"><span>{t('currency')}</span>
        <select value={p.baseCurrency} disabled={disabled} onChange={(e) => set({ ...p, baseCurrency: e.target.value })} data-testid="onb-currency">
          {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label className="fd-field"><span>{t('ports')}</span><input value={p.ports.join(', ')} disabled={disabled} onChange={(e) => set({ ...p, ports: e.target.value.split(',').map((x) => x.trimStart()).slice(0, 12) })} dir="ltr" data-testid="onb-ports" /></label>
      <div className="fd-field"><span>{t('lang')}</span>
        <div className="q-lang" role="group">
          {(['en', 'es', 'fa'] as const).map((l) => (
            <button key={l} type="button" disabled={disabled} className={p.lang === l ? 'active' : ''} onClick={() => { set({ ...p, lang: l }); setUiLang(l); }} data-testid={`onb-lang-${l}`}>{l === 'fa' ? 'فارسی' : l === 'es' ? 'Español' : 'English'}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
const cleanPorts = (p: AccountProfile) => ({ ...p, ports: p.ports.map((x) => x.trim()).filter(Boolean) });
export function OnboardingWizard() {
  const { lang, t } = useT();
  const s = useSession();
  const [step, setStep] = useState<1 | 2>(1);
  const [p, setP] = useState<AccountProfile>({ name: '', country: '', baseCurrency: 'USD', ports: [], lang });
  const [code, setCode] = useState(() => sessionStorage.getItem(JOIN_KEY) ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async (f: () => Promise<unknown>) => {
    setBusy(true); setErr(null);
    try { await f(); sessionStorage.removeItem(JOIN_KEY); } catch { setErr(getSession().error); } finally { setBusy(false); }
  };
  const lbl = (r: string) => (r === 'owner' ? t('owner') : r === 'staff' ? t('staff') : t('client'));
  return (
    <Page testid="onboarding">
      <div className="fd-onb">
        <section className="fd-entry-panel">
          <div className="fd-steps" data-testid="onb-step">{t('step')} {step} {t('of')} 2</div>
          <h2>{step === 1 ? t('onbT') : t('review')}</h2>
          <p className="fd-muted">{t('onbD')} <bdi dir="ltr">{s.email}</bdi></p>
          {step === 1 ? (
            <form onSubmit={(e) => { e.preventDefault(); if (p.name.trim()) setStep(2); }}>
              <ProfileFields p={p} set={setP} />
              <div className="fd-entry-btns"><button type="submit" className="btn primary" disabled={!p.name.trim()} data-testid="onb-next">{t('next')}</button></div>
            </form>
          ) : (
            <>
              <dl className="fd-review" data-testid="onb-review">
                <dt>{t('company')}</dt><dd>{p.name}</dd>
                <dt>{t('country')}</dt><dd>{p.country || '—'}</dd>
                <dt>{t('currency')}</dt><dd>{p.baseCurrency}</dd>
                <dt>{t('ports')}</dt><dd dir="ltr">{cleanPorts(p).ports.join(', ') || '—'}</dd>
                <dt>{t('lang')}</dt><dd>{p.lang.toUpperCase()}</dd>
                <dt>{t('role')}</dt><dd>{lbl('owner')}</dd>
              </dl>
              {err && <p className="fd-amber" data-testid="onb-error">{errMsg(lang, err)}</p>}
              <div className="fd-entry-btns">
                <button type="button" className="btn ghost" onClick={() => setStep(1)}>{t('back')}</button>
                <button type="button" className="btn primary" disabled={busy} onClick={() => void run(() => act((m) => m.createAccount(cleanPorts(p)), true))} data-testid="onb-create">{busy ? t('working') : t('createAcc')}</button>
              </div>
            </>
          )}
        </section>
        <aside className="fd-entry-panel fd-join" data-testid="onb-join-panel">
          <Art name="agents" className="fd-entry-card-art" />
          <h3>{t('joinT')}</h3>
          <p className="fd-muted">{t('joinD')}</p>
          <input className="fd-code" value={code} onChange={(e) => setCode(e.target.value)} dir="ltr" placeholder="…#join=…" data-testid="onb-join-code" />
          {err && step === 1 && <p className="fd-amber" data-testid="onb-join-error">{errMsg(lang, err)}</p>}
          <button type="button" className="btn" disabled={busy || !code.trim()} onClick={() => void run(() => act((m) => m.joinWithCode(code), true))} data-testid="onb-join">{t('joinB')}</button>
          <button type="button" className="q-linklike" onClick={() => void signOut()} data-testid="onb-signout">{t('signOut')}</button>
        </aside>
      </div>
    </Page>
  );
}

// ───────── Getting started (real accounts) ─────────
const GS_HIDE = 'fd.gs.hidden';
export function GettingStarted({ onGo }: { onGo: (v: 'agents' | 'clients' | 'jobs' | 'account') => void }) {
  const { t, dir, lang } = useT();
  const s = useSession();
  const agents = useAgentsDb().list.length;
  const clients = useStore().clients.length;
  const jobs = useJobs().length;
  const [hidden, setHidden] = useState(() => localStorage.getItem(`${GS_HIDE}.${s.orgId}`) === '1');
  if (s.mode !== 'live' || s.role !== 'staff' || hidden || (agents && clients && jobs)) return null;
  const items: { k: 'agents' | 'clients' | 'jobs' | 'account'; title: K; sub?: K; done: boolean }[] = [
    { k: 'agents', title: 'gsAgents', sub: 'gsAgentsD', done: agents > 0 },
    { k: 'clients', title: 'gsClients', done: clients > 0 },
    { k: 'jobs', title: 'gsJob', done: jobs > 0 },
    { k: 'account', title: 'gsTeam', done: false },
  ];
  return (
    <section className="fd-gs" dir={dir} lang={lang} data-testid="getting-started">
      <div className="fd-gs-head">
        <div><h3>{t('gsT')}</h3><p className="fd-muted">{t('gsD')}</p></div>
        <button type="button" className="q-linklike" onClick={() => { localStorage.setItem(`${GS_HIDE}.${s.orgId}`, '1'); setHidden(true); }}>{t('hide')}</button>
      </div>
      <ol className="fd-gs-list">
        {items.map((i) => (
          <li key={i.k} className={i.done ? 'done' : ''}>
            <span className="fd-gs-dot" aria-hidden="true">{i.done ? '✓' : ''}</span>
            <span className="fd-gs-txt"><strong>{t(i.title)}</strong>{i.sub && <small>{t(i.sub)}</small>}</span>
            {i.done ? <span className="fd-muted">{t('done')}</span> : <button type="button" className="btn sm" onClick={() => onGo(i.k)} data-testid={`gs-${i.k}`}>{t('open')}</button>}
          </li>
        ))}
      </ol>
    </section>
  );
}

// ───────── Account settings ─────────
export function AccountView() {
  const { lang, t, dir } = useT();
  const s = useSession();
  const clients = useStore().clients;
  const [team, setTeam] = useState<TeamState>({ members: [], invites: [], org: null });
  const [p, setP] = useState<AccountProfile | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'staff' | 'client'>(s.owner ? 'staff' : 'client');
  const [cid, setCid] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState<(o: string, c: string) => string>(() => () => '');
  useEffect(() => {
    let off = () => undefined as void;
    let alive = true;
    void accounts().then((m) => {
      if (!alive) return;
      setJoinUrl(() => m.joinLink);
      off = m.watchTeam((x) => { setTeam(x); setP((cur) => cur ?? x.org); });
    });
    return () => { alive = false; off(); };
  }, [s.orgId]);
  const safe = async (f: () => Promise<unknown>, ok?: string) => {
    setMsg(null);
    try { await f(); if (ok) setMsg(ok); } catch (e) { setMsg(errMsg(lang, (e as { code?: string }).code ?? 'denied')); }
  };
  const lbl = (r: string) => (r === 'owner' ? t('owner') : r === 'staff' ? t('staff') : t('client'));
  const pend = team.invites.filter((i) => !i.usedBy);
  const copy = (txt: string, k: string) => { void navigator.clipboard?.writeText(txt).catch(() => undefined); setCopied(k); setTimeout(() => setCopied(null), 1500); };
  return (
    <div className="fd-acct" dir={dir} lang={lang} data-testid="account-view">
      <section className="fd-card">
        <h3>{t('acctT')}</h3>
        {!s.owner && <p className="fd-muted">{t('onlyOwner')}</p>}
        {p && (
          <form onSubmit={(e) => { e.preventDefault(); void safe(() => accounts().then((m) => m.updateAccount(cleanPorts(p))), t('saved')); }}>
            <ProfileFields p={p} set={setP} disabled={!s.owner} />
            {s.owner && <div className="fd-entry-btns"><button type="submit" className="btn primary sm" data-testid="acct-save">{t('save')}</button></div>}
          </form>
        )}
        {msg && <p className="fd-note" data-testid="acct-msg">{msg}</p>}
      </section>
      <section className="fd-card">
        <h3>{t('team')}</h3>
        <table className="fd-team" data-testid="team-members">
          <tbody>
            {team.members.map((m) => (
              <tr key={m.uid} data-testid={`member-${m.email}`}>
                <td><bdi dir="ltr">{m.email}</bdi>{m.uid === s.uid && <span className="fd-muted"> ({t('you')})</span>}{m.name ? <div className="fd-muted fd-small">{m.name}</div> : null}</td>
                <td><span className={`fd-role ${m.role}`}>{lbl(m.role)}</span>{m.role === 'client' && m.clientId ? <span className="fd-muted fd-small"> · {clients.find((c) => c.id === m.clientId)?.name ?? m.clientId}</span> : null}</td>
                <td className="fd-right">
                  {m.uid !== s.uid && m.role !== 'owner' && (s.owner || m.role === 'client') && (
                    <button type="button" className="btn ghost sm" onClick={() => { if (window.confirm(t('removeQ'))) void safe(() => accounts().then((x) => x.removeMember(m.uid))); }} data-testid={`member-remove-${m.email}`}>{t('remove')}</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="fd-card">
        <h3>{t('invite')}</h3>
        <p className="fd-muted">{t('inviteD')}</p>
        {!s.owner && <p className="fd-muted">{t('staffOnlyTeam')}</p>}
        <form className="fd-invite" onSubmit={(e) => {
          e.preventDefault();
          void safe(async () => { const m = await accounts(); await m.createInvite(email, role, role === 'client' ? cid : null); setEmail(''); });
        }}>
          <label className="fd-field"><span>{t('email')}</span><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" data-testid="invite-email" /></label>
          <label className="fd-field"><span>{t('role')}</span>
            <select value={role} onChange={(e) => setRole(e.target.value as 'staff' | 'client')} data-testid="invite-role">
              {s.owner && <option value="staff">{t('staff')}</option>}
              <option value="client">{t('client')}</option>
            </select>
          </label>
          {role === 'client' && (
            <label className="fd-field"><span>{t('forClient')}</span>
              <select value={cid} onChange={(e) => setCid(e.target.value)} required data-testid="invite-client">
                <option value="">{t('pickClient')}</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}
          <button type="submit" className="btn primary sm" disabled={!email.trim() || (role === 'client' && !cid)} data-testid="invite-send">{t('createInv')}</button>
        </form>
        <h4>{t('pending')}</h4>
        {pend.length === 0 ? <p className="fd-muted" data-testid="invites-none">{t('none')}</p> : (
          <ul className="fd-invites" data-testid="invites">
            {pend.map((i) => {
              const url = joinUrl(i.join.split('.')[0], i.code);
              return (
                <li key={i.code} data-testid={`invite-${i.email}`}>
                  <div><bdi dir="ltr">{i.email}</bdi> · {lbl(i.role)} <span className="fd-muted fd-small">· {t('expires')} {new Date(i.expiresAt).toLocaleDateString(lang === 'fa' ? 'fa-IR' : lang)}</span></div>
                  <code dir="ltr" data-testid="invite-link">{url}</code>
                  <div className="fd-entry-btns">
                    <button type="button" className="btn sm" onClick={() => copy(url, i.code)} data-testid="invite-copy">{copied === i.code ? t('copied') : t('copy')}</button>
                    <button type="button" className="btn ghost sm" onClick={() => void safe(() => accounts().then((m) => m.revokeInvite(i.code)))} data-testid="invite-revoke">{t('revoke')}</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="fd-card"><ComplianceNote lang={lang} /></section>
    </div>
  );
}

