import { useState } from 'react';
import { useJobs } from '../jobs/store';
import { getStore } from '../clients/store';
import { useUiLang } from '../ui/lang';
import { Art } from '../ui/Art';
import { bt, day, li, money, type BKey } from './i18n';
import { billingStore, useBilling } from './store';
import { BUCKETS, balanceOf, bucketOf, invDue, invOpen, invState, invTotal, pnl, toBase, type Bucket, type ChargeCode, type Invoice, type Ledger } from './model';
import { downloadBlob, invoicePdf } from './pdf';

type F = 'all' | 'unpaid' | 'overdue' | 'bills';

export function FinanceView({ onOpenJob }: { onOpenJob: (id: string) => void }) {
  const [lang] = useUiLang();
  const L = (k: BKey) => bt(lang, k);
  const { ledgers, catalog } = useBilling();
  const jobs = useJobs();
  const now = Date.now();
  const [f, setF] = useState<F>('unpaid');
  const [client, setClient] = useState('');
  const [nc, setNc] = useState({ code: '', name: '' });
  const base = 'USD';
  const all: { l: Ledger; inv: Invoice }[] = Object.values(ledgers).flatMap((l) => l.invoices.filter((i) => i.status !== 'void').map((inv) => ({ l, inv })));
  // Clients = the job's customer (same grouping as the Clients page), whoever the invoice is addressed to.
  const clients = [...new Set(all.filter((x) => x.inv.kind === 'invoice').map((x) => x.l.customer))].sort();
  const rows = all
    .filter(({ l, inv }) => {
      if (f === 'bills') return inv.kind === 'bill';
      if (inv.kind !== 'invoice') return false;
      if (client && l.customer !== client) return false;
      const st = invState(l, inv, now);
      if (f === 'unpaid') return st === 'open' || st === 'partial' || st === 'overdue' || st === 'draft';
      if (f === 'overdue') return st === 'overdue';
      return true;
    })
    .sort((a, b) => invDue(a.inv) - invDue(b.inv));

  // Totals in base currency; amounts with no entered FX rate are listed apart, never converted by guess.
  const unconverted = new Map<string, number>();
  const sumBase = (pick: (x: { l: Ledger; inv: Invoice }) => boolean) => all.filter(pick).reduce((s, { l, inv }) => {
    const open = invOpen(l, inv);
    const v = toBase(l, open, inv.currency);
    if (v == null && open > 0) unconverted.set(inv.currency, (unconverted.get(inv.currency) ?? 0) + open);
    return s + (v ?? 0);
  }, 0);
  const issuedInv = (x: { inv: Invoice }) => x.inv.kind === 'invoice' && x.inv.status === 'issued';
  const toCollect = sumBase(issuedInv);
  const overdue = sumBase((x) => issuedInv(x) && invState(x.l, x.inv, now) === 'overdue');
  const toPay = sumBase((x) => x.inv.kind === 'bill' && x.inv.status === 'issued');
  const profit = Object.values(ledgers).reduce((s, l) => s + pnl(l).profit, 0);
  const aging: Record<Bucket, number> = { current: 0, d30: 0, d60: 0, d90: 0, d90p: 0 };
  for (const x of all.filter(issuedInv)) aging[bucketOf(x.inv, now)] += toBase(x.l, invOpen(x.l, x.inv), x.inv.currency) ?? 0;
  const byClient = new Map<string, number>();
  for (const l of Object.values(ledgers)) byClient.set(l.customer, Math.round(((byClient.get(l.customer) ?? 0) + balanceOf(l, now).open) * 100) / 100);
  const B = (n: number) => money(lang, Math.round(n * 100) / 100, base);
  const anySample = Object.values(ledgers).some((l) => l.sample);
  const pdf = async (l: Ledger, inv: Invoice) => {
    const job = jobs.find((j) => j.id === l.jobId);
    if (!job) return;
    const r = await invoicePdf(job, l, inv, getStore().company, lang === 'es' ? 'es' : 'en', !!l.sample);
    downloadBlob(r.blob, r.filename);
  };
  const addCode = () => {
    const code = nc.code.trim().toUpperCase().slice(0, 12);
    if (!code || catalog.some((c) => c.code === code)) return;
    const n = nc.name.trim() || code;
    billingStore.saveCatalog([...catalog, { code, name: [n, n, n], side: 'both' } as ChargeCode]);
    setNc({ code: '', name: '' });
  };

  return (
    <div className="b-fin" data-testid="finance-view" dir={lang === 'fa' ? 'rtl' : 'ltr'} lang={lang}>
      {anySample && <p className="b-note"><span className="j-sample sm">{L('sample')}</span> {L('sampleNote')}</p>}
      <div className="b-tiles" data-testid="finance-tiles">
        <div className="b-tile"><span>{L('receivable')}</span><strong className="mono">{B(toCollect)}</strong></div>
        <div className={`b-tile ${overdue > 0 ? 'red' : ''}`}><span>{L('overdueF')}</span><strong className="mono" data-testid="fin-overdue">{B(overdue)}</strong></div>
        <div className="b-tile"><span>{L('payable')}</span><strong className="mono">{B(toPay)}</strong></div>
        <div className="b-tile hi"><span>{L('jobsProfit')}</span><strong className="mono">{B(profit)}</strong></div>
      </div>
      {unconverted.size > 0 && (
        <p className="b-msg amber" data-testid="fin-unconverted">{L('missingFx')} {[...unconverted].map(([c, v]) => money(lang, v, c)).join(', ')} — {L('enterRate')}</p>
      )}

      <section className="b-sec">
        <h3>{L('aging')}</h3>
        <div className="b-aging" data-testid="aging">
          {BUCKETS.map((k) => (
            <div key={k} className={`b-age ${k !== 'current' && aging[k] > 0 ? 'late' : ''}`} data-testid={`aging-${k}`}>
              <span>{L(k)}</span>
              <strong className="mono">{B(aging[k])}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="b-sec">
        <div className="b-sec-h">
          <h3>{L('invoices')}</h3>
          <div className="q-lang b-filters" role="group">
            {(['unpaid', 'overdue', 'all', 'bills'] as F[]).map((k) => (
              <button key={k} type="button" className={f === k ? 'active' : ''} onClick={() => setF(k)} data-testid={`fin-f-${k}`}>{L(k === 'unpaid' ? 'unpaidF' : k === 'overdue' ? 'overdueF' : k === 'all' ? 'allF' : 'billsF')}</button>
            ))}
          </div>
          <select className="b-in" value={client} onChange={(e) => setClient(e.target.value)} data-testid="fin-client" disabled={f === 'bills'}>
            <option value="">{L('allClients')}</option>
            {clients.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        {rows.length ? (
          <div className="b-scroll">
            <table className="b-table" data-testid="fin-table">
              <thead><tr><th>{L('no')}</th><th>{L('job')}</th><th>{L('party')}</th><th>{L('issued')}</th><th>{L('due')}</th><th className="num">{L('total')}</th><th className="num">{L('balance')}</th><th>{L('status')}</th><th /></tr></thead>
              <tbody>
                {rows.map(({ l, inv }) => {
                  const st = invState(l, inv, now);
                  return (
                    <tr key={`${l.jobId}-${inv.id}`} data-testid="fin-row">
                      <td><bdi className="mono">{inv.no}</bdi></td>
                      <td><button type="button" className="b-link mono" onClick={() => onOpenJob(l.jobId)} data-testid={`fin-job-${l.jobId}`}>{l.jobId}</button></td>
                      <td>{inv.party}</td>
                      <td>{day(lang, inv.issuedAt)}</td>
                      <td>{day(lang, invDue(inv))}</td>
                      <td className="num mono">{money(lang, invTotal(l, inv), inv.currency)}</td>
                      <td className="num mono">{money(lang, invOpen(l, inv), inv.currency)}</td>
                      <td><span className={`b-pill ${st}`}>{L(st)}</span></td>
                      <td>{inv.kind === 'invoice' && <button type="button" className="btn ghost sm" onClick={() => void pdf(l, inv)}>{L('pdf')}</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="fd-empty"><Art name="containers" className="fd-empty-art" /><p className="b-sub">{L('noInvoices')}</p></div>
        )}
      </section>

      <div className="b-two">
        <section className="b-sec">
          <h3>{L('byClient')}</h3>
          <table className="b-table" data-testid="by-client">
            <tbody>
              {[...byClient].filter(([, v]) => v > 0.005).sort((a, b) => b[1] - a[1]).map(([c, v]) => (
                <tr key={c}><td>{c}</td><td className="num mono" data-testid={`fin-client-bal-${c}`}>{B(v)}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="b-sec" data-testid="charge-catalog">
          <h3>{L('catalog')}</h3>
          <p className="b-sub">{L('catalogNote')}</p>
          <div className="b-codes">
            {catalog.map((c) => (
              <span key={c.code} className="b-code" title={c.name[li(lang)]}>
                <bdi className="mono">{c.code}</bdi> {c.name[li(lang)]}
              </span>
            ))}
          </div>
          <div className="b-payrow">
            <label><span>{L('code')}</span><input className="b-in sm" value={nc.code} onChange={(e) => setNc({ ...nc, code: e.target.value })} data-testid="code-new" /></label>
            <label><span>{L('name')}</span><input className="b-in" value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} dir="auto" /></label>
            <button type="button" className="btn ghost sm" onClick={addCode} data-testid="code-add">{L('add')}</button>
          </div>
        </section>
      </div>
    </div>
  );
}
