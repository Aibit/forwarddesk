"""Nqlyat public_active_trucks / trucks — true soft leftover truck capacity (GCC).

Nqlyat (nqlyat.com) exposes a Supabase REST API. The anon key is embedded in their
public JS bundle (standard Supabase pattern). Tables:

  - public.public_active_trucks  (view of currently available trucks)
  - public.trucks                (carrier-posted available capacity)

When carriers post empty / available trucks, rows appear here with origin/dest,
truck_type, capacity_tons, available_date. That is soft leftover capacity.

Honesty: empty board ≠ failure. We record ok=True with rows=0 when the API works
but no trucks are listed. Kind=public_listing, confidence=marketplace_truck_offer.
"""

from __future__ import annotations

import json
import os
import ssl
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from ..schema import soft_capacity, source_status, utc_now_iso

SOURCE_ID = "nqlyat_trucks"
SOURCE_NAME = "Nqlyat available trucks (Supabase public)"
BASE = "https://cpsznhiaxkpgmjowpdfi.supabase.co/rest/v1"
# Public anon key from nqlyat.com frontend bundle (role=anon). Override via env.
DEFAULT_ANON = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwc3puaGlheGtwZ21qb3dwZGZpIiwicm9sZSI6ImFub24i"
    "LCJpYXQiOjE3NzA1MDQzOTgsImV4cCI6MjA4NjA4MDM5OH0."
    "B3YFl3gy-60iH7Ji35dmoiQJZ4meanvtlz9AuIhYpnY"
)

UAE = {"ae", "uae"}
KSA = {"sa", "ksa", "saudi"}


def _anon() -> str:
    return os.environ.get("NQLYAT_SUPABASE_ANON_KEY", DEFAULT_ANON).strip()


def _get(path_qs: str, *, timeout: float = 45.0) -> tuple[int, Any, str | None]:
    url = f"{BASE}/{path_qs}"
    anon = _anon()
    req = urllib.request.Request(
        url,
        headers={
            "apikey": anon,
            "Authorization": f"Bearer {anon}",
            "Accept": "application/json",
            "User-Agent": "CargoMatchIngestBot/0.2 (+nqlyat soft-capacity research)",
        },
        method="GET",
    )
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            body = resp.read()
            return int(getattr(resp, "status", 200) or 200), json.loads(body.decode("utf-8")), None
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace") if hasattr(e, "read") else ""
        try:
            parsed = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            parsed = raw
        return int(e.code), parsed, raw[:300]
    except Exception as e:  # noqa: BLE001
        return 0, None, str(e)


def _city(row: dict[str, Any], key: str) -> str:
    v = row.get(key) or row.get(key.replace("city", "region")) or ""
    return str(v).strip() or "Unknown"


def _corridor(row: dict[str, Any]) -> bool:
    oc = str(row.get("origin_country") or "").strip().lower()
    dc = str(row.get("dest_country") or "").strip().lower()
    if (oc in UAE and dc in KSA) or (oc in KSA and dc in UAE):
        return True
    blob = " ".join(str(row.get(k) or "") for k in row).lower()
    uae_h = ("dubai", "abu dhabi", "sharjah", "jebel", "uae", "دبي", "الشارقة", "جبل علي")
    ksa_h = ("riyadh", "jeddah", "dammam", "saudi", "الرياض", "جدة", "الدمام")
    return any(h in blob for h in uae_h) and any(h in blob for h in ksa_h)


def _weight_kg(row: dict[str, Any]) -> int:
    for k in ("weight_capacity_kg", "capacity_kg"):
        if row.get(k) not in (None, ""):
            try:
                return int(float(row[k]))
            except (TypeError, ValueError):
                pass
    if row.get("capacity_tons") not in (None, ""):
        try:
            return int(float(row["capacity_tons"]) * 1000)
        except (TypeError, ValueError):
            pass
    return 0


def _row_to_capacity(row: dict[str, Any], fetched: str) -> dict[str, Any]:
    origin = _city(row, "origin_city")
    dest = _city(row, "dest_city")
    truck = str(row.get("truck_type") or "truck").strip()
    carrier = (
        str(row.get("company_name") or row.get("contact_name") or "").strip()
        or f"Nqlyat carrier ({truck})"
    )
    avail = row.get("available_date") or row.get("available_now") or "see listing"
    notes_parts = [
        f"truck_type={truck}",
        f"status={row.get('status')}",
        "Nqlyat marketplace available-truck offer (soft capacity when listed)",
    ]
    if _corridor(row):
        notes_parts.append("UAE↔KSA corridor")
    # Do NOT store phone / contact PII in normalized notes
    safe_raw = {
        k: v
        for k, v in row.items()
        if k
        not in {
            "contact_phone",
            "contact_name",
            "phone",
            "phone_e164",
            "whatsapp",
        }
    }
    tid = str(row.get("id") or "")[:12]
    return soft_capacity(
        id=f"CAP-nqlyat-{tid}" if tid else None,
        carrier=carrier,
        mode="road",
        pickup_city=origin,
        drop_city=dest,
        kind="public_listing",
        source=SOURCE_ID,
        source_url=f"https://nqlyat.com/en/dashboard/find-trucks",
        fetched_at=fetched,
        departure_window=str(avail),
        eta_hours=24,
        available_weight_kg=_weight_kg(row),
        available_volume_cbm=0.0,
        rate_min_usd=0,
        rate_max_usd=0,
        reliability=55,
        notes="; ".join(notes_parts),
        confidence="marketplace_truck_offer",
        raw=safe_raw,
    )


def fetch_nqlyat_trucks(*, cache_dir: Path | None = None) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    fetched = utc_now_iso()
    # Prefer the public view; fall back to trucks table.
    status, data, err = _get("public_active_trucks?select=*&limit=1000")
    source_url = f"{BASE}/public_active_trucks"
    if status != 200 or not isinstance(data, list):
        status2, data2, err2 = _get("trucks?select=*&status=eq.available&limit=1000")
        if status2 == 200 and isinstance(data2, list):
            status, data, err = status2, data2, err2
            source_url = f"{BASE}/trucks?status=eq.available"
        else:
            return [], source_status(
                source_id=SOURCE_ID,
                name=SOURCE_NAME,
                ok=False,
                rows=0,
                error=err or err2 or f"HTTP {status}/{status2}",
                http_status=status or status2,
                url=source_url,
                notes="Supabase REST failed for public_active_trucks and trucks",
            )

    if cache_dir:
        cache_dir.mkdir(parents=True, exist_ok=True)
        (cache_dir / "nqlyat_trucks.json").write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    # Prefer UAE↔KSA; if none, keep all GCC available trucks (honest soft capacity elsewhere)
    corridor = [r for r in data if isinstance(r, dict) and _corridor(r)]
    chosen = corridor if corridor else [r for r in data if isinstance(r, dict)]
    rows = [_row_to_capacity(r, fetched) for r in chosen]

    return rows, source_status(
        source_id=SOURCE_ID,
        name=SOURCE_NAME,
        ok=True,
        rows=len(rows),
        http_status=status,
        url=source_url,
        notes=(
            f"API ok; {len(data)} truck row(s) total, {len(corridor)} UAE↔KSA. "
            "Empty board is real (no fabricated soft space). "
            "Anon key is public frontend key — ToS: research/demo use; do not abuse rate."
        ),
    )
