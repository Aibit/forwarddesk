import { jsPDF } from 'jspdf';
import { COORDS, greatCircle, haversineKm } from './geo';
import type { QMode } from './locations';
import type { Issue, QuoteFields } from './parser';
import type { Quote, Side } from './rates';

export interface PdfInput {
  fields: QuoteFields;
  quote: Quote;
  issues: Issue[];
  lang: 'en' | 'es';
  internal: boolean;
  sampleRates: boolean;
  sourceText: string;
  marginTarget: number;
}

type RGB = [number, number, number];
const C = {
  ink: [31, 29, 26] as RGB,
  text: [52, 49, 45] as RGB,
  muted: [118, 111, 102] as RGB,
  faint: [160, 153, 143] as RGB,
  line: [226, 220, 210] as RGB,
  panel: [246, 243, 237] as RGB,
  land: [226, 220, 208] as RGB,
  water: [242, 239, 233] as RGB,
  amber: [245, 166, 35] as RGB,
  amberDeep: [176, 108, 8] as RGB,
  amberSoft: [253, 243, 224] as RGB,
  white: [255, 255, 255] as RGB,
  red: [176, 52, 52] as RGB,
};

const T = {
  en: {
    title: 'FREIGHT QUOTATION', quoteNo: 'Quote no.', date: 'Date', valid: 'Valid until', total: 'TOTAL PRICE', allIn: 'All-in for the charges listed',
    incoterm: 'Incoterm', equipment: 'Equipment', chargeable: 'Chargeable weight', ready: 'Cargo ready', transit: 'Transit', days: 'days', approx: 'approx.',
    schedule: 'INDICATIVE SCHEDULE', scheduleNote: 'Indicative only — subject to sailing / flight / truck availability at booking.',
    details: 'SHIPMENT DETAILS', charges: 'CHARGES', description: 'Description', basis: 'Basis', qty: 'Qty', amount: 'Amount', buy: 'Buy', margin: 'Margin', sell: 'Sell',
    confirm: 'Please confirm', confirmIntro: 'To turn this into a firm offer, please confirm:', terms: 'TERMS & CONDITIONS',
    route: 'Great-circle distance', schematic: 'schematic route, not the sailing path', mode: 'Mode', weight: 'Gross weight', volume: 'Volume', pieces: 'Pieces',
    commodity: 'Commodity', dg: 'Dangerous goods', yes: 'Yes', no: 'No', unknown: 'To confirm', perCntr: 'per container', origin: 'ORIGIN', destination: 'DESTINATION',
    preparedBy: 'Prepared by', yourForwarder: 'Your forwarder', contact: 'Name · email · phone', sample: 'Sample rates — illustrative only', page: 'Page',
    internal: 'INTERNAL — NOT FOR CUSTOMER', subjectCarrier: 'subject to carrier confirmation', asap: 'ASAP',
    sides: { origin: 'Origin', freight: 'Main freight', destination: 'Destination', customs: 'Customs' } as Record<Side, string>,
    basisL: { per_container: 'per container', per_kg: 'per kg', per_wm: 'per W/M', per_truck: 'per truck', per_shipment: 'per shipment' } as Record<string, string>,
    modes: { fcl: 'Ocean FCL', lcl: 'Ocean LCL', air: 'Air freight', road: 'Road freight' } as Record<QMode, string>,
    stages: {
      sea: ['Cargo ready', 'Gate-in / cut-off', 'ETD', 'ETA', 'Release / delivery'],
      air: ['Cargo ready', 'Airport drop-off', 'ETD', 'ETA', 'Delivery'],
      road: ['Loading', 'Export clearance', 'Border crossing', 'Arrival', 'Delivery'],
    },
    leg: { sea: 'at sea', air: 'flight', road: 'on the road' },
    termsList: (valid: string, inc: string, excluded: string[]) => [
      `Valid until ${valid}. Rates are subject to space and equipment availability at the time of booking.`,
      'Surcharges (e.g. BAF, peak season, currency adjustments) are set by carriers and may change; they will be applied as invoiced.',
      `Excludes duties, taxes, insurance and inspections unless stated.${excluded.length ? ` Not included under ${inc}: ${excluded.join(', ')}.` : ''}`,
      'Transit times are indicative and not guaranteed. Subject to our standard trading conditions.',
    ],
  },
  es: {
    title: 'COTIZACIÓN DE TRANSPORTE', quoteNo: 'N.º de oferta', date: 'Fecha', valid: 'Válida hasta', total: 'PRECIO TOTAL', allIn: 'Total de los conceptos detallados',
    incoterm: 'Incoterm', equipment: 'Equipo', chargeable: 'Peso tasable', ready: 'Mercancía lista', transit: 'Tránsito', days: 'días', approx: 'aprox.',
    schedule: 'CALENDARIO ORIENTATIVO', scheduleNote: 'Orientativo — sujeto a disponibilidad de buque / vuelo / camión al reservar.',
    details: 'DATOS DEL ENVÍO', charges: 'CONCEPTOS', description: 'Concepto', basis: 'Base', qty: 'Cant.', amount: 'Importe', buy: 'Compra', margin: 'Margen', sell: 'Venta',
    confirm: 'Por favor, confirmad', confirmIntro: 'Para convertir esta oferta en firme, confirmadnos:', terms: 'CONDICIONES',
    route: 'Distancia ortodrómica', schematic: 'ruta esquemática, no la ruta del buque', mode: 'Modo', weight: 'Peso bruto', volume: 'Volumen', pieces: 'Bultos',
    commodity: 'Mercancía', dg: 'Mercancía peligrosa', yes: 'Sí', no: 'No', unknown: 'Por confirmar', perCntr: 'por contenedor', origin: 'ORIGEN', destination: 'DESTINO',
    preparedBy: 'Preparado por', yourForwarder: 'Tu transitario', contact: 'Nombre · email · teléfono', sample: 'Tarifas de ejemplo — solo ilustrativas', page: 'Página',
    internal: 'INTERNO — NO ENVIAR AL CLIENTE', subjectCarrier: 'sujeto a confirmación de la naviera', asap: 'Lo antes posible',
    sides: { origin: 'Origen', freight: 'Flete principal', destination: 'Destino', customs: 'Aduanas' } as Record<Side, string>,
    basisL: { per_container: 'por contenedor', per_kg: 'por kg', per_wm: 'por W/M', per_truck: 'por camión', per_shipment: 'por envío' } as Record<string, string>,
    modes: { fcl: 'Marítimo FCL', lcl: 'Marítimo LCL (grupaje)', air: 'Aéreo', road: 'Carretera' } as Record<QMode, string>,
    stages: {
      sea: ['Mercancía lista', 'Entrega / cut-off', 'ETD', 'ETA', 'Despacho / entrega'],
      air: ['Mercancía lista', 'Entrega en aeropuerto', 'ETD', 'ETA', 'Entrega'],
      road: ['Carga', 'Despacho export.', 'Paso de frontera', 'Llegada', 'Entrega'],
    },
    leg: { sea: 'en mar', air: 'vuelo', road: 'en ruta' },
    termsList: (valid: string, inc: string, excluded: string[]) => [
      `Válida hasta el ${valid}. Tarifas sujetas a disponibilidad de espacio y equipo en el momento de la reserva.`,
      'Los recargos (p. ej. BAF, temporada alta, ajustes de divisa) los fijan las navieras y pueden variar; se aplicarán según factura.',
      `No incluye aranceles, impuestos, seguro ni inspecciones salvo indicación.${excluded.length ? ` No incluido en ${inc}: ${excluded.join(', ')}.` : ''}`,
      'Los tiempos de tránsito son orientativos y no garantizados. Sujeto a nuestras condiciones generales.',
    ],
  },
};

