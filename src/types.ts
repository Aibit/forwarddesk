export type Mode = 'road' | 'air' | 'road+air';
export type CommodityClass =
  | 'general'
  | 'electronics'
  | 'pharma'
  | 'perishable'
  | 'hazmat'
  | 'restricted';
export type RfqStatus = 'open' | 'matching' | 'proposed' | 'booked' | 'exception' | 'closed';
export type CapacityStatus = 'available' | 'soft-held' | 'booked' | 'released';
export type CapacityKind = 'schedule' | 'public_listing' | 'published' | 'derived';
export type ComplianceResult = 'pass' | 'veto' | 'pending';
export type MatchStatus = 'proposed' | 'vetoed' | 'accepted' | 'booked' | 'broken' | 'superseded';

export interface ShipperRfq {
  id: string;
  shipper: string;
  commodity: CommodityClass;
  commodityLabel: string;
  weightKg: number;
  volumeCbm: number;
  pickupCity: string;
  dropCity: string;
  deadline: string; // ISO date
  maxPriceUsd: number;
  hazmat: boolean;
  notes?: string;
  status: RfqStatus;
  bookedMatchId?: string;
}

export interface CapacityOffer {
  id: string;
  carrier: string;
  carrierAgent: string;
  mode: Mode;
  lane: string;
  pickupCity: string;
  dropCity: string;
  availableWeightKg: number;
  availableVolumeCbm: number;
  rateMinUsd: number;
  rateMaxUsd: number;
  departureWindow: string;
  etaHours: number;
  reliability: number; // 0–100
  docsOk: boolean;
  restrictedOk: boolean; // can carry restricted / certain border commodities
  hazmatOk: boolean;
  status: CapacityStatus;
  heldForRfqId?: string;
  /** Provenance — schedules ≠ leftover soft space */
  kind?: CapacityKind;
  source?: string;
  source_url?: string;
  fetched_at?: string;
  confidence?: string;
  notes?: string;
  flightOrVoyage?: string;
}

export interface MatchProposal {
  id: string;
  rfqId: string;
  capacityId: string;
  /** @deprecated Prefer sellQuoteUsd — kept as alias of sell for older UI paths */
  priceUsd: number;
  /** What the forwarder pays the carrier (from capacity rate band) */
  buyRateUsd: number;
  /** What the forwarder quotes the shipper (respects RFQ maxPriceUsd when possible) */
  sellQuoteUsd: number;
  marginUsd: number;
  marginPct: number;
  etaHours: number;
  mode: Mode;
  score: number;
  rationale: string[];
  compliance: ComplianceResult;
  vetoReason?: string;
  status: MatchStatus;
  createdAt: string;
}

/** Role keys stay stable for AgentFeed CSS; labels are FF-desk oriented. */
export type AgentRole =
  | 'shipper'
  | 'carrier'
  | 'match'
  | 'compliance'
  | 'exception'
  | 'system';

export interface AgentMessage {
  id: string;
  agent: string;
  role: AgentRole;
  text: string;
  ts: string;
  tone?: 'info' | 'success' | 'warn' | 'danger';
}

export interface Booking {
  id: string;
  matchId: string;
  rfqId: string;
  capacityId: string;
  bookedAt: string;
  policyNote: string;
}
