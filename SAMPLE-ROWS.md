# Sample normalized capacity rows (live ingest)

## Counts by source
```
{
  "carrier_publish_intake": 2,
  "inbound_whatsapp_demo": 1,
  "saudia_cargo_freighter": 63,
  "openflights_uae_ksa": 93,
  "adsb_fi_dxb": 18,
  "nqlyat_backhaul_hint": 20
}
```

## Counts by kind / confidence
```
kinds={'published': 3, 'schedule': 63, 'public_listing': 93, 'derived': 38}
confidence={'carrier_published': 3, 'schedule_only': 63, 'service_exists': 93, 'live_traffic': 18, 'derived_backhaul_imbalance': 20}
```

## Soft leftover?
- **Published soft capacity in store:** 3 (`kind=published` from earlier intake demos)
- **Nqlyat marketplace trucks tonight:** 0 (API healthy)
- **New derived signal:** 20 backhaul imbalance hints
- Schedules/listings remain non-soft

## Inbound parser check
```json
{
  "ok": true,
  "kind": "capacity",
  "fields": {
    "notes": "CAPACITY: Dubai → Riyadh | flatbed | 20t | available Thu | rate 4500 SAR",
    "mode": "road",
    "origin": "Dubai",
    "destination": "Riyadh",
    "dest": "Riyadh",
    "dropCity": "Riyadh",
    "pickupCity": "Dubai",
    "availableWeightKg": 20000,
    "rateMinUsd": 1215,
    "rateMaxUsd": 1215,
    "carrier": "WhatsApp/email carrier"
  },
  "warnings": [],
  "error": null
}
```

## Sample rows
```json
[
  {
    "id": "CAP-bh-e00f2e75-9fe",
    "carrier": "Backhaul hint (Nqlyat 371 fwd loads)",
    "lane": "Dubai → Jeddah",
    "kind": "derived",
    "confidence": "derived_backhaul_imbalance",
    "availableWeightKg": 0,
    "notes": "NOT soft leftover. Forward lane had loads_count=371, avg_price=12123. Reverse empty-truck opportunity hypothesized only.",
    "source": "nqlyat_backhaul_hint"
  },
  {
    "id": "CAP-69d361eff5",
    "carrier": "ClearPath Logistics",
    "lane": "Jebel Ali → Riyadh",
    "kind": "published",
    "confidence": "carrier_published",
    "availableWeightKg": 8000,
    "notes": "Soft return-leg space (publish test)",
    "source": "carrier_publish_intake"
  },
  {
    "id": "CAP-f6f8f3104a",
    "carrier": "Al Noor Transport",
    "lane": "CAPACITY: Dubai → Riyadh",
    "kind": "published",
    "confidence": "carrier_published",
    "availableWeightKg": 20000,
    "notes": "CAPACITY: Dubai → Riyadh | flatbed | 20t | available Thu | rate 4500 SAR\nCarrier: Al Noor Transport",
    "source": "inbound_whatsapp_demo"
  },
  {
    "id": "SVF-SV0902LGGRUH6",
    "carrier": "Saudia Cargo",
    "lane": "Liège → Riyadh",
    "kind": "schedule",
    "confidence": "schedule_only",
    "availableWeightKg": 0,
    "notes": "Freighter SCHEDULE only — not leftover soft space / bookable allotment. Corridor tag: ksa_hub_freighter. Source: Saudia Cargo public Summer-26 freighter CSV.",
    "source": "saudia_cargo_freighter"
  }
]
```
