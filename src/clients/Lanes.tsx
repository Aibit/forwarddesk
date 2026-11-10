import { useMemo, useState } from 'react';
import { buildOptions, sampleRates } from '../quote/rates';
import type { QuoteFields } from '../quote/parser';
import { ct, type CKey } from './i18n';
import { PAYMENT_TERMS, PERIODS, TARGET_PER, VOL_UNITS, hsCheck, laneToRequest, newLane, targetUnits, type LaneProfile, type TargetPer, type VolPeriod, type VolUnit } from './lanes';
import { lineRank, type CLang, type Client } from './store';
import { MsdsSlot } from './Msds';
import './clients.css';

const PORTS = ['Bandar Abbas', 'Jebel Ali', 'Nhava Sheva', 'Mundra', 'Shanghai (Yangshan)', 'Shanghai (Waigaoqiao)', 'Ningbo', 'Hamburg', 'Barcelona', 'Valencia'];

export interface LaneBest { carrier: string; sell: number; perUnit: number | null; diff: number | null }
/** Best current sell option for a lane at the client's margin (sample rates; client "avoid" lines skipped). */
export function bestForLane(l: LaneProfile, c: Client): LaneBest | null {
  const { fields } = laneToRequest(l, c.name, c.incoterm);
  const f: QuoteFields = { mode: 'fcl', origin: null, destination: null, equipment: {}, weightKg: null, volumeCbm: null, pieces: null, incoterm: c.incoterm, readyDate: null, cargo: null, dg: 'no', ...fields };
  const opts = buildOptions(f, sampleRates(), c.marginPct).filter((o) => lineRank(c, o.carrier) !== 'avoid');
  if (!opts.length) return null;
  const o = opts.reduce((a, b) => (b.sellTotal < a.sellTotal ? b : a));
  const u = targetUnits(l.target.per, f);
  const perUnit = u ? o.sellTotal / u : null;
  return { carrier: o.carrier ?? '—', sell: o.sellTotal, perUnit, diff: perUnit != null && l.target.amount != null && l.target.currency === 'USD' && o.currencies.every((c) => c === 'USD') ? Math.round(perUnit - l.target.amount) : null };
}

export function TargetDelta({ diff, lang }: { diff: number | null; lang: CLang }) {
  if (diff == null) return null;
  const L = (k: CKey) => ct(lang, k);
  if (diff === 0) return <span className="t-delta ok">{L('atTarget')}</span>;
  return <span className={`t-delta ${diff < 0 ? 'ok' : 'warn'}`} data-testid="target-delta"><bdi dir="ltr">${Math.abs(diff).toLocaleString('en-US')}</bdi> {diff < 0 ? L('below') : L('above')}</span>;
}

export const fmtVolume = (l: LaneProfile, lang: CLang) =>
  l.volume.amount != null ? `${l.volume.amount} × ${l.volume.unit} / ${ct(lang, `p_${l.volume.period}` as CKey)}` : '—';
export const fmtTarget = (l: LaneProfile, lang: CLang) =>
  l.target.amount != null ? `${l.target.currency} ${l.target.amount.toLocaleString('en-US')} ${ct(lang, 'per')} ${l.target.per}` : '—';

