# Product note — CargoMatch forwarder desk

## Wedge

**Primary user:** freight forwarder desk quoting shippers and buying carrier soft space.  
**Corridor:** UAE ↔ KSA (Dubai / Jebel Ali / Abu Dhabi / Sharjah ↔ Riyadh / Jeddah / Dammam / NEOM).  
**Modes:** road truck + air cargo handoff.  
**Problem:** Forwarders juggle customer RFQs (max sell) against buy-side soft capacity (rate bands, ETA, reliability, border/compliance). Margin is the desk KPI; humans still confirm with carriers — no auto-book / payments.

## What this prototype proves

1. **FF desk choreography is visible** — Desk / Sourcing / Pricing / Compliance / Exception leave an auditable ops trail.
2. **Quotes show BUY / SELL / MARGIN** — buy from capacity rate band; sell respects customer `maxPriceUsd` when possible; score prefers healthy margin that still fits max + compliance PASS.
3. **Compliance as a first-class veto** — restricted / hazmat / missing docs / pharma reliability thresholds kill a commercially attractive option before confirm.
4. **Exception → rematch in one loop** — broken plans free buy-side capacity and re-score the next-best option.
5. **Human confirm only** — “Confirm with carrier” on PASS; demo policy (no payments, no marketplace auto-book).

## Non-goals (explicit)

- Not a neutral shipper↔carrier marketplace; not cargo.one  
- No real bookings, customs, insurance, or settlement  
- Ocean/air **booking** APIs still require commercial credentials  
- Schedules/listings ingested are **not** leftover soft space  

## Capacity ingest (shipped)

Public soft-capacity **discovery** + carrier **publish intake** (`ingest/`, `/capacity`).  
Working sources: Saudia Cargo freighter CSV, OpenFlights UAE↔KSA routes, adsb.fi DXB traffic.  
See CAPACITY_SOURCES.md.

## Demand ingest (shipped)

Soft-demand **discovery** + shipper **publish intake** (`/demand`) — surfaces as customer RFQs on the desk.  
Working: LoadUp public loads (`public_rfq`), BidsFactory UAE logistics tenders, Comtrade ARE→SAU (**proxy**).  
Etimad / eSupply / TruKKer blocked or auth. Strategy: [DEMAND.md](./DEMAND.md).

## Next product steps

Programmable compliance packs per border, human-in-the-loop approval SLAs, credentialed DCSA/SeaRates schedule APIs, road TMS soft-space feeds, quote PDF / email handoff.
