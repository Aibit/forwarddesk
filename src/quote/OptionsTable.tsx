// Quote screen: rich comparison table of the shipping options (lines for exports, overseas agents for imports,
// air / road options), with column chooser, sorting, filters, badges, select, side-by-side compare and export.
import { Fragment, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { QMode } from './locations';
import type { Quote } from './rates';
import { MODE_L, ol, type QLang } from './optlabels';
import {
  fmtInt, BADGE_ORDER, COLS, applicable, badgeLabel, buildRows, cellValue, colDef, colLabel, filterRows, fmtDay, freqText, routeText, sortRows, sourceText, tt,
  type ColKey, type Filters, type History, type OptRow,
} from './optrows';
import './opttable.css';

type L4 = readonly [string, string, string, string];
const IX: Record<QLang, number> = { en: 0, es: 1, fa: 2, ar: 3 };
const U = {
  title: ['Compare options', 'Comparar opciones', 'مقایسه گزینه‌ها', 'مقارنة الخيارات'],
  sub: ['one row per line or agent; click a column to sort', 'una fila por naviera o agente; pulse una columna para ordenar', 'هر ردیف یک خط یا نماینده؛ برای مرتب‌سازی روی ستون بزنید', 'صف لكل خط أو وكيل؛ انقر على عمود للترتيب'],
  columns: ['Columns', 'Columnas', 'ستون‌ها', 'الأعمدة'],
  reset: ['Reset', 'Restablecer', 'بازنشانی', 'إعادة الضبط'],
  allModes: ['All modes', 'Todos los modos', 'همه انواع حمل', 'كل أنواع الشحن'],
  directOnly: ['Direct only', 'Solo directos', 'فقط مستقیم', 'المباشر فقط'],
  validOnly: ['Valid rates only', 'Solo tarifas vigentes', 'فقط نرخ‌های معتبر', 'الأسعار السارية فقط'],
  compare: ['Compare', 'Comparar', 'مقایسه', 'مقارنة'],
  compareHint: ['Tick 2–4 options to compare side by side', 'Marque 2–4 opciones para compararlas', '۲ تا ۴ گزینه را برای مقایسه علامت بزنید', 'حدّد من ٢ إلى ٤ خيارات للمقارنة جنبًا إلى جنب'],
  sideBySide: ['Side by side', 'Lado a lado', 'مقایسه کنار هم', 'جنبًا إلى جنب'],
  close: ['Close', 'Cerrar', 'بستن', 'إغلاق'],
  exportB: ['Export', 'Exportar', 'خروجی', 'تصدير'],
  xlsx: ['Excel (.xlsx)', 'Excel (.xlsx)', 'اکسل (.xlsx)', 'إكسل (.xlsx)'],
  csv: ['CSV (.csv)', 'CSV (.csv)', 'CSV (.csv)', 'CSV (.csv)'],
  allCols: ['Include all columns', 'Incluir todas las columnas', 'همه ستون‌ها', 'تضمين كل الأعمدة'],
  expNote: ['Uses the current filters and sort; visible columns unless “all columns” is ticked.', 'Usa los filtros y el orden actuales; columnas visibles salvo que marque «todas».', 'با فیلتر و ترتیب فعلی؛ فقط ستون‌های نمایان مگر «همه ستون‌ها» را بزنید.', 'يستخدم الفلاتر والترتيب الحاليين؛ الأعمدة الظاهرة ما لم تحدّد «كل الأعمدة».'],
  select: ['Select', 'Elegir', 'انتخاب', 'اختيار'],
  selected: ['Selected', 'Elegida', 'انتخاب‌شده', 'مُختار'],
  none: ['No option matches these filters.', 'Ninguna opción coincide con estos filtros.', 'هیچ گزینه‌ای با این فیلترها نیست.', 'لا يوجد خيار يطابق هذه الفلاتر.'],
  quoteCur: ['Quote currency', 'Moneda de la oferta', 'ارز پیشنهاد', 'عملة العرض'],
  fxHint: ['enter the rate to convert', 'indique el cambio para convertir', 'نرخ تبدیل را وارد کنید', 'أدخل سعر الصرف للتحويل'],
  sampleNote: ['SAMPLE options and rates for the demo, not real carrier rates.', 'Opciones y tarifas de MUESTRA para la demo; no son tarifas reales.', 'گزینه‌ها و نرخ‌های نمونه برای دمو؛ نرخ واقعی خطوط نیستند.', 'خيارات وأسعار عيّنة للعرض التجريبي، وليست أسعارًا حقيقية لشركات الشحن.'],
  shown: ['shown', 'mostradas', 'نمایش', 'معروضة'],
  of: ['of', 'de', 'از', 'من'],
  sortBy: ['Sort by', 'Ordenar por', 'مرتب‌سازی بر اساس', 'ترتيب حسب'],
  history: ['history', 'historial', 'سابقه', 'السجل'],
} as const satisfies Record<string, L4>;
const ut = (l: QLang, k: keyof typeof U) => U[k][IX[l]];

const CURRENCIES = ['USD', 'EUR', 'AED', 'GBP', 'CNY', 'SAR', 'INR'];

// ── localStorage-backed prefs ──
function useLs<T>(key: string, init: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      const s = localStorage.getItem(key);
      return s ? (JSON.parse(s) as T) : init;
    } catch { return init; }
  });
  return [v, (n: T) => { setV(n); try { localStorage.setItem(key, JSON.stringify(n)); } catch { /* private mode */ } }];
}
const DEFAULT_COLS = COLS.filter((c) => c.def).map((c) => c.key);
const PHONE_Q = '(max-width: 720px)';
const usePhone = () => useSyncExternalStore(
  (f) => { const m = window.matchMedia(PHONE_Q); m.addEventListener('change', f); return () => m.removeEventListener('change', f); },
  () => window.matchMedia(PHONE_Q).matches,
);

