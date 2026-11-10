import { canonicalName } from './locations';
import type { QMode } from './locations';
import { chargeableKg, isoDate, parseNum, revenueTons, type QuoteFields } from './parser';

export type Side = 'origin' | 'freight' | 'destination' | 'customs';
export type Basis = 'per_container' | 'per_kg' | 'per_wm' | 'per_truck' | 'per_shipment';

export interface RateRow {
  mode: QMode;
  origin: string; // canonical or '*'
  destination: string; // canonical or '*'
  equipment: string; // '40HC', 'FTL', or '*'
  charge: string;
  side: Side;
  basis: Basis;
  currency: string;
  buy: number;
  min: number;
  validUntil: string; // yyyy-mm-dd
  transitDays: number | null;
  carrier: string;
}

export const CSV_COLUMNS = [
  'mode', 'origin', 'destination', 'equipment', 'charge', 'side', 'basis', 'currency', 'buy', 'min', 'valid_until', 'transit_days', 'carrier',
] as const;

const MODES: QMode[] = ['fcl', 'lcl', 'air', 'road'];
const SIDES: Side[] = ['origin', 'freight', 'destination', 'customs'];
const BASES: Basis[] = ['per_container', 'per_kg', 'per_wm', 'per_truck', 'per_shipment'];

function day(offset: number, today = new Date()): string {
  const d = new Date(today);
  d.setDate(d.getDate() + offset);
  return isoDate(d);
}

type SampleSpec = [QMode, string, string, string, string, Side, Basis, number, number, number, number | null, string];

