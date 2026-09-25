# Soft-capacity playbook — UAE ↔ KSA (overnight research)

**Updated:** 2026-09-22 20:39 CEST (Europe/Madrid)  
**Goal:** Real soft leftover capacity (or closest bookable / allocatable signal). Schedules ≠ soft space.

---

## Executive answer (morning briefing)

| Question | Answer |
|----------|--------|
| Which service actually exposes **soft leftover truck capacity** publicly? | **Nqlyat** `public_active_trucks` / `trucks` via Supabase anon REST. **API healthy; board empty (0 trucks)** tonight. First true soft-capacity *path* beyond schedules. |
| Closest **operational** new signal tonight? | **Nqlyat backhaul hints** — 20 reverse-lane rows derived from 724 AE↔SA lane stats (e.g. Dubai→Jeddah after 371 Jeddah→Dubai loads). `kind=derived`, `confidence=derived_backhaul_imbalance`. **Not asserted soft space** — use to prioritize carrier outreach. |
| Soft **demand** (who needs trucks)? | **Nqlyat loads** — **1,144 active AE↔SA** (fetcher caps 500). LoadUp HTML + public load pages. |
| Closest bookable air/ocean without partner? | **Freightos** public calculator (quote ≠ leftover). **Rate-limited CF 1015** from this box. **cargo.one** free for forwarders but needs company email + optional IATA CASS. |
| What still needs Edu / parent browser? | Signups + OTP (Gmail MCP **works** on `eduard@streamhatchet.com`). Executor has **no computerUse/Task tool** — parent must launch box desktop for forms. |

**New paths beyond Saudia / OpenFlights / ADS-B:**
1. Nqlyat trucks API (soft capacity when non-empty)
2. Nqlyat backhaul imbalance hints (derived)
3. Inbound WhatsApp/email parser → `kind=published`
4. Load-Me public board probe (empty; signup to post)

---

## Working soft-capacity / near-capacity paths

### 1. Nqlyat available trucks — **TRUE soft capacity path** ✅ API
- **Site:** https://nqlyat.com  
- **Endpoint:** `GET https://cpsznhiaxkpgmjowpdfi.supabase.co/rest/v1/public_active_trucks`  
  Fallback: `/rest/v1/trucks?status=eq.available`  
- **Auth:** Public anon JWT from frontend (`NQLYAT_SUPABASE_ANON_KEY` override)  
- **Fetcher:** `ingest/fetchers/nqlyat_trucks.py` → `confidence=marketplace_truck_offer`  
- **Tonight:** **0 trucks** (all statuses). Poll on cron.  
- **Signup:** https://nqlyat.com/signup?role=carrier (phone verify likely)  
- **ToS:** Anon key is public frontend key; polite rate; strip phones; research OK.

### 2. Nqlyat reverse backhaul hints — **DERIVED only** ✅ NEW
- **Fetcher:** `nqlyat_backhaul_hint.py`  
- **Source:** `lane_market_averages` (724 AE↔SA lanes)  
- **Logic:** If forward lane has ≥50 loads, emit reverse lane as outreach hint  
- **Samples:** Dubai→Jeddah (371 fwd), Dubai→Riyadh (250), Dubai→Dammam (231), Jebel Ali→Jeddah (208)  
- **kind=`derived`** — never label as leftover soft space

### 3. Carrier / WhatsApp / email publish intake — **TRUE soft capacity** ✅
- `POST /api/capacity/publish`  
- `POST /api/inbound/parse|capacity` (`ingest/inbound_parse.py`)  
- Gmail design: ops forwards WhatsApp text to Edu → parent/script `search_threads` → POST inbound API

### 4. Freightos marketplace estimates — **quote only** ⚠️
- Public `shippingCalculator` (credit Freightos; ≤100/IP/hour)  
- Fetcher: `freightos_estimate.py` — `confidence=quote_estimate`  
- **Currently 429** from overnight probing

### 5. Load-Me truck board — **API/HTML probe** ⚠️ empty
- `market.load-me.com` 200; `www.load-me.com` often times out  
- Fetcher: `loadme_trucks.py` — 0 rows; no structured JSON  
- Signup to **post** available trucks: https://market.load-me.com/

### 6. Schedules / listings (NOT soft leftover)
- Saudia freighter CSV — `schedule` (63)  
- OpenFlights UAE↔KSA — `public_listing` (93)  
- adsb.fi DXB — `derived` (~18–23)

---

## Soft demand (matching fuel)

