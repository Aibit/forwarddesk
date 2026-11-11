import type { ReactNode } from 'react';
import { Art, Icon, type ArtName, type NavIcon } from './Art';
import { useUiLang, type UiLang } from './lang';
import { useTheme } from './theme';
import { LogoMark } from './Brand';

export type ViewKey = 'jobs' | 'finance' | 'clients' | 'agents' | 'portal' | 'quote' | 'pipeline' | 'account';

const NAV: Record<ViewKey, { label: [string, string, string, string]; sub: [string, string, string, string]; art: ArtName; icon: NavIcon }> = {
  jobs: {
    label: ['Jobs', 'Expedientes', 'پرونده‌ها', 'الشحنات'],
    sub: ['Deadlines, free time and money at risk across every shipment.', 'Plazos, días libres y dinero en riesgo en cada envío.', 'مهلت‌ها، روزهای آزاد و پول در خطر در همه محموله‌ها.', 'المواعيد النهائية والفترة المجانية والأموال المعرّضة للخطر في كل شحنة.'],
    art: 'crane', icon: 'jobs',
  },
  finance: {
    label: ['Finance', 'Finanzas', 'مالی', 'المالية'],
    sub: ['Invoices, vendor bills, payments, ageing and job profit.', 'Facturas, proveedores, cobros, antigüedad y beneficio por expediente.', 'فاکتورها، صورتحساب تأمین‌کنندگان، پرداخت‌ها، سنی‌بندی و سود پرونده.', 'الفواتير وفواتير الموردين والمدفوعات وأعمار الديون وربح الشحنات.'],
    art: 'ship', icon: 'finance',
  },
  clients: {
    label: ['Clients', 'Clientes', 'مشتریان', 'العملاء'],
    sub: ['Client setup, lanes, MSDS and each client’s dashboard.', 'Alta de clientes, rutas, MSDS y el panel de cada cliente.', 'تعریف مشتری، مسیرها، MSDS و داشبورد هر مشتری.', 'إعداد العملاء والمسارات وMSDS ولوحة كل عميل.'],
    art: 'containers', icon: 'clients',
  },
  agents: {
    label: ['Agents', 'Agentes', 'نمایندگان', 'الوكلاء'],
    sub: ['Your agent CRM: overseas agents, lines and partners — contacts, lanes, activity and documents.', 'Tu CRM de agentes: agentes, navieras y socios — contactos, rutas, actividad y documentos.', 'CRM نمایندگان: نمایندگان خارجی، خطوط و شرکا — مخاطبان، مسیرها، فعالیت‌ها و مدارک.', 'نظام CRM للوكلاء: الوكلاء الخارجيون والخطوط والشركاء — جهات الاتصال والمسارات والنشاط والمستندات.'],
    art: 'map', icon: 'agents',
  },
  portal: {
    label: ['Client portal', 'Portal del cliente', 'پرتال مشتری', 'بوابة العميل'],
    sub: ['What your customer sees: shipments, quotes and draft B/L. Sell prices only.', 'Lo que ve tu cliente: envíos, cotizaciones y B/L borrador. Solo precios de venta.', 'آنچه مشتری می‌بیند: محموله‌ها، قیمت‌ها و پیش‌نویس بارنامه. فقط قیمت فروش.', 'ما يراه عميلك: الشحنات وعروض الأسعار ومسودة البوليصة. أسعار البيع فقط.'],
    art: 'ship', icon: 'portal',
  },
  quote: {
    label: ['Quote', 'Cotizar', 'قیمت‌دهی', 'عرض سعر'],
    sub: ['Paste a request, compare line options and send the customer quote.', 'Pega una solicitud, compara opciones de naviera y envía la cotización.', 'درخواست را بچسبانید، گزینه‌های خط را مقایسه کنید و قیمت را بفرستید.', 'الصق طلبًا، وقارن خيارات الخطوط، وأرسل عرض العميل.'],
    art: 'truck', icon: 'quote',
  },
  pipeline: {
    label: ['Sales pipeline', 'Embudo de ventas', 'قیف فروش', 'مسار المبيعات'],
    sub: ['Every inquiry, quote and booking by stage — with value and margin from your quotes and jobs.', 'Cada consulta, cotización y reserva por etapa, con valor y margen de tus cotizaciones y expedientes.', 'هر استعلام، پیشنهاد قیمت و رزرو به تفکیک مرحله — با ارزش و حاشیه سود از قیمت‌ها و پرونده‌ها.', 'كل استفسار وعرض وحجز حسب المرحلة — مع القيمة والهامش من عروضك وشحناتك.'],
    art: 'map', icon: 'pipeline',
  },
  account: {
    label: ['Account', 'Cuenta', 'حساب', 'الحساب'],
    sub: ['Your company profile, your team and invite links.', 'El perfil de tu empresa, tu equipo y los enlaces de invitación.', 'مشخصات شرکت، تیم و لینک‌های دعوت.', 'ملف شركتك وفريقك وروابط الدعوة.'],
    art: 'containers', icon: 'account',
  },
};
const LI: Record<UiLang, 0 | 1 | 2 | 3> = { en: 0, es: 1, fa: 2, ar: 3 };
const UI = {
  workspace: ['Workspace', 'Espacio de trabajo', 'فضای کار', 'مساحة العمل'],
  sales: ['Sales', 'Ventas', 'فروش', 'المبيعات'],
  language: ['Language', 'Idioma', 'زبان', 'اللغة'],
  dark: ['Dark mode', 'Modo oscuro', 'حالت تیره', 'الوضع الداكن'],
  menu: ['Menu', 'Menú', 'منو', 'القائمة'],
  close: ['Close menu', 'Cerrar menú', 'بستن منو', 'إغلاق القائمة'],
  tagline: ['Freight forwarding desk', 'Escritorio del transitario', 'میز کار فورواردر', 'مكتب الشحن والتخليص'],
} as const;
export const navLabel = (k: ViewKey, l: UiLang) => NAV[k].label[LI[l]];
export const ui = (k: keyof typeof UI, l: UiLang) => UI[k][LI[l]];

