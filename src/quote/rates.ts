import { canonicalName } from './locations';
import type { QMode } from './locations';
import { chargeableKg, isoDate, parseNum, revenueTons, type QuoteFields } from './parser';
import { freightEstimate, laneKm, serviceCharges, type L4 } from './extras';
import { HOME_PORT } from './trade';

export type Side = 'origin' | 'freight' | 'destination' | 'customs' | 'services';
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
  /** Optional per-line option data (freight rows): 'Direct' or 'via Port Klang'. */
  routing?: string;
  /** Free time at destination/origin granted by this line, days (10 / 14 / 21). */
  freeDays?: number | null;
  /** Sailing weekday (Mon–Sun) or 'daily'. */
  sails?: string;
  /** Free time at origin (detention/demurrage at the loading end), days. */
  freeDaysOrigin?: number | null;
  /** Overseas agent offering this option (imports), when it is not the line itself. */
  agent?: string;
  /** Where the rate came from ('Line rate sheet', 'Agent email', …) and when it was received (yyyy-mm-dd). */
  source?: string;
  rateDate?: string;
  /** Freight payment terms for this option, when the rate sheet says so. */
  payment?: 'prepaid' | 'collect';
  /** SAMPLE estimate made by the app (no rate on file), never a real price. */
  estimate?: boolean;
}

export const CSV_COLUMNS = [
  'mode', 'origin', 'destination', 'equipment', 'charge', 'side', 'basis', 'currency', 'buy', 'min', 'valid_until', 'transit_days', 'carrier', 'routing', 'free_days', 'sails', 'free_days_origin', 'agent', 'source', 'rate_date', 'payment',
] as const;

const MODES: QMode[] = ['fcl', 'lcl', 'air', 'road'];
const SIDES: Side[] = ['origin', 'freight', 'destination', 'customs', 'services'];
const BASES: Basis[] = ['per_container', 'per_kg', 'per_wm', 'per_truck', 'per_shipment'];

function day(offset: number, today = new Date()): string {
  const d = new Date(today);
  d.setDate(d.getDate() + offset);
  return isoDate(d);
}

type SampleSpec = [QMode, string, string, string, string, Side, Basis, number, number, number, number | null, string];