| Source | Status | Notes |
|--------|--------|-------|
| Nqlyat loads AE↔SA | ✅ 1144 | `nqlyat_loads.py`; WhatsApp-sourced |
| LoadUp Dubai HTML + public load URLs | ✅ | Demand; `/api/v1/loads` login-walled |
| BidsFactory / Comtrade | partial | See SOURCES-DEMAND.md |

---

## Platform attack log (tried hard)

| Platform | Soft capacity? | Access | Result |
|----------|----------------|--------|--------|
| **Nqlyat** | Yes (trucks) | Anon REST | API OK; **0 trucks**; loads+lanes work |
| **Load-Me** | Would be | Public HTML | Empty board; www host flaky |
| **LoadUp** | Carrier login | Free trial plans | Public=demand; API login |
| **TruckVix / GulfFreightX / Trella / TruKKer / SawaTruck** | Unknown | Marketing | No public capacity JSON |
| **Wajeeh** | — | — | **403** from box |
| **UROUTE** | Partner API | Docs need key | Marketing 200; no anon feed |
| **Freightos** | Quotes public | Dev portal free form | Estimator 429 tonight; OpenFreight gated |
| **cargo.one** | Live bookable air | Free + CASS optional | Needs Edu company email + browser |
| **WebCargo / SeaRates / Shipsta / Freightfinder** | Partner/paid | Keys | No free capacity JSON |
| **Maersk Spot** | Instant book | Customer | API 401 without creds |
| **Flexport** | — | — | No public capacity feed |
| **DP World Cargoes / Maqta** | Enterprise | Forms / TLS fail | No anonymous capacity |
| **Aramex / SMSA / Naqel / Zajil / Fetchr** | Parcel APIs | Account | ≠ freighter soft space |
| **CargoAI RapidAPI** | Rates+book | Free BASIC mock CASS | Needs RapidAPI key (browser signup) |
| **TIMOCOM / DAT / Truckstop** | EU/US boards | Paid | Not GCC primary; paid walls |
| **Telegram @SaudiTrucks** | Classifieds | Public preview | Truck *sales* ads, not soft freight capacity |
| **Facebook empty-leg groups** | Possible | Login | Needs parent box browser + Edu login |
| **Haraj** | Classifieds | — | GraphQL/API not useful anonymously |

---

## Human next steps (exact)

1. **Parent:** launch box browser (computerUse) — executor has Chrome but **must not** CDP/Playwright per box-desktop skill; no Task tool in executor toolset.  
2. Sign up **Nqlyat carrier**: https://nqlyat.com/signup?role=carrier — use `eduard@streamhatchet.com`; phone OTP may need Edu. Gmail MCP ready for email verify.  
3. **LoadUp** register: https://loadupae.com/register (carrier free trial).  
4. **cargo.one**: https://www.cargo.one/sign-up-today — company email; without CASS → Agent Rates only.  
5. **Freightos developer**: https://developers.freightos.com/accounts/create — request OpenFreight sandbox if free.  
6. **CargoAI**: RapidAPI free BASIC → set `RAPIDAPI_KEY` / wire fetcher (mock CASS `0000000-0000` for DXB–RUH tests).  
7. SeaRates: email `integrations@searates.com` for trial — **do not pay** without approval.  
8. Ops: paste WhatsApp soft-space texts → `POST /api/inbound/capacity`.  
9. Optional: join Telegram freight groups via Edu phone; forward messages to inbound parser.

---

## Rate limits & provenance

- Nqlyat: ≤1 trucks poll / few minutes; loads ≤500/run  
- Freightos: ≤100/hour/IP  
- Never label `schedule` / `quote_estimate` / OpenFlights / backhaul hints as leftover soft space  
- Soft leftover = `published` (intake) or `marketplace_truck_offer` with weight>0 when board non-empty

---

## WhatsApp / email inbound

Meta WhatsApp Cloud API needs Business app (not free overnight).

1. Forward WhatsApp → Edu Gmail or paste Capacity Inbox  
2. `POST /api/inbound/parse` `{"text":"...","channel":"whatsapp"}`  
3. `POST /api/inbound/capacity` → `kind=published`  
4. Later: Gmail filter → script using Gmail MCP `search_threads` → inbound API

---

## Live counts (2026-09-22 ~20:39 CEST ingest)

| Source | Rows | Soft leftover? |
|--------|------|----------------|
| saudia_cargo_freighter | 63 | No (schedule) |
| openflights_uae_ksa | 93 | No |
| adsb_fi_dxb | 18 | No |
| nqlyat_trucks | 0 | Path yes / data empty |
| nqlyat_backhaul_hint | **20** | No (derived) |
| loadme_trucks | 0 | Board empty |
| freightos_estimate | 0 | 429 |
| **Total capacity.jsonl** | **~197** | |
