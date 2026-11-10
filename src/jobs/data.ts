import type { Dir } from './steps';

export type Size = '20' | '40' | '40HC';
export interface Container {
  no: string;
  seal: string | null;
  size: Size;
  heavy?: boolean;
  freeDays: number | null;
  /** Free-time clock start (export: empty released / collected, import: discharge). */
  clockStart: number | null;
  /** Clock stop (export: loaded on vessel, import: empty returned). */
  clockStop: number | null;
  returned?: 'checking' | 'ok' | null;
}
export type ChargeKey = 'bl' | 'thc' | 'seal' | 'extras' | 'demurrage' | 'do';
export interface Charge {
  key: ChargeKey;
  /** Fixed amount; when absent the amount comes from the tariff table. */
  amount?: number;
  paid: boolean;
}
export type DocKey = 'booking' | 'release' | 'seals' | 'declaration' | 'shippingOrder' | 'draftBl' | 'originalBl' | 'packing' | 'arrival' | 'loi' | 'do' | 'warehouse';
export type DocStatus = 'done' | 'waiting' | 'pending' | 'blocked';
export interface Doc {
  key: DocKey;
  status: DocStatus;
  at?: number;
  rounds?: number;
  note?: string;
}
export interface Cheque {
  kind: 'demurrage' | 'container';
  container?: string;
  holder: string;
  status: 'held' | 'returned' | 'toLodge';
}
export interface LogEntry {
  at: number;
  text: string;
  kind?: 'info' | 'warn' | 'alert';
}
export interface Job {
  id: string;
  dir: Dir;
  customer: string;
  commodity: string;
  pol: string;
  pod: string;
  line: string;
  step: string;
  containers: Container[];
  plannedEquipment?: string;
  vessel?: { name: string; eta: number; sailed?: number };
  charges: Charge[];
  collect?: { amount: number; collected: boolean; rebateReceived: boolean };
  cheques: Cheque[];
  docs: Doc[];
  log: LogEntry[];
  docDelay?: boolean;
  quoteText?: string;
}

const H = 3600_000;
const D = 24 * H;

/** ISO 6346 check digit so the sample container numbers are well-formed. */
function cntr(owner: string, serial: string): string {
  const base = owner + serial;
  // standard table: A10 B12 C13 ... K21 L23 ... U32 ... Z38
  const table: Record<string, number> = {};
  let v = 10;
  for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    if (v % 11 === 0) v++;
    table[ch] = v++;
  }
  let sum = 0;
  [...base].forEach((ch, i) => (sum += (/\d/.test(ch) ? Number(ch) : table[ch]) * 2 ** i));
  return `${base}${(sum % 11) % 10}`;
}

const box = (owner: string, serial: string, seal: string | null, size: Size, freeDays: number | null, start: number | null, stop: number | null, extra: Partial<Container> = {}): Container => ({
  no: cntr(owner, serial), seal, size, freeDays, clockStart: start, clockStop: stop, ...extra,
});