/** SAMPLE China → Jebel Ali rows: [origin, transit A, transit C, Line A 20GP/40GP/40HC, Line C 20GP/40GP/40HC]. Illustrative only. */
const CN_JEA: [string, number, number, [number, number, number], [number, number, number]][] = [
  ['Shanghai (Yangshan)', 18, 16, [980, 1600, 1650], [1040, 1680, 1720]],
  ['Ningbo', 19, 17, [940, 1540, 1590], [1010, 1620, 1680]],
  ['Qingdao', 22, 20, [1060, 1720, 1780], [1120, 1800, 1860]],
  ['Shenzhen', 15, 14, [860, 1420, 1470], [920, 1500, 1550]],
];
function chinaToJebelAli(): SampleSpec[] {
  const out: SampleSpec[] = [];
  for (const [o, tA, tC, a, c] of CN_JEA) {
    (['20GP', '40GP', '40HC'] as const).forEach((eq, i) => {
      const baf = (line: 'A' | 'C') => (eq === '20GP' ? (line === 'A' ? 170 : 160) : line === 'A' ? 300 : 280);
      out.push(['fcl', o, 'Jebel Ali', eq, 'Ocean freight', 'freight', 'per_container', a[i], 0, 21, tA, 'Sample Line A']);
      out.push(['fcl', o, 'Jebel Ali', eq, 'BAF (bunker surcharge)', 'freight', 'per_container', baf('A'), 0, 14, null, 'Sample Line A']);
      out.push(['fcl', o, 'Jebel Ali', eq, 'Ocean freight', 'freight', 'per_container', c[i], 0, 21, tC, 'Sample Line C']);
      out.push(['fcl', o, 'Jebel Ali', eq, 'BAF (bunker surcharge)', 'freight', 'per_container', baf('C'), 0, 14, null, 'Sample Line C']);
    });
  }
  return out;
}

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
  // more lines on the same lane (E3: ask several lines, take the best)
  ['fcl', 'Shanghai (Yangshan)', 'Barcelona', '40HC', 'Ocean freight', 'freight', 'per_container', 1890, 0, 21, 38, 'Sample Line C'],
  ['fcl', 'Shanghai (Yangshan)', 'Barcelona', '40HC', 'BAF (bunker surcharge)', 'freight', 'per_container', 360, 0, 14, null, 'Sample Line C'],
  ['fcl', 'Shanghai (Yangshan)', 'Barcelona', '40GP', 'Ocean freight', 'freight', 'per_container', 1800, 0, 21, 38, 'Sample Line C'],
  ['fcl', 'Shanghai (Yangshan)', 'Barcelona', '40GP', 'BAF (bunker surcharge)', 'freight', 'per_container', 360, 0, 14, null, 'Sample Line C'],
  ['fcl', 'Shanghai (Yangshan)', 'Barcelona', '20GP', 'Ocean freight', 'freight', 'per_container', 1080, 0, 21, 38, 'Sample Line C'],
  ['fcl', 'Shanghai (Yangshan)', 'Barcelona', '20GP', 'BAF (bunker surcharge)', 'freight', 'per_container', 190, 0, 14, null, 'Sample Line C'],
  ['fcl', 'Shanghai (Yangshan)', 'Barcelona', '40HC', 'Ocean freight', 'freight', 'per_container', 2390, 0, 10, 29, 'Sample Line D'],
  ['fcl', 'Shanghai (Yangshan)', 'Barcelona', '40HC', 'BAF (bunker surcharge)', 'freight', 'per_container', 380, 0, 10, null, 'Sample Line D'],
  ['fcl', 'Shanghai (Yangshan)', 'Barcelona', '40GP', 'Ocean freight', 'freight', 'per_container', 2290, 0, 10, 29, 'Sample Line D'],
  ['fcl', 'Shanghai (Yangshan)', 'Barcelona', '40GP', 'BAF (bunker surcharge)', 'freight', 'per_container', 380, 0, 10, null, 'Sample Line D'],
  ['fcl', 'Shanghai (Yangshan)', 'Barcelona', '20GP', 'Ocean freight', 'freight', 'per_container', 1390, 0, 10, 29, 'Sample Line D'],
  ['fcl', 'Shanghai (Yangshan)', 'Barcelona', '20GP', 'BAF (bunker surcharge)', 'freight', 'per_container', 200, 0, 10, null, 'Sample Line D'],
  ['fcl', 'Shanghai (Yangshan)', '*', '*', 'Origin THC', 'origin', 'per_container', 120, 0, 30, null, 'Terminal tariff'],
  ['fcl', 'Shanghai (Yangshan)', '*', '*', 'Origin trucking (incl. bridge toll)', 'origin', 'per_container', 260, 0, 30, null, 'Sample trucker'],
  ['fcl', 'Shanghai (Waigaoqiao)', '*', '*', 'Origin THC', 'origin', 'per_container', 115, 0, 30, null, 'Terminal tariff'],
  ['fcl', 'Shanghai (Waigaoqiao)', '*', '*', 'Origin trucking', 'origin', 'per_container', 150, 0, 30, null, 'Sample trucker'],
  ['fcl', 'Shanghai (Yangshan)', '*', '*', 'Export docs / B/L fee', 'origin', 'per_shipment', 60, 0, 60, null, 'Sample agent'],
  ['fcl', 'Shanghai (Waigaoqiao)', '*', '*', 'Export docs / B/L fee', 'origin', 'per_shipment', 60, 0, 60, null, 'Sample agent'],
  ['fcl', '*', 'Barcelona', '*', 'Destination THC', 'destination', 'per_container', 260, 0, 45, null, 'Terminal tariff'],
  ['fcl', '*', 'Barcelona', '*', 'Delivery order / handling', 'destination', 'per_shipment', 90, 0, 45, null, 'Sample agent'],
  ['fcl', '*', 'Barcelona', '*', 'Import customs clearance', 'customs', 'per_shipment', 110, 0, 90, null, 'Sample broker'],

  // exports from the home port, Jebel Ali (sample; Jebel Ali origin charges are shown separately as local charges)
  ['fcl', 'Jebel Ali', 'Nhava Sheva', '20GP', 'Ocean freight', 'freight', 'per_container', 690, 0, 14, 5, 'Sample Line A'],
  ['fcl', 'Jebel Ali', 'Nhava Sheva', '20GP', 'BAF (bunker surcharge)', 'freight', 'per_container', 110, 0, 14, null, 'Sample Line A'],
  ['fcl', 'Jebel Ali', 'Nhava Sheva', '20GP', 'Heavy-weight surcharge', 'freight', 'per_container', 75, 0, 14, null, 'Sample Line A'],
  ['fcl', 'Jebel Ali', 'Nhava Sheva', '20GP', 'Ocean freight', 'freight', 'per_container', 560, 0, 14, 8, 'Sample Line B'],
  ['fcl', 'Jebel Ali', 'Nhava Sheva', '20GP', 'BAF (bunker surcharge)', 'freight', 'per_container', 95, 0, 14, null, 'Sample Line B'],
  ['fcl', 'Jebel Ali', 'Nhava Sheva', '20GP', 'Heavy-weight surcharge', 'freight', 'per_container', 75, 0, 14, null, 'Sample Line B'],
  ['fcl', 'Jebel Ali', 'Nhava Sheva', '20GP', 'Ocean freight', 'freight', 'per_container', 760, 0, 10, 4, 'Sample Line C'],
  ['fcl', 'Jebel Ali', 'Nhava Sheva', '20GP', 'BAF (bunker surcharge)', 'freight', 'per_container', 120, 0, 10, null, 'Sample Line C'],
  ['fcl', 'Jebel Ali', 'Nhava Sheva', '40GP', 'Ocean freight', 'freight', 'per_container', 1150, 0, 14, 5, 'Sample Line A'],
  ['fcl', 'Jebel Ali', 'Nhava Sheva', '40GP', 'BAF (bunker surcharge)', 'freight', 'per_container', 190, 0, 14, null, 'Sample Line A'],
  ['fcl', 'Jebel Ali', 'Nhava Sheva', '40HC', 'Ocean freight', 'freight', 'per_container', 1190, 0, 14, 5, 'Sample Line A'],
  ['fcl', 'Jebel Ali', 'Nhava Sheva', '40HC', 'BAF (bunker surcharge)', 'freight', 'per_container', 190, 0, 14, null, 'Sample Line A'],
  ['fcl', 'Jebel Ali', 'Nhava Sheva', '40GP', 'Ocean freight', 'freight', 'per_container', 960, 0, 14, 8, 'Sample Line B'],
  ['fcl', 'Jebel Ali', 'Nhava Sheva', '40GP', 'BAF (bunker surcharge)', 'freight', 'per_container', 170, 0, 14, null, 'Sample Line B'],
  ['fcl', 'Jebel Ali', 'Dammam', '20GP', 'Ocean freight', 'freight', 'per_container', 380, 0, 14, 3, 'Sample Line A'],
  ['fcl', 'Jebel Ali', 'Shanghai (Yangshan)', '20GP', 'Ocean freight', 'freight', 'per_container', 520, 0, 14, 17, 'Sample Line B'],
  ['fcl', 'Jebel Ali', 'Shanghai (Yangshan)', '20GP', 'BAF (bunker surcharge)', 'freight', 'per_container', 140, 0, 14, null, 'Sample Line B'],
  ['fcl', 'Jebel Ali', '*', '*', 'THC (port tariff)', 'origin', 'per_container', 110, 0, 120, null, 'Port tariff (sample)'],
  ['fcl', 'Jebel Ali', '*', '*', 'B/L fee', 'origin', 'per_shipment', 60, 0, 120, null, 'Line / agent tariff (sample)'],
  ['fcl', 'Jebel Ali', '*', '*', 'Seal fee', 'origin', 'per_container', 15, 0, 120, null, 'Sample Line A'],
  ['fcl', '*', 'Nhava Sheva', '*', 'Destination THC', 'destination', 'per_container', 140, 0, 45, null, 'Terminal tariff'],
  // imports into Jebel Ali (sample; Jebel Ali destination charges are shown separately as local charges)
  ['fcl', 'Nhava Sheva', 'Jebel Ali', '20GP', 'Ocean freight', 'freight', 'per_container', 640, 0, 14, 5, 'Sample Line A'],
  ['fcl', 'Nhava Sheva', 'Jebel Ali', '20GP', 'BAF (bunker surcharge)', 'freight', 'per_container', 100, 0, 14, null, 'Sample Line A'],
  ['fcl', 'Nhava Sheva', 'Jebel Ali', '20GP', 'Ocean freight', 'freight', 'per_container', 590, 0, 14, 8, 'Sample Line B'],
  ['fcl', 'Nhava Sheva', 'Jebel Ali', '20GP', 'BAF (bunker surcharge)', 'freight', 'per_container', 90, 0, 14, null, 'Sample Line B'],
  ['fcl', 'Nhava Sheva', '*', '*', 'Origin THC', 'origin', 'per_container', 95, 0, 45, null, 'Terminal tariff'],
  ['fcl', '*', 'Jebel Ali', '*', 'THC (port tariff)', 'destination', 'per_container', 110, 0, 120, null, 'Port tariff (sample)'],
  ['fcl', '*', 'Jebel Ali', '*', 'DO fee', 'destination', 'per_shipment', 50, 0, 120, null, 'Line / agent tariff (sample)'],
  // China → Jebel Ali, 20GP / 40GP / 40HC, two lines per port
  ...chinaToJebelAli(),
  ['fcl', 'Ningbo', '*', '*', 'Origin THC', 'origin', 'per_container', 115, 0, 30, null, 'Terminal tariff'],
  ['fcl', 'Ningbo', '*', '*', 'Export docs / B/L fee', 'origin', 'per_shipment', 60, 0, 60, null, 'Sample agent'],
  ['fcl', 'Qingdao', '*', '*', 'Origin THC', 'origin', 'per_container', 110, 0, 30, null, 'Terminal tariff'],
  ['fcl', 'Qingdao', '*', '*', 'Export docs / B/L fee', 'origin', 'per_shipment', 60, 0, 60, null, 'Sample agent'],
  ['fcl', 'Shenzhen', '*', '*', 'Origin THC', 'origin', 'per_container', 125, 0, 30, null, 'Terminal tariff'],
  ['fcl', 'Shenzhen', '*', '*', 'Export docs / B/L fee', 'origin', 'per_shipment', 60, 0, 60, null, 'Sample agent'],

  ['lcl', 'Ningbo', 'Valencia', '*', 'Ocean freight (LCL)', 'freight', 'per_wm', 48, 48, 21, 34, 'Sample Consol'],
  ['lcl', 'Ningbo', 'Valencia', '*', 'BAF (LCL)', 'freight', 'per_wm', 9, 0, 10, null, 'Sample Consol'],
  ['lcl', 'Ningbo', 'Valencia', '*', 'Ocean freight (LCL)', 'freight', 'per_wm', 41, 41, 21, 40, 'Sample Consol B'],
  ['lcl', 'Ningbo', 'Valencia', '*', 'BAF (LCL)', 'freight', 'per_wm', 9, 0, 21, null, 'Sample Consol B'],
  ['lcl', 'Ningbo', '*', '*', 'Origin CFS', 'origin', 'per_wm', 18, 36, 30, null, 'Sample Consol'],
  ['lcl', 'Ningbo', '*', '*', 'Pickup to CFS', 'origin', 'per_shipment', 95, 0, 30, null, 'Sample trucker'],
  ['lcl', '*', 'Valencia', '*', 'Destination CFS / handling', 'destination', 'per_wm', 32, 64, 45, null, 'Sample Consol'],
  ['lcl', '*', 'Valencia', '*', 'Destination docs', 'destination', 'per_shipment', 65, 0, 45, null, 'Sample agent'],
  ['lcl', '*', 'Valencia', '*', 'Import customs clearance', 'customs', 'per_shipment', 95, 0, 90, null, 'Sample broker'],

  ['air', 'Dubai (DXB)', 'Madrid (MAD)', '*', 'Air freight', 'freight', 'per_kg', 2.35, 120, 7, 2, 'Sample Airline'],
  ['air', 'Dubai (DXB)', 'Madrid (MAD)', '*', 'Fuel surcharge', 'freight', 'per_kg', 0.85, 0, 7, null, 'Sample Airline'],
  ['air', 'Dubai (DXB)', 'Madrid (MAD)', '*', 'Security surcharge', 'freight', 'per_kg', 0.15, 0, 30, null, 'Sample Airline'],
  ['air', 'Dubai (DXB)', 'Madrid (MAD)', '*', 'Air freight', 'freight', 'per_kg', 1.95, 100, 7, 3, 'Sample Airline B'],
  ['air', 'Dubai (DXB)', 'Madrid (MAD)', '*', 'Fuel surcharge', 'freight', 'per_kg', 0.85, 0, 7, null, 'Sample Airline B'],
  ['air', 'Dubai (DXB)', 'Madrid (MAD)', '*', 'Security surcharge', 'freight', 'per_kg', 0.15, 0, 30, null, 'Sample Airline B'],
  ['air', 'Dubai (DXB)', '*', '*', 'Origin handling', 'origin', 'per_kg', 0.12, 35, 30, null, 'Sample handler'],
  ['air', 'Dubai (DXB)', '*', '*', 'AWB fee', 'origin', 'per_shipment', 30, 0, 60, null, 'Sample agent'],
  ['air', '*', 'Madrid (MAD)', '*', 'Destination handling', 'destination', 'per_kg', 0.18, 45, 30, null, 'Sample handler'],
  ['air', '*', 'Madrid (MAD)', '*', 'Import customs clearance', 'customs', 'per_shipment', 95, 0, 90, null, 'Sample broker'],

  ['road', 'Jebel Ali', 'Riyadh', 'FTL', 'Linehaul (FTL)', 'freight', 'per_truck', 1450, 0, 14, 3, 'Sample Haulier'],
  ['road', 'Jebel Ali', 'Riyadh', 'FTL', 'Border / transit docs', 'freight', 'per_truck', 60, 0, 30, null, 'Sample Haulier'],
  ['road', 'Jebel Ali', 'Riyadh', 'FTL', 'Linehaul (FTL)', 'freight', 'per_truck', 1320, 0, 14, 4, 'Sample Haulier B'],
  ['road', 'Jebel Ali', 'Riyadh', 'FTL', 'Border / transit docs', 'freight', 'per_truck', 60, 0, 30, null, 'Sample Haulier B'],
  ['road', 'Jebel Ali', '*', '*', 'UAE export clearance', 'origin', 'per_shipment', 85, 0, 60, null, 'Sample broker'],
  ['road', '*', 'Riyadh', '*', 'KSA import clearance', 'customs', 'per_shipment', 140, 0, 60, null, 'Sample broker'],
];

