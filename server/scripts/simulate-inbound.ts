// Local development: post a signed inbound text webhook to a running server.
//   WA_APP_SECRET=... npm run simulate -- +971501234567 "Hello about FD-E-1042"
import { sign } from '../src/signature.js';

const [to = '971501234567', text = 'Hello, any update on FD-E-1042?'] = process.argv.slice(2);
const url = process.env.WA_SERVER ?? `http://localhost:${process.env.PORT ?? 8080}/webhooks/whatsapp`;
const from = to.replace(/\D/g, '');
const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ id: 'LOCAL', changes: [{ field: 'messages', value: {
  messaging_product: 'whatsapp', metadata: { display_phone_number: '0', phone_number_id: process.env.WA_PHONE_NUMBER_ID ?? 'local' },
  contacts: [{ profile: { name: 'Local test' }, wa_id: from }],
  messages: [{ from, id: `wamid.LOCAL${Date.now()}`, timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: text } }] } }] }] });
const headers: Record<string, string> = { 'Content-Type': 'application/json' };
if (process.env.WA_APP_SECRET) headers['X-Hub-Signature-256'] = `sha256=${sign(body, process.env.WA_APP_SECRET)}`;
const r = await fetch(url, { method: 'POST', headers, body });
console.log(r.status, await r.text());
