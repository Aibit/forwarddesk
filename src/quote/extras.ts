/**
 * Requested extra services (insurance, customs clearance, trucking) and SAMPLE estimates for the demo.
 * Every amount here is an illustrative SAMPLE figure, never a real price: lines built from it carry
 * `estimate: true` and the charge name ends in "(SAMPLE estimate)".
 */
import { COORDS, haversineKm } from './geo';
import type { QMode } from './locations';
import type { QuoteFields, ServiceReq } from './parser';

export type L4 = [string, string, string, string]; // en, es, fa, ar

/** SAMPLE service tariff (USD). Illustrative only. */
export const SAMPLE_SERVICES = {
  insurancePct: 0.35, // % of the declared cargo value
  insuranceMin: 60,
  clearanceUae: 150, // per declaration
  clearanceOther: 120,
  exportClearance: 85,
  pickupCntr: 180,
  pickupShpt: 120,
  deliveryCntr: 220,
  deliveryShpt: 140,
};

/** Rough SAMPLE FX used only to express a non-USD cargo value in USD for the insurance estimate. */
const FX_USD: Record<string, number> = { USD: 1, EUR: 1.08, AED: 0.2723, GBP: 1.27, CNY: 0.14, INR: 0.012, SAR: 0.2667 };

const UAE = /jebel ali|dubai|abu dhabi|sharjah|khalifa|ajman/i;
const PLACE: Record<string, L4> = {
  Dubai: ['Dubai', 'Dubái', 'دبی', 'دبي'],
  'Jebel Ali': ['Jebel Ali', 'Jebel Ali', 'جبل علی', 'جبل علي'],
  'Abu Dhabi': ['Abu Dhabi', 'Abu Dabi', 'ابوظبی', 'أبوظبي'],
  Sharjah: ['Sharjah', 'Sharjah', 'شارجه', 'الشارقة'],
};
const placeL4 = (p: string): L4 => PLACE[p] ?? [p, p, p, p];
const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

export interface ServiceCharge {
  kind: ServiceReq['kind'];
  side: 'customs' | 'services';
  basis: 'per_shipment' | 'per_container';
  qty: number;
  unit: number;
  buy: number;
  /** Label per UI language, without the SAMPLE marker (the screen shows a badge). */
  labels: L4;
  /** Matches an existing rate-sheet line instead of adding an estimate. */
  match?: RegExp;
  matchSide?: 'origin' | 'destination' | 'customs';
}

function containers(f: QuoteFields): number {
  return Object.entries(f.equipment).filter(([k]) => k !== 'FTL').reduce((s, [, n]) => s + n, 0);
}

