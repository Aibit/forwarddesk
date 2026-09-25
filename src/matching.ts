import type {
  CapacityOffer,
  ComplianceResult,
  MatchProposal,
  ShipperRfq,
} from './types';

/** Target gross margin on sell quote when room under shipper max. */
const TARGET_MARGIN_PCT = 0.15;
/** Soft floor: skip if buy exceeds max by more than 5%. */
const BUY_OVER_MAX_SOFT = 1.05;

function laneCompatible(rfq: ShipperRfq, cap: CapacityOffer): boolean {
  if (cap.pickupCity === rfq.pickupCity && cap.dropCity === rfq.dropCity) {
    return true;
  }
  // Soft hub groups (demo): same region pickup + exact drop still match
  const hubGroups = [
    ['Dubai', 'Jebel Ali', 'Abu Dhabi', 'Sharjah'],
    ['Singapore', 'Jakarta'],
    ['Rotterdam', 'Hamburg', 'Antwerp'],
  ];
  const pickupNear = hubGroups.some(
    (hubs) => hubs.includes(rfq.pickupCity) && hubs.includes(cap.pickupCity)
  );
  return pickupNear && cap.dropCity === rfq.dropCity;
}

function fitsCapacity(rfq: ShipperRfq, cap: CapacityOffer): boolean {
  return (
    cap.availableWeightKg >= rfq.weightKg &&
    cap.availableVolumeCbm >= rfq.volumeCbm &&
    cap.status === 'available'
  );
}

/** Buy rate: interpolate within carrier rate band by fill factor. */
function computeBuyRate(rfq: ShipperRfq, cap: CapacityOffer): number {
  const fillW = rfq.weightKg / cap.availableWeightKg;
  const fillV = rfq.volumeCbm / cap.availableVolumeCbm;
  const fill = Math.min(1, Math.max(fillW, fillV));
  const mid = (cap.rateMinUsd + cap.rateMaxUsd) / 2;
  const price = Math.round(
    cap.rateMinUsd + (cap.rateMaxUsd - mid) * fill + mid * 0.15 * (1 - fill)
  );
  return Math.min(cap.rateMaxUsd, Math.max(cap.rateMinUsd, price));
}

/**
 * Sell quote: aim for ~15% margin on buy, capped at shipper maxPriceUsd
 * when buy leaves room. If buy ≥ max, sell at max (thin / negative margin).
 */
function computeSellQuote(buyRateUsd: number, maxPriceUsd: number): number {
  if (buyRateUsd >= maxPriceUsd) {
    return maxPriceUsd;
  }
  const targetSell = Math.round(buyRateUsd / (1 - TARGET_MARGIN_PCT));
  const minSell = buyRateUsd + 50; // nominal desk markup floor
  return Math.min(maxPriceUsd, Math.max(minSell, targetSell));
}

export function checkCompliance(
  rfq: ShipperRfq,
  cap: CapacityOffer
): { result: ComplianceResult; reason?: string } {
  if (!cap.docsOk) {
    return {
      result: 'veto',
      reason: `Missing border / corridor documentation for ${cap.carrier}`,
    };
  }
  if (rfq.hazmat && !cap.hazmatOk) {
    return {
      result: 'veto',
      reason: `Carrier not licensed for hazmat / ADR on this corridor`,
    };
  }
  if (rfq.commodity === 'restricted' && !cap.restrictedOk) {
    return {
      result: 'veto',
      reason: `Restricted commodity blocked — carrier lacks controlled-goods clearance for NEOM / dual-use`,
    };
  }
  if (rfq.commodity === 'pharma' && cap.reliability < 85) {
    return {
      result: 'veto',
      reason: `Pharma GDP policy: reliability score ${cap.reliability} below threshold 85`,
    };
  }
  return { result: 'pass' };
}

export interface ScoredCandidate {
  capacity: CapacityOffer;
  buyRateUsd: number;
  sellQuoteUsd: number;
  marginUsd: number;
  marginPct: number;
  priceUsd: number;
  score: number;
  rationale: string[];
  compliance: ComplianceResult;
  vetoReason?: string;
}

