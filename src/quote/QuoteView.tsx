import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { LOCATIONS, type QMode } from './locations';
import {
  INCOTERMS,
  chargeableKg,
  missingIssues,
  parseRequest,
  resolveForMode,
  type DgState,
  type Issue,
  type QuoteFields,
} from './parser';
import { CSV_COLUMNS, buildQuote, loadRateCsv, sampleRates, type Quote, type RateRow, type Side } from './rates';
import { SAMPLE_REQUESTS } from './samples';
import './quote.css';

type Lang = 'en' | 'es';
type FieldKey = keyof QuoteFields;

const MODE_LABEL: Record<QMode, string> = { fcl: 'Ocean FCL', lcl: 'Ocean LCL', air: 'Air', road: 'Road' };
const MODE_LABEL_ES: Record<QMode, string> = { fcl: 'Marítimo FCL', lcl: 'Marítimo LCL (grupaje)', air: 'Aéreo', road: 'Carretera' };
const SIDE_LABEL: Record<Side, string> = { origin: 'Origin', freight: 'Main freight', destination: 'Destination', customs: 'Customs' };
const SIDE_ORDER: Side[] = ['origin', 'freight', 'destination', 'customs'];
const PENDING: Partial<Record<string, { en: string; es: string }>> = {
  mode: { en: 'transport mode', es: 'modo de transporte' },
  origin: { en: 'origin port / pickup address', es: 'puerto de origen / dirección de recogida' },
  destination: { en: 'destination', es: 'destino' },
  equipment: { en: 'equipment type', es: 'tipo de equipo' },
  weightKg: { en: 'gross weight', es: 'peso bruto' },
  volumeCbm: { en: 'dimensions / volume', es: 'medidas / volumen' },
  incoterm: { en: 'Incoterm', es: 'Incoterm' },
  readyDate: { en: 'cargo ready date', es: 'fecha de mercancía lista' },
  cargo: { en: 'commodity', es: 'tipo de mercancía' },
  dg: { en: 'DG status', es: 'si es mercancía peligrosa' },
};
const BASIS_LABEL: Record<string, string> = { per_container: 'cntr', per_kg: 'kg', per_wm: 'W/M', per_truck: 'truck', per_shipment: 'shpt' };

const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const money2 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

function fmtElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function fmtDate(iso: string | null, lang: Lang): string {
  if (!iso) return '—';
  if (iso === 'ASAP') return lang === 'es' ? 'lo antes posible' : 'ASAP';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function equipmentText(eq: Record<string, number>): string {
  return Object.entries(eq).map(([k, n]) => `${n}x${k}`).join(', ');
}

function parseEquipmentInput(s: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of s.split(/[,+;]/)) {
    const m = part.trim().toUpperCase().match(/^(\d+)\s*[X×*]?\s*(20GP|40GP|40HC|45HC|20RF|40RF|40OT|20OT|FTL)$/);
    if (m) out[m[2]] = (out[m[2]] || 0) + Number(m[1]);
  }
  return out;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }
}

function questionsText(issues: Issue[], lang: Lang): string {
  const qs = issues.filter((i) => i.question && i.kind !== 'assumed').map((i) => i.question![lang]);
  const assumed = issues.filter((i) => i.question && i.kind === 'assumed').map((i) => i.question![lang]);
  const all = [...qs, ...assumed];
  if (!all.length) return '';
  if (lang === 'es') {
    return `Hola,\n\nGracias por la solicitud. Para daros un precio en firme, ¿nos podéis confirmar lo siguiente?\n\n${all.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\nMientras tanto os adelantamos una cotización indicativa.\n\nUn saludo,`;
  }
  return `Hi,\n\nThanks for your request. To give you a firm price, could you please confirm:\n\n${all.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\nIn the meantime, please find an indicative quote below.\n\nBest regards,`;
}

