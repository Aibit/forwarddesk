// Webhook bodies shaped like Meta's documented examples.
export const PNID = '123456789012345';
const wrap = (value: Record<string, unknown>) => ({
  object: 'whatsapp_business_account',
  entry: [{ id: 'WABA_ID', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', metadata: { display_phone_number: '15550000000', phone_number_id: PNID }, ...value } }] }],
});
export const textMsg = (from: string, id: string, body: string, ts = Math.floor(Date.now() / 1000), name = 'Ana') =>
  wrap({ contacts: [{ profile: { name }, wa_id: from }], messages: [{ from, id, timestamp: String(ts), type: 'text', text: { body } }] });
export const imageMsg = (from: string, id: string, mediaId = 'IMG1') =>
  wrap({ contacts: [{ profile: { name: 'Ana' }, wa_id: from }], messages: [{ from, id, timestamp: String(Math.floor(Date.now() / 1000)), type: 'image', image: { caption: 'seal photo', mime_type: 'image/jpeg', sha256: 'abc', id: mediaId } }] });
export const documentMsg = (from: string, id: string, mediaId = 'DOC1') =>
  wrap({ contacts: [{ profile: { name: 'Ana' }, wa_id: from }], messages: [{ from, id, timestamp: String(Math.floor(Date.now() / 1000)), type: 'document', document: { caption: 'Packing list FD-E-1042', filename: 'packing list.pdf', mime_type: 'application/pdf', sha256: 'def', id: mediaId } }] });
export const statusMsg = (wamid: string, status: 'sent' | 'delivered' | 'read' | 'failed', recipient: string, errors?: unknown[]) =>
  wrap({ statuses: [{ id: wamid, status, timestamp: String(Math.floor(Date.now() / 1000)), recipient_id: recipient, ...(errors ? { errors } : {}) }] });