/** SAMPLE buy rates for the demo — illustrative numbers, not market rates. Validity is relative to today. */
const SAMPLE: SampleSpec[] = [
  // mode, origin, destination, equipment, charge, side, basis, buy, min, valid (days from today), transit, carrier
  ['fcl', 'Shanghai (Yangshan)', 'Barcelona', '40HC', 'Ocean freight', 'freight', 'per_container', 2150, 0, 21, 32, 'Sample Line A'],
  ['fcl', 'Shanghai (Yangshan)', 'Barcelona', '40HC', 'BAF (bunker surcharge)', 'freight', 'per_container', 380, 0, -3, null, 'Sample Line A'],
  ['fcl', 'Shanghai (Yangshan)', 'Barcelona', '20GP', 'Ocean freight', 'freight', 'per_container', 1250, 0, 21, 32, 'Sample Line A'],
  ['fcl', 'Shanghai (Yangshan)', 'Barcelona', '20GP', 'BAF (bunker surcharge)', 'freight', 'per_container', 200, 0, -3, null, 'Sample Line A'],
  ['fcl', 'Shanghai (Yangshan)', 'Barcelona', '40GP', 'Ocean freight', 'freight', 'per_container', 2050, 0, 21, 32, 'Sample Line A'],
  ['fcl', 'Shanghai (Yangshan)', 'Barcelona', '40GP', 'BAF (bunker surcharge)', 'freight', 'per_container', 380, 0, -3, null, 'Sample Line A'],
  ['fcl', 'Shanghai (Waigaoqiao)', 'Barcelona', '40GP', 'Ocean freight', 'freight', 'per_container', 2130, 0, 21, 34, 'Sample Line B'],
  ['fcl', 'Shanghai (Waigaoqiao)', 'Barcelona', '40GP', 'BAF (bunker surcharge)', 'freight', 'per_container', 360, 0, 14, null, 'Sample Line B'],
  ['fcl', 'Shanghai (Waigaoqiao)', 'Barcelona', '40HC', 'Ocean freight', 'freight', 'per_container', 2230, 0, 21, 34, 'Sample Line B'],
  ['fcl', 'Shanghai (Waigaoqiao)', 'Barcelona', '40HC', 'BAF (bunker surcharge)', 'freight', 'per_container', 360, 0, 14, null, 'Sample Line B'],
  ['fcl', 'Shanghai (Waigaoqiao)', 'Barcelona', '20GP', 'Ocean freight', 'freight', 'per_container', 1300, 0, 21, 34, 'Sample Line B'],
  ['fcl', 'Shanghai (Waigaoqiao)', 'Barcelona', '20GP', 'BAF (bunker surcharge)', 'freight', 'per_container', 190, 0, 14, null, 'Sample Line B'],
  ['fcl', 'Shanghai (Yangshan)', '*', '*', 'Origin THC', 'origin', 'per_container', 120, 0, 30, null, 'Terminal tariff'],
  ['fcl', 'Shanghai (Yangshan)', '*', '*', 'Origin trucking (incl. bridge toll)', 'origin', 'per_container', 260, 0, 30, null, 'Sample trucker'],
  ['fcl', 'Shanghai (Waigaoqiao)', '*', '*', 'Origin THC', 'origin', 'per_container', 115, 0, 30, null, 'Terminal tariff'],
  ['fcl', 'Shanghai (Waigaoqiao)', '*', '*', 'Origin trucking', 'origin', 'per_container', 150, 0, 30, null, 'Sample trucker'],
  ['fcl', 'Shanghai (Yangshan)', '*', '*', 'Export docs / B/L fee', 'origin', 'per_shipment', 60, 0, 60, null, 'Sample agent'],
  ['fcl', 'Shanghai (Waigaoqiao)', '*', '*', 'Export docs / B/L fee', 'origin', 'per_shipment', 60, 0, 60, null, 'Sample agent'],
  ['fcl', '*', 'Barcelona', '*', 'Destination THC', 'destination', 'per_container', 260, 0, 45, null, 'Terminal tariff'],
  ['fcl', '*', 'Barcelona', '*', 'Delivery order / handling', 'destination', 'per_shipment', 90, 0, 45, null, 'Sample agent'],
  ['fcl', '*', 'Barcelona', '*', 'Import customs clearance', 'customs', 'per_shipment', 110, 0, 90, null, 'Sample broker'],

  ['fcl', 'Bandar Abbas', 'Nhava Sheva', '20GP', 'Ocean freight', 'freight', 'per_container', 690, 0, 14, 5, 'Sample Line A'],
  ['fcl', 'Bandar Abbas', 'Nhava Sheva', '20GP', 'BAF (bunker surcharge)', 'freight', 'per_container', 110, 0, 14, null, 'Sample Line A'],
  ['fcl', 'Bandar Abbas', 'Nhava Sheva', '20GP', 'Heavy-weight surcharge', 'freight', 'per_container', 75, 0, 14, null, 'Sample Line A'],
  ['fcl', 'Bandar Abbas', 'Jebel Ali', '20GP', 'Ocean freight', 'freight', 'per_container', 380, 0, 14, 2, 'Sample Line A'],
  ['fcl', 'Bandar Abbas', '*', '*', 'THC (Ports Organization tariff)', 'origin', 'per_container', 110, 0, 120, null, 'Ports Organization (sample)'],
  ['fcl', 'Bandar Abbas', '*', '*', 'B/L fee', 'origin', 'per_shipment', 60, 0, 120, null, 'Shipping Association (sample)'],
  ['fcl', 'Bandar Abbas', '*', '*', 'Seal fee', 'origin', 'per_container', 15, 0, 120, null, 'Sample Line A'],
  ['fcl', '*', 'Nhava Sheva', '*', 'Destination THC', 'destination', 'per_container', 140, 0, 45, null, 'Terminal tariff'],

  ['lcl', 'Ningbo', 'Valencia', '*', 'Ocean freight (LCL)', 'freight', 'per_wm', 48, 48, 21, 34, 'Sample Consol'],
  ['lcl', 'Ningbo', 'Valencia', '*', 'BAF (LCL)', 'freight', 'per_wm', 9, 0, 10, null, 'Sample Consol'],
  ['lcl', 'Ningbo', '*', '*', 'Origin CFS', 'origin', 'per_wm', 18, 36, 30, null, 'Sample Consol'],
  ['lcl', 'Ningbo', '*', '*', 'Pickup to CFS', 'origin', 'per_shipment', 95, 0, 30, null, 'Sample trucker'],
  ['lcl', '*', 'Valencia', '*', 'Destination CFS / handling', 'destination', 'per_wm', 32, 64, 45, null, 'Sample Consol'],
  ['lcl', '*', 'Valencia', '*', 'Destination docs', 'destination', 'per_shipment', 65, 0, 45, null, 'Sample agent'],
  ['lcl', '*', 'Valencia', '*', 'Import customs clearance', 'customs', 'per_shipment', 95, 0, 90, null, 'Sample broker'],

  ['air', 'Dubai (DXB)', 'Madrid (MAD)', '*', 'Air freight', 'freight', 'per_kg', 2.35, 120, 7, 2, 'Sample Airline'],
  ['air', 'Dubai (DXB)', 'Madrid (MAD)', '*', 'Fuel surcharge', 'freight', 'per_kg', 0.85, 0, 7, null, 'Sample Airline'],
  ['air', 'Dubai (DXB)', 'Madrid (MAD)', '*', 'Security surcharge', 'freight', 'per_kg', 0.15, 0, 30, null, 'Sample Airline'],
  ['air', 'Dubai (DXB)', '*', '*', 'Origin handling', 'origin', 'per_kg', 0.12, 35, 30, null, 'Sample handler'],
  ['air', 'Dubai (DXB)', '*', '*', 'AWB fee', 'origin', 'per_shipment', 30, 0, 60, null, 'Sample agent'],
  ['air', '*', 'Madrid (MAD)', '*', 'Destination handling', 'destination', 'per_kg', 0.18, 45, 30, null, 'Sample handler'],
  ['air', '*', 'Madrid (MAD)', '*', 'Import customs clearance', 'customs', 'per_shipment', 95, 0, 90, null, 'Sample broker'],

  ['road', 'Jebel Ali', 'Riyadh', 'FTL', 'Linehaul (FTL)', 'freight', 'per_truck', 1450, 0, 14, 3, 'Sample Haulier'],
  ['road', 'Jebel Ali', 'Riyadh', 'FTL', 'Border / transit docs', 'freight', 'per_truck', 60, 0, 30, null, 'Sample Haulier'],
  ['road', 'Jebel Ali', '*', '*', 'UAE export clearance', 'origin', 'per_shipment', 85, 0, 60, null, 'Sample broker'],
  ['road', '*', 'Riyadh', '*', 'KSA import clearance', 'customs', 'per_shipment', 140, 0, 60, null, 'Sample broker'],
];