const GROUPS: { key: 'workspace' | 'sales'; items: ViewKey[] }[] = [
  { key: 'workspace', items: ['jobs', 'finance', 'clients', 'agents', 'portal'] },
  { key: 'sales', items: ['quote', 'pipeline'] },
];

export function Sidebar({ view, onPick, open, onClose, clientOnly, account = false }: { view: ViewKey; onPick: (v: ViewKey) => void; open: boolean; onClose: () => void; clientOnly: boolean; account?: boolean }) {
  const [lang, setLang] = useUiLang();
  const [theme, setTheme] = useTheme();
  return (
    <>
      <aside className={`nd-side ${open ? 'open' : ''}`} aria-label="ForwardDesk" data-testid="sidebar">
        <div className="nd-brand">
          <LogoMark size={46} />
          <div className="nd-brand-txt">
            <strong>ForwardDesk</strong>
            <span>{ui('tagline', lang)}</span>
          </div>
          <button type="button" className="nd-iconbtn nd-close" onClick={onClose} aria-label={ui('close', lang)}><Icon name="close" /></button>
        </div>
        <nav className="nd-nav" role="group" aria-label="ForwardDesk pages">
          {GROUPS.map((g) => {
            const items = clientOnly ? g.items.filter((k) => k === 'portal') : account && g.key === 'workspace' ? [...g.items, 'account' as ViewKey] : g.items;
            if (!items.length) return null;
            return (
              <div className="nd-group" key={g.key}>
                <div className="nd-group-h">{ui(g.key, lang)}</div>
                {items.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`nd-item ${view === k ? 'active' : ''}`}
                    aria-current={view === k ? 'page' : undefined}
                    onClick={() => onPick(k)}
                    data-testid={k === 'agents' ? 'tab-agents' : `nav-${k}`}
                  >
                    <Icon name={NAV[k].icon} />
                    <span>{navLabel(k, lang)}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="nd-side-foot">
          <div className="nd-group-h">{ui('language', lang)}</div>
          <div className="q-lang nd-lang" role="group" aria-label="Language">
            {(['en', 'es', 'fa', 'ar'] as UiLang[]).map((l) => (
              <button key={l} type="button" className={lang === l ? 'active' : ''} onClick={() => setLang(l)} data-testid={`ui-lang-${l}`}>{l === 'fa' ? 'فا' : l === 'ar' ? 'عر' : l.toUpperCase()}</button>
            ))}
          </div>
          <label className="nd-switch" data-testid="theme-toggle">
            <input type="checkbox" checked={theme === 'dark'} onChange={(e) => setTheme(e.target.checked ? 'dark' : 'light')} />
            <span className="nd-switch-ic"><Icon name={theme === 'dark' ? 'moon' : 'sun'} /></span>
            <span>{ui('dark', lang)}</span>
            <i aria-hidden="true" />
          </label>
        </div>
      </aside>
      {open && <div className="nd-scrim" onClick={onClose} aria-hidden="true" />}
    </>
  );
}

export function PageHeader({ view, children, compact }: { view: ViewKey; children?: ReactNode; compact?: boolean }) {
  const [lang] = useUiLang();
  const n = NAV[view];
  return (
    <header className={`nd-head ${compact ? 'compact' : ''}`} data-testid="page-header" dir={(lang === 'fa' || lang === 'ar') ? 'rtl' : 'ltr'} lang={lang}>
      <div className="nd-head-txt">
        <span className="nd-head-ic"><Icon name={n.icon} /></span>
        <h1>{n.label[LI[lang]]}</h1>
        <p>{n.sub[LI[lang]]}</p>
        {children && <div className="nd-head-extra">{children}</div>}
      </div>
      <Art name={n.art} className="nd-head-art" />
    </header>
  );
}
