import { useState } from 'react';
import type { Job } from '../jobs/data';
import { useTariffs, type Tariffs } from '../jobs/tariffs';
import { chequeAmount } from '../jobs/logic';
import { getStore } from '../clients/store';
import { useUiLang } from '../ui/lang';
import { bt, day, li, money, type BKey } from './i18n';
import { billingStore, ledgerFor, useBilling } from './store';
import {
  CURRENCIES, invDue, invOpen, invPaid, invState, invTotal, nextNo, pnl, releaseGate, round2, uid,
  type Invoice, type Ledger, type Line,
} from './model';
import { downloadBlob, invoicePdf } from './pdf';

/** Save a ledger with the House B/L release flag recomputed (Firestore rules read it). */
export function saveLedgerFor(job: Job, l: Ledger, _t?: Tariffs) {
  billingStore.saveLedger({ ...l, releaseOk: releaseGate(job, l).ok });
}
const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));

export function JobBilling({ job, sample }: { job: Job; sample: boolean }) {
  const [lang] = useUiLang();
  const L = (k: BKey) => bt(lang, k);
  const { ledgers, catalog } = useBilling();
  const tariffs = useTariffs();
  const now = Date.now();
  const l = ledgers[job.id] ?? ledgerFor(job);
  const save = (n: Ledger) => saveLedgerFor(job, n, tariffs);
  const p = pnl(l);
  const [pay, setPay] = useState<{ inv: string; amount: string; method: string; ref: string } | null>(null);
  const [bill, setBill] = useState<{ vendor: string; ref: string } | null>(null);
  const allNos = Object.values(ledgers).flatMap((x) => x.invoices.map((i) => i.no));

  const setLine = (id: string, patch: Partial<Line>) => save({ ...l, lines: l.lines.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  const addLine = () => save({ ...l, lines: [...l.lines, { id: uid('l'), code: catalog[0]?.code ?? 'OFR', desc: catalog[0]?.name[0] ?? '', qty: 1, currency: l.base, sell: null, buy: null, payer: job.customer, vendor: '', terms: 'prepaid' }] });
  const invoiceAll = () => {
    const open = l.lines.filter((x) => (x.sell ?? 0) > 0 && !x.invoiceId);
    const groups = new Map<string, Line[]>();
    for (const x of open) groups.set(`${x.payer}|${x.currency}`, [...(groups.get(`${x.payer}|${x.currency}`) ?? []), x]);
    const invs: Invoice[] = [];
    const nos = [...allNos];
    for (const [k, xs] of groups) {
      const [party, currency] = k.split('|');
      const no = nextNo('INV', nos);
      nos.push(no);
      invs.push({ id: uid('i'), no, kind: 'invoice', party: party || job.customer, currency, lineIds: xs.map((x) => x.id), issuedAt: now, dueDays: 15, status: 'draft' });
    }
    save({ ...l, invoices: [...l.invoices, ...invs], lines: l.lines.map((x) => ({ ...x, invoiceId: x.invoiceId ?? invs.find((i) => i.lineIds.includes(x.id))?.id ?? null })) });
  };
  const vendors = [...new Set(l.lines.filter((x) => (x.buy ?? 0) > 0 && !x.billId && x.vendor).map((x) => x.vendor))];
  const recordBill = () => {
    if (!bill) return;
    const xs = l.lines.filter((x) => (x.buy ?? 0) > 0 && !x.billId && x.vendor === bill.vendor);
    const byCcy = new Map<string, Line[]>();
    for (const x of xs) byCcy.set(x.currency, [...(byCcy.get(x.currency) ?? []), x]);
    const nos = [...allNos];
    const invs: Invoice[] = [...byCcy].map(([currency, ys]) => {
      const no = nextNo('BILL', nos);
      nos.push(no);
      return { id: uid('b'), no, kind: 'bill', party: bill.vendor, currency, lineIds: ys.map((y) => y.id), issuedAt: now, dueDays: 30, status: 'issued', ref: bill.ref };
    });
    save({ ...l, invoices: [...l.invoices, ...invs], lines: l.lines.map((x) => ({ ...x, billId: x.billId ?? invs.find((i) => i.lineIds.includes(x.id))?.id ?? null })) });
    setBill(null);
  };
  const setInv = (id: string, patch: Partial<Invoice>) => save({ ...l, invoices: l.invoices.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
  const voidInv = (inv: Invoice) => save({
    ...l,
    invoices: l.invoices.map((i) => (i.id === inv.id ? { ...i, status: 'void' } : i)),
    lines: l.lines.map((x) => (inv.kind === 'invoice' && x.invoiceId === inv.id ? { ...x, invoiceId: null } : inv.kind === 'bill' && x.billId === inv.id ? { ...x, billId: null } : x)),
  });
  const addPay = () => {
    if (!pay) return;
    const a = Number(pay.amount.replace(',', '.'));
    if (!(a > 0)) return;
    save({ ...l, payments: [...l.payments, { id: uid('p'), invoiceId: pay.inv, amount: round2(a), at: Date.now(), method: pay.method, ref: pay.ref }] });
    setPay(null);
  };
  const pdf = async (inv: Invoice, pl: 'en' | 'es') => {
    const r = await invoicePdf(job, l, inv, getStore().company, pl, sample);
    downloadBlob(r.blob, r.filename);
  };
  const usedCcy = [...new Set([...l.lines.map((x) => x.currency), ...l.invoices.map((i) => i.currency)])].filter((c) => c !== l.base);
  const B = (n: number) => money(lang, n, l.base);

  const invTable = (kind: 'invoice' | 'bill') => {
    const list = l.invoices.filter((i) => i.kind === kind);
    if (!list.length) return <p className="b-sub">—</p>;
    return (
      <table className="b-table" data-testid={`${kind}-table`}>
        <thead><tr><th>{L('no')}</th><th>{L('party')}</th><th>{L('due')}</th><th className="num">{L('total')}</th><th className="num">{kind === 'invoice' ? L('received') : L('paidOut')}</th><th className="num">{L('balance')}</th><th>{L('status')}</th><th /></tr></thead>
        <tbody>
          {list.map((inv) => {
            const st = invState(l, inv, now);
            return (
              <tr key={inv.id} data-testid={`inv-${inv.no}`}>
                <td><bdi className="mono">{inv.no}</bdi>{inv.ref ? <div className="b-sub mono">{inv.ref}</div> : null}</td>
                <td>{inv.party}</td>
                <td>{inv.status === 'draft' ? (
                  <input className="b-in xs" type="number" min={0} value={inv.dueDays} onChange={(e) => setInv(inv.id, { dueDays: Number(e.target.value) || 0 })} aria-label={L('dueDays')} />
                ) : day(lang, invDue(inv))}</td>
                <td className="num mono">{money(lang, invTotal(l, inv), inv.currency)}</td>
                <td className="num mono">{money(lang, invPaid(l, inv), inv.currency)}</td>
                <td className="num mono">{money(lang, invOpen(l, inv), inv.currency)}</td>
                <td><span className={`b-pill ${st}`}>{L(st)}</span></td>
                <td className="b-row-actions">
                  {inv.status === 'draft' && <button type="button" className="btn primary sm" onClick={() => setInv(inv.id, { status: 'issued', issuedAt: Date.now() })} data-testid={`issue-${inv.no}`}>{L('issue')}</button>}
                  {inv.status === 'issued' && invOpen(l, inv) > 0 && <button type="button" className="btn ghost sm" onClick={() => setPay({ inv: inv.id, amount: String(invOpen(l, inv)), method: 'Bank transfer', ref: '' })} data-testid={`pay-${inv.no}`}>{L('payment')}</button>}
                  {kind === 'invoice' && <button type="button" className="btn ghost sm" onClick={() => void pdf(inv, lang === 'es' ? 'es' : 'en')} data-testid={`pdf-${inv.no}`}>{L('pdf')}</button>}
                  {inv.status !== 'void' && invPaid(l, inv) === 0 && <button type="button" className="btn ghost sm" onClick={() => voidInv(inv)}>{L('void')}</button>}
                </td>
              </tr>
            );
          })}
          {pay && list.some((i) => i.id === pay.inv) && (
            <tr className="b-payrow" data-testid="pay-form">
              <td colSpan={8}>
                <label><span>{L('amount')}</span><input className="b-in" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} inputMode="decimal" data-testid="pay-amount" /></label>
                <label><span>{L('method')}</span><input className="b-in" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })} /></label>
                <label><span>{L('ref')}</span><input className="b-in" value={pay.ref} onChange={(e) => setPay({ ...pay, ref: e.target.value })} /></label>
                <button type="button" className="btn primary sm" onClick={addPay} data-testid="pay-save">{L('add')}</button>
                <button type="button" className="btn ghost sm" onClick={() => setPay(null)}>{L('cancel')}</button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    );
  };

  return (
    <div className="b-wrap" data-testid="job-billing">
      {l.sample && <p className="b-note"><span className="j-sample sm">{L('sample')}</span> {L('sampleNote')}</p>}
      <div className="b-tiles" data-testid="job-pnl">
        <div className="b-tile"><span>{L('revenue')}</span><strong className="mono">{B(p.revenue)}</strong></div>
        <div className="b-tile"><span>{L('cost')}</span><strong className="mono">{B(p.cost)}</strong></div>
        <div className="b-tile hi"><span>{L('profit')}</span><strong className="mono" data-testid="pnl-profit">{B(p.profit)}</strong><em>{p.marginPct != null ? `${L('margin')} ${p.marginPct}%` : ''}</em></div>
        <div className="b-tile"><span>{L('receivable')}</span><strong className="mono">{B(p.receivable)}</strong><em>{p.uninvoiced ? `${p.uninvoiced} ${L('toInvoice')}` : ''}</em></div>
        <div className="b-tile"><span>{L('payable')}</span><strong className="mono">{B(p.payable)}</strong></div>
      </div>
      {p.missingFx.length > 0 && <p className="b-msg amber" data-testid="missing-fx">{L('missingFx')} {p.missingFx.join(', ')} — {L('enterRate')}</p>}

      <section className="b-sec">
        <div className="b-sec-h">
          <h3>{L('charges')}</h3>
          <button type="button" className="btn ghost sm" onClick={addLine} data-testid="add-line">{L('addLine')}</button>
        </div>
        {l.lines.length ? (
          <div className="b-scroll">
            <table className="b-table b-lines" data-testid="charge-lines">
              <thead><tr><th>{L('code')}</th><th>{L('desc')}</th><th className="num">{L('qty')}</th><th>{L('ccy')}</th><th className="num">{L('sell')}</th><th>{L('payer')}</th><th className="num">{L('buy')}</th><th>{L('vendor')}</th><th>{L('terms')}</th><th className="num">{L('profit')}</th><th /></tr></thead>
              <tbody>
                {l.lines.map((x) => {
                  const lockS = !!x.invoiceId, lockB = !!x.billId;
                  const prof = ((x.sell ?? 0) - (x.buy ?? 0)) * x.qty;
                  return (
                    <tr key={x.id}>
                      <td>
                        <select className="b-in" value={x.code} disabled={lockS && lockB} onChange={(e) => { const c = catalog.find((k) => k.code === e.target.value); setLine(x.id, { code: e.target.value, desc: x.desc || (c ? c.name[li(lang)] : '') }); }}>
                          {[...catalog.map((k) => k.code), ...(catalog.some((k) => k.code === x.code) ? [] : [x.code])].map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td><input className="b-in wide" value={x.desc} disabled={lockS && lockB} onChange={(e) => setLine(x.id, { desc: e.target.value })} dir="auto" /></td>
                      <td className="num"><input className="b-in xs num" value={x.qty} disabled={lockS || lockB} onChange={(e) => setLine(x.id, { qty: Number(e.target.value) || 0 })} inputMode="decimal" /></td>
                      <td>
                        <select className="b-in" value={x.currency} disabled={lockS || lockB} onChange={(e) => setLine(x.id, { currency: e.target.value })}>
                          {[...new Set([...CURRENCIES, x.currency])].map((c) => <option key={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="num"><input className="b-in sm num" value={x.sell ?? ''} disabled={lockS} onChange={(e) => setLine(x.id, { sell: numOrNull(e.target.value) })} inputMode="decimal" data-testid="line-sell" /></td>
                      <td><input className="b-in" value={x.payer} disabled={lockS} onChange={(e) => setLine(x.id, { payer: e.target.value })} dir="auto" /></td>
                      <td className="num"><input className="b-in sm num" value={x.buy ?? ''} disabled={lockB} onChange={(e) => setLine(x.id, { buy: numOrNull(e.target.value) })} inputMode="decimal" data-testid="line-buy" /></td>
                      <td><input className="b-in" value={x.vendor} disabled={lockB} onChange={(e) => setLine(x.id, { vendor: e.target.value })} dir="auto" data-testid="line-vendor" /></td>
                      <td>
                        <select className="b-in" value={x.terms} onChange={(e) => setLine(x.id, { terms: e.target.value as Line['terms'] })}>
                          <option value="prepaid">P</option>
                          <option value="collect">C</option>
                        </select>
                      </td>
                      <td className="num mono">{money(lang, round2(prof), x.currency)}</td>
                      <td>{!lockS && !lockB && <button type="button" className="btn ghost sm" onClick={() => save({ ...l, lines: l.lines.filter((y) => y.id !== x.id) })} aria-label={L('remove')}>✕</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="b-sub">{L('noLines')}</p>
        )}
      </section>

      {usedCcy.length > 0 && (
        <section className="b-sec" data-testid="fx-panel">
          <h3>{L('fx')}</h3>
          <p className="b-sub">{L('fxNote')}</p>
          <div className="b-fx">
            {usedCcy.map((c) => (
              <label key={c} className={l.fx[c] ? '' : 'amber'}>
                <span>1 {c} =</span>
                <input className="b-in sm num" value={l.fx[c] ?? ''} placeholder={L('enterRate')} onChange={(e) => save({ ...l, fx: { ...l.fx, [c]: numOrNull(e.target.value) } })} inputMode="decimal" data-testid={`fx-${c}`} />
                <span>{l.base}</span>
              </label>
            ))}
          </div>
        </section>
      )}

      <section className="b-sec">
        <div className="b-sec-h">
          <h3>{L('invoices')}</h3>
          <button type="button" className="btn ghost sm" disabled={!p.uninvoiced} onClick={invoiceAll} data-testid="new-invoice">{L('newInvoice')}</button>
        </div>
        {invTable('invoice')}
      </section>

      <section className="b-sec">
        <div className="b-sec-h">
          <h3>{L('bills')}</h3>
          <button type="button" className="btn ghost sm" disabled={!vendors.length} onClick={() => setBill({ vendor: vendors[0], ref: '' })} data-testid="new-bill">{L('newBill')}</button>
        </div>
        {bill && (
          <div className="b-payrow box" data-testid="bill-form">
            <label><span>{L('vendor')}</span><select className="b-in" value={bill.vendor} onChange={(e) => setBill({ ...bill, vendor: e.target.value })}>{vendors.map((v) => <option key={v}>{v}</option>)}</select></label>
            <label><span>{L('vendorRef')}</span><input className="b-in" value={bill.ref} onChange={(e) => setBill({ ...bill, ref: e.target.value })} /></label>
            <button type="button" className="btn primary sm" onClick={recordBill} data-testid="bill-save">{L('add')}</button>
            <button type="button" className="btn ghost sm" onClick={() => setBill(null)}>{L('cancel')}</button>
          </div>
        )}
        {invTable('bill')}
      </section>

      <div className="b-two">
        <section className="b-sec">
          <h3>{L('cheques')}</h3>
          <p className="b-sub">{L('chequeRule')}</p>
          {job.cheques.length ? (
            <table className="b-table" data-testid="cheques">
              <tbody>
                {job.cheques.map((c, i) => {
                  const cn = job.containers.find((x) => x.no === c.container);
                  const back = c.kind === 'container' ? cn?.returned === 'ok' : job.containers.every((x) => x.returned === 'ok');
                  return (
                    <tr key={i}>
                      <td>{c.kind === 'container' ? <bdi className="mono">{c.container}</bdi> : L('cheques')}</td>
                      <td className="num mono">{money(lang, chequeAmount(job, c, tariffs), tariffs.currency)}</td>
                      <td className="num"><span className={`b-pill ${back ? 'paid' : 'open'}`}>{back ? L('emptyBack') : L('emptyOut')}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : <p className="b-sub">—</p>}
        </section>
      </div>
    </div>
  );
}
