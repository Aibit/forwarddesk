import { LOCATIONS, canonicalName, findLocation, normalize, type QMode } from './locations';

export type DgState = 'yes' | 'no' | 'unknown';

export interface QuoteFields {
  mode: QMode | null;
  origin: string | null;
  destination: string | null;
  /** e.g. { '40HC': 2 } for FCL, { FTL: 1 } for road */
  equipment: Record<string, number>;
  weightKg: number | null;
  volumeCbm: number | null;
  pieces: number | null;
  incoterm: string | null;
  readyDate: string | null; // ISO yyyy-mm-dd, or 'ASAP'
  cargo: string | null;
  dg: DgState;
}

export type IssueKind = 'missing' | 'ambiguous' | 'assumed';

export interface Issue {
  field: keyof QuoteFields | 'route';
  kind: IssueKind;
  message: string;
  question?: { en: string; es: string };
  /** For ambiguous choices the user can click to resolve. */
  options?: string[];
}

export interface ParseResult {
  fields: QuoteFields;
  /** Ambiguity / assumption details discovered while parsing the raw text. */
  parseIssues: Issue[];
  /** Raw evidence for chips, e.g. which words produced the mode. */
  evidence: Partial<Record<keyof QuoteFields, string>>;
  originOptions?: string[];
  destinationOptions?: string[];
  originBase: string | null;
  destBase: string | null;
  language: 'en' | 'es';
}

export const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, ene: 0, enero: 0,
  feb: 1, february: 1, febrero: 1,
  mar: 2, march: 2, marzo: 2,
  apr: 3, april: 3, abr: 3, abril: 3,
  may: 4, mayo: 4,
  jun: 5, june: 5, junio: 5,
  jul: 6, july: 6, julio: 6,
  aug: 7, august: 7, ago: 7, agosto: 7,
  sep: 8, sept: 8, september: 8, septiembre: 8,
  oct: 9, october: 9, octubre: 9,
  nov: 10, november: 10, noviembre: 10,
  dec: 11, december: 11, dic: 11, diciembre: 11,
};

/** Parse "2.150", "2,150", "7,8", "3.2", "22" into a number. */
export function parseNum(s: string): number {
  const t = s.trim();
  if (/^\d{1,3}([.,]\d{3})+$/.test(t)) return Number(t.replace(/[.,]/g, ''));
  return Number(t.replace(',', '.'));
}

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function futureDate(day: number, month: number, today: Date): string {
  let d = new Date(today.getFullYear(), month, day);
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (d < t0) d = new Date(today.getFullYear() + 1, month, day);
  return isoDate(d);
}

const NUM = String.raw`(\d+(?:[.,]\d+)*)`;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface Hit {
  base: string;
  index: number;
  word: string;
}

