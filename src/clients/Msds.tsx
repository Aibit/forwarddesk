import { useRef, useState, type ChangeEvent } from 'react';
import { MSDS_MAX, deleteMsds, fmtSize, loadMsds, ml, msdsNeed, saveMsds, setMsdsRules, useMsdsRules, DEFAULT_MSDS_RULES, type MsdsMeta, type MsdsRule } from './msds';
import type { CLang } from './store';

/** Status chip: required (amber, "to confirm" style) / optional (muted) / received (green). */
export function MsdsChip({ hs, dg, meta, lang }: { hs?: string | null; dg?: string | null; meta?: MsdsMeta | null; lang: CLang }) {
  const n = msdsNeed(hs, dg);
  const cls = meta ? 'ok' : n.need === 'required' ? 'req' : 'opt';
  return <span className={`msds-chip ${cls}`} data-testid="msds-chip" title={n.rule ? `HS ${n.rule.prefix}: ${n.rule.label} — ${ml(lang, 'sampleRule')}` : n.dg ? ml(lang, 'dgRule') : ''}>{meta ? ml(lang, 'received') : ml(lang, n.need)}</span>;
}

export async function viewMsds(meta: MsdsMeta) {
  const w = window.open('', '_blank');
  const b = await loadMsds(meta.id);
  if (!b) { w?.close(); window.alert('File not found in this browser.'); return; }
  const url = URL.createObjectURL(b);
  if (w) w.location.href = url; else window.location.href = url;
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function MsdsSlot({ hs, dg, meta, onChange, lang, testid = 'msds' }: { hs?: string | null; dg?: string | null; meta?: MsdsMeta | null; onChange: (m: MsdsMeta | null) => void; lang: CLang; testid?: string }) {
  useMsdsRules();
  const ref = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const n = msdsNeed(hs, dg);
  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!/^(application\/pdf|image\/)/.test(f.type) && !/\.(pdf|png|jpe?g|webp|gif)$/i.test(f.name)) return setErr(ml(lang, 'badType'));
    if (f.size > MSDS_MAX) return setErr(ml(lang, 'tooBig'));
    setErr(null);
    try {
      const m = await saveMsds(f);
      if (meta) void deleteMsds(meta.id);
      onChange(m);
    } catch (x) {
      setErr(String(x));
    }
  };
  return (
    <div className={`msds-slot ${meta ? 'ok' : n.need === 'required' ? 'req' : ''}`} data-testid={testid} onClick={(e) => e.stopPropagation()}>
      <MsdsChip hs={hs} dg={dg} meta={meta} lang={lang} />
      {!meta && n.need === 'required' && (n.rule || n.dg) && (
        <span className="c-sub">{n.rule ? <>HS <bdi dir="ltr">{n.rule.prefix}</bdi>: {n.rule.label}</> : ml(lang, 'dgRule')} · <em>{ml(lang, 'sampleRule')}</em></span>
      )}
      {meta ? (
        <span className="msds-file">
          <bdi className="mono" data-testid={`${testid}-name`}>{meta.name}</bdi> <span className="c-sub">({fmtSize(meta.size)})</span>
          <button type="button" className="q-linklike" onClick={() => void viewMsds(meta)} data-testid={`${testid}-view`}>{ml(lang, 'view')}</button>
          <button type="button" className="q-linklike" onClick={() => { void deleteMsds(meta.id); onChange(null); }} data-testid={`${testid}-remove`}>{ml(lang, 'remove')}</button>
          <button type="button" className="q-linklike" onClick={() => ref.current?.click()}>{ml(lang, 'replace')}</button>
        </span>
      ) : (
        <button type="button" className="btn sm ghost" onClick={() => ref.current?.click()} data-testid={`${testid}-upload`}>{ml(lang, 'upload')}</button>
      )}
      <span className="c-sub">{ml(lang, 'browserOnly')}</span>
      <input ref={ref} type="file" accept="application/pdf,image/*" hidden onChange={pick} data-testid={`${testid}-input`} />
      {err && <span className="q-amber">{err}</span>}
    </div>
  );
}

/** Editable rule list (sample rules, like tariffs). */
export function MsdsRulesEditor({ lang, onClose }: { lang: CLang; onClose: () => void }) {
  const rules = useMsdsRules();
  const [d, setD] = useState<MsdsRule[]>(rules);
  const up = (i: number, p: Partial<MsdsRule>) => setD(d.map((r, j) => (j === i ? { ...r, ...p } : r)));
  return (
    <section className="q-panel" data-testid="msds-rules">
      <div className="q-head"><h2>{ml(lang, 'rulesH')}</h2><span className="j-sample sm">{ml(lang, 'sampleRule')}</span></div>
      <p className="c-muted c-small">HS codes starting with these prefixes show “{ml(lang, 'required')}”; every other HS code shows “{ml(lang, 'optional')}”. Any cargo marked DG is always required. Saved in this browser only.</p>
      <div className="msds-rules">
        {d.map((r, i) => (
          <div key={i} className="msds-rule">
            <input className="c-in mono" value={r.prefix} onChange={(e) => up(i, { prefix: e.target.value.replace(/[^\d.]/g, '') })} placeholder="27" dir="ltr" data-testid={`msds-rule-prefix-${i}`} />
            <input className="c-in" value={r.label} onChange={(e) => up(i, { label: e.target.value })} />
            <button type="button" className="btn sm ghost" onClick={() => setD(d.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
      </div>
      <div className="c-form-actions">
        <button type="button" className="btn sm ghost" onClick={() => setD([...d, { prefix: '', label: '' }])} data-testid="msds-rule-add">+ rule</button>
        <button type="button" className="btn sm ghost" onClick={() => setD(DEFAULT_MSDS_RULES)}>Reset to sample</button>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn sm ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="btn sm primary" onClick={() => { setMsdsRules(d.filter((r) => r.prefix.replace(/\D/g, ''))); onClose(); }} data-testid="msds-rules-save">Save</button>
      </div>
    </section>
  );
}
