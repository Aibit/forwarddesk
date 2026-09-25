"""Nqlyat lane_market_averages → derived reverse-lane backhaul HINTS.

NOT soft leftover capacity. High load counts Jeddah→Dubai imply empty-truck
opportunity on Dubai→Jeddah, but no carrier has asserted space. kind=derived,
confidence=derived_backhaul_imbalance. Weight/volume left 0.
"""

from __future__ import annotations

import json
import os
import ssl
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from ..schema import soft_capacity, source_status, utc_now_iso

SOURCE_ID = "nqlyat_backhaul_hint"
SOURCE_NAME = "Nqlyat lane imbalance → reverse backhaul hints (derived)"
BASE = "https://cpsznhiaxkpgmjowpdfi.supabase.co/rest/v1"
DEFAULT_ANON = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwc3puaGlheGtwZ21qb3dwZGZpIiwicm9sZSI6ImFub24i"
    "LCJpYXQiOjE3NzA1MDQzOTgsImV4cCI6MjA4NjA4MDM5OH0."
    "B3YFl3gy-60iH7Ji35dmoiQJZ4meanvtlz9AuIhYpnY"
)

MIN_LOADS = 50  # only strong imbalance lanes


def _anon() -> str:
    return os.environ.get("NQLYAT_SUPABASE_ANON_KEY", DEFAULT_ANON).strip()


def _city(v: Any) -> str:
    s = str(v or "").strip()
    if " - " in s:
        lat = s.split(" - ", 1)[1].strip()
        if lat:
            return lat
    return s or "Unknown"


def _get(path_qs: str, *, timeout: float = 45.0) -> tuple[int, Any, str | None]:
    url = f"{BASE}/{path_qs}"
    anon = _anon()
    req = urllib.request.Request(
        url,
        headers={
            "apikey": anon,
            "Authorization": f"Bearer {anon}",
            "Accept": "application/json",
            "User-Agent": "CargoMatchIngestBot/0.3 (+backhaul-hint research)",
        },
        method="GET",
    )
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            return int(getattr(resp, "status", 200) or 200), json.loads(
                resp.read().decode("utf-8")
            ), None
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace") if hasattr(e, "read") else ""
        return int(e.code), None, raw[:300]
    except Exception as e:  # noqa: BLE001
        return 0, None, str(e)


def fetch_nqlyat_backhaul_hint(
    *, cache_dir: Path | None = None
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    fetched = utc_now_iso()
    qs = (
        "lane_market_averages?select=*"
        "&or=(and(origin_country.eq.ae,dest_country.eq.sa),"
        "and(origin_country.eq.sa,dest_country.eq.ae))"
        "&order=loads_count.desc"
        "&limit=80"
    )
    status, data, err = _get(qs)
    url = f"{BASE}/lane_market_averages (AE↔SA)"
    if status not in (200, 206) or not isinstance(data, list):
        return [], source_status(
            source_id=SOURCE_ID,
            name=SOURCE_NAME,
            ok=False,
            rows=0,
            error=err or f"HTTP {status}",
            http_status=status,
            url=url,
            notes="lane_market_averages fetch failed",
        )

    if cache_dir:
        cache_dir.mkdir(parents=True, exist_ok=True)
        (cache_dir / "nqlyat_lane_market_uae_ksa.json").write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    rows: list[dict[str, Any]] = []
    for lane in data:
        if not isinstance(lane, dict):
            continue
        try:
            loads = int(lane.get("loads_count") or 0)
        except (TypeError, ValueError):
            loads = 0
        if loads < MIN_LOADS:
            continue
        # Reverse the busy lane → hypothesized empty return
        origin = _city(lane.get("dest_city"))
        dest = _city(lane.get("origin_city"))
        avg = lane.get("avg_price")
        rate = 0
        try:
            if avg not in (None, ""):
                rate = int(float(avg) / 3.75)  # SAR→USD display only
        except (TypeError, ValueError):
            rate = 0
        lid = str(lane.get("id") or "")[:12]
        rows.append(
            soft_capacity(
                id=f"CAP-bh-{lid}" if lid else None,
                carrier=f"Backhaul hint (Nqlyat {loads} fwd loads)",
                mode="road",
                pickup_city=origin,
                drop_city=dest,
                kind="derived",
                source=SOURCE_ID,
                source_url="https://nqlyat.com/en",
                fetched_at=fetched,
                departure_window="derived from forward demand — verify with carriers",
                eta_hours=24,
                available_weight_kg=0,
                available_volume_cbm=0.0,
                rate_min_usd=rate,
                rate_max_usd=rate,
                reliability=35,
                notes=(
                    f"NOT soft leftover. Forward lane had loads_count={loads}, "
                    f"avg_price={avg}. Reverse empty-truck opportunity hypothesized only."
                ),
                confidence="derived_backhaul_imbalance",
                raw={
                    "forward_origin": lane.get("origin_city"),
                    "forward_dest": lane.get("dest_city"),
                    "loads_count": loads,
                    "avg_price": avg,
                    "avg_price_per_km": lane.get("avg_price_per_km"),
                },
            )
        )

    return rows, source_status(
        source_id=SOURCE_ID,
        name=SOURCE_NAME,
        ok=True,
        rows=len(rows),
        http_status=status,
        url=url,
        notes=(
            f"Derived reverse-lane hints from {len(data)} AE↔SA lane stats; "
            f"kept {len(rows)} with loads_count>={MIN_LOADS}. "
            "confidence=derived_backhaul_imbalance — NOT asserted soft space."
        ),
    )
