import { useEffect, useState } from 'react';
import { QuoteView } from './quote/QuoteView';
import { JobsView } from './jobs/JobsView';
import { ClientsView } from './clients/ClientsView';
import { PortalView } from './clients/PortalView';
import { AgentsDbView } from './agents/AgentsDbView';
import { PipelineView } from './sales/PipelineView';
import { AuthBar } from './backend/AuthBar';
import { AccountDialog, AccountView, GettingStarted, JOIN_KEY, OnboardingWizard, StartScreen, VerifyScreen } from './backend/Accounts';
import { useSession } from './backend/session';
import { clientForJob, getStore } from './clients/store';
import './App.css';
import './ui/notion.css';
import { FinanceView } from './billing/FinanceView';
import './billing/billing.css';
import { billingStore } from './billing/store';
import { useJobs } from './jobs/store';
import { useTariffs } from './jobs/tariffs';
import { Sidebar, PageHeader, navLabel, ui, type ViewKey } from './ui/Layout';
import { Icon } from './ui/Art';
import { useUiLang } from './ui/lang';
import { LogoMark } from './ui/Brand';

function App() {
  const [viewMode, setViewMode] = useState<ViewKey>('jobs');
  const [quoteSeed, setQuoteSeed] = useState<{ text: string; n: number; clientId?: string | null; laneId?: string | null } | null>(null);
  const [clientReq, setClientReq] = useState<{ id: string; n: number } | null>(null);
  const [jobReq, setJobReq] = useState<{ id: string; n: number } | null>(null);
  const sess = useSession();
  const [uiLang] = useUiLang();
  const [navOpen, setNavOpen] = useState(false);
  const clientOnly = sess.mode === 'live' && sess.role === 'client';
  // Two-mode entry: start screen until the visitor picks "Try the demo" (remembered) or signs in. ?demo skips it.
  const [entry, setEntry] = useState<string | null>(() => localStorage.getItem('fd.entry') ?? (new URLSearchParams(location.search).has('demo') ? 'demo' : null));
  const [resuming] = useState(() => localStorage.getItem('fd.live') === '1');
  const [acctDlg, setAcctDlg] = useState<null | 'create' | 'signin'>(null);
  const jobs = useJobs();
  const tariffs = useTariffs();
  useEffect(() => {
    const m = location.hash.match(/^#join=(.+)$/);
    if (!m) return;
    sessionStorage.setItem(JOIN_KEY, decodeURIComponent(m[1]));
    history.replaceState(null, '', location.pathname + location.search);
    setAcctDlg('create');
  }, []);
  // A new page starts at the top, not at the previous page's scroll position.
  useEffect(() => { window.scrollTo(0, 0); document.querySelector('.nd-scroll')?.scrollTo(0, 0); }, [viewMode]);
  useEffect(() => {
    if (viewMode === 'account' && !(sess.mode === 'live' && sess.role === 'staff')) setViewMode('jobs');
  }, [viewMode, sess.mode, sess.role]);
  useEffect(() => {
    if (clientOnly) setViewMode('portal');
  }, [clientOnly]);
  // The billing ledger is the single source of unpaid amounts: move legacy job charges onto invoice lines (staff / demo).
  useEffect(() => {
    if (!clientOnly && sess.mode !== 'connecting') billingStore.syncLegacy(jobs, tariffs);
  }, [jobs, tariffs, clientOnly, sess.mode]);
  const openClient = (id: string | null | undefined) => {
    if (!id) return;
    setClientReq((r) => ({ id, n: (r?.n ?? 0) + 1 }));
    setViewMode('clients');
  };
  const openJob = (id: string) => { setJobReq((r) => ({ id, n: (r?.n ?? 0) + 1 })); setViewMode('jobs'); };
  const pick = (v: ViewKey) => {
    if (v === 'jobs') setJobReq(null);
    if (v === 'clients') setClientReq(null);
    setViewMode(v);
    setNavOpen(false);
  };
  const shownView: ViewKey = clientOnly ? 'portal' : viewMode;

  if (sess.mode === 'verify') return <VerifyScreen />;
  if (sess.mode === 'onboard') return <OnboardingWizard />;
  if (!entry && (sess.mode === 'demo' || (sess.mode === 'connecting' && !resuming))) {
    return (
      <>
        <StartScreen onDemo={() => { localStorage.setItem('fd.entry', 'demo'); setEntry('demo'); }} onAccount={setAcctDlg} />
        {acctDlg && <AccountDialog tab={acctDlg} onClose={() => setAcctDlg(null)} />}
      </>
    );
  }

  return (
    <div className={`app nd ${navOpen ? 'nav-open' : ''}`} dir={(uiLang === 'fa' || uiLang === 'ar') ? 'rtl' : 'ltr'} lang={uiLang} data-view={shownView}>
      <Sidebar view={shownView} onPick={pick} open={navOpen} onClose={() => setNavOpen(false)} clientOnly={clientOnly} account={sess.mode === 'live' && sess.role === 'staff'} />
      {acctDlg && <AccountDialog tab={acctDlg} onClose={() => setAcctDlg(null)} />}
      <div className="nd-main">
      <header className="topbar nd-top">
        <button type="button" className="nd-iconbtn nd-burger" onClick={() => setNavOpen(true)} aria-label={ui('menu', uiLang)} data-testid="nav-open"><Icon name="menu" /></button>
        <div className="nd-crumb">
          <LogoMark size={28} className="nd-crumb-logo" />
          <span className="nd-crumb-root">ForwardDesk</span>
          <span className="nd-crumb-sep" aria-hidden="true">/</span>
          <span className="nd-crumb-page">{navLabel(shownView, uiLang)}</span>
        </div>
        <div className="nd-top-right" dir="ltr">
          <AuthBar />
        </div>
      </header>

      <div className="nd-scroll" data-testid="page-scroll">
      <div className="nd-page">
      <PageHeader view={shownView} />
      {(viewMode === 'jobs' || viewMode === 'agents' || viewMode === 'clients') && <GettingStarted onGo={(v) => pick(v)} />}
      {!clientOnly && viewMode === 'account' && sess.mode === 'live' && <AccountView />}

      {!clientOnly && viewMode === 'jobs' && (
        <JobsView
          openRequest={jobReq}
          onDraftQuote={(text, customer) => { setQuoteSeed((q) => ({ text, n: (q?.n ?? 0) + 1, clientId: customer ? clientForJob(getStore().clients, customer)?.id ?? null : null })); setViewMode('quote'); }}
          onOpenClient={(customer) => openClient(clientForJob(getStore().clients, customer)?.id)}
        />
      )}
      {!clientOnly && viewMode === 'finance' && <FinanceView onOpenJob={openJob} />}
      {!clientOnly && viewMode === 'clients' && (
        <ClientsView
          openRequest={clientReq}
          onOpenJob={openJob}
          onNewQuote={(clientId, laneId) => { setQuoteSeed((q) => ({ text: '', n: (q?.n ?? 0) + 1, clientId, laneId: laneId ?? null })); setViewMode('quote'); }}
        />
      )}
      {(viewMode === 'portal' || clientOnly) && <PortalView />}
      {!clientOnly && viewMode === 'agents' && <AgentsDbView />}
      {!clientOnly && viewMode === 'quote' && <QuoteView seed={quoteSeed} onOpenClient={openClient} />}
      {!clientOnly && viewMode === 'pipeline' && (
        <PipelineView onOpenJob={openJob} onOpenClient={openClient} onNewQuote={() => { setQuoteSeed((q) => ({ text: '', n: (q?.n ?? 0) + 1 })); setViewMode('quote'); }} />
      )}

      </div>
      </div>
      </div>
    </div>
  );
}

export default App;