/** SAMPLE per-line option data (routing, free time, sailing day), keyed by carrier + lane. */
type LineMeta = { routing: string; freeDays: number | null; sails: string; freeOrigin?: number | null; agent?: string; age?: number };
/** freeOrigin = origin free days, agent = overseas agent (imports), age = days since the SAMPLE rate was received. */
const LINE_META: Record<string, LineMeta> = {
  'Sample Line A|Shanghai (Yangshan)|Barcelona': { routing: 'Direct', freeDays: 10, sails: 'Thu', freeOrigin: 5, age: 3 },
  'Sample Line C|Shanghai (Yangshan)|Barcelona': { routing: 'via Port Klang', freeDays: 21, sails: 'Mon', freeOrigin: 7, age: 9 },
  'Sample Line D|Shanghai (Yangshan)|Barcelona': { routing: 'Direct (express)', freeDays: 14, sails: 'Sat', freeOrigin: 4, age: 1 },
  'Sample Line B|Shanghai (Waigaoqiao)|Barcelona': { routing: 'Direct', freeDays: 14, sails: 'Wed', freeOrigin: 5, age: 6 },
  'Sample Line A|Jebel Ali|Nhava Sheva': { routing: 'Direct', freeDays: 10, sails: 'Tue', freeOrigin: 7, age: 2 },
  'Sample Line B|Jebel Ali|Nhava Sheva': { routing: 'via Salalah', freeDays: 14, sails: 'Sat', freeOrigin: 7, age: 5 },
  'Sample Line C|Jebel Ali|Nhava Sheva': { routing: 'Direct', freeDays: 21, sails: 'Thu', freeOrigin: 10, age: 12 },
  'Sample Line A|Jebel Ali|Dammam': { routing: 'Direct', freeDays: 10, sails: 'Sun', freeOrigin: 7, age: 2 },
  'Sample Line B|Jebel Ali|Shanghai (Yangshan)': { routing: 'via Port Klang', freeDays: 14, sails: 'Wed', freeOrigin: 7, age: 4 },
  'Sample Line A|Nhava Sheva|Jebel Ali': { routing: 'Direct', freeDays: 14, sails: 'Fri', freeOrigin: 5, agent: 'Sample Agent Nhava Sheva', age: 4 },
  'Sample Line B|Nhava Sheva|Jebel Ali': { routing: 'via Salalah', freeDays: 21, sails: 'Mon', freeOrigin: 7, agent: 'Sample Agent Nhava Sheva', age: 8 },
  'Sample Line A|Shanghai (Yangshan)|Jebel Ali': { routing: 'Direct', freeDays: 10, sails: 'Wed', freeOrigin: 5, agent: 'Sample Agent Shanghai', age: 3 },
  'Sample Line C|Shanghai (Yangshan)|Jebel Ali': { routing: 'via Port Klang', freeDays: 14, sails: 'Sat', freeOrigin: 7, agent: 'Sample Agent Shanghai', age: 6 },
  'Sample Line A|Ningbo|Jebel Ali': { routing: 'Direct', freeDays: 10, sails: 'Tue', freeOrigin: 5, agent: 'Sample Agent Shanghai', age: 2 },
  'Sample Line C|Ningbo|Jebel Ali': { routing: 'via Singapore', freeDays: 14, sails: 'Fri', freeOrigin: 7, agent: 'Sample Agent Shanghai', age: 5 },
  'Sample Line A|Qingdao|Jebel Ali': { routing: 'Direct', freeDays: 10, sails: 'Mon', freeOrigin: 5, age: 3 },
  'Sample Line C|Qingdao|Jebel Ali': { routing: 'via Port Klang', freeDays: 14, sails: 'Thu', freeOrigin: 7, age: 7 },
  'Sample Line A|Shenzhen|Jebel Ali': { routing: 'Direct', freeDays: 10, sails: 'Sun', freeOrigin: 5, age: 1 },
  'Sample Line C|Shenzhen|Jebel Ali': { routing: 'via Singapore', freeDays: 14, sails: 'Wed', freeOrigin: 7, age: 4 },
  'Sample Consol|Ningbo|Valencia': { routing: 'Direct consol', freeDays: null, sails: 'Fri', age: 4 },
  'Sample Consol B|Ningbo|Valencia': { routing: 'via Singapore', freeDays: null, sails: 'Tue', age: 10 },
  'Sample Airline|Dubai (DXB)|Madrid (MAD)': { routing: 'Direct flight', freeDays: null, sails: 'daily', age: 1 },
  'Sample Airline B|Dubai (DXB)|Madrid (MAD)': { routing: 'via Doha', freeDays: null, sails: 'daily', age: 2 },
  'Sample Haulier|Jebel Ali|Riyadh': { routing: 'Direct via Batha', freeDays: null, sails: 'daily', age: 3 },
  'Sample Haulier B|Jebel Ali|Riyadh': { routing: 'Direct via Batha (groupage wait)', freeDays: null, sails: 'daily', age: 5 },
};

