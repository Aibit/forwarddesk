export interface SampleRequest {
  id: string;
  label: string;
  channel: string;
  text: string;
}

export const SAMPLE_REQUESTS: SampleRequest[] = [
  {
    id: 'fcl',
    label: 'Ocean FCL · Shanghai → Barcelona',
    channel: 'Email',
    text: 'Hi, need price for 2x40HC Shanghai Yangshan to Barcelona, approx 18 tons per container, ready 20 Nov, FOB, general cargo. Thanks',
  },
  {
    id: 'fcl-messy',
    label: 'Ocean FCL (messy) · Shanghai',
    channel: 'WhatsApp',
    text: 'hi need price 2x40 shanghai - barcelona asap pls',
  },
  {
    id: 'air',
    label: 'Air · Dubai → Madrid',
    channel: 'WhatsApp',
    text: '450kg 3.2cbm Dubai to Madrid urgent!! 4 pcs. DG? no',
  },
  {
    id: 'road',
    label: 'Road FTL · Jebel Ali → Riyadh',
    channel: 'WhatsApp',
    text: 'Jebel Ali -> Riyadh 1 FTL 22t next week, steel coils, customer wants DAP Riyadh',
  },
  {
    id: 'lcl',
    label: 'LCL (Spanish) · Ningbo → Valencia',
    channel: 'Email',
    text: 'Buenas, ¿nos podéis cotizar un grupaje desde Ningbo a Valencia? 6 palets, 2.150 kg, 7,8 m3. Mercancía: piezas de recambio, no peligrosa. Lista la semana que viene. Gracias!',
  },
];
