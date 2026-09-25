import { useState } from 'react';
import type { CapacityOffer, Mode } from '../types';
import { CITIES } from '../data';
import { uid } from '../utils';

interface Props {
  onSubmit: (cap: CapacityOffer) => void;
  onClose: () => void;
}

export function CapacityForm({ onSubmit, onClose }: Props) {
  const [carrier, setCarrier] = useState('New Regional Carrier');
  const [mode, setMode] = useState<Mode>('road');
  const [pickupCity, setPickup] = useState('Dubai');
  const [dropCity, setDrop] = useState('Riyadh');
  const [availableWeightKg, setW] = useState(5000);
  const [availableVolumeCbm, setV] = useState(25);
  const [rateMinUsd, setMin] = useState(1500);
  const [rateMaxUsd, setMax] = useState(2200);
  const [etaHours, setEta] = useState(18);
  const [reliability, setRel] = useState(85);
  const [docsOk, setDocs] = useState(true);
  const [hazmatOk, setHaz] = useState(false);
  const [restrictedOk, setRes] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const id = uid('CAP').toUpperCase();
    onSubmit({
      id,
      carrier,
      carrierAgent: `SourcingAgent-${carrier.split(' ')[0]}`,
      mode,
      lane: `${pickupCity} → ${dropCity}`,
      pickupCity,
      dropCity,
      availableWeightKg,
      availableVolumeCbm,
      rateMinUsd,
      rateMaxUsd,
      departureWindow: '2026-09-24 06:00–16:00 GST',
      etaHours,
      reliability,
      docsOk,
      restrictedOk,
      hazmatOk,
      status: 'available',
      kind: 'published',
      source: 'ui_form_in_memory',
      confidence: 'carrier_published',
      notes: 'In-memory UI publish (not persisted — use /capacity for durable intake)',
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <header>
          <h2>Add buy-side capacity / soft space</h2>
          <button type="button" className="icon-btn" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="form-grid">
          <label className="span-2">
            Carrier name
            <input value={carrier} onChange={(e) => setCarrier(e.target.value)} required />
          </label>
          <label>
            Mode
            <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
              <option value="road">road</option>
              <option value="air">air</option>
              <option value="road+air">road+air</option>
            </select>
          </label>
          <label>
            Reliability
            <input
              type="number"
              min={50}
              max={100}
              value={reliability}
              onChange={(e) => setRel(Number(e.target.value))}
            />
          </label>
          <label>
            Pickup
            <select value={pickupCity} onChange={(e) => setPickup(e.target.value)}>
              {CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            Drop
            <select value={dropCity} onChange={(e) => setDrop(e.target.value)}>
              {CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            Weight (kg)
            <input
              type="number"
              value={availableWeightKg}
              onChange={(e) => setW(Number(e.target.value))}
            />
          </label>
          <label>
            Volume (m³)
            <input
              type="number"
              value={availableVolumeCbm}
              onChange={(e) => setV(Number(e.target.value))}
            />
          </label>
          <label>
            Buy rate min USD
            <input
              type="number"
              value={rateMinUsd}
              onChange={(e) => setMin(Number(e.target.value))}
            />
          </label>
          <label>
            Buy rate max USD
            <input
              type="number"
              value={rateMaxUsd}
              onChange={(e) => setMax(Number(e.target.value))}
            />
          </label>
          <label>
            ETA (hours)
            <input
              type="number"
              value={etaHours}
              onChange={(e) => setEta(Number(e.target.value))}
            />
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={docsOk} onChange={(e) => setDocs(e.target.checked)} />
            Border docs OK
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={hazmatOk}
              onChange={(e) => setHaz(e.target.checked)}
            />
            Hazmat OK
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={restrictedOk}
              onChange={(e) => setRes(e.target.checked)}
            />
            Controlled goods OK
          </label>
        </div>
        <footer>
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary">
            Add buy-side capacity
          </button>
        </footer>
      </form>
    </div>
  );
}
