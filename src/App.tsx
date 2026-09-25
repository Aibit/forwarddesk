import { useCallback, useEffect, useState } from 'react';
import { loadBoardData, type DataSource } from './api';
import { AgentFeed } from './components/AgentFeed';
import { CapacityForm } from './components/CapacityForm';
import { LiveBoard } from './components/LiveBoard';
import { MatchCards } from './components/MatchCards';
import { RfqForm } from './components/RfqForm';
import { AGENT_META, initialCapacity, initialRfqs } from './data';
import { buildProposals } from './matching';
import type {
  AgentMessage,
  Booking,
  CapacityOffer,
  MatchProposal,
  ShipperRfq,
} from './types';
import { nowLabel, sleep, uid } from './utils';
import './App.css';

function resolveRole(
  agent: string,
  role: AgentMessage['role']
): AgentMessage['role'] {
  if (role !== 'system') return role;
  if (agent.startsWith('Carrier') || agent.startsWith('Sourcing')) return 'carrier';
  if (agent.startsWith('Shipper') || agent.startsWith('Desk')) return 'shipper';
  if (agent.startsWith('Match') || agent.startsWith('Pricing')) return 'match';
  if (agent.startsWith('Compliance')) return 'compliance';
  if (agent.startsWith('Exception')) return 'exception';
  return 'system';
}

