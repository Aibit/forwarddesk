import type { CapacityOffer, ShipperRfq } from '../types';

interface Props {
  rfqs: ShipperRfq[];
  capacity: CapacityOffer[];
  selectedRfqId: string | null;
  onSelectRfq: (id: string) => void;
}

const kindHint: Record<string, string> = {
  schedule: 'Timetable — not leftover soft space',
  public_listing: 'Service/route listing — capacity unknown',
  published: 'Carrier-published soft capacity (buy-side)',
  derived: 'Derived signal — not bookable leftover',
};

function statusTag(status: string) {
  const key = status.replace('soft-held', 'soft-held');
  return `tag tag-${key}`;
}

export function LiveBoard({ rfqs, capacity, selectedRfqId, onSelectRfq }: Props) {
  const softCount = capacity.filter(
    (c) => c.status === 'available' && (c.kind === 'published' || !c.kind)
  ).length;
  const openCount = rfqs.filter(
    (r) => r.status === 'open' || r.status === 'proposed' || r.status === 'matching'
  ).length;

  return (
    <>
      <div className="col-header">
        <h2>Customer RFQs</h2>
        <span className="count">{openCount} open · {rfqs.length} total</span>
      </div>
      <div className="col-scroll">
        {rfqs.length === 0 ? (
          <div className="empty-state">
            No customer RFQs on the desk.
            <div className="hint-action">
              <span>Add a customer RFQ from the top strip.</span>
            </div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Customer</th>
                <th>Lane</th>
                <th>Kg</th>
                <th>Max sell</th>
                <th>By</th>
                <th>St</th>
              </tr>
            </thead>
            <tbody>
              {rfqs.map((r) => (
                <tr
                  key={r.id}
                  className={`clickable ${selectedRfqId === r.id ? 'selected' : ''}`}
                  onClick={() => onSelectRfq(r.id)}
                >
                  <td className="id-cell">{r.id}</td>
                  <td title={r.commodityLabel}>
                    {r.shipper}
                    {r.hazmat ? (
                      <span className="flag-mini warn"> HAZ</span>
                    ) : null}
                  </td>
                  <td>
                    {r.pickupCity}→{r.dropCity}
                  </td>
                  <td className="num">{r.weightKg.toLocaleString()}</td>
                  <td className="num">{r.maxPriceUsd.toLocaleString()}</td>
                  <td className="mono">{r.deadline.slice(5)}</td>
                  <td>
                    <span className={statusTag(r.status)}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="sub-section">
          <div className="col-header">
            <h2>Buy-side capacity</h2>
            <span className="count">
              {softCount} soft · {capacity.length} rows
            </span>
          </div>
          {capacity.length === 0 ? (
            <div className="empty-state">
              No buy-side rows. Open{' '}
              <a href="/capacity" style={{ color: 'var(--amber)' }}>
                Capacity Inbox
              </a>{' '}
              to ingest or add soft space.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Carrier</th>
                  <th>Lane</th>
                  <th>Avail</th>
                  <th>Buy band</th>
                  <th>ETA</th>
                  <th>Prov</th>
                  <th>St</th>
                </tr>
              </thead>
              <tbody>
                {capacity.map((c) => {
                  const softUnknown = c.kind && c.kind !== 'published';
                  return (
                    <tr key={c.id}>
                      <td className="id-cell">{c.id}</td>
                      <td title={c.carrierAgent}>
                        {c.carrier}
                        {!c.docsOk && (
                          <span className="flag-mini warn"> docs!</span>
                        )}
                        {c.hazmatOk && (
                          <span className="flag-mini ok"> HZ</span>
                        )}
                      </td>
                      <td>
                        {c.pickupCity}→{c.dropCity}{' '}
                        <span className="flag-mini">{c.mode}</span>
                      </td>
                      <td className="num">
                        {softUnknown
                          ? '—'
                          : `${c.availableWeightKg.toLocaleString()}`}
                      </td>
                      <td className="num">
                        {c.kind === 'published' || !c.kind
                          ? `${c.rateMinUsd}–${c.rateMaxUsd}`
                          : '—'}
                      </td>
                      <td className="num">{c.etaHours}h</td>
                      <td>
                        {c.kind && (
                          <span
                            className={`prov prov-${c.kind}`}
                            title={kindHint[c.kind] || ''}
                          >
                            {c.kind === 'public_listing'
                              ? 'LISTING'
                              : c.kind.toUpperCase()}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={statusTag(c.status)}>{c.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