function quoteText(f: QuoteFields, q: Quote, issues: Issue[], lang: Lang): string {
  const es = lang === 'es';
  const mode = f.mode ? (es ? MODE_LABEL_ES : MODE_LABEL)[f.mode] : '';
  const units = f.mode === 'fcl' || f.mode === 'road' ? equipmentText(f.equipment).replace(/x/g, '×') : f.mode === 'air' ? `${q.chargeable} kg ${es ? 'tasables' : 'chargeable'}` : `${q.units}`;
  const cargoBits = [f.cargo, f.dg === 'no' ? (es ? 'no peligrosa' : 'non-DG') : f.dg === 'yes' ? 'DG' : null].filter(Boolean).join(' · ');
  const weightBits = [f.pieces ? `${f.pieces} ${es ? 'bultos' : 'pcs'}` : null, f.weightKg ? `${f.weightKg.toLocaleString('en-US')} kg${f.mode === 'fcl' ? (es ? ' por contenedor' : ' per container') : ''}` : null, f.volumeCbm ? `${f.volumeCbm} cbm` : null].filter(Boolean).join(' / ');
  const cur = q.currencies.length === 1 ? q.currencies[0] : q.currencies.join('/');
  const width = Math.max(...q.lines.map((l) => l.charge.length), 12) + 2;
  const lines = [...q.lines]
    .sort((a, b) => SIDE_ORDER.indexOf(a.side) - SIDE_ORDER.indexOf(b.side))
    .map((l) => `  ${l.charge.padEnd(width)}${money(l.sell).padStart(10)}${l.stale ? (es ? '  (sujeto a confirmación)' : '  (subject to carrier confirmation)') : ''}`);
  const pending = [...new Set(issues.filter((i) => i.kind !== 'assumed' && i.question).map((i) => PENDING[i.field]?.[lang]).filter(Boolean))];
  const incotermLine = f.incoterm ?? (es ? 'FOB (por confirmar)' : 'FOB (to be confirmed)');
  const route = `${f.origin} → ${f.destination}`;
  const transit = q.transitDays != null ? (es ? `aprox. ${q.transitDays} días` : `approx. ${q.transitDays} days`) : es ? 'por confirmar' : 'to be confirmed';
  const excluded = q.excluded.map((l) => l.charge);
  if (es) {
    return [
      `Asunto: Cotización — ${units} ${route} (${mode}, ${incotermLine})`,
      '',
      'Hola,',
      '',
      'Gracias por vuestra solicitud. Os pasamos nuestra oferta:',
      '',
      `Ruta: ${route}`,
      `Modo: ${mode} · ${units}`,
      cargoBits || weightBits ? `Mercancía: ${[cargoBits, weightBits].filter(Boolean).join(' · ')}` : null,
      `Incoterm: ${incotermLine} · Mercancía lista: ${fmtDate(f.readyDate, 'es')}`,
      `Tránsito: ${transit}`,
      '',
      `Cargos (${cur}):`,
      ...lines,
      `  ${'TOTAL'.padEnd(width)}${money(q.sellTotal).padStart(10)}`,
      '',
      `Validez: hasta ${fmtDate(q.validUntil, 'es')}, sujeto a disponibilidad de espacio y equipo en el momento de la reserva.`,
      `No incluido: aranceles, impuestos, seguro${excluded.length ? `, ${excluded.join(', ')}` : ''} y cualquier concepto no detallado.`,
      pending.length ? `Pendiente de confirmar: ${pending.join('; ')}.` : null,
      '',
      'Un saludo,',
    ].filter((x) => x !== null).join('\n');
  }
  return [
    `Subject: Quotation — ${units} ${route} (${mode}, ${incotermLine})`,
    '',
    'Hi,',
    '',
    'Thank you for your request. Please find our offer below:',
    '',
    `Route: ${route}`,
    `Mode: ${mode} · ${units}`,
    cargoBits || weightBits ? `Cargo: ${[cargoBits, weightBits].filter(Boolean).join(' · ')}` : null,
    `Incoterm: ${incotermLine} · Cargo ready: ${fmtDate(f.readyDate, 'en')}`,
    `Transit time: ${transit}`,
    '',
    `Charges (${cur}):`,
    ...lines,
    `  ${'TOTAL'.padEnd(width)}${money(q.sellTotal).padStart(10)}`,
    '',
    `Validity: until ${fmtDate(q.validUntil, 'en')}, subject to space and equipment availability at time of booking.`,
    `Not included: duties, taxes, insurance${excluded.length ? `, ${excluded.join(', ')}` : ''} and anything not listed above.`,
    pending.length ? `Subject to confirmation of: ${pending.join('; ')}.` : null,
    '',
    'Best regards,',
  ].filter((x) => x !== null).join('\n');
}

interface ChipProps {
  label: string;
  value: ReactNode;
  status: 'ok' | 'missing' | 'ambiguous' | 'assumed';
  evidence?: string;
  editing: boolean;
  onEdit: () => void;
  editor: ReactNode;
}