/** SAMPLE jobs. All dates are relative to `now`, so the countdowns are always live. */
export function sampleJobs(now = Date.now()): Job[] {
  const t = (d: number, h = 0) => now + d * D + h * H;
  return [
    {
      id: 'FD-E-1042', dir: 'export', customer: 'Customer A', commodity: 'Bitumen 60/70 in drums', pol: 'Bandar Abbas', pod: 'Jebel Ali',
      line: 'Line A (sample)', step: 'E18',
      containers: [
        box('LNAU', '204118', 'LA-482913', '20', 10, t(-7, -12), null, { heavy: true }),
        box('LNAU', '204377', 'LA-482914', '20', 10, t(-7, -12), null, { heavy: true }),
      ],
      vessel: { name: 'SAMPLE VESSEL ALPHA', eta: t(2, 10) },
      charges: [{ key: 'bl', paid: false }, { key: 'thc', paid: false }, { key: 'seal', paid: true }],
      cheques: [],
      docs: [
        { key: 'booking', status: 'done', at: t(-10) },
        { key: 'release', status: 'done', at: t(-8) },
        { key: 'seals', status: 'done', at: t(-7, -12) },
        { key: 'declaration', status: 'done', at: t(-1, -6) },
        { key: 'shippingOrder', status: 'waiting', note: 'Waiting on cargo owner — B/L details' },
        { key: 'draftBl', status: 'pending' },
        { key: 'originalBl', status: 'pending' },
      ],
      log: [
        { at: t(-8), text: 'E11 Release order received from Line A, sent to Bandar Abbas office' },
        { at: t(-7, -12), text: 'E12 Clearance agent collected release order and 2 seals' },
        { at: t(-1, -6), text: 'E15 Export declaration filed' },
        { at: t(-0, -3), text: 'E17 Customs papers handed to the line — first vessel ALPHA', kind: 'info' },
      ],
    },
    {
      id: 'FD-E-1038', dir: 'export', customer: 'Customer B', commodity: 'Stone blocks (سنگ کوپ)', pol: 'Bandar Abbas', pod: 'Shanghai',
      line: 'Line B (sample)', step: 'E21',
      containers: [
        box('LNBU', '310452', 'LB-117205', '20', 10, t(-15), t(-2), { heavy: true }),
        box('LNBU', '310468', 'LB-117206', '20', 10, t(-15), t(-2), { heavy: true }),
        box('LNBU', '310471', 'LB-117207', '20', 10, t(-14), t(-2), { heavy: true }),
        box('LNBU', '310486', 'LB-117208', '20', 10, t(-14), t(-2), { heavy: true }),
      ],
      vessel: { name: 'SAMPLE VESSEL BRAVO', eta: t(-3), sailed: t(-2) },
      charges: [
        { key: 'bl', paid: true },
        { key: 'thc', paid: false },
        { key: 'seal', paid: true },
        { key: 'extras', amount: 45, paid: false },
        { key: 'demurrage', paid: false },
      ],
      cheques: [],
      docs: [
        { key: 'booking', status: 'done', at: t(-20) },
        { key: 'release', status: 'done', at: t(-16) },
        { key: 'seals', status: 'done', at: t(-15) },
        { key: 'declaration', status: 'done', at: t(-5) },
        { key: 'shippingOrder', status: 'done', at: t(-4, -8), note: 'Received 56 h before arrival' },
        { key: 'draftBl', status: 'done', at: t(-1), rounds: 3, note: 'Round 3 approved by customer' },
        { key: 'originalBl', status: 'blocked', note: 'Held by Line B until every charge is paid' },
      ],
      log: [
        { at: t(-5), text: 'Free time ended on all 4 containers before loading', kind: 'warn' },
        { at: t(-2), text: 'Vessel BRAVO sailed — charges now due (E21)' },
        { at: t(-1), text: 'E20 Draft B/L round 3 approved' },
        { at: t(0, -5), text: 'Line B demurrage invoice received: 4 × 20′', kind: 'warn' },
      ],
    },
    {
      id: 'FD-E-1047', dir: 'export', customer: 'Customer C', commodity: 'Bitumen in drums', pol: 'Bandar Abbas', pod: 'Nhava Sheva',
      line: 'Lines A, B, C asked', step: 'E3', plannedEquipment: "2 × 20′ heavy",
      containers: [],
      charges: [], cheques: [],
      docs: [],
      log: [
        { at: t(0, -6), text: 'E2 Rate request by WhatsApp: 2 × 20′ heavy bitumen to Nhava Sheva' },
        { at: t(0, -4), text: 'E3 Asked Line A, Line B, Line C for rates — 1 of 3 replied' },
      ],
      quoteText: 'Hi, need price for 2x20GP heavy Bandar Abbas to Nhava Sheva, bitumen in drums, approx 24 tons per container, ready next week. Thanks',
    },
    {
      id: 'FD-E-1031', dir: 'export', customer: 'Customer B', commodity: 'Stone blocks (سنگ کوپ)', pol: 'Bandar Abbas', pod: 'Shanghai',
      line: 'Line A (sample)', step: 'E14',
      containers: [
        ...['118020', '118035', '118041', '118057', '118063', '118079'].map((s, i) => box('LNAU', s, `LA-49${3100 + i}`, '20', 21, t(-9), null, { heavy: true })),
      ],
      vessel: { name: 'SAMPLE VESSEL CHARLIE', eta: t(6, 4) },
      charges: [{ key: 'bl', paid: false }, { key: 'thc', paid: false }, { key: 'seal', paid: true }],
      cheques: [],
      docs: [
        { key: 'booking', status: 'done', at: t(-12) },
        { key: 'release', status: 'done', at: t(-10) },
        { key: 'seals', status: 'done', at: t(-9) },
        { key: 'declaration', status: 'pending' },
        { key: 'shippingOrder', status: 'pending' },
        { key: 'draftBl', status: 'pending' },
        { key: 'originalBl', status: 'pending' },
      ],
      log: [
        { at: t(-12), text: 'E8 Free time 21 days agreed with Line A (big shipment)' },
        { at: t(-9), text: 'E12 6 seals and release order collected' },
        { at: t(0, -2), text: 'E14 4 of 6 containers loaded from trucks' },
      ],
    },
    {
      id: 'FD-I-0877', dir: 'import', customer: 'Customer D', commodity: 'Basmati rice, bagged', pol: 'Nhava Sheva', pod: 'Bandar Abbas',
      line: 'Line C (sample)', step: 'I14', docDelay: true,
      containers: [
        box('LNCU', '502214', 'LC-90311', '20', 21, t(-52), null),
        box('LNCU', '502229', 'LC-90312', '20', 21, t(-52), null),
        box('LNCU', '502235', 'LC-90313', '20', 21, t(-52), null),
      ],
      vessel: { name: 'SAMPLE VESSEL DELTA', eta: t(-52) },
      charges: [{ key: 'thc', paid: true }, { key: 'do', paid: true }],
      collect: { amount: 2850, collected: true, rebateReceived: true },
      cheques: [
        { kind: 'demurrage', holder: 'Line C', status: 'held' },
        ...['502214', '502229', '502235'].map((s) => ({ kind: 'container' as const, container: cntr('LNCU', s), holder: 'Line C', status: 'held' as const })),
      ],
      docs: [
        { key: 'draftBl', status: 'done', at: t(-60), rounds: 2 },
        { key: 'arrival', status: 'done', at: t(-53) },
        { key: 'loi', status: 'done', at: t(-52) },
        { key: 'do', status: 'done', at: t(-50) },
        { key: 'warehouse', status: 'done', at: t(-50) },
      ],
      log: [
        { at: t(-52), text: 'I10 Arrival notice: 3 × 20′, cheques required, return terminal named' },
        { at: t(-50), text: 'I12 DO and warehouse receipt handed to customer' },
        { at: t(-31), text: 'Free time ended — customer\'s import documents still incomplete', kind: 'alert' },
        { at: t(-3), text: 'Customer says permit expected next week (document delay, 40–60 day case)', kind: 'warn' },
      ],
    },
    {
      id: 'FD-I-0912', dir: 'import', customer: 'Customer E', commodity: 'Machinery spare parts', pol: 'Shanghai', pod: 'Bandar Abbas',
      line: 'Line B (sample)', step: 'I11',
      containers: [
        box('LNBU', '771304', 'LB-220871', '40HC', 14, t(-4), null),
        box('LNBU', '771310', 'LB-220872', '40HC', 14, t(-4), null),
      ],
      vessel: { name: 'SAMPLE VESSEL ECHO', eta: t(-4) },
      charges: [{ key: 'thc', paid: false }, { key: 'do', paid: false }],
      collect: { amount: 3400, collected: false, rebateReceived: false },
      cheques: [
        { kind: 'demurrage', holder: 'Line B', status: 'toLodge' },
        { kind: 'container', container: cntr('LNBU', '771304'), holder: 'Line B', status: 'toLodge' },
        { kind: 'container', container: cntr('LNBU', '771310'), holder: 'Line B', status: 'toLodge' },
      ],
      docs: [
        { key: 'draftBl', status: 'done', at: t(-20), rounds: 1 },
        { key: 'arrival', status: 'done', at: t(-4) },
        { key: 'loi', status: 'waiting', note: 'Line\'s LOI form sent to customer to sign' },
        { key: 'do', status: 'pending' },
        { key: 'warehouse', status: 'pending' },
      ],
      log: [
        { at: t(-4), text: 'I10 Arrival notice from Line B: THC, DO fee, 2 container cheques + 1 demurrage cheque' },
        { at: t(-1), text: 'Charges sent to customer for payment (I12)' },
      ],
    },
    {
      id: 'FD-I-0921', dir: 'import', customer: 'Customer F', commodity: 'Industrial spare parts', pol: 'Hamburg', pod: 'Bandar Abbas',
      line: 'Line D (sample)', step: 'I9',
      containers: [box('LNDU', '640085', 'LD-55120', '40', 21, null, null)],
      vessel: { name: 'SAMPLE VESSEL FOXTROT', eta: t(6, 8) },
      charges: [],
      collect: { amount: 4100, collected: false, rebateReceived: false },
      cheques: [],
      docs: [
        { key: 'draftBl', status: 'waiting', rounds: 2, note: 'Round 2: consignee address corrected, waiting on customer' },
        { key: 'arrival', status: 'pending' },
        { key: 'do', status: 'pending' },
        { key: 'warehouse', status: 'pending' },
      ],
      log: [
        { at: t(-9), text: 'I8 Our Hamburg agent loaded on first sailing (FOXTROT)' },
        { at: t(-2), text: 'I9 Draft B/L round 1 sent to customer' },
        { at: t(0, -20), text: 'I9 Round 2: consignee address corrected' },
      ],
    },
    {
      id: 'FD-I-0859', dir: 'import', customer: 'Customer G', commodity: 'Ceramic tiles', pol: 'Shanghai', pod: 'Bandar Abbas',
      line: 'Line A (sample)', step: 'I15',
      containers: [box('LNAU', '880561', 'LA-301877', '20', 21, t(-18), t(-1), { returned: 'checking' })],
      vessel: { name: 'SAMPLE VESSEL GOLF', eta: t(-18) },
      charges: [{ key: 'thc', paid: true }, { key: 'do', paid: true }],
      collect: { amount: 1650, collected: true, rebateReceived: false },
      cheques: [
        { kind: 'demurrage', holder: 'Line A', status: 'held' },
        { kind: 'container', container: cntr('LNAU', '880561'), holder: 'Line A', status: 'held' },
      ],
      docs: [
        { key: 'draftBl', status: 'done', at: t(-30), rounds: 1 },
        { key: 'arrival', status: 'done', at: t(-18) },
        { key: 'loi', status: 'done', at: t(-17) },
        { key: 'do', status: 'done', at: t(-16) },
        { key: 'warehouse', status: 'done', at: t(-16) },
      ],
      log: [
        { at: t(-16), text: 'I12 Customer paid; DO and warehouse receipt handed over' },
        { at: t(-1), text: 'I15 Empty returned to terminal inside free time — damage check in progress' },
      ],
    },
  ];
}
