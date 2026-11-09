/** Small location dictionary for the Quote parser. Rate-sheet names are added at runtime. */
export type QMode = 'fcl' | 'lcl' | 'air' | 'road';

export interface LocationDef {
  name: string; // canonical name used in rate sheets
  aliases: string[]; // lowercase words/phrases found in requests
  modes?: QMode[]; // which modes this canonical point serves (undefined = any)
  /** For a city with several ports/terminals: canonical names to choose from, per mode. */
  choices?: Partial<Record<QMode, string[]>>;
  /** For a city that maps to a different point by mode (e.g. Dubai by sea = Jebel Ali). */
  byMode?: Partial<Record<QMode, string>>;
}

export const LOCATIONS: LocationDef[] = [
  {
    name: 'Shanghai',
    aliases: ['shanghai', 'cnsha'],
    choices: { fcl: ['Shanghai (Yangshan)', 'Shanghai (Waigaoqiao)'], lcl: ['Shanghai (Yangshan)', 'Shanghai (Waigaoqiao)'] },
    byMode: { air: 'Shanghai (PVG)' },
  },
  { name: 'Shanghai (Yangshan)', aliases: ['yangshan'], modes: ['fcl', 'lcl'] },
  { name: 'Shanghai (Waigaoqiao)', aliases: ['waigaoqiao', 'wgq'], modes: ['fcl', 'lcl'] },
  { name: 'Shanghai (PVG)', aliases: ['pvg', 'pudong'], modes: ['air'] },
  { name: 'Ningbo', aliases: ['ningbo', 'cnngb'] },
  { name: 'Shenzhen', aliases: ['shenzhen', 'yantian'] },
  { name: 'Qingdao', aliases: ['qingdao'] },
  { name: 'Barcelona', aliases: ['barcelona', 'bcn', 'esbcn'], byMode: { air: 'Barcelona (BCN)' } },
  { name: 'Barcelona (BCN)', aliases: [], modes: ['air'] },
  { name: 'Valencia', aliases: ['valencia', 'vlc', 'esvlc'] },
  { name: 'Algeciras', aliases: ['algeciras'] },
  { name: 'Bilbao', aliases: ['bilbao'] },
  { name: 'Madrid (MAD)', aliases: ['madrid', 'barajas'] },
  { name: 'Rotterdam', aliases: ['rotterdam', 'rtm'] },
  { name: 'Hamburg', aliases: ['hamburg', 'hamburgo'] },
  { name: 'Antwerp', aliases: ['antwerp', 'amberes'] },
  {
    name: 'Dubai',
    aliases: ['dubai', 'dxb', 'dubái'],
    byMode: { air: 'Dubai (DXB)', fcl: 'Jebel Ali', lcl: 'Jebel Ali', road: 'Jebel Ali' },
  },
  { name: 'Dubai (DXB)', aliases: [], modes: ['air'] },
  { name: 'Jebel Ali', aliases: ['jebel ali', 'jebelali', 'jea', 'aejea'] },
  { name: 'Abu Dhabi', aliases: ['abu dhabi', 'auh'] },
  { name: 'Sharjah', aliases: ['sharjah', 'shj'] },
  { name: 'Riyadh', aliases: ['riyadh', 'ruh', 'riad'] },
  { name: 'Jeddah', aliases: ['jeddah', 'jed', 'yeda'] },
  { name: 'Dammam', aliases: ['dammam', 'dmm'] },
  { name: 'Singapore', aliases: ['singapore', 'singapur'] },
  { name: 'Nhava Sheva', aliases: ['nhava sheva', 'jnpt', 'mumbai'] },
  { name: 'Casablanca', aliases: ['casablanca'] },
];

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/** Resolve any name (request word or rate-sheet cell) to a canonical name, or null. */
export function canonicalName(raw: string, extra: string[] = []): string | null {
  const n = normalize(raw);
  for (const l of LOCATIONS) {
    if (normalize(l.name) === n || l.aliases.some((a) => normalize(a) === n)) return l.name;
  }
  for (const e of extra) if (normalize(e) === n) return e;
  return null;
}

export function findLocation(name: string): LocationDef | undefined {
  return LOCATIONS.find((l) => l.name === name);
}
