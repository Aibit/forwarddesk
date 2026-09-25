# Soft-demand sources tried (UAE → KSA)

Honesty log for CargoMatch demand ingest. **No fabricated “live RFQs.”**  
Kinds: `tender` | `public_rfq` | `published` | `proxy`.

Checked around **2026-09-22 (Europe/Madrid)**.

---

## Working (rows produced)

### 1. LoadUp public shipper loads — **WORKS**
- **ID:** `loadup_public`
- **Kind:** `public_rfq`
- **URL:** https://loadupae.com/locations/dubai-emirate  
- **Detail pattern:** https://loadupae.com/loads/{origin}-to-{dest}-{id}
- **What we get:** Public HTML cards + `/loads/...` links (e.g. Dubai Emirate → Riyadh Region, → Jeddah Region). Equipment labels when present.
- **API:** `https://loadupae.com/api/v1/loads` → **302 login**. No anonymous JSON.
- **Parse note:** listing HTML uses absolute `/loads/...` URLs; fetcher matches both absolute and relative paths.
- **Confidence:** `public_load_board` — marketplace intent, not a confirmed booking.
- **License / ToS:** Public marketing pages; for production redistribution confirm LoadUp terms; keep `source_url`.

### 2. BidsFactory UAE tenders — **WORKS** (noisy)
- **ID:** `bidsfactory_uae`
- **Kind:** `tender`
- **URLs:**  
  - https://bidsfactory.com/en/tenders/country/ae  
  - https://bidsfactory.com/en/tenders/sector/transport/country/ae
- **What we get:** Aggregated UAE MOF / Dubai eSupply notice titles + links. Logistics keyword + transport-sector filter.
- **Limit:** Many lots are parts/maintenance/warehousing — **not** UAE→KSA lane RFQs. Origin/dest set to “UAE (see tender)”.
- **Confidence:** `tender_aggregator`.

### 3. UN Comtrade UAE→KSA exports — **WORKS** (PROXY)
- **ID:** `comtrade_uae_ksa`
- **Kind:** `proxy`
- **URL pattern:** `.../preview/C/A/HS?reporterCode=784&partnerCode=682&period={year}&flowCode=X&cmdCode=TOTAL` (years fetched separately; comma-joined periods → HTTP 400)
- **What we get:** Annual ARE→SAU merchandise export value (2021≈26.6B, 2022≈28.1B, 2023≈29.5B USD FOB).
- **Confidence:** `trade_stats_proxy` — **not soft demand**.

### 4. Shipper publish intake — **WORKS** (first-party)
- **Source:** `shipper_publish_intake`
- **Kind:** `published`
- **Endpoint:** `POST /api/demand/publish`
- **Confidence:** `shipper_published`

---

## Attempted — failed / blocked / auth

### Etimad visitor tenders — **BLOCKED**
- https://tenders.etimad.sa/Tender/AllTendersForVisitor → TSPD / bot challenge HTML.
- Official: https://apiportal.etimad.sa — Tenders Inquiry Service needs subscription + API keys (“Soon” / gated).

### Dubai eSupply — **LOGIN / 404**
- `esupply.dubai.gov.ae/web/login.html` → 404 from this box; portal expects registered suppliers.

### UAE MOF Digital Procurement — **UNUSABLE ANON**
- `procurement.mof.gov.ae` DNS fail from this environment; MOF marketing pages only.

### Load-Me marketplace — **NO PUBLIC FEED**
- https://market.load-me.com/ marketing 200; search UI; no anonymous loads JSON found.

### TruKKer / Naql / Freightos load boards — **PARTNER / AUTH**
- Commercial / app load boards; no public open feed documented for anonymous ingest.

### World Bank indicators — **WORKS but PROXY only**
- `api.worldbank.org/.../NE.EXP.GNFS.CD` etc. Macro exports/imports — not ingested as soft demand (Comtrade already covers corridor proxy).

---

## Interpretation for matching

| kind | Soft demand? | Use on RFQ board |
|------|--------------|------------------|
| `published` | **Yes** (asserted) | Match |
| `public_rfq` | Yes (weak) | Match with badge |
| `tender` | Maybe | Optional / weak |
| `proxy` | **No** | Demand Inbox only |

## Nqlyat active loads UAE↔KSA — **WORKS**
- **ID:** `nqlyat_loads`
- **Kind:** `public_rfq`
- **API:** Supabase REST `loads?origin/dest AE↔SA&status=eq.active`
- **Scale:** 1000+ corridor actives (2026-09-22); many `source=whatsapp`
- **PII:** phones stripped in fetcher
- **Note:** Soft **demand**, not capacity.