export function sampleRates(today = new Date()): RateRow[] {
  return SAMPLE.map(([mode, origin, destination, equipment, charge, side, basis, buy, min, valid, transit, carrier]) => {
    const meta = side === 'freight' ? LINE_META[`${carrier}|${origin}|${destination}`] : undefined;
    return {
      mode, origin, destination, equipment, charge, side, basis, currency: 'USD', buy, min, validUntil: day(valid, today), transitDays: transit, carrier,
      ...(meta
        ? {
            routing: meta.routing, freeDays: meta.freeDays, sails: meta.sails, freeDaysOrigin: meta.freeOrigin ?? null,
            ...(meta.agent ? { agent: meta.agent } : {}),
            source: meta.agent ? 'Sample agent quote' : 'Sample rate sheet', rateDate: day(-(meta.age ?? 0), today),
          }
        : {}),
    };
  });
}

export function rowsToCsv(rows: RateRow[]): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [CSV_COLUMNS.join(',')];
  for (const r of rows) {
    lines.push([r.mode, r.origin, r.destination, r.equipment, r.charge, r.side, r.basis, r.currency, String(r.buy), String(r.min || ''), r.validUntil, r.transitDays == null ? '' : String(r.transitDays), r.carrier, r.routing ?? '', r.freeDays == null ? '' : String(r.freeDays), r.sails ?? '', r.freeDaysOrigin == null ? '' : String(r.freeDaysOrigin), r.agent ?? '', r.source ?? '', r.rateDate ?? '', r.payment ?? ''].map(esc).join(','));
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
      routing: get('routing') || undefined,
      freeDays: get('free_days') ? parseNum(get('free_days')) || null : null,
      sails: get('sails') || undefined,
      freeDaysOrigin: get('free_days_origin') ? parseNum(get('free_days_origin')) || null : null,
      agent: get('agent') || undefined,
      source: get('source') || undefined,
      rateDate: normDate(get('rate_date')) ?? undefined,
      payment: /^collect$/i.test(get('payment')) ? 'collect' : /^prepaid$/i.test(get('payment')) ? 'prepaid' : undefined,
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
  /** SAMPLE estimate (no rate on file / requested service), never a real price. */
  estimate?: boolean;
  /** Asked for in the request (insurance, customs clearance, trucking): always quoted, whatever the Incoterm. */
  requested?: boolean;
  /** Screen label per UI language (en, es, fa, ar), when the app wrote the line. */
  labels?: L4;
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
  /** Option data: which line/carrier this quote uses for the main freight. */
  carrier: string | null;
  routing: string | null;
  freeDays: number | null;
  sails: string | null;
  etd: string | null;
  eta: string | null;
  freeDaysOrigin: number | null;
  agent: string | null;
  rateSource: string | null;
  rateDate: string | null;
  payment: 'prepaid' | 'collect' | null;
  /** Main freight is a SAMPLE estimate (no rate on file for this lane). */
  freightEstimate: boolean;
  /** Requested equipment priced with the standard GP rate (e.g. ['40HC']). */
  gpFallback: string[];
}

