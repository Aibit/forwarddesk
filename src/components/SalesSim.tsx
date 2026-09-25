import type { MatchProposal, Mode, ShipperRfq } from '../types';

/** Approximate city → [lat, lon] for seed lanes + a few generics. */
const CITY_COORDS: Record<string, [number, number]> = {
  Dubai: [25.2048, 55.2708],
  'Jebel Ali': [24.9857, 55.064],
  'Abu Dhabi': [24.4539, 54.3773],
  Sharjah: [25.3463, 55.4209],
  Riyadh: [24.7136, 46.6753],
  Jeddah: [21.4858, 39.1925],
  Dammam: [26.4207, 50.0888],
  NEOM: [28.0, 35.2],
  Singapore: [1.3521, 103.8198],
  Jakarta: [-6.2088, 106.8456],
  Rotterdam: [51.9244, 4.4777],
  Hamburg: [53.5511, 9.9937],
};

function hashCity(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

/** Known coords, or a deterministic band placement so unknown cities still draw. */
function resolveCoords(city: string): [number, number] {
  const hit = CITY_COORDS[city];
  if (hit) return hit;
  const h = hashCity(city);
  const lat = ((h % 120) / 120) * 70 - 20; // ~-20..50
  const lon = (((h >> 8) % 360) / 360) * 360 - 180;
  return [lat, lon];
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))));
}

/** Project lon/lat into SVG viewBox with padding. */
function project(
  lon: number,
  lat: number,
  bounds: { minLon: number; maxLon: number; minLat: number; maxLat: number },
  w: number,
  h: number,
  pad = 48
): [number, number] {
  const { minLon, maxLon, minLat, maxLat } = bounds;
  const dx = Math.max(maxLon - minLon, 8);
  const dy = Math.max(maxLat - minLat, 6);
  const x = pad + ((lon - minLon) / dx) * (w - pad * 2);
  const y = pad + ((maxLat - lat) / dy) * (h - pad * 2);
  return [x, y];
}

function estimateHours(km: number, mode: Mode | undefined): { hours: number; label: string } {
  if (mode === 'air' || mode === 'road+air') {
    return { hours: Math.round(km / 750 + 4), label: 'air-ish (cruise + handling)' };
  }
  // road default
  return { hours: Math.round(km / 60), label: 'road-ish (~60 km/h effective)' };
}

