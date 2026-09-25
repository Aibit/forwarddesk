import type { CapacityOffer, MatchProposal, ShipperRfq } from '../types';

interface Props {
  proposals: MatchProposal[];
  rfqs: ShipperRfq[];
  capacity: CapacityOffer[];
  busy: boolean;
  selectedRfqId: string | null;
  selectedProposalId?: string | null;
  onSelectProposal?: (matchId: string) => void;
  onAccept: (matchId: string) => void;
  onException: (matchId: string, reason: string) => void;
  onRunMatch: () => void;
}

export function MatchCards({
  proposals,
  rfqs,
  capacity,
  busy,
  selectedRfqId,
  selectedProposalId = null,
  onSelectProposal,
  onAccept,
  onException,
  onRunMatch,
}: Props) {
  const visible = proposals.filter(
    (p) => p.status === 'proposed' || p.status === 'vetoed' || p.status === 'booked'
  );

  const byRfq = new Map<string, MatchProposal[]>();
  for (const p of visible) {
    const list = byRfq.get(p.rfqId) ?? [];
    list.push(p);
    byRfq.set(p.rfqId, list);
  }

  const entries = [...byRfq.entries()].sort(([a], [b]) => {
    if (a === selectedRfqId) return -1;
    if (b === selectedRfqId) return 1;
    return 0;
  });

  return (
    <div className="workbench">
      <div className="col-header">
        <h2>Quote workbench</h2>
        <span className="count">
          {visible.length} option{visible.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="col-scroll">
        {visible.length === 0 && (
          <div className="empty-state">
            <strong>No quote options.</strong>
            <p style={{ margin: '0.4rem 0 0' }}>
              Select a customer RFQ on the left, then build quotes.
            </p>
            <div className="hint-action">
              <button
                type="button"
                className="btn primary"
                disabled={busy || !selectedRfqId}
                onClick={onRunMatch}
              >
                Build quotes
              </button>
              <span>
                or press <kbd>R</kbd>
              </span>
            </div>
          </div>
        )}

        {entries.map(([rfqId, list]) => {
          const rfq = rfqs.find((r) => r.id === rfqId);
          return (
            <div key={rfqId}>
              <div className="match-group-label">
                {rfqId} · {rfq?.shipper ?? '—'} · {rfq?.pickupCity}→{rfq?.dropCity}{' '}
                · max sell ${rfq?.maxPriceUsd.toLocaleString() ?? '—'}
              </div>
              {list.map((p) => {
                const cap = capacity.find((c) => c.id === p.capacityId);
                const isBooked = p.status === 'booked';
                const isVeto = p.compliance === 'veto' || p.status === 'vetoed';
                const marginClass =
                  p.marginPct >= 12 ? 'margin-ok' : p.marginPct > 0 ? 'margin-thin' : 'margin-neg';
                const isSelected = selectedProposalId === p.id;
                return (
                  <article
                    key={p.id}
                    className={`match-ticket ${isVeto ? 'vetoed' : ''} ${isBooked ? 'booked' : ''} ${isSelected ? 'selected-pitch' : ''}`}
                    onClick={() => onSelectProposal?.(p.id)}
                    role={onSelectProposal ? 'button' : undefined}
                    tabIndex={onSelectProposal ? 0 : undefined}
                    onKeyDown={
                      onSelectProposal
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onSelectProposal(p.id);
                            }
                          }
                        : undefined
                    }
                  >
                    <div
                      className={`stamp ${
                        isBooked ? 'stamp-booked' : isVeto ? 'stamp-veto' : 'stamp-pass'
                      }`}
                    >
                      {isBooked ? 'CONFIRMED' : isVeto ? 'VETO' : 'PASS'}
                    </div>
                    <div className="ticket-body">
                      <div className="ticket-top">
                        <span className="ticket-carrier">
                          {cap?.carrier ?? p.capacityId}
                        </span>
                        <span className="ticket-id">{p.capacityId}</span>
                        <span className="ticket-score">SCR {p.score}</span>
                      </div>
                      <div className="ticket-kpis">
                        <span>
                          <span>Buy</span>${p.buyRateUsd.toLocaleString()}
                        </span>
                        <span>
                          <span>Sell</span>${p.sellQuoteUsd.toLocaleString()}
                        </span>
                        <span className={marginClass}>
                          <span>Margin</span>$
                          {p.marginUsd.toLocaleString()} ({p.marginPct}%)
                        </span>
                        <span>
                          <span>ETA</span>
                          {p.etaHours}h
                        </span>
                        <span>
                          <span>Mode</span>
                          {p.mode}
                        </span>
                      </div>
                      <ul className="ticket-rationale">
                        {p.rationale.slice(0, 3).map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                      {p.vetoReason && (
                        <p className="veto-reason">{p.vetoReason}</p>
                      )}
                    </div>
                    <div className="ticket-actions">
                      {!isVeto && !isBooked && (
                        <button
                          type="button"
                          className="btn primary sm"
                          disabled={busy}
                          onClick={() => onAccept(p.id)}
                          title={`Sell $${p.sellQuoteUsd} · Buy $${p.buyRateUsd} · Margin $${p.marginUsd}`}
                        >
                          Confirm with carrier
                        </button>
                      )}
                      {isBooked && (
                        <>
                          <button
                            type="button"
                            className="btn danger sm"
                            disabled={busy}
                            onClick={() => onException(p.id, 'truck no-show')}
                          >
                            No-show
                          </button>
                          <button
                            type="button"
                            className="btn danger outline sm"
                            disabled={busy}
                            onClick={() => onException(p.id, 'sailing / slot slip')}
                          >
                            Slot slip
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
