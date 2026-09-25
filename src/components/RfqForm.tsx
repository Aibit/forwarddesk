import { useState } from 'react';
import type { CommodityClass, ShipperRfq } from '../types';
import { CITIES } from '../data';
import { uid } from '../utils';

interface Props {
  onSubmit: (rfq: ShipperRfq) => void;
  onClose: () => void;
}

export function RfqForm({ onSubmit, onClose }: Props) {
  const [shipper, setShipper] = useState('Demo Customer LLC');
  const [commodity, setCommodity] = useState<CommodityClass>('general');
  const [label, setLabel] = useState('General cargo');
  const [weightKg, setWeightKg] = useState(1000);
  const [volumeCbm, setVolumeCbm] = useState(5);
  const [pickupCity, setPickup] = useState('Dubai');
  const [dropCity, setDrop] = useState('Riyadh');
  const [deadline, setDeadline] = useState('2026-09-26');
  const [maxPriceUsd, setMax] = useState(2500);
  const [hazmat, setHazmat] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      id: uid('RFQ').toUpperCase().replace('RFQ-', 'RFQ-'),
      shipper,
      commodity,
      commodityLabel: label,
      weightKg,
      volumeCbm,
      pickupCity,
      dropCity,
      deadline,
      maxPriceUsd,
      hazmat: hazmat || commodity === 'hazmat',
      status: 'open',
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
          <h2>New customer RFQ</h2>
          <button type="button" className="icon-btn" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="form-grid">
          <label>
            Customer
            <input value={shipper} onChange={(e) => setShipper(e.target.value)} required />
          </label>
          <label>
            Commodity class
            <select
              value={commodity}
              onChange={(e) => setCommodity(e.target.value as CommodityClass)}
            >
              <option value="general">general</option>
              <option value="electronics">electronics</option>
              <option value="pharma">pharma</option>
              <option value="perishable">perishable</option>
              <option value="hazmat">hazmat</option>
              <option value="restricted">restricted</option>
            </select>
          </label>
          <label className="span-2">
            Commodity label
            <input value={label} onChange={(e) => setLabel(e.target.value)} required />
          </label>
          <label>
            Weight (kg)
            <input
              type="number"
              min={1}
              value={weightKg}
              onChange={(e) => setWeightKg(Number(e.target.value))}
            />
          </label>
          <label>
            Volume (m³)
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={volumeCbm}
              onChange={(e) => setVolumeCbm(Number(e.target.value))}
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
            Deadline
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </label>
          <label>
            Max sell price (USD)
            <input
              type="number"
              min={100}
              value={maxPriceUsd}
              onChange={(e) => setMax(Number(e.target.value))}
            />
          </label>
          <label className="checkbox span-2">
            <input
              type="checkbox"
              checked={hazmat}
              onChange={(e) => setHazmat(e.target.checked)}
            />
            Hazmat flag
          </label>
        </div>
        <footer>
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary">
            Add customer RFQ
          </button>
        </footer>
      </form>
    </div>
  );
}