export function sampleRates(today = new Date()): RateRow[] {
  return SAMPLE.map(([mode, origin, destination, equipment, charge, side, basis, buy, min, valid, transit, carrier]) => ({
    mode, origin, destination, equipment, charge, side, basis, currency: 'USD', buy, min, validUntil: day(valid, today), transitDays: transit, carrier,
  }));
}

export function rowsToCsv(rows: RateRow[]): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [CSV_COLUMNS.join(',')];
  for (const r of rows) {
    lines.push([r.mode, r.origin, r.destination, r.equipment, r.charge, r.side, r.basis, r.currency, String(r.buy), String(r.min || ''), r.validUntil, r.transitDays == null ? '' : String(r.transitDays), r.carrier].map(esc).join(','));
  }
  return lines.join('\n') + '\n';
}

/** Minimal CSV parser: quotes, escaped quotes, CRLF, comma or semicolon delimiter. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '');
  const firstLine = src.split(/\r?\n/)[0] ?? '';
  const delim = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQ = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQ) {
      if (c === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else inQ = false;
      } else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

export interface CsvLoad {
  rows: RateRow[];
  skipped: { line: number; reason: string }[];
  newLocations: string[];
}

function normDate(s: string): string | null {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/); // dd/mm/yyyy
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

export function loadRateCsv(text: string): CsvLoad {
  const table = parseCsv(text);
  const skipped: CsvLoad['skipped'] = [];
  if (table.length === 0) return { rows: [], skipped: [{ line: 1, reason: 'empty file' }], newLocations: [] };
  const header = table[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const idx = (k: string) => header.indexOf(k);
  const required = ['mode', 'origin', 'destination', 'charge', 'side', 'basis', 'buy', 'valid_until'];
  const missingCols = required.filter((k) => idx(k) < 0);
  if (missingCols.length) return { rows: [], skipped: [{ line: 1, reason: `missing columns: ${missingCols.join(', ')}` }], newLocations: [] };
  const rows: RateRow[] = [];
  const newLocations = new Set<string>();
  const loc = (v: string) => {
    const t = v.trim();
    if (!t || t === '*') return '*';
    const c = canonicalName(t);
    if (c) return c;
    newLocations.add(t);
    return t;
  };
  table.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const get = (k: string) => (idx(k) >= 0 ? (cells[idx(k)] ?? '').trim() : '');
    const mode = get('mode').toLowerCase() as QMode;
    const side = get('side').toLowerCase() as Side;
    const basis = get('basis').toLowerCase() as Basis;
    const buy = parseNum(get('buy'));
    const valid = normDate(get('valid_until'));
    if (!MODES.includes(mode)) return skipped.push({ line, reason: `mode "${get('mode')}" (use fcl, lcl, air, road)` });
    if (!SIDES.includes(side)) return skipped.push({ line, reason: `side "${get('side')}" (use origin, freight, destination, customs)` });
    if (!BASES.includes(basis)) return skipped.push({ line, reason: `basis "${get('basis')}"` });
    if (!Number.isFinite(buy)) return skipped.push({ line, reason: `buy "${get('buy')}" is not a number` });
    if (!valid) return skipped.push({ line, reason: `valid_until "${get('valid_until')}" (use YYYY-MM-DD)` });
    if (!get('charge')) return skipped.push({ line, reason: 'charge name empty' });
    const minRaw = get('min');
    const tRaw = get('transit_days');
    rows.push({
      mode,
      origin: loc(get('origin')),
      destination: loc(get('destination')),
      equipment: (get('equipment') || '*').toUpperCase().replace('HQ', 'HC'),
      charge: get('charge'),
      side,
      basis,
      currency: (get('currency') || 'USD').toUpperCase(),
      buy,
      min: minRaw ? parseNum(minRaw) || 0 : 0,
      validUntil: valid,
      transitDays: tRaw ? parseNum(tRaw) || null : null,
      carrier: get('carrier'),
    });
    return undefined;
  });
  return { rows, skipped, newLocations: [...newLocations] };
}

/** Which charge sides the paying customer normally covers under each Incoterm (buyer view up to FCA/FOB/C-terms; seller view for D-terms). */
export function scopeFor(incoterm: string | null): { sides: Side[]; note: string } {
  switch (incoterm) {
    case 'EXW':
      return { sides: ['origin', 'freight', 'destination', 'customs'], note: 'EXW: pickup, origin charges, main freight, destination charges and import clearance.' };
    case 'FCA':
    case 'FAS':
    case 'FOB':
      return { sides: ['freight', 'destination', 'customs'], note: `${incoterm}: seller pays origin charges; quote covers main freight, destination charges and import clearance.` };
    case 'CFR':
    case 'CIF':
    case 'CPT':
    case 'CIP':
      return { sides: ['destination', 'customs'], note: `${incoterm}: seller pays freight; quote covers destination charges and import clearance only.` };
    case 'DAP':
    case 'DPU':
      return { sides: ['origin', 'freight', 'destination'], note: `${incoterm}: seller pays to destination; import clearance and duties are for the consignee.` };
    case 'DDP':
      return { sides: ['origin', 'freight', 'destination', 'customs'], note: 'DDP: all charges incl. import clearance — duties & taxes NOT included in this quote.' };
    default:
      return { sides: ['freight', 'destination', 'customs'], note: 'No Incoterm given — priced as FOB (freight + destination). Confirm with customer.' };
  }
}

