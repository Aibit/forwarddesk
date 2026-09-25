"""adsb.fi open data — live aircraft near Dubai (derived traffic signal).

https://opendata.adsb.fi — free ADS-B aggregate. Not bookable soft space.
We keep flights whose callsign prefix maps to carriers that operate UAE↔KSA
(EK/UAE Emirates, EY/ETD Etihad, SV/SVA Saudia, FZ/FDB flydubai, XY/KNE Flynas).
"""

from __future__ import annotations

import json
from typing import Any

from ..httputil import fetch
from ..schema import soft_capacity, source_status, utc_now_iso

SOURCE_ID = "adsb_fi_dxb"
SOURCE_NAME = "adsb.fi live traffic near Dubai"
# Dubai Intl approx
URL = "https://opendata.adsb.fi/api/v2/lat/25.25/lon/55.36/dist/120"

CARRIER_PREFIX = {
    "EK": "Emirates",
    "UAE": "Emirates",
    "EY": "Etihad Airways",
    "ETD": "Etihad Airways",
    "SV": "Saudia",
    "SVA": "Saudia",
    "FZ": "flydubai",
    "FDB": "flydubai",
    "XY": "flynas",
    "KNE": "flynas",
}


def _carrier_from_flight(flight: str) -> tuple[str | None, str]:
    f = (flight or "").strip().upper()
    if not f:
        return None, ""
    for pref in sorted(CARRIER_PREFIX.keys(), key=len, reverse=True):
        if f.startswith(pref):
            return CARRIER_PREFIX[pref], f
    return None, f


def fetch_adsb_dxb(cache_dir=None) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    fetched_at = utc_now_iso()
    status, body, _ = fetch(URL, timeout=40, accept="application/json")
    if status != 200 or not body:
        return [], source_status(
            source_id=SOURCE_ID,
            name=SOURCE_NAME,
            ok=False,
            error=f"HTTP {status}",
            http_status=status,
            url=URL,
        )
    try:
        data = json.loads(body.decode("utf-8", errors="replace"))
    except json.JSONDecodeError as e:
        return [], source_status(
            source_id=SOURCE_ID,
            name=SOURCE_NAME,
            ok=False,
            error=f"JSON parse: {e}",
            http_status=status,
            url=URL,
        )

    aircraft = data.get("aircraft") or data.get("ac") or []
    rows: list[dict[str, Any]] = []
    for ac in aircraft:
        flight = (ac.get("flight") or "").strip()
        carrier, callsign = _carrier_from_flight(flight)
        if not carrier:
            continue
        alt = ac.get("alt_baro") or ac.get("alt_geom") or 0
        # Observed near DXB — destination unknown from this endpoint.
        # Record as Dubai-area live movement for corridor carriers (derived).
        rec = soft_capacity(
            carrier=carrier,
            mode="air",
            pickup_city="Dubai (live ADS-B)",
            drop_city="Unknown (track only)",
            kind="derived",
            source=SOURCE_ID,
            source_url=URL,
            fetched_at=fetched_at,
            departure_window=f"Live ADS-B @ {fetched_at}",
            eta_hours=0,
            available_weight_kg=0,
            available_volume_cbm=0,
            reliability=40,
            notes=(
                "DERIVED from live ADS-B near Dubai for a UAE↔KSA-relevant carrier. "
                "Destination not provided by this endpoint — NOT bookable soft capacity. "
                f"callsign={callsign} type={ac.get('t')} alt={alt} gs={ac.get('gs')}."
            ),
            confidence="live_traffic",
            flight_or_voyage=callsign or None,
            raw={
                "hex": ac.get("hex"),
                "lat": ac.get("lat"),
                "lon": ac.get("lon"),
                "t": ac.get("t"),
                "r": ac.get("r"),
                "track": ac.get("track"),
            },
            id=f"ADSB-{(ac.get('hex') or callsign or 'x')[:10]}",
        )
        rows.append(rec)

    return rows, source_status(
        source_id=SOURCE_ID,
        name=SOURCE_NAME,
        ok=True,
        rows=len(rows),
        http_status=200,
        url=URL,
        notes=(
            f"Filtered {len(rows)}/{len(aircraft)} aircraft to EK/EY/SV/FZ/XY families. "
            "kind=derived; no destination → soft space unknown."
        ),
    )
