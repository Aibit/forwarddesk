# Product note — ForwardDesk

## Wedge

**Product:** ForwardDesk — sales + quoting tool for freight forwarders (pitch the lane, then lock buy/sell) — not only an ops matcher.  
**Primary user:** freight forwarder desk pitching shippers and buying carrier soft space.  
**Lane / corridor:** a **filter and data attribute** on RFQs and capacity — not the product identity. Demo seed includes UAE↔KSA plus other example lanes.  
**Modes:** road truck + air cargo handoff (ocean/air booking APIs still out of scope).  
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
- Not locked to a single corridor — lane is a desk filter

## Capacity ingest (shipped)

Public soft-capacity **discovery** + carrier **publish intake** (`ingest/`, `/capacity`).  
Working sources include Saudia Cargo freighter CSV, OpenFlights route samples, adsb.fi DXB traffic (demo feeds; more lanes welcome).  
See CAPACITY_SOURCES.md.

## Demand ingest (shipped)

Soft-demand **discovery** + shipper **publish intake** (`/demand`) — surfaces as customer RFQs on the desk.  
Working: LoadUp public loads (`public_rfq`), BidsFactory logistics tenders, Comtrade trade proxies.  
Etimad / eSupply / TruKKer blocked or auth. Strategy: [DEMAND.md](./DEMAND.md).

## Next product steps

Programmable compliance packs per border/lane, human-in-the-loop approval SLAs, credentialed DCSA/SeaRates schedule APIs, road TMS soft-space feeds, quote PDF / email handoff.
