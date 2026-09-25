# Soft-capacity sources tried (UAE ↔ KSA)

Honesty log for CargoMatch capacity ingest. **No fabricated “live” rows.**  
Kinds used in store: `schedule` | `public_listing` | `published` | `derived`.

Checked around **2026-09-22 (Europe/Madrid)**.

---

## Working (rows produced)

### 1. Saudia Cargo freighter schedule CSV — **WORKS**
- **ID:** `saudia_cargo_freighter`
- **Kind:** `schedule`
- **URL (page):** https://www.saudiacargo.com/en/our-reach/our-network/schedule  
- **URL (CSV):** `https://svcazureweb.azurewebsites.net/getmedia/3df29127-fb10-4614-9a5f-b5c8909357fe/SV-FREIGHTER-S-26-SCHEDULE_18-8-2026.csv?ext=.csv`  
  (media id discovered linked from the public schedule page HTML)
- **What we get:** Summer-2026 freighter legs with flight no., effective/end dates, DOW mask, dep/arr airports & local times, sub-fleet, block time.
- **Corridor fit:** Most legs are long-haul into/out of **JED / RUH / DMM** (KSA hubs). Direct UAE↔KSA freighter legs are uncommon in this file; rows are tagged `ksa_hub_freighter` vs `uae_ksa` when applicable.
- **Confidence:** `schedule_only` — **not leftover soft space**. Weight/volume stored as 0.
- **License / ToS (high level):** Public marketing/schedule media on Saudia Cargo site. For production redistribution, confirm Saudia Cargo terms; treat as factual schedule reference, not a booking API.

### 2. OpenFlights routes (UAE↔KSA filter) — **WORKS**
- **ID:** `openflights_uae_ksa`
- **Kind:** `public_listing`
- **URLs:**  
  - https://raw.githubusercontent.com/jpatokal/openflights/master/data/routes.dat  
  - airlines.dat / airports.dat (name enrichment)  
  - Project: https://openflights.org/data.html
- **What we get:** Deduped airline+airport pairs where one end is UAE (DXB/DWC/AUH/SHJ/…) and the other KSA (JED/RUH/DMM/MED/…).
- **Confidence:** `service_exists` — route listing only; **no timetable, no soft space**.
- **License / ToS:** OpenFlights data is under **ODbL** (see project page). Attribution required for database extracts; we keep `source_url` on each row.

### 3. adsb.fi open data near Dubai — **WORKS** (noisy / derived)
- **ID:** `adsb_fi_dxb`
- **Kind:** `derived`
- **URL:** https://opendata.adsb.fi/api/v2/lat/25.25/lon/55.36/dist/120
- **What we get:** Live aircraft near DXB filtered to callsign prefixes EK/UAE, EY/ETD, SV/SVA, FZ/FDB, XY/KNE.
- **Limit:** Destination not in payload → drop city recorded as “Unknown (track only)”.
- **Confidence:** `live_traffic` — **not bookable soft capacity**.
- **License / ToS:** adsb.fi open data; respect their fair-use / attribution expectations.

### 4. Carrier publish intake — **WORKS** (first-party)
- **ID / source:** `carrier_publish_intake`
- **Kind:** `published`
- **Endpoint:** `POST /api/capacity/publish`
- **Confidence:** `carrier_published` — this is the soft-capacity path when public leftover data is thin.

---

### 5. Nqlyat available trucks (Supabase) — **WORKS (API; 0 trucks tonight)**
- **ID:** `nqlyat_trucks`
- **Kind:** `public_listing` · **confidence:** `marketplace_truck_offer`
- **URL:** `https://cpsznhiaxkpgmjowpdfi.supabase.co/rest/v1/public_active_trucks` (+ `trucks?status=eq.available`)
- **What we get:** Carrier-posted available trucks (origin/dest, type, capacity). **True soft-capacity path** when non-empty.
- **Tonight:** 0 rows (empty board — not fabricated).
- **Auth:** Public anon key from nqlyat.com JS; override `NQLYAT_SUPABASE_ANON_KEY`.

### 6. Freightos marketplace estimates — **WORKS when not rate-limited**
- **ID:** `freightos_estimate`
- **Kind:** `public_listing` · **confidence:** `quote_estimate` — **NOT leftover soft space**
- **URL:** https://ship.freightos.com/api/shippingCalculator
- **Limit:** 100/IP/hour; Cloudflare 1015 observed after burst.
- **Attribution:** Required (Freightos).

---



### 7. Nqlyat reverse backhaul hints — **WORKS (derived; NOT soft leftover)**
- **ID:** `nqlyat_backhaul_hint`
- **Kind:** `derived` · **confidence:** `derived_backhaul_imbalance`
- **URL:** Supabase `lane_market_averages` AE↔SA
- **What we get:** Reverse of high-volume forward lanes (e.g. Dubai→Jeddah after Jeddah→Dubai demand). Weight=0.
- **Honesty:** Outreach prioritization only — not carrier-asserted space.

### 8. Load-Me truck search — **WORKS (empty board)**
- **ID:** `loadme_trucks`
- **Kind:** would be `public_listing` when non-empty
- **URL:** https://market.load-me.com/search
- **Tonight:** 0 truck rows; no structured public JSON.

## Attempted — failed / blocked / auth

### DP World Jeddah berthing schedule — **BLOCKED**
- **UI:** https://dpworld.sa/berthingschedule (HTML loads; Angular `BerthingScheduleCtrl`)
- **API (from JS):** `GET /api/BerthingScheduleApi/GetBerthingSchedule?StartDate=&EndDate=`
- **Result:** Page sometimes 200 via curl; **API returns Cloudflare 403** from this environment even with cookies/`Referer`. Fetcher records failure; **zero fabricated berthing rows**.
- **Notes:** Would be `schedule` (vessel calls ≠ container soft space) if unblocked.

### SeaRates Ship Schedules API — **AUTH**
- https://schedules.searates.com/api/v2/... → `API_KEY_WRONG` / 401 without key.

### Emirates SkyCargo — **BLOCKED**
- Site/media PDFs (`skycargo.com/media/...freighter...pdf`) → **Access Denied / 403** from this box.
- Host-to-host API exists commercially only (email onboarding); no public schedule JSON.

### OpenSky Network — **TLS FAIL**
- `opensky-network.org` TLS unexpectedly EOF from this environment.

### Freightos — **NO PUBLIC FEED**
- Marketing site 200; quotes/schedules require auth / product access. Not ingested.

### Maersk / MSC / CMA CGM / Hapag interactive schedules — **AUTH / BOT WALL**
- Public HTML shells or 403; commercial schedule APIs need client credentials (DCSA).

### MyShipTracking arrivals — **WRONG / UNUSABLE WITHOUT SEARCH API**
- `ports-arrivals-departures/?pid=…` without a reliable Jeddah/Jebel Ali pid from HTML search (SPA). Did not scrape inventively; left unused.

### Dubai Trade vessel voyage schedule — **LOGIN**
- Documented as portal service for registered users; no anonymous JSON API found.

### Linescape — **CUSTOMER API**
- Schedule API for customers; not free-public.

---

## Interpretation for matching

| kind | Use on board | Soft leftover? |
|------|----------------|----------------|
| `schedule` | Show sailing/flight windows | **No** |
| `public_listing` | Show lane/service existence | **No** |
| `derived` | Weak live signal | **No** |
| `published` | Matchable soft capacity | **Yes** (carrier-asserted) |

