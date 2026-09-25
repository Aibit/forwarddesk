import { initialCapacity, initialRfqs } from './data';
import type { CapacityOffer, Mode, ShipperRfq, CommodityClass } from './types';

export type DataSource = 'ingest' | 'tms-stub' | 'seed';

export interface LoadResult {
  capacity: CapacityOffer[];
  rfqs: ShipperRfq[];
  source: DataSource;
  error?: string;
}

const MODES: Mode[] = ['road', 'air', 'road+air'];
const COMMODITIES: CommodityClass[] = [
  'general',
  'electronics',
  'pharma',
  'perishable',
  'hazmat',
  'restricted',
];

function asMode(v: unknown): Mode {
  return MODES.includes(v as Mode) ? (v as Mode) : 'road';
}

function asCommodity(v: unknown): CommodityClass {
  return COMMODITIES.includes(v as CommodityClass)
    ? (v as CommodityClass)
    : 'general';
}

function agentFromCarrier(carrier: string): string {
  const base = carrier.split('(')[0].trim().replace(/[^A-Za-z0-9]+/g, '');
  return `SourcingAgent-${base.slice(0, 28) || 'Carrier'}`;
}

/** Map API / CSV-shaped JSON into CapacityOffer. */
export function mapCapacityRow(raw: Record<string, unknown>): CapacityOffer {
  const origin = String(raw.origin ?? raw.pickupCity ?? '');
  const dest = String(raw.destination ?? raw.dropCity ?? '');
  const carrier = String(raw.carrier ?? 'Unknown Carrier');
  const dStart = raw.departureStart != null ? String(raw.departureStart) : '';
  const dEnd = raw.departureEnd != null ? String(raw.departureEnd) : '';
  let window = String(raw.departureWindow ?? '');
  if (!window && dStart) {
    const endPart = dEnd.includes(' ') ? dEnd.split(' ').pop() : dEnd;
    window = endPart ? `${dStart}–${endPart} GST` : `${dStart} GST`;
  }

  const truthy = (v: unknown) =>
    v === true ||
    v === 1 ||
    String(v).toLowerCase() === 'true' ||
    String(v).toLowerCase() === 'yes';

  return {
    id: String(raw.id ?? ''),
    carrier,
    carrierAgent: String(raw.carrierAgent ?? '') || agentFromCarrier(carrier),
    mode: asMode(raw.mode),
    lane: String(raw.lane ?? '') || `${origin} → ${dest}`,
    pickupCity: origin,
    dropCity: dest,
    availableWeightKg: Number(raw.availableWeightKg) || 0,
    availableVolumeCbm: Number(raw.availableVolumeCbm) || 0,
    rateMinUsd: Number(raw.rateMinUsd) || 0,
    rateMaxUsd: Number(raw.rateMaxUsd) || 0,
    departureWindow: window || 'TBD',
    etaHours: Number(raw.etaHours) || 18,
    reliability: Number(raw.reliability) || 80,
    docsOk: truthy(raw.docsOk ?? raw.borderDocsOk),
    restrictedOk: truthy(raw.restrictedOk ?? raw.restrictedCapable),
    hazmatOk: truthy(raw.hazmatOk ?? raw.hazmatCapable),
    status: (raw.status as CapacityOffer['status']) || 'available',
    kind: raw.kind as CapacityOffer['kind'] | undefined,
    source: raw.source != null ? String(raw.source) : undefined,
    source_url: raw.source_url != null ? String(raw.source_url) : undefined,
    fetched_at: raw.fetched_at != null ? String(raw.fetched_at) : undefined,
    confidence: raw.confidence != null ? String(raw.confidence) : undefined,
    notes: raw.notes != null && String(raw.notes).trim() ? String(raw.notes) : undefined,
    flightOrVoyage:
      raw.flightOrVoyage != null ? String(raw.flightOrVoyage) : undefined,
  };
}

export function mapRfqRow(raw: Record<string, unknown>): ShipperRfq {
  const truthy = (v: unknown) =>
    v === true ||
    v === 1 ||
    String(v).toLowerCase() === 'true' ||
    String(v).toLowerCase() === 'yes';

  const commodity = asCommodity(raw.commodity);
  const notes = raw.notes != null && String(raw.notes).trim() ? String(raw.notes) : undefined;

  return {
    id: String(raw.id ?? ''),
    shipper: String(raw.shipper ?? 'Unknown Shipper'),
    commodity,
    commodityLabel: String(raw.commodityLabel ?? commodity),
    weightKg: Number(raw.weightKg) || 0,
    volumeCbm: Number(raw.volumeCbm) || 0,
    pickupCity: String(raw.pickupCity ?? ''),
    dropCity: String(raw.dropCity ?? ''),
    deadline: String(raw.deadline ?? ''),
    maxPriceUsd: Number(raw.maxPriceUsd) || 0,
    hazmat: truthy(raw.hazmat),
    notes,
    status: (raw.status as ShipperRfq['status']) || 'open',
  };
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

/**
 * Load capacity + RFQs from TMS stub API.
 * Falls back to seed data in src/data.ts if the API is unreachable.
 * This keeps the static GitHub Pages build usable while preserving live API mode.
 */
export async function loadBoardData(): Promise<LoadResult> {
  try {
    const [capRaw, rfqRaw] = await Promise.all([
      fetchJson('/api/capacity'),
      fetchJson('/api/rfqs'),
    ]);

    if (!Array.isArray(capRaw)) {
      throw new Error('capacity response is not an array');
    }

    const capacity = (capRaw as Record<string, unknown>[]).map(mapCapacityRow);

    let rfqs: ShipperRfq[];
    if (Array.isArray(rfqRaw) && rfqRaw.length > 0) {
      rfqs = (rfqRaw as Record<string, unknown>[]).map(mapRfqRow);
    } else {
      rfqs = initialRfqs;
    }

    // Prefer ingest provenance when rows carry kind/source; else TMS stub.
    const hasProv = capacity.some((c) => Boolean(c.kind || c.source));
    return {
      capacity,
      rfqs,
      source: hasProv ? 'ingest' : 'tms-stub',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      capacity: initialCapacity,
      rfqs: initialRfqs,
      source: 'seed',
      error: message,
    };
  }
}
