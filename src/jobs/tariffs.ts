import { useSyncExternalStore } from 'react';
import { bridge } from '../backend/bridge';
/**
 * SAMPLE tariffs. Per the brief, the Shipping Association (انجمن کشتیرانی) sets demurrage, B/L fee, DO fee and
 * guarantee-cheque amounts each year, and the Ports Organization (سازمان بنادر) sets THC. Kept as editable data,
 * never hard-coded in the logic. Numbers are illustrative only.
 */
export interface Tariffs {
  year: string;
  currency: string;
  demurrage20Tier1: number; // per container per day, days 1–7 over free time
  demurrage20Tier2: number; // per container per day, day 8+
  demurrage40Tier1: number;
  demurrage40Tier2: number;
  tier1Days: number;
  blFee: number; // per B/L
  thc20: number;
  thc40: number;
  sealFee: number; // per container
  doFee: number; // per B/L (import)
  chequeDemurrage: number; // per B/L
  chequeContainer20: number; // per container — follows an empty container's value
  chequeContainer40: number;
  lineRebatePct: number; // I13: line pays ~2–3% for transfer and banking fees
}

export type TariffKey = Exclude<keyof Tariffs, 'year' | 'currency'>;

export const DEFAULT_TARIFFS: Tariffs = {
  year: '1405 (2026/27)',
  currency: 'USD',
  demurrage20Tier1: 20,
  demurrage20Tier2: 40,
  demurrage40Tier1: 40,
  demurrage40Tier2: 80,
  tier1Days: 7,
  blFee: 60,
  thc20: 110,
  thc40: 165,
  sealFee: 15,
  doFee: 50,
  chequeDemurrage: 1500,
  chequeContainer20: 2500,
  chequeContainer40: 4000,
  lineRebatePct: 2.5,
};

export const TARIFF_ROWS: { key: TariffKey; setBy: 'sa' | 'po' | 'line'; unit: string }[] = [
  { key: 'demurrage20Tier1', setBy: 'sa', unit: "/ 20' / day" },
  { key: 'demurrage20Tier2', setBy: 'sa', unit: "/ 20' / day" },
  { key: 'demurrage40Tier1', setBy: 'sa', unit: "/ 40' / day" },
  { key: 'demurrage40Tier2', setBy: 'sa', unit: "/ 40' / day" },
  { key: 'tier1Days', setBy: 'sa', unit: 'days' },
  { key: 'blFee', setBy: 'sa', unit: '/ B/L' },
  { key: 'doFee', setBy: 'sa', unit: '/ B/L' },
  { key: 'thc20', setBy: 'po', unit: "/ 20'" },
  { key: 'thc40', setBy: 'po', unit: "/ 40'" },
  { key: 'sealFee', setBy: 'line', unit: '/ cntr' },
  { key: 'chequeDemurrage', setBy: 'sa', unit: '/ B/L' },
  { key: 'chequeContainer20', setBy: 'sa', unit: "/ 20'" },
  { key: 'chequeContainer40', setBy: 'sa', unit: "/ 40'" },
  { key: 'lineRebatePct', setBy: 'line', unit: '%' },
];

const KEY = 'fd-tariffs-v1';
function readLocal(): Tariffs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_TARIFFS, ...(JSON.parse(raw) as Partial<Tariffs>) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_TARIFFS };
}
let current: Tariffs = typeof localStorage === 'undefined' ? { ...DEFAULT_TARIFFS } : readLocal();
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
/** Current tariff table (this browser in demo mode, Firestore in live mode). */
export const loadTariffs = (): Tariffs => current;
export function saveTariffs(t: Tariffs) {
  if (t === current) return;
  current = t;
  if (bridge.w) bridge.w.setTariffs(t);
  else {
    try {
      localStorage.setItem(KEY, JSON.stringify(t));
    } catch {
      /* ignore */
    }
  }
  emit();
}
export function hydrateTariffs(t: Partial<Tariffs> | null) {
  current = { ...DEFAULT_TARIFFS, ...(t ?? {}) };
  emit();
}
export function reloadTariffs() {
  current = readLocal();
  emit();
}
export const useTariffs = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => current);