const SIDE_ORDER: Side[] = ['origin', 'freight', 'destination', 'customs'];

function b64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

let assets: Promise<{ fonts: Record<string, string>; land: number[][][] }> | null = null;
function loadAssets() {
  if (!assets) {
    const base = import.meta.env.BASE_URL;
    const files: Record<string, string> = {
      PlexR: 'IBMPlexSans-Regular.ttf', PlexM: 'IBMPlexSans-Medium.ttf', PlexSB: 'IBMPlexSans-SemiBold.ttf', PlexB: 'IBMPlexSans-Bold.ttf',
      MonoR: 'IBMPlexMono-Regular.ttf', MonoM: 'IBMPlexMono-Medium.ttf',
    };
    assets = (async () => {
      const fonts: Record<string, string> = {};
      await Promise.all(
        Object.entries(files).map(async ([k, f]) => {
          const r = await fetch(`${base}fonts/${f}`);
          if (!r.ok) throw new Error(`font ${f}: ${r.status}`);
          fonts[k] = b64(await r.arrayBuffer());
        })
      );
      const lr = await fetch(`${base}pdf/land-110m.json`);
      const land = lr.ok ? ((await lr.json()) as number[][][]) : [];
      return { fonts, land };
    })();
    assets.catch(() => (assets = null));
  }
  return assets;
}

const money = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });
const qtyFmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

function fmtDate(iso: string | null, lang: 'en' | 'es'): string {
  if (!iso) return '—';
  if (iso === 'ASAP') return T[lang].asap;
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '');
}
function shortDate(d: Date, lang: 'en' | 'es'): string {
  return d.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-GB', { day: 'numeric', month: 'short' }).replace('.', '');
}
function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function quoteNumber(text: string): string {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `FD-Q-${isoToday().replace(/-/g, '')}-${String(h % 1000).padStart(3, '0')}`;
}

