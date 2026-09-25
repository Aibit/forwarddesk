"""Nqlyat active loads (UAE↔KSA) — soft DEMAND from marketplace / WhatsApp ingest.

Not soft capacity. Shippers post loads (often via WhatsApp → Nqlyat pipeline).
~1k+ active AE↔SA corridor loads observed 2026-09-22 via public anon REST.

Kind: public_rfq. PII (phones) stripped from stored rows.
"""

from __future__ import annotations

import json
import os
import ssl
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from ..schema import soft_demand, source_status, utc_now_iso

SOURCE_ID = "nqlyat_loads"
SOURCE_NAME = "Nqlyat active loads UAE↔KSA (Supabase public)"
BASE = "https://cpsznhiaxkpgmjowpdfi.supabase.co/rest/v1"
DEFAULT_ANON = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwc3puaGlheGtwZ21qb3dwZGZpIiwicm9sZSI6ImFub24i"
    "LCJpYXQiOjE3NzA1MDQzOTgsImV4cCI6MjA4NjA4MDM5OH0."
    "B3YFl3gy-60iH7Ji35dmoiQJZ4meanvtlz9AuIhYpnY"
)

SELECT = (
    "id,status,origin_country,origin_city,dest_country,dest_city,truck_type,load_type,"
    "weight_tons,price,currency,ready_date,created_at,expires_at,distance_km,"
    "commodity_type,source,source_kind,trucks_needed,is_urgent,short_code"
)


def _anon() -> str:
    return os.environ.get("NQLYAT_SUPABASE_ANON_KEY", DEFAULT_ANON).strip()


def _get(path_qs: str, *, timeout: float = 60.0) -> tuple[int, Any, str | None]:
    url = f"{BASE}/{path_qs}"
    anon = _anon()
    req = urllib.request.Request(
        url,
        headers={
            "apikey": anon,
            "Authorization": f"Bearer {anon}",
            "Accept": "application/json",
            "User-Agent": "CargoMatchIngestBot/0.2 (+nqlyat demand research)",
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


def _city(v: Any) -> str:
    s = str(v or "").strip()
    # "دبي - Dubai" → prefer Latin tail when present
    if " - " in s:
        parts = s.split(" - ", 1)
        if parts[1].strip():
            return parts[1].strip()
    return s or "Unknown"


def fetch_nqlyat_loads(*, cache_dir: Path | None = None) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    fetched = utc_now_iso()
    # Active AE↔SA or SA↔AE
    qs = (
        f"loads?select={SELECT}"
        "&or=(and(origin_country.eq.ae,dest_country.eq.sa),and(origin_country.eq.sa,dest_country.eq.ae))"
        "&status=eq.active"
        "&order=created_at.desc"
        "&limit=500"
    )
    status, data, err = _get(qs)
    url = f"{BASE}/loads (AE↔SA active)"
    if status not in (200, 206) or not isinstance(data, list):
        return [], source_status(
            source_id=SOURCE_ID,
            name=SOURCE_NAME,
            ok=False,
            rows=0,
            error=err or f"HTTP {status}",
            http_status=status,
            url=url,
            notes="Failed to list corridor loads",
        )

    if cache_dir:
        cache_dir.mkdir(parents=True, exist_ok=True)
        (cache_dir / "nqlyat_loads_uae_ksa.json").write_text(
            json.dumps(data[:200], ensure_ascii=False, indent=2), encoding="utf-8"
        )

    rows: list[dict[str, Any]] = []
    for r in data:
        if not isinstance(r, dict):
            continue
        origin = _city(r.get("origin_city"))
        dest = _city(r.get("dest_city"))
        weight = None
        if r.get("weight_tons") not in (None, ""):
            try:
                weight = int(float(r["weight_tons"]) * 1000)
            except (TypeError, ValueError):
                weight = None
        max_price = None
        if r.get("price") not in (None, "", 0, 0.0):
            try:
                # SAR → rough USD for board (not FX-accurate)
                sar = float(r["price"])
                max_price = int(sar * 0.27) if str(r.get("currency") or "SAR").upper() == "SAR" else int(sar)
            except (TypeError, ValueError):
                max_price = None
        src_kind = str(r.get("source_kind") or r.get("source") or "marketplace")
        tid = str(r.get("id") or "")[:12]
        notes = (
            f"truck_type={r.get('truck_type')}; load_type={r.get('load_type')}; "
            f"source={src_kind}; NOT soft capacity (shipper demand)"
        )
        rows.append(
            soft_demand(
                id=f"DEM-nqlyat-{tid}" if tid else None,
                shipper_or_broker="Nqlyat shipper (public listing)",
                origin=origin,
                dest=dest,
                kind="public_rfq",
                source=SOURCE_ID,
                source_url=f"https://nqlyat.com/en/l/{r.get('id')}" if r.get("id") else "https://nqlyat.com/en",
                fetched_at=fetched,
                commodity=str(r.get("commodity_type") or r.get("truck_type") or "general freight"),
                weight_kg=weight,
                window=str(r.get("ready_date") or r.get("expires_at") or "see listing"),
                max_price=max_price,
                notes=notes,
                mode="road",
                confidence="public_load_board",
                raw={
                    "id": r.get("id"),
                    "short_code": r.get("short_code"),
                    "origin_country": r.get("origin_country"),
                    "dest_country": r.get("dest_country"),
                    "truck_type": r.get("truck_type"),
                    "source": r.get("source"),
                    "source_kind": r.get("source_kind"),
                    "distance_km": r.get("distance_km"),
                    "trucks_needed": r.get("trucks_needed"),
                    "is_urgent": r.get("is_urgent"),
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
            f"{len(rows)} active AE↔SA loads (capped 500). Many source=whatsapp. "
            "Demand only — phones stripped. Anon key from public JS."
        ),
    )
