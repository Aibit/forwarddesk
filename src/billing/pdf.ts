// PDFs for job documents (House B/L, arrival notice, delivery order, booking confirmation) and invoices. EN / ES.
import { jsPDF } from 'jspdf';
import type { Job } from '../jobs/data';
import type { Company } from '../clients/store';
import { invOpen, invPaid, invTotal, invDue, type Invoice, type JobDoc, type Ledger } from './model';
import FD_MARK_PNG from '../assets/brand/logo-mark-pdf.png?inline';

type PL = 'en' | 'es';
type RGB = [number, number, number];
const C = { ink: [25, 25, 24] as RGB, text: [55, 53, 47] as RGB, muted: [120, 119, 116] as RGB, line: [227, 226, 224] as RGB, soft: [247, 246, 243] as RGB, amber: [176, 110, 20] as RGB, wm: [236, 234, 230] as RGB };

const T = {
  en: {
    hbl: 'HOUSE BILL OF LADING', an: 'ARRIVAL NOTICE', do: 'DELIVERY ORDER', bc: 'BOOKING CONFIRMATION', invoice: 'INVOICE',
    no: 'No.', date: 'Date', job: 'Booking', shipper: 'Shipper', consignee: 'Consignee', notify: 'Notify party', vessel: 'Vessel', pol: 'Port of loading', pod: 'Port of discharge',
    eta: 'ETA', line: 'Carrier', containers: 'Container no.', seal: 'Seal', size: 'Size', goods: 'Description of goods', marks: 'Marks & numbers', packages: 'Packages',
    gross: 'Gross weight (kg)', cbm: 'Volume (m³)', freight: 'Freight', prepaid: 'PREPAID', collect: 'COLLECT', place: 'Place and date of issue', draft: 'DRAFT', released: 'RELEASED', issued: 'ISSUED',
    sample: 'SAMPLE — illustrative data, not a valid document', billTo: 'Bill to', due: 'Due date', desc: 'Description', qty: 'Qty', unit: 'Unit price', amount: 'Amount', total: 'Total',
    paid: 'Paid', balance: 'Balance due', signed: 'Signed for the carrier / as agent', toBeConfirmed: 'to be confirmed', anText: 'The goods below are expected at the port of discharge. Please arrange customs clearance and settle charges before collection.',
    doText: 'Please release the cargo below to the consignee or its authorised clearance agent.', bcText: 'We confirm the booking below. Cut-off and free-time details as advised by the carrier.',
    blText: 'Received in apparent good order and condition unless otherwise stated, for carriage from the port of loading to the port of discharge.',
  },
  es: {
    hbl: 'CONOCIMIENTO DE EMBARQUE HOUSE', an: 'AVISO DE LLEGADA', do: 'ORDEN DE ENTREGA', bc: 'CONFIRMACIÓN DE RESERVA', invoice: 'FACTURA',
    no: 'Nº', date: 'Fecha', job: 'Reserva', shipper: 'Cargador', consignee: 'Consignatario', notify: 'Notificar a', vessel: 'Buque', pol: 'Puerto de carga', pod: 'Puerto de descarga',
    eta: 'ETA', line: 'Naviera', containers: 'Contenedor', seal: 'Precinto', size: 'Tamaño', goods: 'Descripción de la mercancía', marks: 'Marcas y números', packages: 'Bultos',
    gross: 'Peso bruto (kg)', cbm: 'Volumen (m³)', freight: 'Flete', prepaid: 'PREPAGADO', collect: 'A COBRAR', place: 'Lugar y fecha de emisión', draft: 'BORRADOR', released: 'LIBERADO', issued: 'EMITIDO',
    sample: 'EJEMPLO — datos ilustrativos, documento no válido', billTo: 'Facturar a', due: 'Vencimiento', desc: 'Descripción', qty: 'Cant.', unit: 'Precio ud.', amount: 'Importe', total: 'Total',
    paid: 'Pagado', balance: 'Saldo pendiente', signed: 'Firmado por el transportista / como agente', toBeConfirmed: 'por confirmar', anText: 'La mercancía siguiente llegará al puerto de descarga. Gestione el despacho y abone los cargos antes de la retirada.',
    doText: 'Entreguen la mercancía siguiente al consignatario o a su agente de aduanas autorizado.', bcText: 'Confirmamos la reserva siguiente. Cut-off y días libres según indique la naviera.',
    blText: 'Recibido en aparente buen estado salvo indicación contraria, para su transporte del puerto de carga al de descarga.',
  },
};