export function scoreCandidates(
  rfq: ShipperRfq,
  capacity: CapacityOffer[],
  excludeCapacityIds: string[] = []
): ScoredCandidate[] {
  const candidates: ScoredCandidate[] = [];

  for (const cap of capacity) {
    if (excludeCapacityIds.includes(cap.id)) continue;
    if (!laneCompatible(rfq, cap)) continue;
    if (!fitsCapacity(rfq, cap)) continue;

    const buyRateUsd = computeBuyRate(rfq, cap);
    if (buyRateUsd > rfq.maxPriceUsd * BUY_OVER_MAX_SOFT) continue;

    const sellQuoteUsd = computeSellQuote(buyRateUsd, rfq.maxPriceUsd);
    const marginUsd = sellQuoteUsd - buyRateUsd;
    const marginPct =
      sellQuoteUsd > 0
        ? Math.round((marginUsd / sellQuoteUsd) * 1000) / 10
        : 0;

    const { result, reason } = checkCompliance(rfq, cap);

    // Scoring: sell fit vs max, margin health, ETA, reliability, fill, exact lane
    const sellFitScore =
      28 * Math.max(0, 1 - sellQuoteUsd / Math.max(rfq.maxPriceUsd, 1));
    // Prefer ~12–18% margin; taper outside that band
    const marginHealth =
      marginPct >= 12 && marginPct <= 22
        ? 1
        : marginPct >= 8 && marginPct < 12
          ? 0.7
          : marginPct > 22 && marginPct <= 30
            ? 0.75
            : marginPct > 0
              ? 0.35
              : 0;
    const marginScore = 22 * marginHealth;
    const deadlineMs = new Date(rfq.deadline + 'T23:59:59').getTime();
    const etaMs = Date.now() + cap.etaHours * 3600_000;
    const etaScore = etaMs <= deadlineMs ? 20 : 4;
    const relScore = (cap.reliability / 100) * 18;
    const fillW = rfq.weightKg / cap.availableWeightKg;
    const fillV = rfq.volumeCbm / cap.availableVolumeCbm;
    const fitScore = 8 * (1 - Math.abs(0.4 - Math.max(fillW, fillV)));

    const exactLane =
      cap.pickupCity === rfq.pickupCity && cap.dropCity === rfq.dropCity;
    let score =
      sellFitScore +
      marginScore +
      etaScore +
      relScore +
      fitScore +
      (exactLane ? 8 : 0);
    // Bonus when sell fits under max with healthy margin
    if (sellQuoteUsd <= rfq.maxPriceUsd && marginPct >= 10 && result === 'pass') {
      score += 6;
    }
    if (result === 'veto') score -= 100;

    const rationale: string[] = [];
    rationale.push(
      `BUY $${buyRateUsd.toLocaleString()} · SELL $${sellQuoteUsd.toLocaleString()} · margin $${marginUsd.toLocaleString()} (${marginPct}%)`
    );
    rationale.push(
      `Sell vs customer max $${rfq.maxPriceUsd.toLocaleString()}${
        sellQuoteUsd <= rfq.maxPriceUsd ? ' — fits' : ' — over'
      }`
    );
    rationale.push(`ETA ${cap.etaHours}h · deadline ${rfq.deadline}`);
    rationale.push(`Reliability ${cap.reliability}/100`);
    rationale.push(
      `Fit ${Math.round(fillW * 100)}% wt / ${Math.round(fillV * 100)}% vol`
    );
    rationale.push(
      exactLane
        ? `Exact lane · ${cap.mode}`
        : `Soft hub match · ${cap.mode} · ${cap.lane}`
    );

    candidates.push({
      capacity: cap,
      buyRateUsd,
      sellQuoteUsd,
      marginUsd,
      marginPct,
      priceUsd: sellQuoteUsd,
      score: Math.round(score * 10) / 10,
      rationale,
      compliance: result,
      vetoReason: reason,
    });
  }

  return candidates.sort((a, b) => b.score - a.score);
}

export function buildProposals(
  rfq: ShipperRfq,
  capacity: CapacityOffer[],
  excludeCapacityIds: string[] = [],
  limit = 3
): MatchProposal[] {
  const scored = scoreCandidates(rfq, capacity, excludeCapacityIds).slice(
    0,
    limit
  );
  const now = new Date().toISOString();
  return scored.map((s, i) => ({
    id: `MP-${rfq.id}-${s.capacity.id}-${Date.now()}-${i}`,
    rfqId: rfq.id,
    capacityId: s.capacity.id,
    priceUsd: s.sellQuoteUsd,
    buyRateUsd: s.buyRateUsd,
    sellQuoteUsd: s.sellQuoteUsd,
    marginUsd: s.marginUsd,
    marginPct: s.marginPct,
    etaHours: s.capacity.etaHours,
    mode: s.capacity.mode,
    score: s.score,
    rationale: s.rationale,
    compliance: s.compliance,
    vetoReason: s.vetoReason,
    status: s.compliance === 'veto' ? ('vetoed' as const) : ('proposed' as const),
    createdAt: now,
  }));
}
