# Soft demand strategy — CargoMatch UAE → KSA MVP

**Soft demand** = shipper / forwarder *intent* to move freight **before** a hard booking: RFQs, tenders, recurring lanes, forecasted volume.  
Road-first corridor (Dubai / Jebel Ali / AUH / SHJ → Riyadh / Jeddah / Dammam / NEOM); air secondary.

Checked **2026-09-22 (Europe/Madrid)**. Be honest: public leftover RFQs are thin; **publish intake + ops relationships** are the real wedge.

---

## Ranked by realism

### A. Relationship / ops channels (highest yield for MVP)

| Who has demand | Why they’d share | MVP wedge tactic |
|----------------|------------------|------------------|
| **Forwarders / 3PLs** already brokering UAE–KSA road | They need backhaul fill + competitive carrier quotes; CargoMatch is a *channel*, not a competitor if you don’t steal the customer | Start with 5–10 desks that already run DJB↔RUH / Jebel Ali↔Jeddah. Offer: post soft RFQ once → get scored soft capacity (your ingest board). WhatsApp group → form/API mirror |
| **Shipper logistics / sales** (FMCG, electronics re-export, project cargo) | Recurring lanes; tired of phone RFQs | Pilot: weekly “lane forecast” (volume window + max rate) into `/api/demand/publish` |
| **Carrier sales** with empty return legs | They hear shipper intent first when hunting loads | Ask them to forward shipper WhatsApp RFQs into Demand Inbox (broker-as-publisher) |
| **Customs brokers / border agents** (Al Batha / King Fahd Causeway adjacent flows) | See paperwork demand before trucks move | Soft signal only — invite as “intent tip” publishers, not data scrape |

**Do this week:** WhatsApp / call list of UAE forwarders who already broker KSA; give them the Publish soft RFQ form; treat every message as a `kind=published` row. No fake board inflation.

### B. Public / digital signals we can ingest *now*

| Source | Soft demand? | Status (see SOURCES-DEMAND.md) |
|--------|--------------|--------------------------------|
| **LoadUp** public location HTML (`/locations/dubai-emirate`) | **Yes** (`public_rfq`) — shipper load cards incl. Dubai→Riyadh / Jeddah | **Works** (HTML scrape; API login-walled) |
| **BidsFactory** UAE / transport sector pages | **Partial** (`tender`) — mirrors UAE MOF / Dubai eSupply lots | **Works** with logistics keyword filter; often warehousing/goods, not lane RFQs |
| **Etimad** visitor tenders | Would be strong KSA gov demand | **Blocked** (TSPD bot wall); official API needs keys |
| **Dubai eSupply / UAE MOF DPP** | Gov logistics lots | **Login / DNS** — use aggregator for now |
| **Load-Me, TruKKer, Naql, Freightos** | Marketplace demand | **No public feed** / partner API only |

### C. Product intake (must-have regardless of scrapers)

`POST /api/demand/publish` + Demand Inbox form → `kind=published`, `confidence=shipper_published`.

This is the **reliable** soft-demand path (mirrors carrier publish on the supply side). Wire CargoMatch RFQ board to merge `published` + matchable ingested (`public_rfq`, `tender`) — **never** proxies into matching.

### D. Proxies that are **NOT** soft demand (but useful)

| Proxy | Use | Do not |
|-------|-----|--------|
| **UN Comtrade** ARE→SAU annual exports | Lane intensity / TAM narrative | Treat as RFQ |
| World Bank NE.EXP / NE.IMP | Macro export/import | Match trucks to it |
| AIS / port throughput | Congestion / vessel cadence | Infer shipper RFQs |
| Schedules (Saudia freighter, berthing) | Capacity *windows* | Confuse with demand |

Stored as `kind=proxy` with a loud “not soft demand” badge.

---

## Who has demand data (map)

```
Shippers ──RFQ──► Forwarders/3PLs ──tender/spot──► Carriers
   │                    │                              │
   │              WhatsApp groups                 soft capacity
   │              LoadUp / Naql / TruKKer         (your supply board)
   ▼                    ▼
Gov portals (Etimad, eSupply, MOF)     Trade stats (Comtrade) [proxy]
```

**Share incentives:** less empty phone time, faster quotes against *your* soft capacity, optional anonymity on public board, corridor specialization (UAE–KSA road docs).

---

## MVP wedge (recommended sequence)

1. **Shipper/forwarder publish** live (this package) — zero fake rows.  
2. **Ingest LoadUp** public UAE↔KSA listings as `public_rfq` for board density + demos.  
3. **Ops outbound:** 10 forwarders already on the lane; convert WhatsApp RFQs → publish API.  
4. **Tenders:** keep BidsFactory logistics filter as weak signal; pursue Etimad API keys only if gov freight tends are a segment.  
5. **Do not** wait on TruKKer/Freightos APIs for MVP truth.

---

## Matching policy

| kind | Show in Demand Inbox | Feed RFQ matcher |
|------|----------------------|------------------|
| `published` | Yes | **Yes** |
| `public_rfq` | Yes | Yes (label provenance) |
| `tender` | Yes | Optional / weak |
| `proxy` | Yes (badge) | **No** |