export interface QuoteOpts {
  /** Demo / sample rate sheet: fill gaps with clearly labelled SAMPLE estimates. */
  estimates?: boolean;
}

export const ESTIMATE_CARRIER = 'SAMPLE estimate';

export type Badge = 'recommended' | 'cheapest' | 'fastest' | 'mostFree';

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
function sailingDates(f: QuoteFields, sails: string | null, transit: number | null, today: Date): { etd: string | null; eta: string | null } {
  const base = f.readyDate && f.readyDate !== 'ASAP' ? new Date(f.readyDate + 'T12:00:00') : new Date(today);
  const etd = new Date(base);
  const wd = sails ? WEEKDAYS.indexOf(sails.slice(0, 3).toLowerCase()) : -1;
  if (f.mode === 'air') etd.setDate(etd.getDate() + 1);
  else if (f.mode === 'road') etd.setDate(etd.getDate() + 0);
  else {
    etd.setDate(etd.getDate() + 2); // gate-in / cut-off
    if (wd >= 0) while (etd.getDay() !== wd) etd.setDate(etd.getDate() + 1);
    else etd.setDate(etd.getDate() + 1);
  }
  if (transit == null) return { etd: isoDate(etd), eta: null };
  const eta = new Date(etd);
  eta.setDate(eta.getDate() + transit);
  return { etd: isoDate(etd), eta: isoDate(eta) };
}