export function LanesEditor({ lanes, onChange, lang, client, portal, onQuote, testid = 'lanes' }: {
  lanes: LaneProfile[]; onChange: (l: LaneProfile[]) => void; lang: CLang; client?: Client | null; portal?: boolean; onQuote?: (l: LaneProfile) => void; testid?: string;
}) {
  const L = (k: CKey) => ct(lang, k);
  const [editId, setEditId] = useState<string | null>(null);
  const up = (id: string, patch: Partial<LaneProfile>) => onChange(lanes.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const bests = useMemo(() => new Map(client && !portal ? lanes.map((l) => [l.id, bestForLane(l, client)]) : []), [lanes, client, portal]);
  return (
    <div className="c-lanes" data-testid={testid}>
      <datalist id="fd-ports">{PORTS.map((p) => <option key={p} value={p} />)}</datalist>
      {lanes.length === 0 && <div className="c-muted">{L('noAgents')}</div>}
      {lanes.map((l) => {
        const hs = hsCheck(l.hs, lang);
        if (editId === l.id) {
          const custom = !PAYMENT_TERMS.includes(l.payment);
          return (
            <div key={l.id} className="c-ag-edit" data-testid={`${testid}-edit`}>
              <div className="c-form c-form3">
                <label className="c-field"><span>{L('pol')}</span><input className="c-in" list="fd-ports" value={l.pol} onChange={(e) => up(l.id, { pol: e.target.value })} data-testid={`${testid}-pol`} /></label>
                <label className="c-field"><span>{L('pod')}</span><input className="c-in" list="fd-ports" value={l.pod} onChange={(e) => up(l.id, { pod: e.target.value })} data-testid={`${testid}-pod`} /></label>
                <label className="c-field"><span>{L('commodity')}</span><input className="c-in" value={l.commodity} onChange={(e) => up(l.id, { commodity: e.target.value })} data-testid={`${testid}-commodity`} /></label>
                <label className="c-field"><span>{L('hs')}</span>
                  <input className={`c-in ${hs.ok ? '' : 'warn'}`} value={l.hs} onChange={(e) => up(l.id, { hs: e.target.value })} placeholder="2713.20" dir="ltr" data-testid={`${testid}-hs`} />
                  <small className={hs.ok ? 'c-muted' : 'q-amber'} data-testid={`${testid}-hs-check`}>{hs.text}</small>
                </label>
                <label className="c-field"><span>{L('volume')}</span>
                  <span className="c-inline">
                    <input className="c-in" type="number" min={0} value={l.volume.amount ?? ''} onChange={(e) => up(l.id, { volume: { ...l.volume, amount: e.target.value === '' ? null : Number(e.target.value) } })} data-testid={`${testid}-vol`} />
                    <select className="c-in" value={l.volume.unit} onChange={(e) => up(l.id, { volume: { ...l.volume, unit: e.target.value as VolUnit } })}>{VOL_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
                    <select className="c-in" value={l.volume.period} onChange={(e) => up(l.id, { volume: { ...l.volume, period: e.target.value as VolPeriod } })}>{PERIODS.map((p) => <option key={p} value={p}>/ {L(`p_${p}` as CKey)}</option>)}</select>
                  </span>
                </label>
                <label className="c-field"><span>{L('payTerm')}</span>
                  <span className="c-inline">
                    <select className="c-in" value={custom ? '__custom' : l.payment} onChange={(e) => up(l.id, { payment: e.target.value === '__custom' ? '' : e.target.value })} data-testid={`${testid}-pay`}>
                      {PAYMENT_TERMS.map((p) => <option key={p} value={p}>{p}</option>)}
                      <option value="__custom">{L('custom')}</option>
                    </select>
                    {custom && <input className="c-in" value={l.payment} onChange={(e) => up(l.id, { payment: e.target.value })} placeholder="e.g. 30% advance, 70% CAD" />}
                  </span>
                </label>
                <label className="c-field wide"><span>{L('target')}</span>
                  <span className="c-inline">
                    <input className="c-in" type="number" min={0} value={l.target.amount ?? ''} onChange={(e) => up(l.id, { target: { ...l.target, amount: e.target.value === '' ? null : Number(e.target.value) } })} data-testid={`${testid}-target`} />
                    <select className="c-in" value={l.target.currency} onChange={(e) => up(l.id, { target: { ...l.target, currency: e.target.value } })}>{['USD', 'EUR', 'AED', 'CNY'].map((c) => <option key={c}>{c}</option>)}</select>
                    <select className="c-in" value={l.target.per} onChange={(e) => up(l.id, { target: { ...l.target, per: e.target.value as TargetPer } })}>{TARGET_PER.map((p) => <option key={p} value={p}>{L('per')} {p}</option>)}</select>
                  </span>
                </label>
                <label className="c-field"><span>{L('dgLane')}</span><input type="checkbox" checked={!!l.dg} onChange={(e) => up(l.id, { dg: e.target.checked })} data-testid={`${testid}-dg`} /></label>
                <div className="c-field wide"><span>MSDS</span><MsdsSlot hs={l.hs} dg={l.dg ? 'yes' : 'no'} meta={l.msds} onChange={(m) => up(l.id, { msds: m })} lang={lang} testid={`${testid}-msds-edit`} /></div>
                <label className="c-field wide"><span>{L('notes')}</span><input className="c-in" value={l.notes} onChange={(e) => up(l.id, { notes: e.target.value })} /></label>
              </div>
              <div className="c-form-actions">
                <button type="button" className="btn sm ghost" onClick={() => { onChange(lanes.filter((x) => x.id !== l.id)); setEditId(null); }}>{L('removeAgent')}</button>
                <span style={{ flex: 1 }} />
                {portal && <button type="button" className="btn sm primary" onClick={() => { up(l.id, { source: 'portal', submittedAt: Date.now() }); setEditId(null); }} data-testid={`${testid}-submit`}>{L('submitRfq')}</button>}
                <button type="button" className={`btn sm ${portal ? 'ghost' : 'primary'}`} onClick={() => setEditId(null)} data-testid={`${testid}-done`}>{L('done')}</button>
              </div>
            </div>
          );
        }
        const b = bests.get(l.id);
        return (
          <div key={l.id} className="c-lane" data-testid={`${testid}-row`}>
            <div className="c-lane-main">
              <strong><bdi>{l.pol || '—'} → {l.pod || '—'}</bdi></strong>
              {l.source === 'portal' && l.submittedAt && <span className="c-rank-chip rk-preferred">{portal ? L('submitted') : L('fromPortal')}</span>}
              <span className="c-sub">{l.commodity || '—'}{l.dg ? ' · DG' : ''}{l.hs ? <> · HS <bdi className="mono" dir="ltr">{l.hs}</bdi>{hs.text ? ` (${hs.text})` : ''}</> : null}</span>
              <span className="c-sub">{L('volume')} <bdi>{fmtVolume(l, lang)}</bdi> · {L('payTerm')}: {l.payment || '—'}</span>
            </div>
            <div className="c-lane-target">
              <span className="c-sub">{L('target')}</span>
              <bdi className="mono">{fmtTarget(l, lang)}</bdi>
              {!portal && client && (
                b ? (
                  <span className="c-sub">
                    {L('best')}: {b.carrier.replace(/^Sample /, '')} <bdi className="mono">{b.perUnit != null ? `$${Math.round(b.perUnit).toLocaleString('en-US')}` : `$${b.sell.toLocaleString('en-US')}`}</bdi>{b.perUnit != null ? ` ${L('allIn')} ${l.target.per}` : ''} <TargetDelta diff={b.diff} lang={lang} />
                  </span>
                ) : (
                  <span className="c-sub">{L('noRate')}</span>
                )
              )}
            </div>
            <div className="c-ag-btns">
              {onQuote && <button type="button" className="btn sm primary" onClick={() => onQuote(l)} data-testid={`${testid}-quote`}>{L('quoteLane')}</button>}
              <button type="button" className="btn sm ghost" onClick={() => setEditId(l.id)} data-testid={`${testid}-editbtn`}>{L('edit')}</button>
            </div>
            <div className="c-lane-msds"><MsdsSlot hs={l.hs} dg={l.dg ? 'yes' : 'no'} meta={l.msds} onChange={(m) => up(l.id, { msds: m })} lang={lang} testid={`${testid}-msds`} /></div>
          </div>
        );
      })}
      <div>
        <button type="button" className="btn sm ghost" onClick={() => { const l = newLane(); onChange([...lanes, l]); setEditId(l.id); }} data-testid={`${testid}-add`}>{L('addLane')}</button>
      </div>
      {portal && <p className="c-muted c-small">{L('rfqNote')}</p>}
    </div>
  );
}