function findLocationHits(text: string, extra: string[]): Hit[] {
  const n = normalize(text);
  const hits: Hit[] = [];
  const terms: { term: string; base: string }[] = [];
  for (const l of LOCATIONS) {
    for (const a of l.aliases) terms.push({ term: normalize(a), base: l.name });
  }
  for (const e of extra) {
    if (!canonicalName(e)) terms.push({ term: normalize(e), base: e });
  }
  // Longer terms first so "jebel ali" wins over shorter overlaps.
  terms.sort((a, b) => b.term.length - a.term.length);
  const taken: [number, number][] = [];
  for (const { term, base } of terms) {
    if (!term) continue;
    const re = new RegExp(`(^|[^a-z0-9])(${escapeRe(term)})(?=$|[^a-z0-9])`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(n))) {
      const start = m.index + m[1].length;
      const end = start + m[2].length;
      if (taken.some(([s, e]) => start < e && end > s)) continue;
      taken.push([start, end]);
      hits.push({ base, index: start, word: text.slice(start, end) });
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}

/** Map a base location to the concrete point for a mode. */
export function resolveForMode(
  base: string,
  mode: QMode | null
): { name: string; options?: string[]; assumedFrom?: string } {
  const def = findLocation(base);
  if (!def || !mode) return { name: base };
  const choices = def.choices?.[mode];
  if (choices && choices.length > 1) return { name: choices[0], options: choices };
  const mapped = def.byMode?.[mode];
  if (mapped && mapped !== base) return { name: mapped, assumedFrom: base };
  return { name: base };
}

export function parseRequest(raw: string, extraLocations: string[] = [], today = new Date()): ParseResult {
  const text = raw.replace(/\s+/g, ' ').trim();
  const lower = normalize(text);
  const parseIssues: Issue[] = [];
  const evidence: ParseResult['evidence'] = {};

  const esWords = (lower.match(/\b(hola|necesito|cotizacion|cotizar|desde|hasta|mercancia|palets|semana|gracias|buenas|nos|podeis|grupaje|peligrosa|lista)\b/g) || []).length;
  const language: 'en' | 'es' = esWords >= 2 ? 'es' : 'en';

  // ── Equipment ──
  const equipment: Record<string, number> = {};
  const eqRe = /(\d+)\s*(?:x|×|\*)?\s*(20|40|45)\s*(?:'|’|ft|pies)?\s*(hc|hq|gp|dv|dc|st|std|rf|reefer|ot|fr)?\b/gi;
  let em: RegExpExecArray | null;
  let ambiguousSize = false;
  while ((em = eqRe.exec(text))) {
    const count = Number(em[1]);
    if (count < 1 || count > 99) continue;
    const size = em[2];
    let type = (em[3] || '').toLowerCase();
    if (!type) {
      ambiguousSize = true;
      type = 'gp';
    }
    const norm = type === 'hq' || type === 'hc' ? 'HC' : type === 'rf' || type === 'reefer' ? 'RF' : type === 'ot' ? 'OT' : type === 'fr' ? 'FR' : 'GP';
    const key = `${size}${norm}`;
    equipment[key] = (equipment[key] || 0) + count;
    evidence.equipment = em[0].trim();
  }
  const ftl = lower.match(/(\d+)?\s*(ftl|full truck(?:load)?|camion completo|camiones? completos?|trucks?|trailers?|camion(?:es)?)\b/);
  if (ftl && Object.keys(equipment).length === 0 && /ftl|full truck|completo|truck|trailer|camion/.test(ftl[2])) {
    equipment.FTL = ftl[1] ? Number(ftl[1]) : 1;
    evidence.equipment = ftl[0].trim();
  }

  // ── Weight / volume / pieces ──
  let weightKg: number | null = null;
  const wm = lower.match(new RegExp(`${NUM}\\s*(kgs?|kilos?|kilogramos?|t|tons?|tonnes?|mt|toneladas?)\\b`));
  if (wm) {
    const v = parseNum(wm[1]);
    weightKg = /^(kg|kgs|kilo|kilos|kilogramo|kilogramos)$/.test(wm[2]) ? v : v * 1000;
    evidence.weightKg = wm[0];
  }
  let volumeCbm: number | null = null;
  const vm = lower.match(new RegExp(`${NUM}\\s*(cbm|m3|m³|cubic meters?|metros cubicos)`));
  if (vm) {
    volumeCbm = parseNum(vm[1]);
    evidence.volumeCbm = vm[0];
  }
  let pieces: number | null = null;
  const pm = lower.match(/(\d+)\s*(pcs|pieces|pallets?|palets?|plts|cartons|ctns|boxes|bultos|cajas|cases)\b/);
  if (pm) {
    pieces = Number(pm[1]);
    evidence.pieces = pm[0];
  }

  // ── Mode ──
  let mode: QMode | null = null;
  if (Object.keys(equipment).some((k) => k !== 'FTL') || /\bfcl\b|\bcontainers?\b|\bcontenedor/.test(lower)) {
    mode = 'fcl';
    evidence.mode = evidence.equipment || 'FCL';
  } else if (/\blcl\b|grupaje|consolidad|groupage/.test(lower)) {
    mode = 'lcl';
    evidence.mode = (lower.match(/\blcl\b|grupaje|consolidad\w*|groupage/) || ['LCL'])[0];
  } else if (/\bby air\b|\bair ?freight\b|\bairfreight\b|\baereo\b|\bawb\b|\bvia aerea\b|\bair\b/.test(lower)) {
    mode = 'air';
    evidence.mode = (lower.match(/by air|air ?freight|airfreight|aereo|awb|via aerea|\bair\b/) || ['air'])[0];
  } else if (equipment.FTL || /\bltl\b|\broad\b|\bcarretera\b|\btruck\b/.test(lower)) {
    mode = 'road';
    evidence.mode = evidence.equipment || 'road';
  }
  const urgent = /\burgent|\basap\b|urgente|\bcuanto antes\b/.test(lower);
  if (!mode && weightKg != null && weightKg <= 1500 && urgent) {
    mode = 'air';
    parseIssues.push({
      field: 'mode',
      kind: 'assumed',
      message: `Mode not stated — assumed AIR (urgent, ${weightKg.toLocaleString()} kg).`,
      question: {
        en: 'Shall we quote this by air? Given the urgency we have assumed air freight.',
        es: '¿Lo cotizamos por vía aérea? Por la urgencia hemos asumido aéreo.',
      },
    });
    evidence.mode = 'urgent + small';
  }

  // ── Route ──
  const hits = findLocationHits(text, extraLocations);
  const distinct: Hit[] = [];
  for (const h of hits) if (!distinct.some((d) => d.base === h.base)) distinct.push(h);
  let originBase: string | null = null;
  let destBase: string | null = null;
  for (const h of distinct) {
    const before = normalize(text.slice(Math.max(0, h.index - 9), h.index));
    if (/(\bto|->|→|>|\ba|hasta|\bdest\w*:?)\s*$/.test(before) && !destBase) destBase = h.base;
    else if (/(\bfrom|\bde|desde|\bex|\borigin:?)\s*$/.test(before) && !originBase) originBase = h.base;
  }
  for (const h of distinct) {
    if (h.base === originBase || h.base === destBase) continue;
    if (!originBase) originBase = h.base;
    else if (!destBase) destBase = h.base;
  }
  if (originBase) evidence.origin = distinct.find((d) => d.base === originBase)?.word;
  if (destBase) evidence.destination = distinct.find((d) => d.base === destBase)?.word;

  let origin: string | null = null;
  let destination: string | null = null;
  let originOptions: string[] | undefined;
  let destinationOptions: string[] | undefined;
  if (originBase) {
    const r = resolveForMode(originBase, mode);
    origin = r.name;
    originOptions = r.options;
    if (r.assumedFrom) parseIssues.push({ field: 'origin', kind: 'assumed', message: `"${r.assumedFrom}" read as ${r.name} for ${mode?.toUpperCase()}.` });
  }
  if (destBase) {
    const r = resolveForMode(destBase, mode);
    destination = r.name;
    destinationOptions = r.options;
    if (r.assumedFrom) parseIssues.push({ field: 'destination', kind: 'assumed', message: `"${r.assumedFrom}" read as ${r.name} for ${mode?.toUpperCase()}.` });
  }

  if (ambiguousSize) {
    parseIssues.push({
      field: 'equipment',
      kind: 'ambiguous',
      message: 'Container type not stated — priced as standard (GP).',
      question: { en: 'Do you need standard (GP) or high-cube (HC) containers?', es: '¿Necesitáis contenedores estándar (GP) o high cube (HC)?' },
    });
  }

  // ── Incoterm ──
  const im = text.toUpperCase().match(new RegExp(`\\b(${INCOTERMS.join('|')}|CNF|C&F)\\b`));
  let incoterm: string | null = null;
  if (im) {
    incoterm = im[1] === 'CNF' || im[1] === 'C&F' ? 'CFR' : im[1];
    evidence.incoterm = im[0];
  }

  // ── Ready date ──
  let readyDate: string | null = null;
  const dm1 = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s*(?:de\s+)?([a-z]{3,10})\b/);
  const dm2 = lower.match(/\b([a-z]{3,10})\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
  const dm3 = lower.match(/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/);
  const readyCtx = /(ready|cargo ready|lista|listo|disponible|pickup|recogida|from|desde|loading|carga)/;
  if (dm1 && MONTHS[dm1[2]] !== undefined) {
    readyDate = futureDate(Number(dm1[1]), MONTHS[dm1[2]], today);
    evidence.readyDate = dm1[0];
  } else if (dm2 && MONTHS[dm2[1]] !== undefined) {
    readyDate = futureDate(Number(dm2[2]), MONTHS[dm2[1]], today);
    evidence.readyDate = dm2[0];
  } else if (dm3 && Number(dm3[2]) <= 12 && !/cbm|m3/.test(lower.slice(lower.indexOf(dm3[0]), lower.indexOf(dm3[0]) + dm3[0].length + 4))) {
    readyDate = futureDate(Number(dm3[1]), Number(dm3[2]) - 1, today);
    evidence.readyDate = dm3[0];
  } else if (urgent || /\btoday\b|\bhoy\b|\bnow\b/.test(lower)) {
    readyDate = 'ASAP';
    evidence.readyDate = (lower.match(/urgent\w*|asap|hoy|today|now/) || ['ASAP'])[0];
  } else if (/next week|semana que viene|proxima semana|la semana proxima/.test(lower)) {
    const d = new Date(today);
    d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
    readyDate = isoDate(d);
    evidence.readyDate = (lower.match(/next week|semana que viene|proxima semana|la semana proxima/) || [''])[0];
    parseIssues.push({
      field: 'readyDate',
      kind: 'ambiguous',
      message: `"${evidence.readyDate}" — assumed Monday ${readyDate}.`,
      question: { en: 'Which exact day will the cargo be ready for pickup?', es: '¿Qué día exacto estará lista la mercancía para recoger?' },
    });
  }
  void readyCtx;

  // ── Cargo & DG ──
  let dg: DgState = 'unknown';
  if (/\b(dg|imo|imdg|adr|haz(?:mat)?|dangerous|peligros[ao]s?)\b\s*\??\s*[:-]?\s*(no|n|none|negative)\b|\bno\s+(dg|dangerous|haz(?:mat)?|peligros[ao]|imo)\b|\bnon[- ]?(dg|haz(?:ardous)?|dangerous)\b|\bno es peligros/.test(lower)) {
    dg = 'no';
    evidence.dg = 'stated: not DG';
  } else if (/\b(un\s?\d{4}|class\s?\d|clase\s?\d|imo|imdg|dangerous goods|hazmat|lithium|litio|msds|dg)\b/.test(lower)) {
    dg = 'yes';
    evidence.dg = (lower.match(/un\s?\d{4}|class\s?\d|clase\s?\d|imo|imdg|dangerous goods|hazmat|lithium|litio|msds|\bdg\b/) || ['DG'])[0];
  } else if (/general cargo|carga general|\bfak\b/.test(lower)) {
    dg = 'no';
    evidence.dg = 'general cargo';
  }
  let cargo: string | null = null;
  const cm = text.match(/(?:cargo|commodity|goods|mercanc[ií]a|producto)\s*[:=-]\s*([^.,;\n]+)/i);
  const known = lower.match(/general cargo|carga general|steel coils?|bobinas de acero|spare parts|piezas de recambio|recambios|auto parts|electronics|electronica|textiles?|furniture|muebles|machinery|maquinaria|food|alimentos|pharma\w*|chemicals?|quimicos|cosmetics|cosmeticos|ceramic tiles|azulejos|olive oil|aceite de oliva|garments|ropa/);
  if (cm) cargo = cm[1].trim();
  else if (known) cargo = known[0];
  if (cargo) evidence.cargo = cargo;

  return {
    fields: { mode, origin, destination, equipment, weightKg, volumeCbm, pieces, incoterm, readyDate, cargo, dg },
    parseIssues,
    evidence,
    originOptions,
    destinationOptions,
    originBase,
    destBase,
    language,
  };
}

/** Air chargeable weight at 1:6000 (1 cbm = 166.67 kg), rounded up to the next 0.5 kg. */
export function chargeableKg(weightKg: number | null, volumeCbm: number | null): number | null {
  if (weightKg == null && volumeCbm == null) return null;
  const vol = (volumeCbm ?? 0) * (1_000_000 / 6000);
  return Math.ceil(Math.max(weightKg ?? 0, vol) * 2) / 2;
}

/** Ocean LCL revenue tons: greater of cbm and metric tonnes, minimum 1. */
export function revenueTons(weightKg: number | null, volumeCbm: number | null): number | null {
  if (weightKg == null && volumeCbm == null) return null;
  return Math.max(1, volumeCbm ?? 0, (weightKg ?? 0) / 1000);
}

/** Missing-field checks run on the effective (possibly user-edited) fields. */
export function missingIssues(f: QuoteFields): Issue[] {
  const out: Issue[] = [];
  const q = (en: string, es: string) => ({ en, es });
  if (!f.mode) out.push({ field: 'mode', kind: 'missing', message: 'Mode not clear (sea / air / road).', question: q('Would you like this quoted by sea, air or road?', '¿Lo cotizamos por mar, aéreo o carretera?') });
  if (!f.origin) out.push({ field: 'origin', kind: 'missing', message: 'Origin not found.', question: q('Where will the cargo be collected (city / port and postcode)?', '¿Dónde se recoge la mercancía (ciudad / puerto y código postal)?') });
  if (!f.destination) out.push({ field: 'destination', kind: 'missing', message: 'Destination not found.', question: q('What is the final destination (city / port and postcode)?', '¿Cuál es el destino final (ciudad / puerto y código postal)?') });
  if (f.mode === 'fcl' && Object.keys(f.equipment).filter((k) => k !== 'FTL').length === 0)
    out.push({ field: 'equipment', kind: 'missing', message: 'Container count / type missing.', question: q('How many containers, and which type (20GP / 40GP / 40HC)?', '¿Cuántos contenedores y de qué tipo (20GP / 40GP / 40HC)?') });
  if (f.mode === 'fcl' && f.weightKg == null)
    out.push({ field: 'weightKg', kind: 'missing', message: 'Gross weight per container missing (needed for VGM / overweight check).', question: q('What is the approximate gross weight per container?', '¿Cuál es el peso bruto aproximado por contenedor?') });
  if ((f.mode === 'air' || f.mode === 'lcl' || f.mode === 'road') && f.weightKg == null)
    out.push({ field: 'weightKg', kind: 'missing', message: 'Gross weight missing.', question: q('What is the total gross weight (kg)?', '¿Cuál es el peso bruto total (kg)?') });
  if ((f.mode === 'air' || f.mode === 'lcl') && f.volumeCbm == null)
    out.push({ field: 'volumeCbm', kind: 'missing', message: 'Volume / dimensions missing — chargeable weight can’t be checked.', question: q('Could you send the number of pieces and dimensions (L×W×H cm)?', '¿Nos podéis pasar número de bultos y medidas (largo×ancho×alto cm)?') });
  if (f.mode === 'road' && f.equipment.FTL && !/flatbed|curtain|reefer|box/.test(f.cargo ?? ''))
    out.push({ field: 'equipment', kind: 'ambiguous', message: 'Trailer type not stated.', question: q('Which trailer do you need — curtainsider or flatbed? Any loading restrictions?', '¿Qué tipo de tráiler necesitáis — lona o plataforma? ¿Alguna restricción de carga?') });
  if (!f.incoterm) out.push({ field: 'incoterm', kind: 'missing', message: 'Incoterm missing — scope of charges unclear (assumed FOB).', question: q('Which Incoterm applies (e.g. EXW, FOB, CIF, DAP)?', '¿Qué Incoterm aplica (EXW, FOB, CIF, DAP…)?') });
  if (!f.readyDate) out.push({ field: 'readyDate', kind: 'missing', message: 'Cargo ready date missing.', question: q('When will the cargo be ready?', '¿Cuándo estará lista la mercancía?') });
  if (!f.cargo) out.push({ field: 'cargo', kind: 'missing', message: 'Commodity not described.', question: q('What is the commodity (short description / HS code)?', '¿Qué mercancía es (descripción breve / código HS)?') });
  if (f.dg === 'unknown') out.push({ field: 'dg', kind: 'missing', message: 'DG status unknown.', question: q('Is the cargo dangerous goods? If yes, please send the MSDS and UN number.', '¿Es mercancía peligrosa? En ese caso, enviadnos la MSDS y el número UN.') });
  if (f.dg === 'yes') out.push({ field: 'dg', kind: 'ambiguous', message: 'Dangerous goods — DG surcharges and carrier acceptance not in sample rates.', question: q('Please send the MSDS, UN number and class so we can confirm DG acceptance.', 'Por favor enviad la MSDS, número UN y clase para confirmar la aceptación DG.') });
  return out;
}