function App() {
  const [rfqs, setRfqs] = useState<ShipperRfq[]>(initialRfqs);
  const [capacity, setCapacity] = useState<CapacityOffer[]>(initialCapacity);
  const [proposals, setProposals] = useState<MatchProposal[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [dataSource, setDataSource] = useState<DataSource>('seed');
  const [loadingData, setLoadingData] = useState(true);
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: 'boot-1',
      agent: 'System',
      role: 'system',
      text: 'ForwardDesk online · multi-lane quoting · buy carrier soft space · human confirm only.',
      ts: nowLabel(),
      tone: 'info',
    },
  ]);
  const [selectedRfqId, setSelectedRfqId] = useState<string | null>('RFQ-1001');
  const [busy, setBusy] = useState(false);
  const [showRfqForm, setShowRfqForm] = useState(false);
  const [showCapForm, setShowCapForm] = useState(false);

  const pushMsg = useCallback(
    (
      agent: string,
      text: string,
      tone: AgentMessage['tone'] = 'info',
      role: AgentMessage['role'] = 'system'
    ) => {
      const meta = AGENT_META[agent];
      const r = resolveRole(agent, role);
      setMessages((prev) => [
        ...prev,
        {
          id: uid('msg'),
          agent: meta?.label ?? agent,
          role: r,
          text,
          ts: nowLabel(),
          tone,
        },
      ]);
    },
    []
  );

  const refreshFromTms = useCallback(
    async (opts?: { silent?: boolean }) => {
      setLoadingData(true);
      const result = await loadBoardData();
      setCapacity(result.capacity);
      setRfqs(result.rfqs);
      setDataSource(result.source);
      setProposals([]);
      setBookings([]);
      if (result.rfqs.length > 0) {
        setSelectedRfqId((prev) =>
          result.rfqs.some((r) => r.id === prev) ? prev : result.rfqs[0].id
        );
      }
      setLoadingData(false);
      if (!opts?.silent) {
        if (result.source === 'ingest') {
          pushMsg(
            'System',
            `Ingest loaded · ${result.capacity.length} buy-side rows · ${result.rfqs.length} customer RFQs.`,
            'success'
          );
        } else if (result.source === 'tms-stub') {
          pushMsg(
            'System',
            `TMS stub · ${result.capacity.length} capacity · ${result.rfqs.length} RFQs.`,
            'success'
          );
        } else {
          pushMsg(
            'System',
            `Live API unavailable (${result.error ?? 'offline'}) — using seed desk data.`,
            'warn'
          );
        }
      } else if (result.source === 'ingest') {
        pushMsg(
          'System',
          `Source: ingest · ${result.capacity.length} provenance-tagged. Inbox: /capacity`,
          'success'
        );
      } else if (result.source === 'tms-stub') {
        pushMsg(
          'System',
          `Source: TMS stub · ${result.capacity.length} soft-capacity rows.`,
          'success'
        );
      } else {
        pushMsg(
          'System',
          `Static mode: using seed desk data. Start python3 server.py for live ingest.`,
          'warn'
        );
      }
    },
    [pushMsg]
  );

  useEffect(() => {
    void refreshFromTms({ silent: true });
  }, [refreshFromTms]);

  const runMatch = async (rfqId?: string) => {
    const id = rfqId ?? selectedRfqId;
    if (!id || busy) return;
    const rfq = rfqs.find((r) => r.id === id);
    if (!rfq) return;
    if (rfq.status === 'booked') {
      pushMsg(
        'System',
        `${id} already confirmed — trigger exception to rematch.`,
        'warn'
      );
      return;
    }

    setBusy(true);
    setSelectedRfqId(id);

    setRfqs((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'matching' } : r))
    );

    pushMsg(
      'DeskAgent',
      `Customer RFQ ${id}: ${rfq.shipper} · ${rfq.commodityLabel}, ${rfq.weightKg}kg / ${rfq.volumeCbm}m³, ${rfq.pickupCity}→${rfq.dropCity}, max sell $${rfq.maxPriceUsd}, by ${rfq.deadline}.`,
      'info',
      'shipper'
    );
    await sleep(450);

    const laneCaps = capacity.filter(
      (c) =>
        c.status === 'available' &&
        (c.dropCity === rfq.dropCity ||
          (['Dubai', 'Jebel Ali', 'Abu Dhabi', 'Sharjah'].includes(c.pickupCity) &&
            c.dropCity === rfq.dropCity))
    );
    for (const c of laneCaps.slice(0, 3)) {
      pushMsg(
        c.carrierAgent,
        `Buy-side ${c.id}: ${c.availableWeightKg}kg, band $${c.rateMinUsd}–$${c.rateMaxUsd}, ETA ${c.etaHours}h, rel ${c.reliability}.`,
        'info',
        'carrier'
      );
      await sleep(280);
    }

    pushMsg(
      'PricingAgent',
      `Building quotes for ${id} · buy rate · sell vs max · margin · ETA · compliance…`,
      'info',
      'match'
    );
    await sleep(500);

    const exclude = capacity
      .filter((c) => c.status === 'booked' || c.status === 'soft-held')
      .map((c) => c.id);

    const fresh = buildProposals(rfq, capacity, exclude, 4);

    setProposals((prev) => [
      ...prev.filter(
        (p) => p.rfqId !== id || p.status === 'booked' || p.status === 'broken'
      ),
      ...fresh,
    ]);

    if (fresh.length === 0) {
      pushMsg(
        'PricingAgent',
        `No feasible buy-side options for ${id}.`,
        'warn',
        'match'
      );
      setRfqs((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'open' } : r))
      );
      setBusy(false);
      return;
    }

    for (const p of fresh) {
      const cap = capacity.find((c) => c.id === p.capacityId)!;
      pushMsg(
        'PricingAgent',
        `Quote option ${cap.carrier}: BUY $${p.buyRateUsd} / SELL $${p.sellQuoteUsd} / MARGIN $${p.marginUsd} (${p.marginPct}%) · ${p.etaHours}h · score ${p.score}.`,
        'success',
        'match'
      );
      await sleep(320);
      if (p.compliance === 'veto') {
        pushMsg(
          'ComplianceAgent',
          `VETO ${p.capacityId}: ${p.vetoReason}`,
          'danger',
          'compliance'
        );
      } else {
        pushMsg(
          'ComplianceAgent',
          `PASS ${p.capacityId} — docs/class/border OK.`,
          'success',
          'compliance'
        );
      }
      await sleep(280);
    }

    const passCount = fresh.filter((p) => p.compliance === 'pass').length;
    pushMsg(
      'PricingAgent',
      `${fresh.length} quote options · ${passCount} cleared. Send quote / confirm with carrier (human handoff).`,
      passCount ? 'success' : 'warn',
      'match'
    );

    setRfqs((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status: passCount ? 'proposed' : 'open' } : r
      )
    );
    setBusy(false);
  };

  const acceptBook = async (matchId: string) => {
    if (busy) return;
    const match = proposals.find((p) => p.id === matchId);
    if (!match || match.compliance === 'veto') return;

    setBusy(true);
    const rfq = rfqs.find((r) => r.id === match.rfqId)!;
    const cap = capacity.find((c) => c.id === match.capacityId)!;

    pushMsg(
      'DeskAgent',
      `Sending quote to ${rfq.shipper} @ $${match.sellQuoteUsd} · confirming buy with ${cap.carrier} @ $${match.buyRateUsd} (margin $${match.marginUsd}).`,
      'info',
      'shipper'
    );
    await sleep(350);
    pushMsg(
      'PricingAgent',
      `Soft-holding ${cap.id} · human confirm only — no auto-book / payments.`,
      'info',
      'match'
    );
    await sleep(400);
    pushMsg(
      'ComplianceAgent',
      `Final PASS ${match.rfqId} ↔ ${match.capacityId}.`,
      'success',
      'compliance'
    );
    await sleep(300);

    const booking: Booking = {
      id: uid('BKG').toUpperCase(),
      matchId,
      rfqId: match.rfqId,
      capacityId: match.capacityId,
      bookedAt: new Date().toISOString(),
      policyNote: `Confirmed under demo policy — sell $${match.sellQuoteUsd} / buy $${match.buyRateUsd} / margin $${match.marginUsd}. Simulated handoff only.`,
    };
    setBookings((prev) => [...prev, booking]);

    setProposals((prev) =>
      prev.map((p) => {
        if (p.id === matchId) return { ...p, status: 'booked' };
        if (p.rfqId === match.rfqId && p.status === 'proposed')
          return { ...p, status: 'superseded' };
        return p;
      })
    );

    setRfqs((prev) =>
      prev.map((r) =>
        r.id === match.rfqId
          ? { ...r, status: 'booked', bookedMatchId: matchId }
          : r
      )
    );

    setCapacity((prev) =>
      prev.map((c) =>
        c.id === match.capacityId
          ? {
              ...c,
              status: 'booked',
              heldForRfqId: match.rfqId,
              availableWeightKg: Math.max(0, c.availableWeightKg - rfq.weightKg),
              availableVolumeCbm: Math.max(
                0,
                Math.round((c.availableVolumeCbm - rfq.volumeCbm) * 10) / 10
              ),
            }
          : c
      )
    );

    pushMsg(
      'PricingAgent',
      `CONFIRMED ${booking.id}: quote to ${rfq.shipper} · buy ${cap.carrier} · margin $${match.marginUsd} (${match.marginPct}%).`,
      'success',
      'match'
    );
    setBusy(false);
  };

  const triggerException = async (matchId: string, reason: string) => {
    if (busy) return;
    const match = proposals.find((p) => p.id === matchId);
    if (!match || match.status !== 'booked') return;

    setBusy(true);
    const rfq = rfqs.find((r) => r.id === match.rfqId)!;
    const brokenCapId = match.capacityId;

    pushMsg(
      'ExceptionAgent',
      `Exception ${match.rfqId}: ${reason}. Releasing buy-side + rematch…`,
      'danger',
      'exception'
    );
    await sleep(450);

    setCapacity((prev) =>
      prev.map((c) =>
        c.id === brokenCapId
          ? {
              ...c,
              status: 'released',
              heldForRfqId: undefined,
            }
          : c
      )
    );

    setProposals((prev) =>
      prev.map((p) => (p.id === matchId ? { ...p, status: 'broken' } : p))
    );

    setRfqs((prev) =>
      prev.map((r) =>
        r.id === match.rfqId
          ? { ...r, status: 'exception', bookedMatchId: undefined }
          : r
      )
    );

    pushMsg(
      'ExceptionAgent',
      `${brokenCapId} released. Searching next-best excl. failed.`,
      'warn',
      'exception'
    );
    await sleep(400);

    const availableCaps = capacity.map((c) =>
      c.id === brokenCapId
        ? { ...c, status: 'released' as const, heldForRfqId: undefined }
        : c
    );

    const rematchRfq = { ...rfq, status: 'matching' as const };
    setRfqs((prev) =>
      prev.map((r) => (r.id === rfq.id ? rematchRfq : r))
    );

    pushMsg(
      'PricingAgent',
      `Rebuild quotes for ${rfq.id} after ${reason}…`,
      'info',
      'match'
    );
    await sleep(500);

    const exclude = [
      brokenCapId,
      ...availableCaps
        .filter((c) => c.status === 'booked' || c.status === 'soft-held')
        .map((c) => c.id),
    ];

    const fresh = buildProposals(rematchRfq, availableCaps, exclude, 3);
    setProposals((prev) => [
      ...prev.filter((p) => p.rfqId !== rfq.id || p.status === 'broken'),
      ...fresh,
    ]);

    if (fresh.length === 0) {
      pushMsg(
        'ExceptionAgent',
        `No alternate for ${rfq.id}. Back to open.`,
        'danger',
        'exception'
      );
      setRfqs((prev) =>
        prev.map((r) => (r.id === rfq.id ? { ...r, status: 'open' } : r))
      );
      setBusy(false);
      return;
    }

    for (const p of fresh) {
      const cap = availableCaps.find((c) => c.id === p.capacityId)!;
      if (p.compliance === 'veto') {
        pushMsg(
          'ComplianceAgent',
          `VETO rematch ${p.capacityId}: ${p.vetoReason}`,
          'danger',
          'compliance'
        );
      } else {
        pushMsg(
          'PricingAgent',
          `Rematch ${cap.carrier}: BUY $${p.buyRateUsd} / SELL $${p.sellQuoteUsd} / MARGIN $${p.marginUsd} (score ${p.score}).`,
          'success',
          'match'
        );
        pushMsg(
          'ComplianceAgent',
          `PASS ${p.capacityId}.`,
          'success',
          'compliance'
        );
      }
      await sleep(300);
    }

    const passCount = fresh.filter((p) => p.compliance === 'pass').length;
    pushMsg(
      'ExceptionAgent',
      `Rematch done — ${passCount} cleared. Confirm with carrier to rebook.`,
      passCount ? 'success' : 'warn',
      'exception'
    );

    setRfqs((prev) =>
      prev.map((r) =>
        r.id === rfq.id ? { ...r, status: passCount ? 'proposed' : 'open' } : r
      )
    );
    setBusy(false);
  };

  const addRfq = (rfq: ShipperRfq) => {
    const id = `RFQ-${Date.now().toString().slice(-4)}`;
    const next = { ...rfq, id };
    setRfqs((prev) => [next, ...prev]);
    setSelectedRfqId(id);
    setShowRfqForm(false);
    pushMsg(
      'DeskAgent',
      `New customer RFQ ${id} · ${next.shipper}: ${next.pickupCity}→${next.dropCity}, ${next.commodityLabel}, max sell $${next.maxPriceUsd}.`,
      'success',
      'shipper'
    );
  };

  const addCapacity = (cap: CapacityOffer) => {
    const id = `CAP-${Date.now().toString().slice(-3)}`;
    const next = { ...cap, id };
    setCapacity((prev) => [next, ...prev]);
    setShowCapForm(false);
    pushMsg(
      next.carrierAgent,
      `Buy-side soft space ${id}: ${next.lane}, ${next.availableWeightKg}kg, band $${next.rateMinUsd}–$${next.rateMaxUsd}.`,
      'success',
      'carrier'
    );
  };

  const selected = rfqs.find((r) => r.id === selectedRfqId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)
      ) {
        return;
      }
      if (showRfqForm || showCapForm) return;
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        void runMatch();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRfqId, busy, showRfqForm, showCapForm, rfqs, capacity]);

  const srcLabel =
    dataSource === 'ingest'
      ? 'INGEST'
      : dataSource === 'tms-stub'
        ? 'TMS-STUB'
        : 'SEED';

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="logo">FD</div>
          <div>
            <h1>FORWARDDESK</h1>
            <p className="corridor">MULTI-LANE QUOTING DESK</p>
          </div>
        </div>
        <div className="top-meta">
          <span
            className="corridor-chip"
            title={
              selected
                ? `Selected RFQ lane: ${selected.pickupCity} → ${selected.dropCity}`
                : 'No RFQ selected — showing all corridors'
            }
          >
            {selected
              ? `${selected.pickupCity} → ${selected.dropCity}`
              : 'All corridors'}
          </span>
          <span
            className={`src-chip ${dataSource === 'seed' ? 'seed' : 'live'}`}
            title={
              dataSource === 'ingest'
                ? 'Capacity ingest (live/public + publish)'
                : dataSource === 'tms-stub'
                  ? 'TMS stub CSV'
                  : 'Offline seed'
            }
          >
            <span className="dot" aria-hidden />
            {srcLabel}
          </span>
          {bookings.length > 0 && (
            <span className="mono">{bookings.length} CFM</span>
          )}
          <a href="/capacity">/capacity</a>
        </div>
        <div className="top-actions">
          <button
            type="button"
            className="btn ghost sm"
            disabled={loadingData || busy}
            onClick={() => void refreshFromTms()}
            title="Try live /api/capacity and /api/rfqs; static Pages uses seed data"
          >
            {loadingData ? '…' : 'Refresh'}
          </button>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => setShowRfqForm(true)}
          >
            + Customer RFQ
          </button>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => setShowCapForm(true)}
          >
            + Buy-side
          </button>
          <button
            type="button"
            className="btn primary sm"
            disabled={busy || !selectedRfqId}
            onClick={() => void runMatch()}
          >
            {busy ? 'Working…' : 'Build quotes'}
          </button>
        </div>
      </header>

      {selected && (
        <div className="sticky-bar">
          <span className="mono">{selected.id}</span>
          <span className="route-label">
            {selected.shipper} · {selected.pickupCity} → {selected.dropCity}
          </span>
          <span className="mono">
            {selected.weightKg}kg · max sell ${selected.maxPriceUsd} ·{' '}
            {selected.commodityLabel}
            {selected.hazmat ? ' · HAZMAT' : ''}
          </span>
          <span className={`tag tag-${selected.status}`}>{selected.status}</span>
          <div className="sticky-actions">
            <button
              type="button"
              className="btn sm ghost"
              disabled={busy}
              onClick={() => void runMatch('RFQ-1005')}
              title="Restricted commodity — expect BudgetWheels veto"
            >
              Demo: veto
            </button>
            <button
              type="button"
              className="btn sm ghost"
              disabled={busy}
              onClick={() => void runMatch('RFQ-1004')}
              title="Hazmat — only SafeChem passes"
            >
              Demo: hazmat
            </button>
            <button
              type="button"
              className="btn primary sm"
              disabled={busy || selected.status === 'booked'}
              onClick={() => void runMatch()}
            >
              {busy ? 'Working…' : 'Build quotes'}
            </button>
          </div>
        </div>
      )}

      <main className="ops-grid">
        <section className="ops-col" aria-label="Customer RFQs and buy-side capacity">
          <LiveBoard
            rfqs={rfqs}
            capacity={capacity}
            selectedRfqId={selectedRfqId}
            onSelectRfq={setSelectedRfqId}
          />
        </section>
        <section className="ops-col" aria-label="Quote workbench">
          <MatchCards
            proposals={proposals}
            rfqs={rfqs}
            capacity={capacity}
            busy={busy}
            selectedRfqId={selectedRfqId}
            onAccept={(id) => void acceptBook(id)}
            onException={(id, reason) => void triggerException(id, reason)}
            onRunMatch={() => void runMatch()}
          />
        </section>
        <aside className="ops-col" aria-label="Ops log">
          <AgentFeed messages={messages} />
        </aside>
      </main>

      <footer className="ops-footer">
        <span>
          <kbd>R</kbd> build quotes on selected RFQ
        </span>
        <span>ForwardDesk · human confirm · no payments/auto-book</span>
        <span>Schedules ≠ soft leftover</span>
      </footer>

      {showRfqForm && (
        <RfqForm onSubmit={addRfq} onClose={() => setShowRfqForm(false)} />
      )}
      {showCapForm && (
        <CapacityForm onSubmit={addCapacity} onClose={() => setShowCapForm(false)} />
      )}
    </div>
  );
}

export default App;