function Chip({ label, value, status, evidence, editing, onEdit, editor }: ChipProps) {
  return (
    <div className={`q-chip q-${status} ${editing ? 'editing' : ''}`}>
      <span className="q-chip-label">{label}</span>
      {editing ? (
        <span className="q-chip-editor">{editor}</span>
      ) : (
        <button type="button" className="q-chip-value" onClick={onEdit} title={evidence ? `Found: “${evidence}” — click to edit` : 'Click to edit'}>
          {value}
        </button>
      )}
      {status !== 'ok' && !editing && <span className="q-chip-flag">{status === 'missing' ? 'MISSING' : status === 'ambiguous' ? 'TO CONFIRM' : 'ASSUMED'}</span>}
    </div>
  );
}

export function QuoteView({ seed }: { seed?: { text: string; n: number } | null } = {}) {
  const [text, setText] = useState('');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [doneMs, setDoneMs] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [overrides, setOverrides] = useState<Partial<QuoteFields>>({});
  const [editing, setEditing] = useState<FieldKey | null>(null);
  const [margin, setMargin] = useState(15);
  const [rates, setRates] = useState<RateRow[]>(() => sampleRates());
  const [sheet, setSheet] = useState<{ name: string; rows: number; skipped: { line: number; reason: string }[] } | null>(null);
  const [extraLocs, setExtraLocs] = useState<string[]>([]);
  const [lang, setLang] = useState<Lang>('en');
  const [copied, setCopied] = useState<'quote' | 'questions' | null>(null);
  const [showFormat, setShowFormat] = useState(false);
  const [pdfInternal, setPdfInternal] = useState(false);
  const [pdfState, setPdfState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const fileRef = useRef<HTMLInputElement>(null);
  const quoteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (startedAt == null || doneMs != null) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [startedAt, doneMs]);

  const parsed = useMemo(() => parseRequest(text, extraLocs), [text, extraLocs]);

  const startFresh = (t: string) => {
    setText(t);
    setOverrides({});
    setEditing(null);
    setCopied(null);
    setDoneMs(null);
    setStartedAt(t.trim() ? Date.now() : null);
    setNow(Date.now());
    const p = parseRequest(t, extraLocs);
    setLang(p.language);
  };

  useEffect(() => {
    if (seed?.text) startFresh(seed.text);
  }, [seed?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  const mode = overrides.mode !== undefined ? overrides.mode : parsed.fields.mode;
  const originRes = parsed.originBase ? resolveForMode(parsed.originBase, mode) : null;
  const destRes = parsed.destBase ? resolveForMode(parsed.destBase, mode) : null;
  const fields: QuoteFields = {
    ...parsed.fields,
    mode,
    origin: originRes?.name ?? null,
    destination: destRes?.name ?? null,
    ...overrides,
  };
  if (overrides.mode !== undefined && overrides.origin === undefined) fields.origin = originRes?.name ?? null;
  if (overrides.mode !== undefined && overrides.destination === undefined) fields.destination = destRes?.name ?? null;

  const originOptions = overrides.origin === undefined ? originRes?.options : undefined;
  const destOptions = overrides.destination === undefined ? destRes?.options : undefined;

  const issues: Issue[] = useMemo(() => {
    if (!text.trim()) return [];
    const out: Issue[] = [];
    if (originOptions)
      out.push({
        field: 'origin',
        kind: 'ambiguous',
        message: `${parsed.originBase} has ${originOptions.length} container ports — ${originOptions.join(' or ')}. Different trucking, tolls and terminal fees.`,
        question: {
          en: `Which ${parsed.originBase} port should we quote from — ${originOptions.map((o) => o.replace(/^.*\((.*)\)$/, '$1')).join(' or ')}? If the factory address is known, we can suggest the cheaper one.`,
          es: `¿Desde qué puerto de ${parsed.originBase} cotizamos — ${originOptions.map((o) => o.replace(/^.*\((.*)\)$/, '$1')).join(' o ')}? Si nos pasáis la dirección de fábrica, os recomendamos el más económico.`,
        },
        options: originOptions,
      });
    if (destOptions)
      out.push({ field: 'destination', kind: 'ambiguous', message: `${parsed.destBase}: choose port (${destOptions.join(' / ')}).`, options: destOptions });
    for (const i of parsed.parseIssues) if (overrides[i.field as FieldKey] === undefined) out.push(i);
    for (const i of missingIssues(fields)) if (!out.some((o) => o.field === i.field && o.kind === i.kind)) out.push(i);
    const rank = { missing: 0, ambiguous: 1, confirm: 1, assumed: 2 };
    return out.sort((a, b) => rank[a.kind] - rank[b.kind]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, parsed, JSON.stringify(overrides), JSON.stringify(fields), originOptions?.join(), destOptions?.join()]);

  const statusOf = (k: FieldKey): ChipProps['status'] => {
    const mine = issues.filter((i) => i.field === k);
    if (mine.some((i) => i.kind === 'missing')) return 'missing';
    if (mine.some((i) => i.kind === 'ambiguous' || i.kind === 'confirm')) return 'ambiguous';
    if (mine.some((i) => i.kind === 'assumed')) return 'assumed';
    return 'ok';
  };

  const quote = useMemo(() => (text.trim() ? buildQuote(fields, rates, margin) : null), [text, JSON.stringify(fields), rates, margin]); // eslint-disable-line react-hooks/exhaustive-deps

  const alternatives = useMemo(() => {
    const opts = originRes?.options;
    if (!opts || !text.trim()) return [];
    return opts
      .filter((o) => o !== fields.origin)
      .map((o) => ({ name: o, q: buildQuote({ ...fields, origin: o }, rates, margin) }))
      .filter((a) => a.q && a.q.hasFreight);
  }, [originRes?.options?.join(), JSON.stringify(fields), rates, margin, text]); // eslint-disable-line react-hooks/exhaustive-deps

  const allLocations = useMemo(() => {
    const s = new Set<string>();
    for (const l of LOCATIONS) if (!l.choices || Object.keys(l.choices).length === 0) s.add(l.name);
    for (const r of rates) {
      if (r.origin !== '*') s.add(r.origin);
      if (r.destination !== '*') s.add(r.destination);
    }
    return [...s].sort();
  }, [rates]);

  const setField = <K extends FieldKey>(k: K, v: QuoteFields[K]) => setOverrides((o) => ({ ...o, [k]: v }));
  const closeEdit = () => setEditing(null);

  const onUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = loadRateCsv(String(reader.result ?? ''));
      if (res.rows.length) {
        setRates(res.rows);
        setExtraLocs(res.newLocations);
      }
      setSheet({ name: file.name, rows: res.rows.length, skipped: res.skipped });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const resetSample = () => {
    setRates(sampleRates());
    setSheet(null);
    setExtraLocs([]);
  };

  const qText = quote && quote.hasFreight ? quoteText(fields, quote, issues, lang) : '';
  const askText = questionsText(issues, lang);
  const elapsed = startedAt == null ? null : (doneMs ?? now - startedAt);
  const usingSample = !sheet || sheet.rows === 0;

  async function doPdf() {
    if (!quote || !quote.hasFreight) return;
    setPdfState('busy');
    try {
      const { generateQuotePdf } = await import('./pdf');
      const { blob, filename } = await generateQuotePdf({
        fields, quote, issues: issues.filter((i) => i.kind !== 'assumed'), lang, internal: pdfInternal, sampleRates: usingSample, sourceText: text, marginTarget: margin,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setPdfState('done');
      setTimeout(() => setPdfState('idle'), 2500);
    } catch (err) {
      console.warn('PDF generation failed', err);
      setPdfState('error');
    }
  }
  const templateHref = `${import.meta.env.BASE_URL}rate-sheet-template.csv`;

  const doCopy = async (what: 'quote' | 'questions') => {
    const ok = await copyText(what === 'quote' ? qText : askText);
    if (ok) {
      setCopied(what);
      if (what === 'quote' && startedAt != null && doneMs == null) setDoneMs(Date.now() - startedAt);
      window.setTimeout(() => setCopied((c) => (c === what ? null : c)), 2500);
    }
  };

  const lineGroups = quote ? SIDE_ORDER.map((s) => ({ side: s, lines: quote.lines.filter((l) => l.side === s) })).filter((g) => g.lines.length) : [];

  const sel = (k: FieldKey, value: string, options: { v: string; l: string }[], apply: (v: string) => void) => (
    <select
      autoFocus
      className="q-input"
      value={value}
      onChange={(e: ChangeEvent<HTMLSelectElement>) => {
        apply(e.target.value);
        closeEdit();
      }}
      onBlur={closeEdit}
      aria-label={k}
    >
      <option value="">—</option>
      {options.map((o) => (
        <option key={o.v} value={o.v}>
          {o.l}
        </option>
      ))}
    </select>
  );

  const inp = (k: FieldKey, value: string, apply: (v: string) => void, type: 'text' | 'number' | 'date' = 'text') => (
    <input
      autoFocus
      className="q-input"
      type={type}
      defaultValue={value}
      aria-label={k}
      onBlur={(e) => {
        apply(e.target.value);
        closeEdit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') closeEdit();
      }}
    />
  );

  const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));

  return (
    <div className="quote-view">
      <section className="q-left" aria-label="Customer request">
        <div className="q-panel">
          <div className="q-head">
            <h2>Paste a customer request (email / WhatsApp)</h2>
            {elapsed != null && (
              <span className={`q-timer ${doneMs != null ? 'done' : ''}`} title="From paste to copied quote">
                {doneMs != null ? 'QUOTE READY IN ' : 'TIME TO QUOTE '}
                <strong>{fmtElapsed(elapsed)}</strong>
              </span>
            )}
          </div>
          <textarea
            className="q-paste"
            placeholder="e.g. hi need price 2x40HC Shanghai to Barcelona, ready 20 Nov, FOB…"
            value={text}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
              const v = e.target.value;
              if (!text.trim() && v.trim()) startFresh(v);
              else {
                setText(v);
                if (!v.trim()) {
                  setStartedAt(null);
                  setDoneMs(null);
                }
              }
            }}
            onPaste={(e) => {
              const el = e.currentTarget;
              window.setTimeout(() => startFresh(el.value), 0);
            }}
            rows={4}
          />
          <div className="q-samples">
            <span className="q-muted">Try a sample:</span>
            {SAMPLE_REQUESTS.map((s) => (
              <button key={s.id} type="button" className="btn ghost sm" onClick={() => startFresh(s.text)} title={s.text}>
                {s.label}
              </button>
            ))}
            {text && (
              <button type="button" className="btn ghost sm" onClick={() => startFresh('')}>
                Clear
              </button>
            )}
          </div>
        </div>

        {text.trim() && (
          <div className={`q-summary ${quote && quote.hasFreight ? 'priced' : 'unpriced'}`} data-testid="quote-summary">
            {quote && quote.hasFreight ? (
              <>
                <span className="q-summary-tag">PRICED</span>
                <span className="mono">
                  SELL <strong>${money(quote.sellTotal)}</strong> · margin ${money(quote.marginUsd)} ({quote.marginPct}%) · {quote.transitDays ?? '?'} d
                </span>
                <span className="q-summary-meta">
                  {issues.filter((i) => i.kind === 'missing').length === 0
                    ? issues.filter((i) => i.kind === 'ambiguous' || i.kind === 'confirm').length === 0
                      ? 'all details present — ready to send'
                      : `${issues.filter((i) => i.kind === 'ambiguous' || i.kind === 'confirm').length} to confirm with customer`
                    : `${issues.filter((i) => i.kind === 'missing').length} missing`}
                </span>
                <button type="button" className="btn sm primary" onClick={() => quoteRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                  View quote →
                </button>
              </>
            ) : (
              <>
                <span className="q-summary-tag">NOT PRICED</span>
                <span>{!quote ? 'Needs mode, origin and destination.' : `No freight rate for ${fields.origin} → ${fields.destination} in this rate sheet.`}</span>
              </>
            )}
          </div>
        )}

        {text.trim() && (
          <div className="q-panel">
            <div className="q-head">
              <h2>What it read</h2>
              <span className="q-muted">click any field to fix it</span>
            </div>
            <div className="q-chips">
              <Chip label="Mode" status={statusOf('mode')} evidence={parsed.evidence.mode} editing={editing === 'mode'} onEdit={() => setEditing('mode')}
                value={fields.mode ? MODE_LABEL[fields.mode] : '—'}
                editor={sel('mode', fields.mode ?? '', (Object.keys(MODE_LABEL) as QMode[]).map((m) => ({ v: m, l: MODE_LABEL[m] })), (v) => setField('mode', (v || null) as QMode | null))} />
              <Chip label="Origin" status={statusOf('origin')} evidence={parsed.evidence.origin} editing={editing === 'origin'} onEdit={() => setEditing('origin')}
                value={fields.origin ?? '—'}
                editor={sel('origin', fields.origin ?? '', allLocations.map((l) => ({ v: l, l })), (v) => setField('origin', v || null))} />
              <Chip label="Destination" status={statusOf('destination')} evidence={parsed.evidence.destination} editing={editing === 'destination'} onEdit={() => setEditing('destination')}
                value={fields.destination ?? '—'}
                editor={sel('destination', fields.destination ?? '', allLocations.map((l) => ({ v: l, l })), (v) => setField('destination', v || null))} />
              {(fields.mode === 'fcl' || fields.mode === 'road' || Object.keys(fields.equipment).length > 0) && (
                <Chip label="Equipment" status={statusOf('equipment')} evidence={parsed.evidence.equipment} editing={editing === 'equipment'} onEdit={() => setEditing('equipment')}
                  value={equipmentText(fields.equipment) || '—'}
                  editor={inp('equipment', equipmentText(fields.equipment), (v) => setField('equipment', parseEquipmentInput(v)))} />
              )}
              <Chip label="Weight" status={statusOf('weightKg')} evidence={parsed.evidence.weightKg} editing={editing === 'weightKg'} onEdit={() => setEditing('weightKg')}
                value={fields.weightKg != null ? `${fields.weightKg.toLocaleString('en-US')} kg${fields.mode === 'fcl' ? ' / cntr' : fields.mode === 'road' && parsed.weightPerUnit ? ' / truck' : ''}` : '—'}
                editor={inp('weightKg', fields.weightKg != null ? String(fields.weightKg) : '', (v) => setField('weightKg', numOrNull(v)), 'number')} />
              <Chip label="Volume" status={statusOf('volumeCbm')} evidence={parsed.evidence.volumeCbm} editing={editing === 'volumeCbm'} onEdit={() => setEditing('volumeCbm')}
                value={fields.volumeCbm != null ? `${fields.volumeCbm} cbm` : '—'}
                editor={inp('volumeCbm', fields.volumeCbm != null ? String(fields.volumeCbm) : '', (v) => setField('volumeCbm', numOrNull(v)), 'number')} />
              {fields.mode === 'air' && (
                <div className="q-chip q-ok q-derived">
                  <span className="q-chip-label">Chargeable</span>
                  <span className="q-chip-static">{chargeableKg(fields.weightKg, fields.volumeCbm) ?? '—'} kg</span>
                  <span className="q-chip-hint">1:6000</span>
                </div>
              )}
              <Chip label="Pieces" status="ok" evidence={parsed.evidence.pieces} editing={editing === 'pieces'} onEdit={() => setEditing('pieces')}
                value={fields.pieces ?? '—'}
                editor={inp('pieces', fields.pieces != null ? String(fields.pieces) : '', (v) => setField('pieces', numOrNull(v)), 'number')} />
              <Chip label="Incoterm" status={statusOf('incoterm')} evidence={parsed.evidence.incoterm} editing={editing === 'incoterm'} onEdit={() => setEditing('incoterm')}
                value={fields.incoterm ?? '—'}
                editor={sel('incoterm', fields.incoterm ?? '', INCOTERMS.map((i) => ({ v: i, l: i })), (v) => setField('incoterm', v || null))} />
              <Chip label="Ready" status={statusOf('readyDate')} evidence={parsed.evidence.readyDate} editing={editing === 'readyDate'} onEdit={() => setEditing('readyDate')}
                value={fmtDate(fields.readyDate, 'en')}
                editor={inp('readyDate', fields.readyDate && fields.readyDate !== 'ASAP' ? fields.readyDate : '', (v) => setField('readyDate', v || null), 'date')} />
              <Chip label="Cargo" status={statusOf('cargo')} evidence={parsed.evidence.cargo} editing={editing === 'cargo'} onEdit={() => setEditing('cargo')}
                value={fields.cargo ?? '—'}
                editor={inp('cargo', fields.cargo ?? '', (v) => setField('cargo', v.trim() || null))} />
              <Chip label="DG" status={statusOf('dg')} evidence={parsed.evidence.dg} editing={editing === 'dg'} onEdit={() => setEditing('dg')}
                value={fields.dg === 'yes' ? 'Yes — DG' : fields.dg === 'no' ? 'No' : 'Unknown'}
                editor={sel('dg', fields.dg, [{ v: 'no', l: 'No' }, { v: 'yes', l: 'Yes — DG' }, { v: 'unknown', l: 'Unknown' }], (v) => setField('dg', (v || 'unknown') as DgState))} />
            </div>
          </div>
        )}

        {text.trim() && issues.length > 0 && (
          <div className="q-panel">
            <div className="q-head">
              <h2>What to ask the customer</h2>
              <span className="q-muted">{issues.filter((i) => i.kind === 'missing').length} missing · {issues.filter((i) => i.kind === 'ambiguous' || i.kind === 'confirm').length} to confirm · {issues.filter((i) => i.kind === 'assumed').length} assumed</span>
            </div>
            <ul className="q-issues">
              {issues.map((i, n) => (
                <li key={n} className={`q-issue q-${i.kind === 'confirm' ? 'ambiguous' : i.kind}`}>
                  <span className="q-issue-tag">{i.kind === 'missing' ? 'MISSING' : i.kind === 'assumed' ? 'ASSUMED' : 'TO CONFIRM'}</span>
                  <div>
                    <div className="q-issue-msg">{i.message}</div>
                    {i.question && <div className="q-issue-q">“{i.question[lang]}”</div>}
                    {i.options && (
                      <div className="q-options">
                        {i.options.map((o) => (
                          <button key={o} type="button" className={`btn sm ${fields[i.field as FieldKey] === o ? 'primary' : 'ghost'}`} onClick={() => setField(i.field as FieldKey, o as never)}>
                            {o}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {askText && (
              <div className="q-actions">
                <button type="button" className="btn sm" onClick={() => void doCopy('questions')}>
                  {copied === 'questions' ? 'Copied ✓' : 'Copy questions for customer'}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="q-right" aria-label="Quote">
        <div className={`q-banner ${usingSample ? 'sample' : 'own'}`}>
          <div>
            {usingSample ? (
              <>
                <strong>SAMPLE RATES</strong> — illustrative numbers, not market rates. Load your own rate sheet to quote for real.
              </>
            ) : (
              <>
                <strong>YOUR RATE SHEET</strong> — {sheet!.name} · {sheet!.rows} rows
              </>
            )}
          </div>
          <div className="q-banner-actions">
            <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={onUpload} data-testid="rate-upload" />
            <button type="button" className="btn sm primary" onClick={() => fileRef.current?.click()}>
              Load rate sheet (CSV)
            </button>
            <a className="btn sm ghost" href={templateHref} download="forwarddesk-rate-sheet-template.csv">
              Download rate sheet template
            </a>
            {!usingSample && (
              <button type="button" className="btn sm ghost" onClick={resetSample}>
                Use sample rates
              </button>
            )}
            <button type="button" className="btn sm ghost" onClick={() => setShowFormat((s) => !s)}>
              {showFormat ? 'Hide format' : 'CSV format'}
            </button>
          </div>
        </div>
        {sheet && sheet.skipped.length > 0 && (
          <div className="q-warn">
            {sheet.rows === 0 ? 'Could not load this file — ' : `${sheet.skipped.length} row(s) skipped — `}
            {sheet.skipped.slice(0, 4).map((s) => `line ${s.line}: ${s.reason}`).join(' · ')}
          </div>
        )}
        {showFormat && (
          <div className="q-panel q-format">
            <p>
              One row per charge. Columns (header row required, comma or semicolon separated): <code>{CSV_COLUMNS.join(', ')}</code>
            </p>
            <ul>
              <li><code>mode</code>: fcl · lcl · air · road — <code>side</code>: origin · freight · destination · customs</li>
              <li><code>basis</code>: per_container · per_kg (air = chargeable kg) · per_wm (LCL) · per_truck · per_shipment</li>
              <li><code>origin</code>/<code>destination</code>: port or city name; <code>*</code> = any (for local charges). <code>equipment</code>: 20GP, 40GP, 40HC, FTL or <code>*</code></li>
              <li><code>valid_until</code>: YYYY-MM-DD (or DD/MM/YYYY) — past dates are flagged STALE. Amounts are taken as-is (no FX conversion).</li>
            </ul>
          </div>
        )}

        {!text.trim() && (
          <div className="q-panel q-empty">
            <strong>Paste a request or pick a sample.</strong>
            <p>ForwardDesk reads the request, flags what's missing or ambiguous, prices it from the rate sheet, and writes the customer quote.</p>
          </div>
        )}

        {text.trim() && !quote && (
          <div className="q-panel q-empty">
            <strong>Need a mode, origin and destination to price.</strong>
            <p>Fix the flagged fields on the left.</p>
          </div>
        )}

        {quote && !quote.hasFreight && (
          <div className="q-panel q-empty">
            <strong>No {fields.mode ? MODE_LABEL[fields.mode] : ''} freight rate for {fields.origin} → {fields.destination}{fields.mode === 'fcl' ? ` (${Object.keys(fields.equipment).join(', ') || 'no equipment'})` : ''} in this rate sheet.</strong>
            <p>Add a <code>freight</code> row for this lane to the CSV, or change the lane on the left.</p>
          </div>
        )}

        {quote && quote.hasFreight && (
          <>
            {quote.staleCount > 0 && (
              <div className="q-warn stale">
                <strong>RATE TO RE-CHECK</strong> — {quote.lines.filter((l) => l.stale).map((l) => `${l.charge} expired ${fmtDate(l.validUntil, 'en')}`).join('; ')}. Re-check with the carrier before sending.
              </div>
            )}
            <div className="q-panel q-quote-panel" ref={quoteRef}>
              <div className="q-head">
                <h2>
                  Quote · {fields.origin} → {fields.destination}
                </h2>
                <span className="q-muted">{quote.units}</span>
              </div>
              <div className="q-scope">{quote.scopeNote}</div>
              <table className="q-table">
                <thead>
                  <tr>
                    <th>Charge</th>
                    <th className="num">Qty</th>
                    <th className="num">Buy</th>
                    <th className="num">Sell</th>
                    <th>Valid until</th>
                  </tr>
                </thead>
                <tbody>
                  {lineGroups.map((g) => (
                    <FragmentRows key={g.side} label={SIDE_LABEL[g.side]}>
                      {g.lines.map((l, i) => (
                        <tr key={i} className={l.stale ? 'stale' : ''}>
                          <td>{l.charge}</td>
                          <td className="num mono">
                            {money2(l.qty)} {BASIS_LABEL[l.basis]}
                          </td>
                          <td className="num mono">{money(l.buy)}</td>
                          <td className="num mono">{money(l.sell)}</td>
                          <td className="mono">
                            {l.validUntil}
                            {l.stale && <span className="q-stale-tag">STALE</span>}
                          </td>
                        </tr>
                      ))}
                    </FragmentRows>
                  ))}
                </tbody>
              </table>
              {quote.excluded.length > 0 && (
                <div className="q-excluded">Not in scope for {fields.incoterm ?? 'FOB (assumed)'}: {quote.excluded.map((l) => l.charge).join(' · ')}</div>
              )}
              <div className="q-margin">
                <label htmlFor="q-margin">
                  Margin target <strong className="mono">{margin}%</strong>
                </label>
                <input id="q-margin" type="range" min={0} max={40} step={1} value={margin} onChange={(e: ChangeEvent<HTMLInputElement>) => setMargin(Number(e.target.value))} />
              </div>
              <div className="q-totals">
                <div><span>BUY</span><strong className="mono">${money(quote.buyTotal)}</strong></div>
                <div className="sell"><span>SELL</span><strong className="mono">${money(quote.sellTotal)}</strong></div>
                <div className="margin"><span>MARGIN</span><strong className="mono">${money(quote.marginUsd)} <small>{quote.marginPct}%</small></strong></div>
                <div><span>TRANSIT</span><strong className="mono">{quote.transitDays != null ? `${quote.transitDays} d` : '—'}</strong></div>
                <div title="Earliest rate validity, capped at 14 days"><span>VALID TO</span><strong className="mono">{quote.validUntil ?? '—'}</strong></div>
              </div>
              {quote.currencies.length > 1 && <div className="q-warn">Mixed currencies in rate sheet ({quote.currencies.join(', ')}) — totals are not converted.</div>}
              {alternatives.length > 0 && (
                <div className="q-alt">
                  {alternatives.map((a) => (
                    <button key={a.name} type="button" className="btn sm ghost" onClick={() => setField('origin', a.name)}>
                      Compare ex {a.name}: SELL ${money(a.q!.sellTotal)} · {a.q!.transitDays ?? '?'} d{a.q!.staleCount ? '' : ' · rates current'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="q-panel">
              <div className="q-head">
                <h2>Customer quote</h2>
                <div className="q-lang" role="group" aria-label="Quote language">
                  <button type="button" className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
                  <button type="button" className={lang === 'es' ? 'active' : ''} onClick={() => setLang('es')}>ES</button>
                </div>
              </div>
              <pre className="q-text" data-testid="quote-text">{qText}</pre>
              <div className="q-actions">
                <button type="button" className="btn primary" onClick={() => void doCopy('quote')}>
                  {copied === 'quote' ? 'Copied ✓' : 'Copy quote'}
                </button>
                <button type="button" className="btn" data-testid="generate-pdf" disabled={pdfState === 'busy'} onClick={() => void doPdf()}>
                  {pdfState === 'busy' ? 'Building PDF…' : pdfState === 'done' ? 'PDF downloaded ✓' : pdfState === 'error' ? 'PDF failed — retry' : 'Generate PDF'}
                </button>
                <label className="q-pdf-internal" title="Adds buy and margin columns. Never send this version to the customer.">
                  <input type="checkbox" data-testid="pdf-internal" checked={pdfInternal} onChange={(e) => setPdfInternal(e.target.checked)} /> Internal (with buy/margin)
                </label>
              </div>
              <div className="q-muted q-send-note">Human sends it. Nothing is booked or emailed from here.</div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function FragmentRows({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <tr className="q-group">
        <td colSpan={5}>{label}</td>
      </tr>
      {children}
    </>
  );
}