export interface QuoteLine {
  charge: string;
  side: Side;
  basis: Basis;
  qty: number;
  unitBuy: number;
  buy: number;
  sell: number;
  validUntil: string;
  stale: boolean;
  carrier: string;
  currency: string;
}

export interface Quote {
  lines: QuoteLine[];
  excluded: QuoteLine[];
  buyTotal: number;
  sellTotal: number;
  marginUsd: number;
  marginPct: number;
  transitDays: number | null;
  validUntil: string | null;
  staleCount: number;
  scopeNote: string;
  hasFreight: boolean;
  chargeable: number | null;
  units: string;
  currencies: string[];
}

function qtyFor(basis: Basis, f: QuoteFields, equipment: string): { qty: number; ok: boolean } {
  switch (basis) {
    case 'per_container':
      if (equipment === '*') return { qty: Object.entries(f.equipment).filter(([k]) => k !== 'FTL').reduce((s, [, n]) => s + n, 0), ok: true };
      return { qty: f.equipment[equipment] ?? 0, ok: true };
    case 'per_truck':
      return { qty: f.equipment.FTL ?? 1, ok: true };
    case 'per_kg': {
      const q = f.mode === 'air' ? chargeableKg(f.weightKg, f.volumeCbm) : f.weightKg;
      return { qty: q ?? 0, ok: q != null };
    }
    case 'per_wm': {
      const q = revenueTons(f.weightKg, f.volumeCbm);
      return { qty: q ?? 0, ok: q != null };
    }
    default:
      return { qty: 1, ok: true };
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function buildQuote(f: QuoteFields, rates: RateRow[], marginPct: number, today = new Date()): Quote | null {
  if (!f.mode || !f.origin || !f.destination) return null;
  const todayIso = isoDate(today);
  const scope = scopeFor(f.incoterm);
  const eqKeys = Object.keys(f.equipment);
  const relevant = rates.filter((r) => {
    if (r.mode !== f.mode) return false;
    if (r.side === 'freight' && !(r.origin === f.origin && r.destination === f.destination)) return false;
    if (r.side === 'origin' && !(r.origin === f.origin && (r.destination === '*' || r.destination === f.destination))) return false;
    if ((r.side === 'destination' || r.side === 'customs') && !(r.destination === f.destination && (r.origin === '*' || r.origin === f.origin))) return false;
    if (r.equipment !== '*' && !eqKeys.includes(r.equipment) && !(f.mode !== 'fcl' && f.mode !== 'road')) return false;
    return true;
  });
  const m = Math.min(0.9, Math.max(0, marginPct / 100));
  const toLine = (r: RateRow): QuoteLine => {
    const { qty } = qtyFor(r.basis, f, r.equipment);
    const buy = round2(Math.max(r.min || 0, r.buy * qty));
    const sell = Math.round(buy / (1 - m));
    return { charge: r.charge, side: r.side, basis: r.basis, qty: round2(qty), unitBuy: r.buy, buy, sell, validUntil: r.validUntil, stale: r.validUntil < todayIso, carrier: r.carrier, currency: r.currency };
  };
  const all = relevant.map(toLine).filter((l) => l.qty > 0 || l.basis === 'per_shipment');
  const lines = all.filter((l) => scope.sides.includes(l.side));
  const excluded = all.filter((l) => !scope.sides.includes(l.side));
  const buyTotal = round2(lines.reduce((s, l) => s + l.buy, 0));
  const sellTotal = lines.reduce((s, l) => s + l.sell, 0);
  const marginUsd = round2(sellTotal - buyTotal);
  const transit = relevant.find((r) => r.side === 'freight' && r.transitDays != null)?.transitDays ?? null;
  const fresh = lines.filter((l) => !l.stale).map((l) => l.validUntil).sort();
  const cap = new Date(today);
  cap.setDate(cap.getDate() + 14);
  const capIso = isoDate(cap);
  const validUntil = fresh.length ? (fresh[0] < capIso ? fresh[0] : capIso) : null;
  const units =
    f.mode === 'air'
      ? `${chargeableKg(f.weightKg, f.volumeCbm) ?? '?'} kg chargeable`
      : f.mode === 'lcl'
        ? `${revenueTons(f.weightKg, f.volumeCbm) ?? '?'} W/M`
        : Object.entries(f.equipment).map(([k, n]) => `${n}×${k}`).join(' + ') || '—';
  return {
    lines,
    excluded,
    buyTotal,
    sellTotal,
    marginUsd,
    marginPct: sellTotal > 0 ? Math.round((marginUsd / sellTotal) * 1000) / 10 : 0,
    transitDays: transit,
    validUntil,
    staleCount: lines.filter((l) => l.stale).length,
    scopeNote: scope.note,
    hasFreight: all.some((l) => l.side === 'freight'),
    chargeable: f.mode === 'air' ? chargeableKg(f.weightKg, f.volumeCbm) : null,
    units,
    currencies: [...new Set(lines.map((l) => l.currency))],
  };
}
