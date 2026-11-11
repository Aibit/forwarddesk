# WhatsApp inbox: setup

ForwardDesk's two-way WhatsApp inbox has two parts:

1. **The ForwardDesk WhatsApp service** (`/server` in this repo). It is a small Node service that receives WhatsApp webhooks, stores conversations (SQLite) and sends messages through the official **WhatsApp Cloud API (Meta)** or **360dialog** (same API shape).
2. **The Inbox page** in the app. It talks to the service with an API key.

Without a service, the app shows **sample conversations** in the demo, and the WhatsApp buttons (booking, client, agent, invoice, quote) keep opening your own WhatsApp with the message ready (step 1). Nothing is ever sent automatically.

> **A public HTTPS address is required.** WhatsApp delivers incoming messages and delivery statuses by calling your service over the internet (a "webhook"). Meta only calls `https://` URLs with a valid certificate, so the service must run on a server that is reachable from the internet. Your laptop behind a home router is not reachable. The app on GitHub Pages is also HTTPS, so browsers will only talk to an HTTPS service anyway.

---

## Part A: Try it with Meta's free test number

Meta gives every developer app a free **test phone number**. It can message **up to 5 phone numbers that you add and verify**. It costs nothing and needs no business verification.

### A1. Developer account and app (about 10 minutes)
1. Go to <https://developers.facebook.com> and log in with your Facebook account. Click **Get started** and register as a developer (verify your phone/email if asked).
2. **My Apps → Create app**. Use case: **Connect with customers through WhatsApp** (or type *Other → Business*). Give it a name, e.g. "ForwardDesk test".
3. When asked for a business portfolio, pick yours or let Meta create one. No verification is needed for the test number.
4. In the app, open **WhatsApp → API Setup**. Meta shows:
   - a **test phone number** (the "From" number),
   - its **Phone number ID**, which goes in `WA_PHONE_NUMBER_ID`,
   - a **temporary access token**, which goes in `WA_TOKEN`. **It expires after 24 hours**; click *Generate* again when it does.