/** HC requested but the lane only has GP rates: price it with the GP rate (said once, as "to confirm"). */
function gpFallbackFields(f: QuoteFields, rates: RateRow[]): { f: QuoteFields; keys: string[] } {
  if (f.mode !== 'fcl') return { f, keys: [] };
  const lane = rates.filter((r) => r.mode === 'fcl' && r.side === 'freight' && r.origin === f.origin && r.destination === f.destination);
  const has = (eq: string) => lane.some((r) => r.equipment === eq || r.equipment === '*');
  const eq: Record<string, number> = {};
  const keys: string[] = [];
  for (const [k, n] of Object.entries(f.equipment)) {
    const gp = k.replace(/HC$/, 'GP');
    if (/HC$/.test(k) && !has(k) && has(gp)) { eq[gp] = (eq[gp] ?? 0) + n; keys.push(k); }
    else eq[k] = (eq[k] ?? 0) + n;
  }
  return keys.length ? { f: { ...f, equipment: eq }, keys } : { f, keys };
}

/** SAMPLE estimate rows for gaps in the sample sheet: main freight for a lane with no rate, and generic origin /
 * destination charges for ports with none on file (never at the home port: those come from the tariff table). */
function estimateRows(f: QuoteFields, rates: RateRow[], today: Date): RateRow[] {
  if (!f.mode || !f.origin || !f.destination) return [];
  const out: RateRow[] = [];
  const valid = day(14, today);
  const row = (side: Side, charge: string, basis: Basis, buy: number, equipment = '*', min = 0, transit: number | null = null): RateRow => ({
    mode: f.mode!, origin: side === 'destination' ? '*' : f.origin!, destination: side === 'origin' ? '*' : f.destination!, equipment, charge: `${charge} (SAMPLE estimate)`, side, basis,
    currency: 'USD', buy, min, validUntil: valid, transitDays: transit, carrier: ESTIMATE_CARRIER, estimate: true, source: 'SAMPLE estimate (no rate on file)', rateDate: isoDate(today),
  });
  const lane = rates.filter((r) => r.mode === f.mode && r.side === 'freight' && r.origin === f.origin && r.destination === f.destination);
  const hasFreight = lane.length > 0;
  // FCL: estimate every requested size the lane has no rate for (HC falls back to a GP rate first, see gpFallbackFields)
  const eqGaps = f.mode === 'fcl' ? Object.keys(f.equipment).filter((k) => k !== 'FTL' && !lane.some((r) => r.equipment === k || r.equipment === '*' || (/HC$/.test(k) && r.equipment === k.replace(/HC$/, 'GP')))) : [];
  const km = laneKm(f.origin, f.destination);
  if (km == null) { /* unknown place: no freight estimate */ } else if (f.mode === 'fcl' && eqGaps.length) {
    for (const eq of eqGaps) {
      const e = freightEstimate('fcl', km, eq);
      out.push(row('freight', 'Ocean freight', 'per_container', e.unit, eq, 0, e.transit));
    }
  } else if (!hasFreight && f.mode !== 'fcl') {
    if (f.mode === 'lcl') { const e = freightEstimate('lcl', km, '*'); out.push(row('freight', 'Ocean freight (LCL)', 'per_wm', e.unit, '*', e.min, e.transit)); }
    else if (f.mode === 'air') { const e = freightEstimate('air', km, '*'); out.push(row('freight', 'Air freight', 'per_kg', e.unit, '*', e.min, e.transit)); }
    else { const e = freightEstimate('road', km, 'FTL'); out.push(row('freight', 'Linehaul (FTL)', 'per_truck', e.unit, '*', 0, e.transit)); }
  }
  if (f.mode === 'fcl' || f.mode === 'lcl') {
    const home = (p: string) => p.toLowerCase().replace(/\s*\(.*\)$/, '') === HOME_PORT.toLowerCase();
    const per: Basis = f.mode === 'fcl' ? 'per_container' : 'per_wm';
    if (!home(f.origin) && !rates.some((r) => r.mode === f.mode && r.side === 'origin' && r.origin === f.origin)) {
      out.push(row('origin', 'Origin THC / handling', per, f.mode === 'fcl' ? 120 : 18, '*', f.mode === 'lcl' ? 36 : 0));
      out.push(row('origin', 'Export docs / B/L fee', 'per_shipment', 60));
    }
    if (!home(f.destination) && !rates.some((r) => r.mode === f.mode && r.side === 'destination' && r.destination === f.destination)) {
      out.push(row('destination', 'Destination THC / handling', per, f.mode === 'fcl' ? 210 : 30, '*', f.mode === 'lcl' ? 60 : 0));
      out.push(row('destination', 'Delivery order / docs', 'per_shipment', 80));
    }
  }
  return out;
}