function daysUntil(deadline: string): number | null {
  const t = Date.parse(deadline);
  if (Number.isNaN(t)) return null;
  const ms = t - Date.now();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

interface Props {
  rfq: ShipperRfq | null;
  proposal: MatchProposal | null;
}

export function SalesSim({ rfq, proposal }: Props) {
  if (!rfq) {
    return (
      <div className="sales-sim">
        <div className="sales-sim-empty">
          <strong>Select a customer RFQ</strong>
          <p>Pitch view needs a lane — pick an RFQ on the desk, then flip to Pitch.</p>
        </div>
      </div>
    );
  }

  const origin = resolveCoords(rfq.pickupCity);
  const dest = resolveCoords(rfq.dropCity);
  const km = haversineKm(origin, dest);
  const mode = proposal?.mode;
  const est = estimateHours(km, mode);
  const hours =
    proposal?.etaHours != null && proposal.etaHours > 0
      ? proposal.etaHours
      : est.hours;
  const hoursLabel =
    proposal?.etaHours != null && proposal.etaHours > 0
      ? 'match ETA'
      : est.label;

  const deadlineDays = daysUntil(rfq.deadline);
  const pressure =
    deadlineDays == null
      ? null
      : deadlineDays < 0
        ? 'PAST DEADLINE'
        : deadlineDays <= 1
          ? 'HOT · ≤24h'
          : deadlineDays <= 3
            ? 'TIGHT'
            : 'OPEN';

  const W = 640;
  const H = 320;
  const padLon = 12;
  const padLat = 8;
  const bounds = {
    minLon: Math.min(origin[1], dest[1]) - padLon,
    maxLon: Math.max(origin[1], dest[1]) + padLon,
    minLat: Math.min(origin[0], dest[0]) - padLat,
    maxLat: Math.max(origin[0], dest[0]) + padLat,
  };
  const [x1, y1] = project(origin[1], origin[0], bounds, W, H);
  const [x2, y2] = project(dest[1], dest[0], bounds, W, H);
  const midX = (x1 + x2) / 2;
  const midY = Math.min(y1, y2) - 40 - Math.abs(x2 - x1) * 0.08;
  const arcPath = `M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`;

  const isPass =
    proposal &&
    proposal.compliance === 'pass' &&
    proposal.status !== 'vetoed';

  const modeBadge = (mode ?? 'road').toUpperCase();

  return (
    <div className="sales-sim">
      <div className="sales-sim-header">
        <div>
          <div className="sales-kicker">ROUTE SIMULATION · SALES PITCH</div>
          <h2 className="sales-shipper">{rfq.shipper}</h2>
          <div className="sales-meta mono">
            {rfq.id} · {rfq.weightKg.toLocaleString()} kg · {rfq.commodityLabel}
            {rfq.hazmat ? ' · HAZMAT' : ''}
          </div>
        </div>
        <div className="sales-badges">
          <span className={`sales-mode-badge mode-${(mode ?? 'road').replace('+', '-')}`}>
            {modeBadge}
          </span>
          {pressure && (
            <span
              className={`sales-pressure ${
                pressure.startsWith('HOT') || pressure.startsWith('PAST')
                  ? 'hot'
                  : pressure === 'TIGHT'
                    ? 'tight'
                    : ''
              }`}
            >
              {pressure}
            </span>
          )}
        </div>
      </div>

      <div className="sales-route-labels">
        <div className="sales-endpoint origin">
          <span className="sales-endpoint-kicker">ORIGIN</span>
          <span className="sales-endpoint-city">{rfq.pickupCity}</span>
        </div>
        <div className="sales-route-arrow" aria-hidden>
          ⟶
        </div>
        <div className="sales-endpoint dest">
          <span className="sales-endpoint-kicker">DESTINATION</span>
          <span className="sales-endpoint-city">{rfq.dropCity}</span>
        </div>
      </div>

      <div className="sales-map-wrap">
        <svg
          className="sales-map"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Route arc from ${rfq.pickupCity} to ${rfq.dropCity}`}
        >
          <defs>
            <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f5a623" stopOpacity="0.35" />
              <stop offset="50%" stopColor="#f5a623" stopOpacity="1" />
              <stop offset="100%" stopColor="#f5a623" stopOpacity="0.35" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* grid */}
          {[0, 1, 2, 3, 4].map((i) => (
            <line
              key={`h${i}`}
              x1={0}
              y1={(H / 4) * i}
              x2={W}
              y2={(H / 4) * i}
              className="sales-grid"
            />
          ))}
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <line
              key={`v${i}`}
              x1={(W / 8) * i}
              y1={0}
              x2={(W / 8) * i}
              y2={H}
              className="sales-grid"
            />
          ))}
          <path
            d={arcPath}
            fill="none"
            stroke="url(#arcGrad)"
            strokeWidth="3"
            strokeLinecap="round"
            filter="url(#glow)"
            className="sales-arc"
          />
          <circle cx={x1} cy={y1} r="7" className="sales-dot origin" />
          <circle cx={x2} cy={y2} r="7" className="sales-dot dest" />
          <text x={x1} y={y1 - 14} className="sales-svg-label" textAnchor="middle">
            {rfq.pickupCity.toUpperCase()}
          </text>
          <text x={x2} y={y2 - 14} className="sales-svg-label" textAnchor="middle">
            {rfq.dropCity.toUpperCase()}
          </text>
        </svg>
      </div>

      <div className="sales-stats">
        <div className="sales-stat">
          <span className="sales-stat-label">DISTANCE</span>
          <span className="sales-stat-value mono">
            {km.toLocaleString()}
            <span className="sales-unit"> km</span>
          </span>
        </div>
        <div className="sales-stat">
          <span className="sales-stat-label">TRANSIT</span>
          <span className="sales-stat-value mono">
            {hours}
            <span className="sales-unit"> h</span>
          </span>
          <span className="sales-stat-sub">{hoursLabel}</span>
        </div>
        <div className="sales-stat">
          <span className="sales-stat-label">DEADLINE</span>
          <span className="sales-stat-value mono sales-stat-sm">{rfq.deadline}</span>
          {deadlineDays != null && (
            <span className="sales-stat-sub">
              {deadlineDays < 0
                ? `${Math.abs(deadlineDays)}d overdue`
                : `${deadlineDays}d remaining`}
            </span>
          )}
        </div>
        <div className="sales-stat">
          <span className="sales-stat-label">MAX SELL</span>
          <span className="sales-stat-value mono">
            ${rfq.maxPriceUsd.toLocaleString()}
          </span>
        </div>
      </div>

      {isPass && proposal ? (
        <div className="sales-quote-callouts">
          <div className="sales-callout sell">
            <span className="sales-callout-label">SELL QUOTE</span>
            <span className="sales-callout-value mono">
              ${proposal.sellQuoteUsd.toLocaleString()}
            </span>
          </div>
          <div className="sales-callout buy">
            <span className="sales-callout-label">BUY</span>
            <span className="sales-callout-value mono">
              ${proposal.buyRateUsd.toLocaleString()}
            </span>
          </div>
          <div className="sales-callout margin">
            <span className="sales-callout-label">MARGIN</span>
            <span className="sales-callout-value mono">
              ${proposal.marginUsd.toLocaleString()}
              <span className="sales-callout-pct"> {proposal.marginPct}%</span>
            </span>
          </div>
        </div>
      ) : (
        <div className="sales-quote-hint">
          {proposal && proposal.compliance === 'veto' ? (
            <span>
              Selected option is <strong>VETO</strong> — pick a PASS quote on the desk for
              sell / margin callouts.
            </span>
          ) : (
            <span>
              Build quotes on the desk, then select a <strong>PASS</strong> proposal to
              unlock sell / margin pitch numbers.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