const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export interface OptionsTableProps {
  options: Quote[];
  ui: QLang;
  mode: QMode;
  incoterm: string | null;
  activeIdx: number;
  recommendedIdx: number;
  offCarriers: string[];
  onSelect: (idx: number) => void;
  onToggleQuote: (idx: number) => void;
  rank: (carrier: string | null) => string | null;
  /** Extra per-option note (e.g. the client's target rate delta). */
  extraNote?: (idx: number) => string | null;
  freeTimeRequest: number | null;
  history: (name: string) => History | null;
  quoteRef: string;
  details: (lang: QLang, quoteCurrency: string, fx: string) => [string, string | number][];
}

export function OptionsTable(p: OptionsTableProps) {
  const { ui } = p;
  const rtl = ui === 'fa' || ui === 'ar';
  const phone = usePhone();
  const [visible, setVisible] = useLs<ColKey[]>('fd-qt-cols', DEFAULT_COLS);
  const [sort, setSort] = useLs<{ k: ColKey | null; dir: 1 | -1 }>('fd-qt-sort', { k: null, dir: 1 });
  const [filters, setFilters] = useState<Filters>({ mode: 'all', directOnly: false, validOnly: false });
  const [cur, setCur] = useLs<string>('fd-qt-cur', 'USD');
  const [fx, setFx] = useLs<Record<string, number>>('fd-qt-fx', {});
  const [checkedRaw, setChecked] = useState<string[]>([]);
  const [showCmp, setShowCmp] = useState(false);
  const [menu, setMenuRaw] = useState<'cols' | 'export' | null>(null);
  // open popovers toward the side with more room (keeps them on screen in LTR and RTL)
  const [popSide, setPopSide] = useState<'left' | 'right'>('left');
  const setMenu = (m: 'cols' | 'export' | null, el?: HTMLElement | null) => {
    if (m && el) { const r = el.getBoundingClientRect(); setPopSide(r.left + r.width / 2 < window.innerWidth / 2 ? 'left' : 'right'); }
    setMenuRaw(m);
  };
  const [allCols, setAllCols] = useState(false);

  // FX map keyed by option currency, for the chosen quote currency
  const fxFor: Record<string, number> = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(fx)) { const [from, to] = k.split('>'); if (to === cur && v > 0) out[from] = v; }
    return out;
  }, [fx, cur]);
  const rows = useMemo(() => buildRows(p.options, {
    mode: p.mode, incoterm: p.incoterm, quoteCurrency: cur, fx: fxFor, history: p.history, rank: p.rank, freeTimeRequest: p.freeTimeRequest,
    offCarriers: p.offCarriers, recommendedIdx: p.recommendedIdx, lang: ui, extraNote: p.extraNote,
  }), [p.extraNote, p.options, p.mode, p.incoterm, cur, fxFor, p.history, p.rank, p.freeTimeRequest, p.offCarriers, p.recommendedIdx, ui]);
  const modes = [...new Set(rows.map((r) => r.mode))];
  const appCols = applicable(modes).map((c) => c.key);
  const shownCols = appCols.filter((k) => k === 'carrier' || visible.includes(k));
  const shown = sortRows(filterRows(rows, filters), sort.k, sort.dir, ui);
  // ticks only count for options still on this quote
  const checked = checkedRaw.filter((k) => rows.some((r) => r.key === k));
  const optCurs = [...new Set(rows.map((r) => r.currency))].filter((c) => c !== cur);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.qt-pop, .qt-popbtn')) setMenu(null); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  const onSort = (k: ColKey) => setSort(sort.k === k ? (sort.dir === 1 ? { k, dir: -1 } : { k: null, dir: 1 }) : { k, dir: 1 });
  const toggleCol = (k: ColKey) => setVisible(visible.includes(k) ? visible.filter((x) => x !== k) : [...visible, k]);
  const toggleCheck = (k: string) => setChecked(checked.includes(k) ? checked.filter((x) => x !== k) : checked.length >= 4 ? checked : [...checked, k]);
  const cmpRows = checked.map((k) => rows.find((r) => r.key === k)).filter((r): r is OptRow => !!r);

  const doExport = async (kind: 'xlsx' | 'csv') => {
    const m = await import('./optexport');
    const cols = allCols ? appCols : shownCols;
    const date = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
    const fxText = Object.entries(fxFor).map(([f, v]) => `1 ${f} = ${v} ${cur}`).join(', ') || '—';
    if (kind === 'xlsx') {
      const data = m.buildXlsx({ rows: shown, cols, lang: ui, ref: p.quoteRef, date, quoteCurrency: cur, details: p.details(ui, cur, fxText), sheetNames: [ol(ui, 'options'), DETAILS_SHEET[IX[ui]]] });
      m.download(data as BlobPart, m.exportFileName(p.quoteRef, date, 'xlsx'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } else {
      m.download(m.buildCsv({ rows: shown, cols, lang: ui }), m.exportFileName(p.quoteRef, date, 'csv'), 'text/csv;charset=utf-8');
    }
    setMenu(null);
  };

  const anySample = rows.some((r) => r.sample);
  return (
    <div className="qt" dir={rtl ? 'rtl' : 'ltr'} lang={ui} data-testid="quote-options">
      <div className="qt-head">
        <div className="qt-title">
          <strong>{ut(ui, 'title')} · <bdi>{fmtInt(shown.length, ui)}</bdi>{shown.length !== rows.length ? <span className="q-muted"> {ut(ui, 'of')} <bdi>{fmtInt(rows.length, ui)}</bdi></span> : null}</strong>
          <span className="q-muted">{ut(ui, 'sub')}</span>
        </div>
        <div className="qt-tools">
          <select className="qt-sel" value={filters.mode} onChange={(e) => setFilters({ ...filters, mode: e.target.value as Filters['mode'] })} data-testid="qt-f-mode" disabled={modes.length < 2} aria-label={colLabel(ui, 'mode')}>
            <option value="all">{ut(ui, 'allModes')}</option>
            {modes.map((m) => <option key={m} value={m}>{MODE_L[ui][m]}</option>)}
          </select>
          <label className={`qt-chk ${filters.directOnly ? 'on' : ''}`}><input type="checkbox" checked={filters.directOnly} onChange={(e) => setFilters({ ...filters, directOnly: e.target.checked })} data-testid="qt-f-direct" />{ut(ui, 'directOnly')}</label>
          <label className={`qt-chk ${filters.validOnly ? 'on' : ''}`}><input type="checkbox" checked={filters.validOnly} onChange={(e) => setFilters({ ...filters, validOnly: e.target.checked })} data-testid="qt-f-valid" />{ut(ui, 'validOnly')}</label>
          <label className="qt-cur">
            <span>{ut(ui, 'quoteCur')}</span>
            <select className="qt-sel" value={cur} onChange={(e) => setCur(e.target.value)} data-testid="qt-cur">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
          </label>
          {optCurs.map((oc) => (
            <label key={oc} className="qt-fx" title={ut(ui, 'fxHint')}>
              <bdi dir="ltr">1 {oc} =</bdi>
              <input type="number" min="0" step="0.0001" inputMode="decimal" placeholder={ut(ui, 'fxHint')} value={fx[`${oc}>${cur}`] ?? ''} data-testid="qt-fx"
                onChange={(e) => { const v = parseFloat(e.target.value); const n = { ...fx }; if (v > 0) n[`${oc}>${cur}`] = v; else delete n[`${oc}>${cur}`]; setFx(n); }} />
              <bdi dir="ltr">{cur}</bdi>
            </label>
          ))}
          <div className="qt-popwrap">
            <button type="button" className="qt-btn qt-popbtn" onClick={(e) => setMenu(menu === 'cols' ? null : 'cols', e.currentTarget)} data-testid="qt-cols" aria-expanded={menu === 'cols'}>{ut(ui, 'columns')} · <bdi>{fmtInt(shownCols.length, ui)}</bdi></button>
            {menu === 'cols' && (
              <div className="qt-pop" style={popSide === 'left' ? { left: 0, right: 'auto' } : { right: 0, left: 'auto' }} data-testid="qt-cols-menu">
                {appCols.filter((k) => k !== 'carrier').map((k) => (
                  <label key={k}><input type="checkbox" checked={visible.includes(k)} onChange={() => toggleCol(k)} data-testid={`qt-col-${k}`} />{colLabel(ui, k)}</label>
                ))}
                <button type="button" className="q-linklike" onClick={() => setVisible(DEFAULT_COLS)} data-testid="qt-cols-reset">{ut(ui, 'reset')}</button>
              </div>
            )}
          </div>
          <button type="button" className="qt-btn" disabled={cmpRows.length < 2} onClick={() => setShowCmp(true)} data-testid="qt-compare" title={ut(ui, 'compareHint')}>{ut(ui, 'compare')} · <bdi>{fmtInt(cmpRows.length, ui)}</bdi></button>
          <div className="qt-popwrap">
            <button type="button" className="qt-btn primary qt-popbtn" onClick={(e) => setMenu(menu === 'export' ? null : 'export', e.currentTarget)} data-testid="qt-export" aria-expanded={menu === 'export'}>{ut(ui, 'exportB')}</button>
            {menu === 'export' && (
              <div className="qt-pop" style={popSide === 'left' ? { left: 0, right: 'auto' } : { right: 0, left: 'auto' }} data-testid="qt-export-menu">
                <button type="button" className="qt-btn" onClick={() => doExport('xlsx')} data-testid="qt-exp-xlsx">{ut(ui, 'xlsx')}</button>
                <button type="button" className="qt-btn" onClick={() => doExport('csv')} data-testid="qt-exp-csv">{ut(ui, 'csv')}</button>
                <label><input type="checkbox" checked={allCols} onChange={(e) => setAllCols(e.target.checked)} data-testid="qt-exp-all" />{ut(ui, 'allCols')}</label>
                <div className="q-muted qt-small">{ut(ui, 'expNote')}</div>
              </div>
            )}
          </div>
        </div>
      </div>
      {anySample && <div className="qt-sample" data-testid="qt-sample-note"><span className="j-sample">{tt(ui, 'sample')}</span> {ut(ui, 'sampleNote')}</div>}
      {cmpRows.length < 2 && <div className="q-muted qt-small">{ut(ui, 'compareHint')}</div>}

      {shown.length === 0 ? (
        <div className="qt-empty q-muted" data-testid="qt-empty">{ut(ui, 'none')}</div>
      ) : phone ? (
        <div className="qt-cards" data-testid="qt-cards">
          {shown.map((r) => (
            <div key={r.key} className={`qt-card ${r.idx === p.activeIdx ? 'active' : ''}`} data-testid={`qt-row-${r.idx}`} data-carrier={r.carrier}>
              <Lead r={r} p={p} checked={checked.includes(r.key)} canCheck={checked.length < 4} onCheck={() => toggleCheck(r.key)} />
              <dl className="qt-card-dl">
                {shownCols.filter((k) => k !== 'carrier').map((k) => (
                  <div key={k}><dt>{colLabel(ui, k)}</dt><dd data-col={k}><Cell r={r} k={k} ui={ui} cur={cur} /></dd></div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      ) : (
        <div className="qt-scroll" data-testid="qt-scroll">
          <table className="qt-table" data-testid="qt-table">
            <thead>
              <tr>
                {shownCols.map((k) => (
                  <th key={k} className={`${k === 'carrier' ? 'qt-first' : ''} ${isNum(k) ? 'num' : ''}`} aria-sort={sort.k === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'} data-col={k}>
                    <button type="button" onClick={() => onSort(k)} data-testid={`qt-sort-${k}`} title={`${ut(ui, 'sortBy')} ${colLabel(ui, k)}`}>
                      {colLabel(ui, k)}{k === 'conv' ? <bdi dir="ltr"> ({cur})</bdi> : null}
                      <span className="qt-arrow" aria-hidden>{sort.k === k ? (sort.dir === 1 ? '▲' : '▼') : '↕'}</span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.key} className={r.idx === p.activeIdx ? 'active' : ''} data-testid={`qt-row-${r.idx}`} data-carrier={r.carrier}>
                  {shownCols.map((k) => k === 'carrier' ? (
                    <td key={k} className="qt-first" data-col={k} data-v={String(cellValue(r, k, ui) ?? '')}>
                      <Lead r={r} p={p} checked={checked.includes(r.key)} canCheck={checked.length < 4} onCheck={() => toggleCheck(r.key)} />
                    </td>
                  ) : (
                    <td key={k} className={isNum(k) ? 'num' : ''} data-col={k} data-v={dataV(r, k, ui)}><Cell r={r} k={k} ui={ui} cur={cur} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCmp && cmpRows.length >= 2 && <Compare rows={cmpRows} ui={ui} cur={cur} cols={appCols} activeIdx={p.activeIdx} onSelect={p.onSelect} onClose={() => setShowCmp(false)} />}
    </div>
  );
}

const DETAILS_SHEET: L4 = ['Quote details', 'Detalles de la oferta', 'جزئیات پیشنهاد', 'تفاصيل العرض'];
const isNum = (k: ColKey) => { const kd = colDef(k).kind; return kd === 'money' || kd === 'int' || kd === 'pct'; };
const dataV = (r: OptRow, k: ColKey, ui: QLang) => { const v = cellValue(r, k, ui); return v == null ? '' : String(v); };

function Lead({ r, p, checked, canCheck, onCheck }: { r: OptRow; p: OptionsTableProps; checked: boolean; canCheck: boolean; onCheck: () => void }) {
  const ui = p.ui;
  const inQuote = !p.offCarriers.includes(r.line ?? '');
  const rk = p.rank(r.line);
  return (
    <div className="qt-lead">
      <div className="qt-lead-top">
        <input type="checkbox" className="qt-cmpbox" checked={checked} disabled={!checked && !canCheck} onChange={onCheck} data-testid={`qt-cmp-${r.idx}`} aria-label={ut(ui, 'compare')} />
        <span className="qt-name">{r.agent ?? r.carrier}</span>
        {r.sample && <span className="j-sample" data-testid={`qt-sample-${r.idx}`}>{tt(ui, 'sample')}</span>}
      </div>
      {r.agent && r.line ? <div className="q-muted qt-sub">{r.line}</div> : null}
      <div className="qt-badges">
        {BADGE_ORDER.filter((b) => r.badges.includes(b)).map((b) => <span key={b} className={`qt-badge ${b}`} data-testid={`qt-badge-${b}`}>{badgeLabel(ui, b)}</span>)}
        {rk === 'preferred' && <span className="qt-badge pref">{tt(ui, 'prefers')}</span>}
      </div>
      <div className="qt-actions">
        {r.idx === p.activeIdx
          ? <span className="qt-badge chosen" data-testid={`qt-selected-${r.idx}`}>✓ {ut(ui, 'selected')}</span>
          : <button type="button" className="qt-btn small" onClick={() => p.onSelect(r.idx)} data-testid={`qt-select-${r.idx}`}>{ut(ui, 'select')}</button>}
        <label className="qt-inq"><input type="checkbox" checked={inQuote} onChange={() => p.onToggleQuote(r.idx)} data-testid={`option-pick-${r.idx}`} />{ol(ui, 'inQuote')}</label>
      </div>
    </div>
  );
}

function Cell({ r, k, ui, cur }: { r: OptRow; k: ColKey; ui: QLang; cur: string }) {
  const dash = <span className="q-muted">—</span>;
  switch (k) {
    case 'carrier': return <>{r.carrier}</>;
    case 'mode': return <>{MODE_L[ui][r.mode]}</>;
    case 'route': return <span className={`qt-route ${r.direct ? 'direct' : ''}`}>{routeText(r, ui)}</span>;
    case 'freq': return <>{freqText(r.freq, ui) ?? '—'}</>;
    case 'etd': case 'eta': case 'cutoff': case 'rateDate': return r[k] ? <bdi>{fmtDay(r[k], ui)}</bdi> : dash;
    case 'valid':
      return (
        <span className="qt-valid">
          {r.valid ? <bdi>{fmtDay(r.valid, ui)}</bdi> : dash}
          {r.validDays != null && r.validDays < 0
            ? <span className="qt-badge amber" data-testid={`qt-expired-${r.idx}`}>{tt(ui, 'expired')}</span>
            : r.stale.length > 0 ? <span className="qt-badge amber" data-testid={`qt-expired-${r.idx}`} title={r.stale.join(', ')}>{tt(ui, 'recheck')}</span>
            : r.validDays != null && r.validDays <= 3 ? <span className="qt-badge amber" data-testid={`qt-expiring-${r.idx}`}>{tt(ui, 'expiresIn', r.validDays)}</span> : null}
        </span>
      );
    case 'transit': case 'freeO': case 'freeD': case 'quotes': case 'bookings': return r[k] == null ? dash : <bdi>{fmtInt(r[k] as number, ui)}</bdi>;
    case 'marginPct': return <bdi dir="ltr" className="mono">{r.marginPct}%</bdi>;
    case 'winRate': return r.winRate == null ? dash : <bdi dir="ltr" className="mono">{Math.round(r.winRate * 100)}%</bdi>;
    case 'currency': return <bdi dir="ltr" className="mono">{r.currency}</bdi>;
    case 'conv': return r.conv == null ? <span className="q-muted" title={ut(ui, 'fxHint')}>—</span> : <bdi dir="ltr" className="mono">{money(r.conv)} {cur}</bdi>;
    case 'payment': return <>{tt(ui, r.payment)}</>;
    case 'source': return <>{sourceText(r.source, ui) ?? '—'}</>;
    case 'equip': return <bdi dir="ltr">{r.equip}</bdi>;
    case 'notes': return r.notes ? <span className="qt-notes">{r.notes}</span> : dash;
    default: {
      const v = r[k as 'buy'] as number;
      if (!v && k !== 'buy' && k !== 'sell') return dash;
      return <bdi dir="ltr" className={`mono ${k === 'sell' ? 'qt-strong' : ''}`}>{money(v)}</bdi>;
    }
  }
}

/** Best value per field among the compared rows (lower is better for cost/time, higher for margin/free time/win rate). */
const LOWER: ColKey[] = ['transit', 'freight', 'surch', 'thcO', 'thcD', 'local', 'docs', 'customs', 'extras', 'buy', 'sell', 'conv'];
const HIGHER: ColKey[] = ['margin', 'marginPct', 'freeO', 'freeD', 'winRate', 'quotes', 'bookings'];
function Compare({ rows, ui, cur, cols, activeIdx, onSelect, onClose }: { rows: OptRow[]; ui: QLang; cur: string; cols: ColKey[]; activeIdx: number; onSelect: (i: number) => void; onClose: () => void }) {
  const best = (k: ColKey): number | null => {
    const vals = rows.map((r) => cellValue(r, k, ui)).filter((v): v is number => typeof v === 'number');
    if (vals.length < 2 || new Set(vals).size < 2) return null;
    return LOWER.includes(k) ? Math.min(...vals) : HIGHER.includes(k) ? Math.max(...vals) : null;
  };
  return (
    <div className="qt-cmp" data-testid="qt-compare-panel">
      <div className="qt-cmp-head">
        <strong>{ut(ui, 'sideBySide')} · <bdi>{fmtInt(rows.length, ui)}</bdi></strong>
        <button type="button" className="qt-btn small" onClick={onClose} data-testid="qt-compare-close">{ut(ui, 'close')}</button>
      </div>
      <div className="qt-cmp-grid" style={{ gridTemplateColumns: `minmax(9rem, 13rem) repeat(${rows.length}, minmax(0, 1fr))` }}>
        <div className="qt-cmp-l" />
        {rows.map((r) => (
          <div key={r.key} className="qt-cmp-h" data-testid={`qt-cmp-col-${r.idx}`}>
            <div className="qt-name">{r.agent ?? r.carrier}{r.sample && <span className="j-sample">{tt(ui, 'sample')}</span>}</div>
            <div className="qt-badges">{BADGE_ORDER.filter((b) => r.badges.includes(b)).map((b) => <span key={b} className={`qt-badge ${b}`}>{badgeLabel(ui, b)}</span>)}</div>
            {r.idx === activeIdx ? <span className="qt-badge chosen">✓ {ut(ui, 'selected')}</span> : <button type="button" className="qt-btn small" onClick={() => onSelect(r.idx)}>{ut(ui, 'select')}</button>}
          </div>
        ))}
        {cols.filter((k) => k !== 'carrier').map((k) => {
          const b = best(k);
          return (
            <Fragment key={k}>
              <div className="qt-cmp-l">{colLabel(ui, k)}{k === 'conv' ? <bdi dir="ltr"> ({cur})</bdi> : null}</div>
              {rows.map((r) => {
                const v = cellValue(r, k, ui);
                return <div key={r.key} className={`qt-cmp-v ${b != null && v === b ? 'best' : ''}`} data-col={k}><Cell r={r} k={k} ui={ui} cur={cur} /></div>;
              })}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