/** One priced option per line/carrier that has main-freight rates for this lane and equipment (ask several lines, take the best). */
export function buildOptions(f0: QuoteFields, rates0: RateRow[], marginPct: number, today = new Date(), opts: QuoteOpts = {}): Quote[] {
  if (!f0.mode || !f0.origin || !f0.destination) return [];
  const rates = opts.estimates ? [...rates0, ...estimateRows(f0, rates0, today)] : rates0;
  const { f, keys } = gpFallbackFields(f0, rates);
  const carriers = [
    ...new Set(rates.filter((r) => r.mode === f.mode && r.side === 'freight' && r.origin === f.origin && r.destination === f.destination).map((r) => r.carrier)),
  ];
  const out = (carriers.length ? carriers : [undefined])
    .map((c) => buildQuote(f, rates, marginPct, today, c, f0))
    .filter((q): q is Quote => !!q && q.hasFreight);
  for (const q of out) q.gpFallback = keys;
  return out.sort((a, b) => a.sellTotal - b.sellTotal);
}

/** Badges across options. Recommended = lowest price after adding 1% per extra transit day vs the fastest, preferring options whose rates are all current. */
export function optionBadges(opts: Quote[]): Badge[][] {
  if (opts.length < 2) return opts.map(() => []);
  const minSell = Math.min(...opts.map((o) => o.sellTotal));
  const transits = opts.map((o) => o.transitDays).filter((t): t is number => t != null);
  const minT = transits.length ? Math.min(...transits) : null;
  const frees = opts.map((o) => o.freeDays).filter((t): t is number => t != null);
  const maxFree = frees.length ? Math.max(...frees) : null;
  const freeVaries = frees.length > 1 && new Set(frees).size > 1;
  const tVaries = new Set(transits).size > 1;
  const pool = opts.some((o) => o.staleCount === 0) ? opts.filter((o) => o.staleCount === 0) : opts;
  const score = (o: Quote) => o.sellTotal * (1 + 0.01 * ((o.transitDays ?? minT ?? 0) - (minT ?? 0)));
  const rec = pool.reduce((a, b) => (score(b) < score(a) ? b : a));
  return opts.map((o) => {
    const b: Badge[] = [];
    if (o === rec) b.push('recommended');
    if (o.sellTotal === minSell) b.push('cheapest');
    if (tVaries && minT != null && o.transitDays === minT) b.push('fastest');
    if (freeVaries && maxFree != null && o.freeDays === maxFree) b.push('mostFree');
    return b;
  });
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

export function buildQuote(f: QuoteFields, rates: RateRow[], marginPct: number, today = new Date(), carrier?: string, asked: QuoteFields = f): Quote | null {
  if (!f.mode || !f.origin || !f.destination) return null;
  const todayIso = isoDate(today);
  const scope = scopeFor(f.incoterm);
  const eqKeys = Object.keys(f.equipment);
  const relevant = rates.filter((r) => {
    if (r.mode !== f.mode) return false;
    if (r.side === 'freight' && !(r.origin === f.origin && r.destination === f.destination)) return false;
    if (r.side === 'freight' && carrier !== undefined && r.carrier !== carrier) return false;
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
    return { charge: r.charge, side: r.side, basis: r.basis, qty: round2(qty), unitBuy: r.buy, buy, sell, validUntil: r.validUntil, stale: r.validUntil < todayIso, carrier: r.carrier, currency: r.currency, ...(r.estimate ? { estimate: true } : {}) };
  };
  const all = relevant.map(toLine).filter((l) => l.qty > 0 || l.basis === 'per_shipment');
  // Requested services: use a matching rate-sheet line when there is one (quoted whatever the Incoterm), else add a SAMPLE estimate.
  const extra: QuoteLine[] = [];
  const valid14 = day(14, today);
  for (const sc of serviceCharges(asked)) {
    const hit = sc.match ? all.find((l) => !l.requested && sc.match!.test(l.charge) && (sc.matchSide === 'customs' ? l.side === 'customs' : l.side === sc.matchSide)) : undefined;
    if (hit) { hit.requested = true; continue; }
    const buy = round2(sc.buy);
    extra.push({ charge: `${sc.labels[0]} (SAMPLE estimate)`, labels: sc.labels, side: sc.side, basis: sc.basis, qty: sc.qty, unitBuy: sc.unit, buy, sell: Math.round(buy / (1 - m)), validUntil: valid14, stale: false, carrier: ESTIMATE_CARRIER, currency: 'USD', estimate: true, requested: true });
  }
  all.push(...extra);
  const inScope = (l: QuoteLine) => l.requested || scope.sides.includes(l.side);
  const lines = all.filter(inScope);
  const excluded = all.filter((l) => !inScope(l));
  const buyTotal = round2(lines.reduce((s, l) => s + l.buy, 0));
  const sellTotal = lines.reduce((s, l) => s + l.sell, 0);
  const marginUsd = round2(sellTotal - buyTotal);
  const transit = relevant.find((r) => r.side === 'freight' && r.transitDays != null)?.transitDays ?? null;
  const freightRow = relevant.find((r) => r.side === 'freight' && (r.routing || r.freeDays != null || r.sails)) ?? relevant.find((r) => r.side === 'freight');
  const sails = freightRow?.sails ?? null;
  const { etd, eta } = sailingDates(f, sails, transit, today);
  const fresh = lines.filter((l) => !l.stale).map((l) => l.validUntil).sort();
  const cap = new Date(today);
  cap.setDate(cap.getDate() + 14);
  const capIso = isoDate(cap);
  const validUntil = fresh.length ? (fresh[0] < capIso ? fresh[0] : capIso) : null;
  const units =
    asked.mode === 'air'
      ? `${chargeableKg(f.weightKg, f.volumeCbm) ?? '?'} kg chargeable`
      : f.mode === 'lcl'
        ? `${revenueTons(f.weightKg, f.volumeCbm) ?? '?'} W/M`
        : Object.entries(asked.equipment).map(([k, n]) => `${n}×${k}`).join(' + ') || '—';
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
    carrier: freightRow?.carrier ?? null,
    routing: freightRow?.routing ?? null,
    freeDays: freightRow?.freeDays ?? null,
    sails,
    etd,
    eta,
    freeDaysOrigin: freightRow?.freeDaysOrigin ?? null,
    agent: freightRow?.agent ?? null,
    rateSource: freightRow?.source ?? null,
    rateDate: freightRow?.rateDate ?? null,
    payment: freightRow?.payment ?? null,
    freightEstimate: lines.some((l) => l.side === 'freight' && l.estimate),
    gpFallback: [],
  };
}
