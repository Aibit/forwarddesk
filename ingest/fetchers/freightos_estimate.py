"""Freightos public shippingCalculator — quote range estimates (NOT leftover soft space).

No API key required for marketplace estimates (100 calls/IP/hour). Requires clear
Freightos attribution per their docs. When numQuotes>0 we store a quote_availability
signal; zero quotes is still an honest API success.

Kind: public_listing, confidence: quote_estimate.
"""

from __future__ import annotations

import json
import ssl
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from ..schema import soft_capacity, source_status, utc_now_iso

SOURCE_ID = "freightos_estimate"
SOURCE_NAME = "Freightos marketplace quote estimates (UAE↔KSA)"
API = "https://ship.freightos.com/api/shippingCalculator"

LANES = [
    ("Dubai,United Arab Emirates", "Riyadh,Saudi Arabia", "Dubai", "Riyadh"),
    ("Dubai,United Arab Emirates", "Jeddah,Saudi Arabia", "Dubai", "Jeddah"),
    ("Abu Dhabi,United Arab Emirates", "Dammam,Saudi Arabia", "Abu Dhabi", "Dammam"),
    ("Jebel Ali,United Arab Emirates", "Riyadh,Saudi Arabia", "Jebel Ali", "Riyadh"),
]


def _call(origin: str, dest: str, *, timeout: float = 30.0) -> tuple[int, dict[str, Any] | None, str | None]:
    params = {
        "loadtype": "boxes",
        "weight": "500",
        "width": "80",
        "length": "120",
        "height": "100",
        "quantity": "4",
        "origin": origin,
        "destination": dest,
        "format": "json",
    }
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "CargoMatchIngestBot/0.2 (+Freightos estimate; research)",
            "Accept": "application/json",
        },
        method="GET",
    )
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            return int(getattr(resp, "status", 200) or 200), json.loads(raw), None
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace") if hasattr(e, "read") else ""
        return int(e.code), None, raw[:200]
    except Exception as e:  # noqa: BLE001
        return 0, None, str(e)


def _parse_modes(payload: dict[str, Any]) -> list[dict[str, Any]]:
    resp = payload.get("response") or payload
    efr = resp.get("estimatedFreightRates") or {}
    modes = efr.get("mode")
    if modes is None:
        return []
    if isinstance(modes, dict):
        modes = [modes]
    out = []
    for m in modes:
        if not isinstance(m, dict):
            continue
        price = (m.get("price") or {})
        mn = ((price.get("min") or {}).get("moneyAmount") or {}).get("amount")
        mx = ((price.get("max") or {}).get("moneyAmount") or {}).get("amount")
        tt = m.get("transitTimes") or {}
        out.append(
            {
                "mode": m.get("mode") or "unknown",
                "min": int(float(mn)) if mn not in (None, "") else 0,
                "max": int(float(mx)) if mx not in (None, "") else 0,
                "transit_min": int(float(tt["min"])) if tt.get("min") not in (None, "") else 0,
                "transit_max": int(float(tt["max"])) if tt.get("max") not in (None, "") else 0,
            }
        )
    return out


def fetch_freightos_estimate(*, cache_dir: Path | None = None) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    fetched = utc_now_iso()
    rows: list[dict[str, Any]] = []
    last_status = None
    errors: list[str] = []
    cache_blob: dict[str, Any] = {}

    for origin, dest, o_label, d_label in LANES:
        status, payload, err = _call(origin, dest)
        last_status = status
        key = f"{o_label}->{d_label}"
        if status != 200 or not payload:
            errors.append(f"{key}: HTTP {status} {err}")
            continue
        cache_blob[key] = payload
        modes = _parse_modes(payload)
        num = int(((payload.get("response") or {}).get("estimatedFreightRates") or {}).get("numQuotes") or 0)
        if not modes and num == 0:
            # Honest zero-quote row? Skip storing empty — note in status only.
            continue
        for m in modes:
            mode_map = {"air": "air", "LCL": "ocean", "FCL": "ocean", "LTL": "road", "FTL": "road", "express": "air"}
            rows.append(
                soft_capacity(
                    carrier=f"Freightos marketplace ({m['mode']})",
                    mode=mode_map.get(str(m["mode"]), "air"),
                    pickup_city=o_label,
                    drop_city=d_label,
                    kind="public_listing",
                    source=SOURCE_ID,
                    source_url="https://ship.freightos.com (credit: Freightos)",
                    fetched_at=fetched,
                    departure_window="estimate — not a booking hold",
                    eta_hours=int((m["transit_min"] or m["transit_max"] or 1) * 24) if m["transit_min"] or m["transit_max"] else 48,
                    available_weight_kg=0,  # unknown leftover
                    available_volume_cbm=0,
                    rate_min_usd=m["min"],
                    rate_max_usd=m["max"] or m["min"],
                    reliability=40,
                    notes=(
                        "QUOTE ESTIMATE only — not leftover soft capacity. "
                        "Attribution: Freightos https://www.freightos.com. Rate limit 100/IP/hour."
                    ),
                    confidence="quote_estimate",
                    raw={"lane": key, "mode": m, "numQuotes": num},
                )
            )

    if cache_dir and cache_blob:
        cache_dir.mkdir(parents=True, exist_ok=True)
        (cache_dir / "freightos_estimates.json").write_text(
            json.dumps(cache_blob, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    ok = last_status == 200 and not (errors and not rows and last_status != 200)
    # If rate-limited, fail honestly
    if last_status in (429, 1015) or any("1015" in e or "429" in e for e in errors):
        return [], source_status(
            source_id=SOURCE_ID,
            name=SOURCE_NAME,
            ok=False,
            rows=0,
            error="; ".join(errors) or f"HTTP {last_status}",
            http_status=last_status,
            url=API,
            notes="Rate limited (Cloudflare 1015 / 429). Retry later. Not soft capacity.",
        )
    if errors and not rows and last_status != 200:
        return [], source_status(
            source_id=SOURCE_ID,
            name=SOURCE_NAME,
            ok=False,
            rows=0,
            error="; ".join(errors),
            http_status=last_status,
            url=API,
            notes="Freightos estimate calls failed",
        )

    return rows, source_status(
        source_id=SOURCE_ID,
        name=SOURCE_NAME,
        ok=True,
        rows=len(rows),
        http_status=last_status,
        url=API,
        notes=(
            f"{len(rows)} quote-estimate row(s); {len(errors)} lane error(s). "
            "confidence=quote_estimate — NOT leftover soft space. Credit Freightos."
            + (f" Errors: {'; '.join(errors)}" if errors else "")
        ),
    )