let fonts: Promise<Record<string, string>> | null = null;
function loadFonts() {
  if (!fonts) {
    const base = import.meta.env.BASE_URL;
    const files: Record<string, string> = { R: 'IBMPlexSans-Regular.ttf', SB: 'IBMPlexSans-SemiBold.ttf', B: 'IBMPlexSans-Bold.ttf', M: 'IBMPlexMono-Regular.ttf' };
    fonts = (async () => {
      const out: Record<string, string> = {};
      await Promise.all(Object.entries(files).map(async ([k, f]) => {
        const r = await fetch(`${base}fonts/${f}`);
        if (!r.ok) throw new Error(`font ${f}`);
        const b = new Uint8Array(await r.arrayBuffer());
        let s = '';
        for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
        out[k] = btoa(s);
      }));
      return out;
    })();
    fonts.catch(() => (fonts = null));
  }
  return fonts;
}

// Plex has no Persian glyphs: keep Latin text, swap anything else for '?'-free placeholders.
const latin = (s: string) => s.replace(/[\u0600-\u06FF\u200c]+/g, '').replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ').trim();
const dt = (ms: number | null | undefined, l: PL) => (ms ? new Date(ms).toLocaleDateString(l === 'es' ? 'es-ES' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const amt = (n: number, l: PL) => n.toLocaleString(l === 'es' ? 'es-ES' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function base(lang: PL, sample: boolean, co: Company | null) {
  const f = await loadFonts();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  for (const [k, data] of Object.entries(f)) {
    doc.addFileToVFS(`${k}.ttf`, data);
    doc.addFont(`${k}.ttf`, k, 'normal');
  }
  const font = (k: 'R' | 'SB' | 'B' | 'M', size: number, color: RGB = C.text) => {
    doc.setFont(k, 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const M = 16, W = 210;
  // header
  let x = M;
  if (co?.logo) {
    try {
      const h = 12, w = co.logoW && co.logoH ? Math.min(40, (h * co.logoW) / co.logoH) : 12;
      doc.addImage(co.logo, 'PNG', M, 12, w, h);
      x = M + w + 4;
    } catch { /* bad logo */ }
  } else {
    // No customer logo set: ForwardDesk mark as the placeholder.
    try { doc.addImage(FD_MARK_PNG, 'PNG', M, 11, 13, 13); x = M + 17; } catch { /* keep text only */ }
  }
  font('B', 13, C.ink);
  doc.text(latin(co?.name || 'ForwardDesk'), x, 18);
  font('R', 8, C.muted);
  const sub = [co?.address, co?.phone, co?.email].filter(Boolean).map((s) => latin(String(s))).join(' · ');
  if (sub) doc.text(doc.splitTextToSize(sub, 110), x, 23);
  if (sample) {
    doc.setFillColor(253, 243, 224);
    doc.roundedRect(W - M - 78, 11, 78, 7, 1.5, 1.5, 'F');
    font('SB', 7.5, C.amber);
    doc.text(T[lang].sample, W - M - 39, 15.6, { align: 'center' });
  }
  doc.setDrawColor(...C.line);
  doc.line(M, 30, W - M, 30);
  const box = (label: string, value: string, bx: number, by: number, bw: number, bh: number) => {
    doc.setDrawColor(...C.line);
    doc.roundedRect(bx, by, bw, bh, 1.2, 1.2, 'S');
    font('SB', 6.8, C.muted);
    doc.text(label.toUpperCase(), bx + 3, by + 4.6);
    font('R', 9, C.ink);
    doc.text(doc.splitTextToSize(latin(value) || '—', bw - 6).slice(0, Math.max(1, Math.floor((bh - 7) / 4))), bx + 3, by + 9.5);
  };
  const watermark = (s: string) => {
    doc.saveGraphicsState();
    font('B', 70, C.wm);
    doc.text(s, W / 2, 175, { align: 'center', angle: 30 });
    doc.restoreGraphicsState();
  };
  return { doc, font, box, watermark, M, W, L: T[lang] };
}

export async function jobDocPdf(job: Job, d: JobDoc, co: Company | null, lang: PL, sample: boolean): Promise<{ blob: Blob; filename: string }> {
  const { doc, font, box, watermark, M, W, L } = await base(lang, sample, co);
  const f = d.fields;
  const CW = W - 2 * M;
  if (d.status === 'draft') watermark(L.draft);
  font('B', 17, C.ink);
  doc.text(L[d.kind], M, 42);
  font('M', 9, C.text);
  doc.text(`${L.no} ${d.no}   ·   ${L.job} ${job.id}   ·   ${L.date} ${dt(d.issuedAt ?? Date.now(), lang)}`, M, 48.5);
  font('SB', 8, d.status === 'released' ? [46, 125, 80] : C.muted);
  doc.text(L[d.status], W - M, 42, { align: 'right' });
  font('R', 8.5, C.muted);
  const intro = d.kind === 'an' ? L.anText : d.kind === 'do' ? L.doText : d.kind === 'bc' ? L.bcText : L.blText;
  doc.text(doc.splitTextToSize(intro, CW), M, 55);
  let y = 63;
  const half = (CW - 4) / 2;
  box(L.shipper, f.shipper || (job.dir === 'export' ? job.customer : ''), M, y, half, 24);
  box(L.consignee, f.consignee || (job.dir === 'import' ? job.customer : ''), M + half + 4, y, half, 24);
  y += 28;
  box(L.notify, f.notify, M, y, half, 16);
  box(L.line, job.line, M + half + 4, y, half, 16);
  y += 20;
  const q = (CW - 12) / 4;
  box(L.vessel, job.vessel?.name ?? L.toBeConfirmed, M, y, q, 15);
  box(L.pol, job.pol, M + q + 4, y, q, 15);
  box(L.pod, job.pod, M + 2 * (q + 4), y, q, 15);
  box(L.eta, job.vessel ? dt(job.vessel.eta, lang) : L.toBeConfirmed, M + 3 * (q + 4), y, q, 15);
  y += 21;
  // containers table
  font('SB', 7, C.muted);
  doc.setFillColor(...C.soft);
  doc.rect(M, y, CW, 7, 'F');
  doc.text(L.containers.toUpperCase(), M + 3, y + 4.7);
  doc.text(L.seal.toUpperCase(), M + 70, y + 4.7);
  doc.text(L.size.toUpperCase(), M + 120, y + 4.7);
  y += 7;
  const rows = job.containers.length ? job.containers : [];
  font('M', 9, C.ink);
  for (const c of rows.slice(0, 12)) {
    y += 6;
    doc.text(c.no, M + 3, y);
    doc.text(c.seal ?? '—', M + 70, y);
    doc.text(c.size === '40HC' ? "40'HC" : `${c.size}'`, M + 120, y);
    doc.setDrawColor(...C.line);
    doc.line(M, y + 2, W - M, y + 2);
  }
  if (!rows.length) { y += 6; font('R', 9, C.muted); doc.text(job.plannedEquipment ? `${job.plannedEquipment} (${L.toBeConfirmed})` : L.toBeConfirmed, M + 3, y); }
  y += 8;
  box(L.goods, job.commodity, M, y, CW * 0.5 - 2, 22);
  box(L.marks, f.marks, M + CW * 0.5 + 2, y, CW * 0.5 - 2, 22);
  y += 26;
  const t = (CW - 12) / 4;
  box(L.packages, f.packages, M, y, t, 14);
  box(L.gross, f.grossKg, M + t + 4, y, t, 14);
  box(L.cbm, f.cbm, M + 2 * (t + 4), y, t, 14);
  box(L.freight, f.freight === 'collect' ? L.collect : L.prepaid, M + 3 * (t + 4), y, t, 14);
  y += 20;
  box(L.place, `${f.place || job.pol}, ${dt(d.issuedAt ?? Date.now(), lang)}`, M, y, half, 15);
  doc.setDrawColor(...C.line);
  doc.line(M + half + 14, y + 12, W - M, y + 12);
  font('R', 7.5, C.muted);
  doc.text(L.signed, M + half + 14, y + 16);
  return { blob: doc.output('blob'), filename: `${d.no}${d.status === 'draft' ? '-DRAFT' : ''}.pdf` };
}

export async function invoicePdf(job: Job, l: Ledger, inv: Invoice, co: Company | null, lang: PL, sample: boolean): Promise<{ blob: Blob; filename: string }> {
  const { doc, font, box, watermark, M, W, L } = await base(lang, sample, co);
  const CW = W - 2 * M;
  if (inv.status === 'draft') watermark(L.draft);
  font('B', 17, C.ink);
  doc.text(L.invoice, M, 42);
  font('M', 9, C.text);
  doc.text(`${L.no} ${inv.no}   ·   ${L.job} ${job.id}`, M, 48.5);
  let y = 55;
  const third = (CW - 8) / 3;
  box(L.billTo, inv.party, M, y, third, 20);
  box(L.date, dt(inv.issuedAt, lang), M + third + 4, y, third, 20);
  box(L.due, dt(invDue(inv), lang), M + 2 * (third + 4), y, third, 20);
  y += 24;
  box(`${L.pol} → ${L.pod}`, `${job.pol} → ${job.pod}`, M, y, third * 2 + 4, 15);
  box(L.vessel, job.vessel?.name ?? '—', M + 2 * (third + 4), y, third, 15);
  y += 21;
  doc.setFillColor(...C.soft);
  doc.rect(M, y, CW, 7, 'F');
  font('SB', 7, C.muted);
  doc.text(L.desc.toUpperCase(), M + 3, y + 4.7);
  doc.text(L.qty.toUpperCase(), M + 110, y + 4.7, { align: 'right' });
  doc.text(L.unit.toUpperCase(), M + 140, y + 4.7, { align: 'right' });
  doc.text(`${L.amount.toUpperCase()} ${inv.currency}`, W - M - 3, y + 4.7, { align: 'right' });
  y += 7;
  const lines = l.lines.filter((x) => inv.lineIds.includes(x.id));
  for (const x of lines) {
    const unit = (inv.kind === 'invoice' ? x.sell : x.buy) ?? 0;
    y += 6.5;
    font('M', 8, C.muted);
    doc.text(x.code, M + 3, y);
    font('R', 9, C.ink);
    doc.text(doc.splitTextToSize(latin(x.desc) || x.code, 80)[0], M + 20, y);
    font('M', 9, C.ink);
    doc.text(String(x.qty), M + 110, y, { align: 'right' });
    doc.text(amt(unit, lang), M + 140, y, { align: 'right' });
    doc.text(amt(unit * x.qty, lang), W - M - 3, y, { align: 'right' });
    doc.setDrawColor(...C.line);
    doc.line(M, y + 2.2, W - M, y + 2.2);
  }
  y += 10;
  const tot = invTotal(l, inv), paid = invPaid(l, inv), open = invOpen(l, inv);
  const row = (k: string, v: number, bold = false) => {
    font(bold ? 'SB' : 'R', bold ? 10.5 : 9, C.ink);
    doc.text(k, W - M - 60, y);
    font(bold ? 'SB' : 'M', bold ? 10.5 : 9, C.ink);
    doc.text(`${inv.currency} ${amt(v, lang)}`, W - M - 3, y, { align: 'right' });
    y += 6.5;
  };
  row(L.total, tot, true);
  if (paid) row(L.paid, paid);
  row(L.balance, open, true);
  return { blob: doc.output('blob'), filename: `${inv.no}${inv.status === 'draft' ? '-DRAFT' : ''}.pdf` };
}

export function downloadBlob(blob: Blob, filename: string) {
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 4000);
}
