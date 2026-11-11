# ForwardDesk WhatsApp service

Small Node (TypeScript) service for the ForwardDesk Inbox. It uses the WhatsApp Cloud API (Meta) or 360dialog, with SQLite storage and no runtime dependencies (`node:http` + `node:sqlite`, Node ≥ 22.13).

Setup, test number and go-live steps: [`../docs/whatsapp-setup.md`](../docs/whatsapp-setup.md).

| Endpoint | |
|---|---|
| `GET /webhooks/whatsapp` | verify-token handshake (`hub.challenge`) |
| `POST /webhooks/whatsapp` | inbound messages + statuses; `X-Hub-Signature-256` (Meta) / `x-360dialog-signature` checked on the raw body |
| `POST /api/wa/send` | `{conversationId \| to, text?, uploadId?, caption?, template?: {key, lang, values[]}, fallbackTemplate?, jobId?}`; text/documents only inside the 24 h window (else 409), templates always |
| `POST /api/wa/media` | raw body upload of a document (PDF/Office/text, ≤ 100 MB), headers `Content-Type`, `X-Filename` → `{id}` |
| `GET /api/wa/conversations` · `GET /api/wa/conversations/:id/messages` · `POST …/:id/read` · `POST …/:id/link` | inbox data, unread, link to job (`{jobId}`) or client/agent |
| `GET /api/wa/jobs/:jobId/messages` | threads for the job drawer |
| `PUT /api/wa/directory` | client/agent phone numbers + job IDs from the app, for auto-linking |
| `GET /api/wa/messages/:id/media` · `GET /api/wa/templates` · `GET /api/wa/status` · `GET /healthz` | |

All `/api/wa/*` calls need `Authorization: Bearer $WA_API_KEY`.

```bash
npm ci
npm test                 # unit + end-to-end tests against the mock Cloud API (test/mock-cloud.ts)
npm run build && npm start
npm run templates:export # templates/meta-templates.json for Meta approval
docker compose up -d --build   # with Caddy for HTTPS (edit the domain first)
```
