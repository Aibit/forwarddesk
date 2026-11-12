# Accounts on our own server (preview)

ForwardDesk accounts run on the same small Node + SQLite service as the WhatsApp inbox (`server/`), not on
Firebase. Nothing here depends on a particular cloud: one Linux box with Docker (an EU VPS, a host in
Dubai/UAE, …) and `docker compose up -d` is enough.

## What it does

| Area | How |
|---|---|
| Sign up / sign in / sign out | Email + password. Passwords hashed with **Argon2id** (node:crypto, 19 MiB, 2 passes). Emails are case-insensitive. |
| Sessions | Random 256-bit bearer token (only its SHA-256 is stored). 30 days, sliding; sign-out, password reset and removal from a team end it. Bearer token instead of a cookie so the app can stay on GitHub Pages while the API is on its own domain. |
| Password reset | One-time link, 1 hour, via a pluggable mail adapter. Today: `console` (the link is printed in the server log). Same answer whether or not the email exists. Resetting signs out everywhere. |
| Company workspace | Created after sign-up (name, country, base currency, main ports, language). The creator is the owner. One workspace per login. |
| Invites | Invite **link** (`…/forwarddesk/#join=<workspace>.<code>`), 14 days, one use. Optional email lock. The owner invites staff and clients; staff may invite client logins. |
| Workspace data | Bookings, clients, quotes, agents, billing … stored as documents per workspace (`/api/ws/*`). Another company can never read or write them. Client logins see only their own bookings/quotes/lanes and may only accept a quote or approve a draft B/L (same split as the Firestore rules). The app polls every 5 s for colleagues' changes. |
| Waitlist | `POST /api/waitlist` for the landing-page form (same fields/limits as before, honeypot + 2 s minimum, de-duplicated by email). Admins (`ADMIN_EMAILS`) see it under **Account → Waitlist sign-ups**, change status and download CSV. |
| Rate limits | Sign-up 5/h per IP; sign-in 20/10 min per IP and 5 failures/15 min per email; reset 5/h per IP and 3/h per email; join 20/10 min; waitlist 5/10 min per IP; writes 600/min per user. `429` + `Retry-After`. |
| Validation | Every field length-limited and type-checked server-side; document paths whitelisted; 900 KB per document. |

## The app (SPA)

* Build with `VITE_API_URL=https://api.example.com npm run build` to use the server. The existing **Create account**
  and **Sign in** buttons, onboarding, Account page (team, invites) and the new **reset-password** page then talk to it.
* Without `VITE_API_URL` (the public GitHub Pages build today) nothing changes: the start screen says accounts open
  shortly, `?demo` works offline, and the accounts code is never downloaded.
* UI in English, Spanish, Persian and Arabic; dates Gregorian.

## Go live checklist

1. A server + a (sub)domain, e.g. `api.forwarddesk.example` → its IP. Any provider; check its terms allow your users' countries.
2. `cp server/.env.example server/.env`, set `ACCOUNTS=on`, `APP_URL`, `ADMIN_EMAILS`, `WA_CORS_ORIGINS=https://aibit.github.io`, `TRUST_PROXY=on`.
3. Put the domain in `server/docker-compose.yml` (`api.example.com`), then `docker compose up -d --build` in `server/`.
4. Rebuild the app with `VITE_API_URL=https://api.forwarddesk.example` and deploy it.
5. Real email: add a mail adapter (SMTP / SES / Postmark / Brevo transactional …) in `server/src/accounts/mailer.ts` and set `MAIL_ADAPTER`. Until then, reset links are in `docker compose logs wa`.
6. Landing page waitlist: point the form at `https://api.forwarddesk.example/api/waitlist` (small change in `forwarddesk-site/assets/waitlist.js`; not done yet).
7. Backups: the `wa-data` volume (`fd.sqlite`, `wa.sqlite`, media). A nightly `sqlite3 fd.sqlite ".backup …"` copy off the box is enough at this size.

## Not done yet

* Email verification (accounts are usable right after sign-up; turn on once real mail exists).
* Real-time push (the app polls), file storage outside SQLite for very large attachments, 2FA, Google sign-in on the server.
* The WhatsApp endpoints (`/api/wa/*`) still use their own staff API key, not the login session.

## Tests

* `cd server && npm test` — 61 tests (34 WhatsApp + 27 accounts: password hashing, rules, validation, rate limits,
  and an HTTP end-to-end run over sign-up, workspaces, invites, scoped data, reset, sessions and the waitlist).
* `python3 scripts/accounts-e2e.py …` — the app in Chrome against a local server (see the script header).
