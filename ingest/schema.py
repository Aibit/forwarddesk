"""SoftCapacity schema — aligns with CargoMatch CapacityOffer + provenance."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

KINDS = ("schedule", "public_listing", "published", "derived")
MODES = ("road", "air", "ocean", "road+air", "air+ocean")


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def new_id(prefix: str = "CAP") -> str:
    return f"{prefix}-{uuid4().hex[:10]}"


def agent_slug(carrier: str) -> str:
    base = "".join(ch for ch in carrier.split("(")[0].strip() if ch.isalnum())
    return f"CarrierAgent-{(base or 'Carrier')[:28]}"


def soft_capacity(
    *,
    carrier: str,
    mode: str,
    pickup_city: str,
    drop_city: str,
    kind: str,
    source: str,
    source_url: str,
    fetched_at: str | None = None,
    departure_window: str = "TBD",
    eta_hours: int = 0,
    available_weight_kg: int = 0,
    available_volume_cbm: float = 0.0,
    rate_min_usd: int = 0,
    rate_max_usd: int = 0,
    reliability: int = 50,
    docs_ok: bool = False,
    restricted_ok: bool = False,
    hazmat_ok: bool = False,
    status: str = "available",
    notes: str | None = None,
    confidence: str = "schedule_only",
    flight_or_voyage: str | None = None,
    raw: dict[str, Any] | None = None,
    id: str | None = None,
) -> dict[str, Any]:
    """Build a normalized SoftCapacity record.

    confidence:
      - schedule_only: published timetable; NOT leftover soft space
      - service_exists: route/service known; capacity unknown
      - live_traffic: observed movement; not bookable leftover
      - carrier_published: carrier asserted soft capacity via intake
    """
    if kind not in KINDS:
        raise ValueError(f"invalid kind {kind!r}")
    mode_n = mode if mode in MODES else "air"
    origin = pickup_city.strip()
    dest = drop_city.strip()
    rec: dict[str, Any] = {
        "id": id or new_id("CAP"),
        "carrier": carrier.strip() or "Unknown",
        "carrierAgent": agent_slug(carrier),
        "mode": mode_n,
        "lane": f"{origin} → {dest}",
        "pickupCity": origin,
        "dropCity": dest,
        "origin": origin,
        "destination": dest,
        "availableWeightKg": int(available_weight_kg or 0),
        "availableVolumeCbm": float(available_volume_cbm or 0),
        "rateMinUsd": int(rate_min_usd or 0),
        "rateMaxUsd": int(rate_max_usd or 0),
        "departureWindow": departure_window or "TBD",
        "etaHours": int(eta_hours or 0),
        "reliability": int(reliability or 50),
        "docsOk": bool(docs_ok),
        "restrictedOk": bool(restricted_ok),
        "hazmatOk": bool(hazmat_ok),
        "status": status or "available",
        "notes": notes,
        # provenance
        "kind": kind,
        "source": source,
        "source_url": source_url,
        "fetched_at": fetched_at or utc_now_iso(),
        "confidence": confidence,
        "flightOrVoyage": flight_or_voyage,
    }
    if raw is not None:
        rec["raw"] = raw
    return rec


def source_status(
    *,
    source_id: str,
    name: str,
    ok: bool,
    rows: int = 0,
    error: str | None = None,
    http_status: int | None = None,
    url: str | None = None,
    notes: str | None = None,
) -> dict[str, Any]:
    return {
        "id": source_id,
        "name": name,
        "ok": ok,
        "rows": rows,
        "error": error,
        "http_status": http_status,
        "url": url,
        "notes": notes,
        "checked_at": utc_now_iso(),
    }


DEMAND_KINDS = ("tender", "public_rfq", "published", "proxy")


def soft_demand(
    *,
    shipper_or_broker: str,
    origin: str,
    dest: str,
    kind: str,
    source: str,
    source_url: str,
    fetched_at: str | None = None,
    commodity: str | None = None,
    weight_kg: int | None = None,
    volume_cbm: float | None = None,
    window: str | None = None,
    max_price: int | None = None,
    notes: str | None = None,
    mode: str = "road",
    confidence: str = "public_listing",
    raw: dict[str, Any] | None = None,
    id: str | None = None,
) -> dict[str, Any]:
    """Build a normalized SoftDemand record.

    kind:
      - tender: public procurement / logistics lot
      - public_rfq: load-board / marketplace shipper listing
      - published: shipper/broker asserted via our intake
      - proxy: trade/stats signal — NOT soft demand (lane intensity only)
    """
    if kind not in DEMAND_KINDS:
        raise ValueError(f"invalid demand kind {kind!r}")
    o = origin.strip()
    d = dest.strip()
    rec: dict[str, Any] = {
        "id": id or new_id("DEM"),
        "shipper_or_broker": (shipper_or_broker or "Unknown").strip(),
        "shipper": (shipper_or_broker or "Unknown").strip(),  # RFQ-board alias
        "origin": o,
        "dest": d,
        "destination": d,
        "pickupCity": o,
        "dropCity": d,
        "lane": f"{o} → {d}",
        "commodity": commodity,
        "commodityLabel": commodity or "general",
        "weightKg": int(weight_kg) if weight_kg is not None else None,
        "volumeCbm": float(volume_cbm) if volume_cbm is not None else None,
        "window": window,
        "deadline": window or "",
        "max_price": int(max_price) if max_price is not None else None,
        "maxPriceUsd": int(max_price) if max_price is not None else 0,
        "notes": notes,
        "mode": mode if mode in MODES else "road",
        "status": "open",
        "hazmat": False,
        # provenance
        "kind": kind,
        "source": source,
        "source_url": source_url,
        "fetched_at": fetched_at or utc_now_iso(),
        "confidence": confidence,
    }
    if raw is not None:
        rec["raw"] = raw
    return rec