export async function generateQuotePdf(inp: PdfInput): Promise<{ blob: Blob; filename: string }> {
  const { fields: f, quote: q, lang } = inp;
  const L = T[lang];
  const { fonts, land } = await loadAssets();
  const render = (mh: number) => {
  let overflow = 0;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    for (const [k, data] of Object.entries(fonts)) {
      doc.addFileToVFS(`${k}.ttf`, data);
      doc.addFont(`${k}.ttf`, k, 'normal');
    }
    const W = 210;
    const H = 297;
    const M = 16;
    const CW = W - 2 * M;
    const qn = quoteNumber(inp.sourceText);
    const todayIso = isoToday();

    const font = (k: 'PlexR' | 'PlexM' | 'PlexSB' | 'PlexB' | 'MonoR' | 'MonoM', size: number, color: RGB = C.text) => {
      doc.setFont(k, 'normal');
      doc.setFontSize(size);
      doc.setTextColor(...color);
    };
    const fillC = (c: RGB) => doc.setFillColor(...c);
    const drawC = (c: RGB) => doc.setDrawColor(...c);
    const caps = (s: string, x: number, y: number, color: RGB = C.muted, size = 6.8, align: 'left' | 'right' | 'center' = 'left') => {
      font('PlexSB', size, color);
      doc.setCharSpace(0.35);
      doc.text(s, x, y, { align });
      doc.setCharSpace(0);
    };
    const fit = (s: string, maxW: number): string => {
      if (doc.getTextWidth(s) <= maxW) return s;
      let t = s;
      while (t.length > 1 && doc.getTextWidth(t + '…') > maxW) t = t.slice(0, -1);
      return t + '…';
    };

    // ── Icons ──
    const icon = (mode: QMode | null, cx: number, cy: number, s: number, color: RGB) => {
      fillC(color);
      drawC(color);
      if (mode === 'air') {
        doc.ellipse(cx + s * 0.02, cy, s * 0.42, s * 0.075, 'F');
        doc.moveTo(cx - s * 0.02, cy); doc.lineTo(cx - s * 0.2, cy - s * 0.36); doc.lineTo(cx - s * 0.08, cy - s * 0.36); doc.lineTo(cx + s * 0.16, cy); doc.close(); doc.fill();
        doc.moveTo(cx - s * 0.02, cy); doc.lineTo(cx - s * 0.2, cy + s * 0.36); doc.lineTo(cx - s * 0.08, cy + s * 0.36); doc.lineTo(cx + s * 0.16, cy); doc.close(); doc.fill();
        doc.moveTo(cx - s * 0.3, cy); doc.lineTo(cx - s * 0.42, cy - s * 0.18); doc.lineTo(cx - s * 0.35, cy - s * 0.18); doc.lineTo(cx - s * 0.22, cy); doc.close(); doc.fill();
      } else if (mode === 'road') {
        doc.roundedRect(cx - s * 0.46, cy - s * 0.26, s * 0.58, s * 0.36, s * 0.03, s * 0.03, 'F');
        doc.moveTo(cx + s * 0.15, cy - s * 0.16); doc.lineTo(cx + s * 0.34, cy - s * 0.16); doc.lineTo(cx + s * 0.46, cy - s * 0.02); doc.lineTo(cx + s * 0.46, cy + s * 0.1); doc.lineTo(cx + s * 0.15, cy + s * 0.1); doc.close(); doc.fill();
        fillC(C.white);
        doc.rect(cx + s * 0.27, cy - s * 0.12, s * 0.09, s * 0.08, 'F');
        fillC(color);
        for (const wx of [-0.32, -0.12, 0.33]) {
          doc.circle(cx + s * wx, cy + s * 0.16, s * 0.075, 'F');
        }
      } else {
        // container ship
        doc.moveTo(cx - s * 0.48, cy + s * 0.02); doc.lineTo(cx + s * 0.48, cy + s * 0.02); doc.lineTo(cx + s * 0.36, cy + s * 0.24); doc.lineTo(cx - s * 0.4, cy + s * 0.24); doc.close(); doc.fill();
        const bw = s * 0.15;
        const bh = s * 0.1;
        for (let i = 0; i < 4; i++) for (let j = 0; j < (i % 2 ? 2 : 1) + 0; j++) doc.rect(cx - s * 0.36 + i * (bw + s * 0.02), cy - (j + 1) * (bh + s * 0.015), bw, bh, 'F');
        doc.rect(cx + s * 0.3, cy - s * 0.26, s * 0.1, s * 0.27, 'F');
      }
    };

    let page = 1;
    const footer = () => {
      drawC(C.line);
      doc.setLineWidth(0.25);
      doc.line(M, H - 16, W - M, H - 16);
      font('PlexSB', 7.2, C.ink);
      doc.text(`${L.preparedBy}: ${L.yourForwarder}`, M, H - 11.2);
      font('PlexR', 6.8, C.muted);
      doc.text(L.contact, M, H - 7.6);
      font('PlexR', 6.6, C.faint);
      doc.text(`${qn} · ${L.page} ${page}`, W - M, H - 11.2, { align: 'right' });
      doc.text(inp.sampleRates ? L.sample : 'ForwardDesk', W - M, H - 7.6, { align: 'right' });
    };
    const ensure = (y: number, need: number): number => {
      if (y + need <= H - 19) return y;
      if (page === 1 && overflow === 0) overflow = y + need - (H - 19);
      footer();
      doc.addPage();
      page += 1;
      fillC(C.amber);
      doc.rect(0, 0, W, 2.2, 'F');
      font('PlexSB', 8, C.ink);
      doc.text(`${f.origin} → ${f.destination}`, M, 12);
      font('MonoR', 7.5, C.muted);
      doc.text(qn, W - M, 12, { align: 'right' });
      return 20;
    };

    // ── Header ──
    fillC(C.amber);
    doc.rect(0, 0, W, 2.6, 'F');
    fillC(C.ink);
    doc.roundedRect(M, 11, 11, 11, 1.6, 1.6, 'F');
    fillC(C.amber);
    doc.rect(M + 2.2, 19.2, 6.6, 0.9, 'F');
    font('PlexB', 9.5, C.amber);
    doc.text('FD', M + 5.5, 17.6, { align: 'center' });
    font('PlexB', 15, C.ink);
    doc.text('ForwardDesk', M + 14.5, 17.2);
    font('PlexR', 7.4, C.muted);
    doc.text(lang === 'es' ? 'Transitario · Cotización de flete' : 'Freight forwarding · Quotation', M + 14.5, 21.6);
    caps(L.title, W - M, 13.6, C.amberDeep, 8.2, 'right');
    font('MonoM', 10.5, C.ink);
    doc.text(qn, W - M, 19.2, { align: 'right' });
    font('PlexR', 7.4, C.muted);
    doc.text(`${L.date} ${fmtDate(todayIso, lang)}   ·   ${L.valid} ${fmtDate(q.validUntil, lang)}`, W - M, 23.6, { align: 'right' });
    if (inp.internal) {
      fillC(C.red);
      doc.roundedRect(W / 2 - 30, 9.5, 60, 6, 1, 1, 'F');
      caps(L.internal, W / 2, 13.6, C.white, 7, 'center');
    }
    drawC(C.line);
    doc.setLineWidth(0.3);
    doc.line(M, 28.5, W - M, 28.5);

    // ── Title ──
    const routeTitle = `${f.origin}  →  ${f.destination}`;
    let tsize = 19;
    font('PlexB', tsize, C.ink);
    while (doc.getTextWidth(routeTitle) > CW && tsize > 12) {
      tsize -= 1;
      doc.setFontSize(tsize);
    }
    doc.text(routeTitle, M, 39.5);
    const eqText = f.mode === 'fcl' || f.mode === 'road' ? Object.entries(f.equipment).map(([k, n]) => `${n}×${k}`).join(' + ') : f.mode === 'air' ? `${q.chargeable ?? '—'} kg ${lang === 'es' ? 'tasables' : 'chargeable'}` : q.units;
    font('PlexM', 9.5, C.muted);
    doc.text([f.mode ? L.modes[f.mode] : '', eqText, f.incoterm ?? 'FOB'].filter(Boolean).join('   ·   '), M, 46);

    // ── Hero map ──
    const mx = M;
    const my = 51;
    const mw = 118;

    const o = f.origin ? COORDS[f.origin] : undefined;
    const d = f.destination ? COORDS[f.destination] : undefined;
    fillC(C.water);
    doc.roundedRect(mx, my, mw, mh, 2.5, 2.5, 'F');
    let km: number | null = null;
    if (o && d) {
      km = haversineKm(o, d);
      const pts = greatCircle(o, d, 80);
      // unwrap longitudes
      for (let i = 1; i < pts.length; i++) {
        while (pts[i][1] - pts[i - 1][1] > 180) pts[i][1] -= 360;
        while (pts[i][1] - pts[i - 1][1] < -180) pts[i][1] += 360;
      }
      let minLat = Math.min(...pts.map((p) => p[0]));
      let maxLat = Math.max(...pts.map((p) => p[0]));
      let minLon = Math.min(...pts.map((p) => p[1]));
      let maxLon = Math.max(...pts.map((p) => p[1]));
      const midLat = (minLat + maxLat) / 2;
      const k = Math.cos((midLat * Math.PI) / 180);
      let spanX = Math.max((maxLon - minLon) * k, 10);
      let spanY = Math.max(maxLat - minLat, 6);
      spanX *= 1.32;
      spanY *= 1.6;
      const aspect = mw / mh;
      if (spanX / spanY > aspect) spanY = spanX / aspect;
      else spanX = spanY * aspect;
      const cLon = (minLon + maxLon) / 2;
      const cLat = (minLat + maxLat) / 2 + spanY * 0.04;
      minLon = cLon - spanX / k / 2;
      maxLon = cLon + spanX / k / 2;
      minLat = cLat - spanY / 2;
      maxLat = cLat + spanY / 2;
      const px = (lon: number) => mx + ((lon - minLon) / (maxLon - minLon)) * mw;
      const py = (lat: number) => my + ((maxLat - lat) / (maxLat - minLat)) * mh;

      doc.saveGraphicsState();
      doc.roundedRect(mx, my, mw, mh, 2.5, 2.5, null);
      doc.clip();
      doc.discardPath();
      // graticule
      drawC([232, 228, 220]);
      doc.setLineWidth(0.15);
      const step = spanY > 60 ? 20 : spanY > 25 ? 10 : 5;
      for (let lat = Math.ceil(minLat / step) * step; lat <= maxLat; lat += step) doc.line(mx, py(lat), mx + mw, py(lat));
      for (let lon = Math.ceil(minLon / step) * step; lon <= maxLon; lon += step) doc.line(px(lon), my, px(lon), my + mh);
      // land
      fillC(C.land);
      for (const ring of land) {
        for (const shift of [-360, 0, 360]) {
          let inside = false;
          for (const [lon, lat] of ring) {
            if (lon + shift >= minLon - 5 && lon + shift <= maxLon + 5 && lat >= minLat - 5 && lat <= maxLat + 5) { inside = true; break; }
          }
          if (!inside) continue;
          ring.forEach(([lon, lat], i) => (i === 0 ? doc.moveTo(px(lon + shift), py(lat)) : doc.lineTo(px(lon + shift), py(lat))));
          doc.close();
          doc.fill();
        }
      }
      // arc halo + arc
      const arc = (w: number, c: RGB) => {
        drawC(c);
        doc.setLineWidth(w);
        doc.setLineCap('round');
        pts.forEach(([lat, lon], i) => (i === 0 ? doc.moveTo(px(lon), py(lat)) : doc.lineTo(px(lon), py(lat))));
        doc.stroke();
      };
      arc(2.2, C.white);
      arc(0.9, C.amber);
      // endpoints
      const [ox, oy] = [px(o[1]), py(o[0])];
      const [dx, dy] = [px(pts[pts.length - 1][1]), py(d[0])];
      for (const [x, y, c] of [[ox, oy, C.ink], [dx, dy, C.amberDeep]] as [number, number, RGB][]) {
        fillC(C.white);
        doc.circle(x, y, 2.1, 'F');
        fillC(c);
        doc.circle(x, y, 1.3, 'F');
      }
      // mode badge at midpoint
      const mid = pts[Math.floor(pts.length / 2)];
      const [bx, by] = [px(mid[1]), py(mid[0])];
      fillC(C.white);
      drawC(C.amber);
      doc.setLineWidth(0.6);
      doc.circle(bx, by, 4.6, 'FD');
      icon(f.mode, bx, by, 6.2, C.ink);
      // labels
      const label = (x: number, y: number, kind: string, name: string, nextY: number) => {
        font('PlexSB', 7.6, C.ink);
        const tw = Math.max(doc.getTextWidth(name), 14);
        const w = tw + 5;
        const h = 9;
        let lx = x - w / 2;
        lx = Math.max(mx + 2, Math.min(mx + mw - w - 2, lx));
        let ly = nextY < y ? y + 3.2 : y - h - 3.2;
        if (ly < my + 2) ly = y + 3.2;
        if (ly + h > my + mh - 10) ly = y - h - 3.2;
        fillC(C.white);
        drawC(C.line);
        doc.setLineWidth(0.2);
        doc.roundedRect(lx, ly, w, h, 1.2, 1.2, 'FD');
        caps(kind, lx + 2.5, ly + 3.4, C.faint, 5.2);
        font('PlexSB', 7.6, C.ink);
        doc.text(name, lx + 2.5, ly + 7.2);
      };
      const n1 = pts[Math.min(6, pts.length - 1)];
      const n2 = pts[Math.max(0, pts.length - 7)];
      label(ox, oy, L.origin, f.origin ?? '', py(n1[0]));
      label(dx, dy, L.destination, f.destination ?? '', py(n2[0]));
      doc.restoreGraphicsState();
    } else {
      // schematic fallback
      drawC(C.amber);
      doc.setLineWidth(0.9);
      doc.setLineDashPattern([1.5, 1.2], 0);
      doc.line(mx + 18, my + mh / 2, mx + mw - 18, my + mh / 2);
      doc.setLineDashPattern([], 0);
      fillC(C.ink);
      doc.circle(mx + 18, my + mh / 2, 1.6, 'F');
      fillC(C.amberDeep);
      doc.circle(mx + mw - 18, my + mh / 2, 1.6, 'F');
      font('PlexSB', 8, C.ink);
      doc.text(fit(f.origin ?? '', 40), mx + 18, my + mh / 2 - 5, { align: 'center' });
      doc.text(fit(f.destination ?? '', 40), mx + mw - 18, my + mh / 2 - 5, { align: 'center' });
      fillC(C.white);
      drawC(C.amber);
      doc.circle(mx + mw / 2, my + mh / 2, 4.6, 'FD');
      icon(f.mode, mx + mw / 2, my + mh / 2, 6.2, C.ink);
    }
    // map caption strip
    const cap = km ? `${L.route} ${money(Math.round(km / 10) * 10)} km · ${L.schematic}` : L.schematic;
    font('PlexR', 6.2, C.muted);
    fillC(C.white);
    doc.roundedRect(mx + 3, my + mh - 8.5, doc.getTextWidth(cap) + 4, 5.6, 1, 1, 'F');
    doc.text(cap, mx + 5, my + mh - 4.7);

    // ── Totals card ──
    const tx = mx + mw + 5;
    const tw = W - M - tx;
    fillC(C.ink);
    doc.roundedRect(tx, my, tw, mh, 2.5, 2.5, 'F');
    fillC(C.amber);
    doc.rect(tx, my + 9.5, 1.4, 15.5, 'F');
    caps(L.total, tx + 6, my + 8, C.amber, 6.6);
    const cur = q.currencies.length === 1 ? q.currencies[0] : q.currencies.join('/');
    font('PlexR', 8.6, [200, 194, 184]);
    doc.text(cur, tx + 6, my + 14);
    let ps = 24;
    font('PlexB', ps, C.white);
    const totalStr = money(q.sellTotal);
    while (doc.getTextWidth(totalStr) > tw - 12 && ps > 14) doc.setFontSize(--ps);
    doc.text(totalStr, tx + 6, my + 23.5);
    font('PlexR', 6.6, [170, 164, 154]);
    doc.text(L.allIn, tx + 6, my + 28.5);
    const rows: [string, string][] = [
      [L.incoterm, f.incoterm ?? `FOB (${lang === 'es' ? 'a conf.' : 'TBC'})`],
      [f.mode === 'air' ? L.chargeable : L.equipment, f.mode === 'air' ? `${q.chargeable ?? '—'} kg` : eqText],
      [L.ready, fmtDate(f.readyDate, lang)],
      [L.transit, q.transitDays != null ? `${L.approx} ${q.transitDays} ${L.days}` : '—'],
      [L.valid, fmtDate(q.validUntil, lang)],
    ];
    if (inp.internal) rows.splice(3, 0, [L.buy, money(q.buyTotal)], [L.margin, `${money(q.marginUsd)} (${q.marginPct}%)`]);
    // drop trailing rows that don't fit (valid-until is also in the header, transit in the timeline)
    while (rows.length > 3 && 35 + (rows.length - 1) * 4.4 > mh - 3.5) rows.splice(rows.length - 1, 1);
    const rstep = Math.min(5.2, (mh - 3.5 - 35) / Math.max(1, rows.length - 1));
    let ry = my + 35;
    for (const [k, v] of rows) {
      drawC([70, 66, 60]);
      doc.setLineWidth(0.2);
      doc.line(tx + 6, ry - 3.6, tx + tw - 5, ry - 3.6);
      font('PlexR', 6.6, [170, 164, 154]);
      doc.text(k, tx + 6, ry);
      font('PlexSB', 7.6, C.white);
      doc.text(fit(v, tw - 30), tx + tw - 5, ry, { align: 'right' });
      ry += rstep;
    }

    // ── Timeline ──
    let y = my + mh + 8;
    caps(L.schedule, M, y);
    font('PlexR', 6.4, C.faint);
    doc.text(L.scheduleNote, W - M, y, { align: 'right' });
    const kind = f.mode === 'air' ? 'air' : f.mode === 'road' ? 'road' : 'sea';
    const T0 = q.transitDays ?? (kind === 'air' ? 2 : kind === 'road' ? 3 : 30);
    const offs = kind === 'sea' ? [0, 2, 3, 3 + T0, 5 + T0] : kind === 'air' ? [0, 0, 1, 1 + T0, 2 + T0] : [0, 0, Math.max(1, Math.round(T0 / 2)), T0, T0];
    const base = f.readyDate && f.readyDate !== 'ASAP' ? new Date(f.readyDate + 'T12:00:00') : new Date();
    const xs = [0, 0.2, 0.36, 0.8, 1].map((r) => M + 6 + r * (CW - 12));
    const ly = y + 12;
    drawC(C.line);
    doc.setLineWidth(1.1);
    doc.setLineCap('round');
    doc.line(xs[0], ly, xs[4], ly);
    const legA = kind === 'road' ? 1 : 2;
    const legB = 3;
    drawC(C.amber);
    doc.setLineWidth(1.6);
    doc.line(xs[legA], ly, xs[legB], ly);
    // leg label + icon
    const lmx = (xs[legA] + xs[legB]) / 2;
    fillC(C.white);
    drawC(C.amber);
    doc.setLineWidth(0.5);
    doc.circle(lmx, ly, 3.6, 'FD');
    icon(f.mode, lmx, ly, 4.8, C.ink);
    font('PlexSB', 7, C.amberDeep);
    doc.text(`${offs[legB] - offs[legA]} ${L.days} ${L.leg[kind]}`, lmx, ly - 5.6, { align: 'center' });
    const stages = L.stages[kind];
    xs.forEach((x, i) => {
      fillC(i >= legA && i <= legB ? C.amber : C.white);
      drawC(i >= legA && i <= legB ? C.amber : C.faint);
      doc.setLineWidth(0.5);
      doc.circle(x, ly, 1.5, 'FD');
      const dt = new Date(base);
      dt.setDate(dt.getDate() + offs[i]);
      const align = i === 0 ? 'left' : i === 4 ? 'right' : 'center';
      const ax = i === 0 ? x - 1.5 : i === 4 ? x + 1.5 : x;
      font('PlexSB', 7.2, C.ink);
      doc.text(stages[i], ax, ly + 6.2, { align });
      font('PlexR', 6.6, C.muted);
      doc.text(`${shortDate(dt, lang)} · ${lang === 'es' ? 'día' : 'day'} ${offs[i]}`, ax, ly + 9.6, { align });
    });

    // ── Shipment details ──
    y = ly + 17.5;
    caps(L.details, M, y);
    const det: [string, string][] = [
      [f.mode === 'air' ? L.chargeable : L.equipment, f.mode === 'air' ? `${q.chargeable ?? '—'} kg (1:6000)` : f.mode === 'lcl' ? q.units : eqText || '—'],
      [L.weight, f.weightKg != null ? `${f.weightKg.toLocaleString('en-US')} kg${f.mode === 'fcl' ? ` ${L.perCntr}` : ''}` : L.unknown],
      ...((f.volumeCbm != null || f.mode === 'air' || f.mode === 'lcl' ? [[L.volume, f.volumeCbm != null ? `${f.volumeCbm} cbm` : L.unknown]] : []) as [string, string][]),
      [L.commodity, f.cargo ? f.cargo.charAt(0).toUpperCase() + f.cargo.slice(1) : L.unknown],
      [L.dg, f.dg === 'yes' ? L.yes : f.dg === 'no' ? L.no : L.unknown],
      [L.ready, fmtDate(f.readyDate, lang)],
    ];
    if (f.pieces) det.splice(4, 0, [L.pieces, String(f.pieces)]);
    const colW = CW / 4;
    const detRows = Math.ceil(det.length / 4);
    fillC(C.panel);
    doc.roundedRect(M, y + 2.5, CW, detRows * 9.5 + 2.5, 1.8, 1.8, 'F');
    det.slice(0, 12).forEach(([k, v], i) => {
      const cx = M + 4 + (i % 4) * colW;
      const cy = y + 7.8 + Math.floor(i / 4) * 9.5;
      font('PlexR', 6.2, C.muted);
      doc.text(k, cx, cy);
      const unknown = v === L.unknown || v.includes(L.unknown.toLowerCase());
      font('PlexSB', 8.2, unknown ? C.amberDeep : C.ink);
      doc.text(fit(v, colW - 6), cx, cy + 4.2);
    });
    y += detRows * 9.5 + 10.5;

    // ── Charges ──
    y = ensure(y, 30);
    caps(L.charges, M, y);
    y += 3;
    const cols = inp.internal
      ? { desc: M + 2, basis: M + 74, qty: M + 112, buy: M + 132, margin: M + 152, amt: W - M - 2 }
      : { desc: M + 2, basis: M + 92, qty: M + 135, buy: 0, margin: 0, amt: W - M - 2 };
    fillC(C.ink);
    doc.roundedRect(M, y, CW, 6.4, 1.2, 1.2, 'F');
    font('PlexSB', 6.8, C.white);
    doc.text(L.description, cols.desc + 1, y + 4.3);
    doc.text(L.basis, cols.basis, y + 4.3);
    doc.text(L.qty, cols.qty, y + 4.3, { align: 'right' });
    if (inp.internal) {
      doc.text(`${L.buy} ${cur}`, cols.buy, y + 4.3, { align: 'right' });
      doc.text(L.margin, cols.margin, y + 4.3, { align: 'right' });
    }
    doc.text(`${inp.internal ? L.sell : L.amount} ${cur}`, cols.amt, y + 4.3, { align: 'right' });
    y += 6.4;
    let anyStale = false;
    for (const side of SIDE_ORDER) {
      const lines = q.lines.filter((l) => l.side === side);
      if (!lines.length) continue;
      y = ensure(y, 12);
      y += 4.2;
      caps(L.sides[side].toUpperCase(), cols.desc + 1, y, C.amberDeep, 5.8);
      y += 0.8;
      for (const l of lines) {
        y = ensure(y, 6);
        y += 4.2;
        const stale = l.stale;
        anyStale = anyStale || stale;
        font('PlexR', 7.8, C.text);
        doc.text(fit(l.charge + (stale ? ' *' : ''), cols.basis - cols.desc - 4), cols.desc + 1, y);
        font('PlexR', 7, C.muted);
        doc.text(L.basisL[l.basis] ?? l.basis, cols.basis, y);
        font('MonoR', 7.4, C.muted);
        doc.text(qtyFmt(l.qty), cols.qty, y, { align: 'right' });
        if (inp.internal) {
          doc.text(money(l.buy), cols.buy, y, { align: 'right' });
          doc.text(money(l.sell - l.buy), cols.margin, y, { align: 'right' });
        }
        font('MonoM', 7.8, C.ink);
        doc.text(money(l.sell), cols.amt, y, { align: 'right' });
        drawC(C.line);
        doc.setLineWidth(0.15);
        doc.line(M + 1, y + 1.7, W - M - 1, y + 1.7);
      }
    }
    y = ensure(y, 12);
    y += 3.6;
    fillC(C.amberSoft);
    doc.roundedRect(M, y, CW, 8.4, 1.4, 1.4, 'F');
    fillC(C.amber);
    doc.rect(M, y, 1.4, 8.4, 'F');
    font('PlexB', 8.6, C.ink);
    doc.text(`TOTAL ${cur}`, cols.desc + 2, y + 5.6);
    if (inp.internal) {
      font('MonoM', 7.6, C.muted);
      doc.text(money(q.buyTotal), cols.buy, y + 5.6, { align: 'right' });
      doc.text(`${money(q.marginUsd)} (${q.marginPct}%)`, cols.margin + 8, y + 5.6, { align: 'right' });
    }
    font('PlexB', 10, C.ink);
    doc.text(money(q.sellTotal), cols.amt, y + 5.8, { align: 'right' });
    y += 8.4;
    if (anyStale) {
      y += 3.6;
      font('PlexR', 6.4, C.muted);
      doc.text(`* ${L.subjectCarrier}`, M + 1, y);
    }

    // ── Please confirm + terms ──
    const qs = [...new Set(inp.issues.filter((i) => i.question).map((i) => i.question![lang]))];
    const terms = L.termsList(fmtDate(q.validUntil, lang), f.incoterm ?? 'FOB', q.excluded.map((l) => l.charge));
    const drawTerms = (x0: number, y0: number, colW: number, cols: number): number => {
      font('PlexR', 6.3, C.muted);
      const wrapped = terms.map((t) => doc.splitTextToSize(t, colW - 4) as string[]);
      const colH = Array(cols).fill(0) as number[];
      const place = wrapped.map((w) => {
        const c = colH.indexOf(Math.min(...colH));
        const at = colH[c];
        colH[c] += w.length * 2.8 + 0.9;
        return { c, at };
      });
      caps(L.terms, x0, y0);
      wrapped.forEach((w, i) => {
        const tx0 = x0 + place[i].c * (colW + 8);
        const ty0 = y0 + 4.4 + place[i].at;
        fillC(C.faint);
        doc.circle(tx0 + 1.2, ty0 - 0.9, 0.45, 'F');
        font('PlexR', 6.3, C.muted);
        doc.text(w, tx0 + 3.5, ty0, { lineHeightFactor: 1.25 });
      });
      return 4.4 + Math.max(...colH);
    };
    const termsHeight = (colW: number, cols: number) => {
      font('PlexR', 6.3, C.muted);
      const colH = Array(cols).fill(0) as number[];
      terms.forEach((t) => {
        const n = (doc.splitTextToSize(t, colW - 4) as string[]).length;
        const c = colH.indexOf(Math.min(...colH));
        colH[c] += n * 2.8 + 0.9;
      });
      return 4.4 + Math.max(...colH);
    };

    if (qs.length) {
      const boxW = CW * 0.54;
      const termW = CW - boxW - 7;
      font('PlexR', 7.2, C.text);
      const wrapped = qs.map((s) => doc.splitTextToSize(s, boxW - 15) as string[]);
      const hBox = 14 + wrapped.reduce((s, w) => s + w.length * 3.4 + 1.1, 0);
      const hT = termsHeight(termW, 1);
      y = ensure(y + 6, Math.max(hBox, hT));
      fillC(C.amberSoft);
      doc.roundedRect(M, y, boxW, hBox, 1.8, 1.8, 'F');
      fillC(C.amber);
      doc.rect(M, y, 1.4, hBox, 'F');
      font('PlexB', 8.4, C.ink);
      doc.text(L.confirm, M + 6, y + 5.8);
      font('PlexR', 6.6, C.muted);
      doc.text(L.confirmIntro, M + 6, y + 9.4);
      let cy = y + 14;
      wrapped.forEach((w, n) => {
        font('MonoM', 7, C.amberDeep);
        doc.text(`${n + 1}`, M + 6.5, cy);
        font('PlexR', 7.2, C.text);
        doc.text(w, M + 10.5, cy, { lineHeightFactor: 1.35 });
        cy += w.length * 3.4 + 1.1;
      });
      drawTerms(M + boxW + 7, y + 2.6, termW, 1);
      y += Math.max(hBox, hT);
    } else {
      const colW = (CW - 8) / 2;
      y = ensure(y + 6, termsHeight(colW, 2));
      y += 1;
      y += drawTerms(M, y, colW, 2);
    }

  footer();
    return { doc, overflow };
  };
  const first = render(60);
  const doc = first.overflow > 0 && first.overflow <= 16 ? render(Math.max(44, 60 - first.overflow - 1)).doc : first.doc;
  const blob = doc.output('blob');
  const slug = `${f.origin ?? 'origin'}-${f.destination ?? 'dest'}`.replace(/[^A-Za-z0-9]+/g, '-').replace(/-+$/, '');
  return { blob, filename: `${quoteNumber(inp.sourceText)}_${slug}${inp.internal ? '_INTERNAL' : ''}.pdf` };
}
