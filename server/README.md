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

## Accounts API (preview)

With `ACCOUNTS=on` the same service also serves sign-up/sign-in, sessions, company workspaces, invite links,
workspace data for the app and the landing-page waitlist. See [docs/accounts-setup.md](../docs/accounts-setup.md).

| Method | Path | Who |
|---|---|---|
| POST | `/api/auth/signup`, `/api/auth/signin`, `/api/auth/reset`, `/api/auth/reset/confirm` | public (rate limited) |
| GET / POST | `/api/auth/me`, `/api/auth/signout` | signed in |
| POST / PUT | `/api/workspace` (create / update profile) | signed in / owner |
| GET | `/api/workspace/team` | owner, staff |
| POST / DELETE | `/api/workspace/invites[/:code]`, DELETE `/api/workspace/members/:uid` | owner (staff: client logins) |
| POST | `/api/invites/accept` `{ join }` | signed in, no workspace yet |
| GET / POST | `/api/ws/docs?since=`, `/api/ws/doc?path=`, `/api/ws/write` `{ ops: [{ path, data \| null }] }` | workspace members (client logins: own data only) |
| POST | `/api/waitlist` | public (landing origin) |
| GET / PATCH | `/api/admin/waitlist[?format=csv]`, `/api/admin/waitlist/:id` | `ADMIN_EMAILS` |