/** One SAMPLE charge per requested service. */
export function serviceCharges(f: QuoteFields): ServiceCharge[] {
  const out: ServiceCharge[] = [];
  const reqs = f.services ?? [];
  const nCntr = f.mode === 'fcl' ? containers(f) : 0;
  const S = SAMPLE_SERVICES;
  for (const r of reqs) {
    if (r.kind === 'insurance') {
      const v = f.cargoValue;
      const cur = f.cargoValueCur ?? 'USD';
      if (v != null && v > 0) {
        const usd = v * (FX_USD[cur] ?? 1);
        const buy = Math.max(S.insuranceMin, Math.round((usd * S.insurancePct) / 100));
        const of = `${cur} ${fmt(v)}`;
        out.push({ kind: r.kind, side: 'services', basis: 'per_shipment', qty: 1, unit: buy, buy, labels: [
          `Cargo insurance — ${S.insurancePct}% of ${of} (min USD ${S.insuranceMin})`,
          `Seguro de la mercancía — ${String(S.insurancePct).replace('.', ',')}% de ${of} (mín. USD ${S.insuranceMin})`,
          `بیمه کالا — ${S.insurancePct}٪ از ${of} (حداقل USD ${S.insuranceMin})`,
          `تأمين البضاعة — ${S.insurancePct}٪ من ${of} (حد أدنى USD ${S.insuranceMin})`,
        ] });
      } else {
        out.push({ kind: r.kind, side: 'services', basis: 'per_shipment', qty: 1, unit: S.insuranceMin, buy: S.insuranceMin, labels: [
          `Cargo insurance — minimum (cargo value not given; ${S.insurancePct}% of value)`,
          `Seguro de la mercancía — mínimo (falta el valor; ${String(S.insurancePct).replace('.', ',')}% del valor)`,
          `بیمه کالا — حداقل (ارزش کالا داده نشده؛ ${S.insurancePct}٪ ارزش)`,
          `تأمين البضاعة — الحد الأدنى (لم تُذكر قيمة البضاعة؛ ${S.insurancePct}٪ من القيمة)`,
        ] });
      }
    } else if (r.kind === 'customsDest') {
      const place = r.place ?? f.destination ?? '';
      const p = placeL4(place.replace(/\s*\(.*\)$/, ''));
      const unit = UAE.test(place) || UAE.test(f.destination ?? '') ? S.clearanceUae : S.clearanceOther;
      out.push({ kind: r.kind, side: 'customs', basis: 'per_shipment', qty: 1, unit, buy: unit, match: /customs|clearance|despacho/i, matchSide: 'customs', labels: [
        `Import customs clearance, ${p[0]} — per declaration (duties & VAT not included)`,
        `Despacho de importación, ${p[1]} — por declaración (aranceles e IVA no incluidos)`,
        `ترخیص گمرکی واردات، ${p[2]} — هر اظهارنامه (حقوق گمرکی و مالیات بر ارزش افزوده شامل نیست)`,
        `التخليص الجمركي للاستيراد، ${p[3]} — لكل بيان (الرسوم الجمركية وضريبة القيمة المضافة غير مشمولة)`,
      ] });
    } else if (r.kind === 'customsOrigin') {
      const place = r.place ?? f.origin ?? '';
      const p = placeL4(place.replace(/\s*\(.*\)$/, ''));
      out.push({ kind: r.kind, side: 'customs', basis: 'per_shipment', qty: 1, unit: S.exportClearance, buy: S.exportClearance, match: /export (customs|clearance|declaration)/i, matchSide: 'origin', labels: [
        `Export customs clearance, ${p[0]} — per declaration`,
        `Despacho de exportación, ${p[1]} — por declaración`,
        `ترخیص گمرکی صادرات، ${p[2]} — هر اظهارنامه`,
        `التخليص الجمركي للتصدير، ${p[3]} — لكل بيان`,
      ] });
    } else if (r.kind === 'pickup' || r.kind === 'delivery') {
      if (f.mode === 'road') continue; // the road linehaul already runs door to door
      const pick = r.kind === 'pickup';
      const place = (r.place ?? (pick ? f.origin : f.destination) ?? '').replace(/\s*\(.*\)$/, '');
      const p = placeL4(place);
      const per = nCntr > 0;
      const unit = pick ? (per ? S.pickupCntr : S.pickupShpt) : per ? S.deliveryCntr : S.deliveryShpt;
      const qty = per ? nCntr : 1;
      out.push({ kind: r.kind, side: 'services', basis: per ? 'per_container' : 'per_shipment', qty, unit, buy: unit * qty,
        match: pick ? /truck|pick-?up|haulage|pre-?carriage/i : /truck|haulage|on-?carriage|door delivery/i, matchSide: pick ? 'origin' : 'destination',
        labels: pick ? [
          `Pickup trucking to the port, ${p[0]}`,
          `Transporte de recogida hasta el puerto, ${p[1]}`,
          `حمل زمینی از محل بار تا بندر، ${p[2]}`,
          `النقل البري من موقع الاستلام إلى الميناء، ${p[3]}`,
        ] : [
          `Delivery trucking from the port, ${p[0]}`,
          `Transporte de entrega desde el puerto, ${p[1]}`,
          `حمل زمینی از بندر تا محل تحویل، ${p[2]}`,
          `النقل البري من الميناء إلى موقع التسليم، ${p[3]}`,
        ] });
    }
  }
  return out;
}

/** Great-circle km between two known places, or null when either is unknown. */
export function laneKm(origin: string | null, destination: string | null): number | null {
  const a = origin ? COORDS[origin] : undefined;
  const b = destination ? COORDS[destination] : undefined;
  if (!a || !b) return null;
  const km = haversineKm(a, b);
  return km > 30 ? km : null;
}

/** SAMPLE freight estimate for a lane with no rate on file: unit price per basis and transit days. */
export function freightEstimate(mode: QMode, km: number, equipment: string): { unit: number; min: number; transit: number } {
  const r10 = (n: number) => Math.round(n / 10) * 10;
  if (mode === 'fcl') {
    const base20 = r10(300 + 0.12 * km);
    const mult = /^20/.test(equipment) ? 1 : /HC$/.test(equipment) || /^45/.test(equipment) ? 1.75 : 1.65;
    return { unit: r10(base20 * mult), min: 0, transit: Math.ceil((km * 1.35) / 650) + 3 };
  }
  if (mode === 'lcl') return { unit: Math.round(25 + 0.006 * km), min: Math.round(25 + 0.006 * km), transit: Math.ceil((km * 1.35) / 650) + 7 };
  if (mode === 'air') return { unit: Math.round((1.2 + 0.00028 * km) * 100) / 100, min: 100, transit: km > 6000 ? 3 : 2 };
  return { unit: r10(km * 1.3 * 1.6 + 250), min: 0, transit: Math.ceil((km * 1.3) / 600) + 1 };
}