5. Still on API Setup, under **To**, choose **Manage phone number list** and add up to **5** WhatsApp numbers (yours, a colleague's). Each one gets a code on WhatsApp that must be entered. Messages to numbers not on this list fail.
6. Open **App settings → Basic**, click *Show* next to **App secret**, and copy it into `WA_APP_SECRET`. The service uses it to check that webhooks really come from Meta (X-Hub-Signature-256).

### A2. Run the service on a public HTTPS address
Pick any long random strings for the verify token and the API key, e.g. `openssl rand -hex 24`.

**On a server (recommended, e.g. the planned Hetzner EU server):**
```bash
git clone https://github.com/Aibit/forwarddesk.git && cd forwarddesk/server
cp .env.example .env      # then fill in the values below
# point a (sub)domain, e.g. wa.yourcompany.com, at the server's IP and put it in docker-compose.yml
docker compose up -d --build
curl https://wa.yourcompany.com/healthz     # → {"ok":true}
```
`.env` for the test number:
```
WA_PROVIDER=meta
WA_TOKEN=<temporary access token from API Setup>
WA_PHONE_NUMBER_ID=<Phone number ID from API Setup>
WA_APP_SECRET=<App secret>
WA_VERIFY_TOKEN=<random string you choose>
WA_API_KEY=<another random string, for the ForwardDesk app>
WA_CORS_ORIGINS=https://aibit.github.io
```
The included `docker-compose.yml` runs Caddy in front of the service, and Caddy gets a free HTTPS certificate automatically.

**Quick test from a laptop instead:** run `npm ci && npm run build && npm start` in `server/` (Node 22.13+). Then expose it with an HTTPS tunnel, e.g. `cloudflared tunnel --url http://localhost:8080`; Cloudflare quick tunnels need no account. Use the `https://….trycloudflare.com` address it prints. The address changes every time you restart the tunnel, so you would have to update the webhook URL each time.

### A3. Connect the webhook
1. In the Meta app: **WhatsApp → Configuration → Webhook → Edit**.
2. **Callback URL:** `https://<your-service-address>/webhooks/whatsapp`
3. **Verify token:** the same value as `WA_VERIFY_TOKEN`. Click **Verify and save**. Meta calls the service, and the service answers the challenge.
4. Under **Webhook fields**, click **Manage** and **Subscribe** to `messages`. This one field carries incoming messages and the sent / delivered / read / failed statuses.

### A4. Connect the app
1. Open ForwardDesk. In **Inbox** (or **Clients → Your company → WhatsApp inbox**), enter the **Service URL** (`https://<your-service-address>`) and the **API key** (`WA_API_KEY`). Click **Test connection**, then **Save**. The key is stored only in that browser.
2. From one of your 5 verified phones, send a WhatsApp message to the test number. It appears in the Inbox within a few seconds. This also opens the **24-hour reply window**, so you can now reply with free text and PDFs from the Inbox.
3. Ticks in the Inbox come only from the statuses WhatsApp reports: ✓ sent, ✓✓ delivered, blue ✓✓ read, amber "Not delivered".

**Limits of the test setup**
- Only the 5 verified numbers can receive messages, and the sender is Meta's test number, not your company number.
- The temporary token lasts 24 hours.
- The ForwardDesk templates (`fd_*`) only work after Meta approves them (Part B, step 4). Until then, start conversations from the phone side, or use Meta's pre-approved `hello_world` template from the API Setup page.

### Local development without Meta
`cd server && npm ci && npm test` runs the tests against a **mock Cloud API**. To click through the Inbox locally:
```bash
WA_PROVIDER=mock WA_API_KEY=dev PORT=8080 npm run dev     # sends nothing, returns fake message IDs
npm run simulate -- +447700900123 "Hello about FD-E-1042"  # posts a fake inbound webhook
```
Then connect the app to `http://localhost:8080` with key `dev`, running the app from `npm run dev` on `localhost`.

---

## Part B: Go live with the company's own number

1. **Business verification.** In **Meta Business Suite → Settings → Security Center**, start verification with the company's legal documents (registration certificate, a utility bill or bank statement with the same name and address, a website on the company domain). It usually takes from a few days to two weeks.
2. **A phone number for WhatsApp Business.** Use a number the company owns that can receive an SMS or voice call for the code. The number **must not be active in the WhatsApp or WhatsApp Business app**; delete that account first, or use a new number. Plan EU or Gulf numbers as needed.
   In the Meta app: **WhatsApp → API Setup → Add phone number**. Enter the **display name** (it must match the company or brand, and Meta reviews it), category and description, then verify by SMS or call.
3. **Permanent token.** In **Business Settings → Users → System users**, create a system user (Admin) and assign it the app and the WhatsApp account. Then **Generate token** with `whatsapp_business_messaging` and `whatsapp_business_management`. Put that token in `WA_TOKEN` and the new number's **Phone number ID** in `WA_PHONE_NUMBER_ID`, then restart the service.
4. **Templates.** `cd server && npm run templates:export` writes `templates/meta-templates.json`. It contains one payload per alert and language (6 utility alerts × EN/ES/FA/AR): free time ending, 48 h cut-off, pay before B/L, draft B/L ready, invoice issued, arrival notice.
   - Submit them in **WhatsApp Manager → Message templates → Create template**. Use category **Utility**, the same name and language, the body text and the example values from the file. You can also POST each payload to `https://graph.facebook.com/v26.0/<WABA_ID>/message_templates` with the system-user token.
   - `fd_bl_draft_ready` and `fd_invoice_issued` have a **document header**, so the PDF can go out with the template even outside the 24-hour window. Meta asks for a sample PDF when you create them.
   - **Have a native speaker review the FA and AR texts before submitting.**
   - Approval usually takes minutes to a day. Rejected templates can be edited and resubmitted.
5. **Payment method.** In **WhatsApp Manager → Settings → Payment methods**, add a card. Meta bills template messages (and service messages above the free monthly allowance) by country. Check current prices before going live.
6. **Webhook** stays the same as in A3 (same URL, same verify token). Remove the test number from your app if you no longer need it.

### Alternative: 360dialog
360dialog is an official WhatsApp Business Solution Provider in the EU, with the same Cloud API message format. Use it if you prefer a provider contract, EU support or their onboarding instead of setting things up in Meta directly.
1. Sign up at 360dialog, connect the company's Meta business account and number through their embedded signup (business verification still applies), and create an **API key**.
2. `.env`: `WA_PROVIDER=360dialog`, `WA_TOKEN=<D360 API key>` (`WA_PHONE_NUMBER_ID` is not needed).
3. Set the webhook through the 360dialog API or hub to `https://<your-service-address>/webhooks/whatsapp`.
   - If you have a **platform secret**, put it in `WA_APP_SECRET`; the service checks `x-360dialog-signature`.
   - Otherwise set a custom webhook header `x-fd-webhook-token` with the same value as `WA_WEBHOOK_HEADER_TOKEN`.
4. Submit the same templates through the 360dialog hub or API.

---

## How the inbox behaves
- **24-hour window:** free text and documents (PDF up to 100 MB) can be sent for 24 hours after the contact's last message. Outside that window the service refuses free text (HTTP 409) and the Inbox shows the template picker. Staff choose an approved template in the recipient's language; the values are filled from the booking and can be edited.
- **Linking:**
  - **Client or agent:** matched by phone number. The app sends its client and agent numbers to the service. An exact international match wins; otherwise a unique match on the last 9 digits is used.
  - **Booking:** linked by a booking reference in the message text (e.g. `FD-E-1042`), or by staff choice. Staff choice always wins.
- **Media:** incoming photos and documents are downloaded right away into `WA_MEDIA_DIR` (Meta's download links expire after a few minutes).
- **Statuses** never go backwards (read stays read); "failed" is shown in amber with the WhatsApp error code.
- **Security:**
  - Webhooks without a valid signature are rejected (401).
  - The app API needs the bearer key and only allows the origins in `WA_CORS_ORIGINS`.
  - Local file paths are never returned.
  - The shared API key suits a single small team. Replace it with per-user login before giving access to more people.
- **Back-ups:** copy the `/data` volume (`wa.sqlite` and `media/`).
