"""Saudia Cargo public freighter schedule CSV (Summer 2026).

Public media URL linked from https://www.saudiacargo.com/en/our-reach/our-network/schedule
Label: schedule — freighter timetable, NOT leftover soft space.
Corridor relevance: legs touching KSA hubs (JED/RUH/DMM) for air handoffs.
UAE origin freighter legs are rare in this file; still useful as KSA gateway capacity signal.
"""

from __future__ import annotations

import csv
import io
import re
from datetime import datetime
from typing import Any

from ..httputil import fetch
from ..schema import soft_capacity, source_status, utc_now_iso

SOURCE_ID = "saudia_cargo_freighter"
SOURCE_NAME = "Saudia Cargo freighter schedule CSV"
# Discovered linked from the public schedule page HTML (Aug 2026 media id).
CSV_URL = (
    "https://svcazureweb.azurewebsites.net/getmedia/"
    "3df29127-fb10-4614-9a5f-b5c8909357fe/"
    "SV-FREIGHTER-S-26-SCHEDULE_18-8-2026.csv?ext=.csv"
)
PAGE_URL = "https://www.saudiacargo.com/en/our-reach/our-network/schedule"

AIRPORT_CITY = {
    "JED": "Jeddah",
    "RUH": "Riyadh",
    "DMM": "Dammam",
    "DXB": "Dubai",
    "DWC": "Dubai World Central",
    "AUH": "Abu Dhabi",
    "SHJ": "Sharjah",
    "JFK": "New York JFK",
    "LGG": "Liège",
    "FRA": "Frankfurt",
    "AMS": "Amsterdam",
    "PVG": "Shanghai",
    "HKG": "Hong Kong",
    "NRT": "Tokyo Narita",
    "ICN": "Seoul Incheon",
    "BOM": "Mumbai",
    "DEL": "Delhi",
    "CAI": "Cairo",
    "IST": "Istanbul",
    "MXP": "Milan",
    "BRU": "Brussels",
}

KSA = {"JED", "RUH", "DMM"}
UAE = {"DXB", "DWC", "AUH", "SHJ"}


def _city(code: str) -> str:
    return AIRPORT_CITY.get(code, code)


def _parse_days(mask: str) -> str:
    """Saudia uses .....6. style (positions 1-7 = Mon-Sun, '.' off, digit on)."""
    names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    out = []
    for i, ch in enumerate((mask or "")[:7]):
        if ch and ch != ".":
            out.append(names[i])
    return ",".join(out) if out else (mask or "TBD")


def _eta_hours(block: str) -> int:
    m = re.match(r"^\s*(\d+):(\d+)\s*$", block or "")
    if not m:
        return 0
    return int(m.group(1)) + (1 if int(m.group(2)) >= 30 else 0)


def _window(eff: str, end: str, days: str, dep_time: str) -> str:
    days_h = _parse_days(days)
    return f"{eff}→{end} · {days_h} · dep {dep_time} LT"


def fetch_saudia_freighter(cache_dir=None) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    fetched_at = utc_now_iso()
    status_code, body, _ = fetch(
        CSV_URL, timeout=60, accept="text/csv,text/plain,*/*"
    )
    if status_code != 200 or not body or b"departure_airport" not in body[:500]:
        snippet = body[:200].decode("utf-8", errors="replace") if body else ""
        st = source_status(
            source_id=SOURCE_ID,
            name=SOURCE_NAME,
            ok=False,
            rows=0,
            error=f"HTTP {status_code}; body_prefix={snippet!r}",
            http_status=status_code,
            url=CSV_URL,
            notes="Public CSV linked from Saudia Cargo schedule page.",
        )
        return [], st

    text = body.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    rows: list[dict[str, Any]] = []
    for raw in reader:
        dep = (raw.get("departure_airport") or "").strip().upper()
        arr = (raw.get("arrival_airport") or "").strip().upper()
        if not dep or not arr:
            continue
        # Keep legs that touch KSA hubs (corridor / gateway relevance).
        # Also keep any UAE↔anywhere freighter if present.
        if not (dep in KSA or arr in KSA or dep in UAE or arr in UAE):
            continue
        # CSV header starts with empty first column (flight number).
        flight = ""
        for k, v in raw.items():
            if k is None or k == "" or str(k).lower() in {"flight", "flight_number"}:
                flight = (v or "").strip()
                if flight:
                    break
        if not flight:
            vals = list(raw.values())
            flight = (vals[0] or "").strip() if vals else ""

        corridor = "uae_ksa" if (dep in UAE and arr in KSA) or (dep in KSA and arr in UAE) else "ksa_hub_freighter"
        note = (
            "Freighter SCHEDULE only — not leftover soft space / bookable allotment. "
            f"Corridor tag: {corridor}. Source: Saudia Cargo public Summer-26 freighter CSV."
        )
        rec = soft_capacity(
            carrier="Saudia Cargo",
            mode="air",
            pickup_city=_city(dep),
            drop_city=_city(arr),
            kind="schedule",
            source=SOURCE_ID,
            source_url=PAGE_URL,
            fetched_at=fetched_at,
            departure_window=_window(
                raw.get("effective_date") or "",
                raw.get("end_date") or "",
                raw.get("days_of_operation") or "",
                raw.get("departure_time") or "",
            ),
            eta_hours=_eta_hours(raw.get("block_time") or ""),
            available_weight_kg=0,
            available_volume_cbm=0,
            reliability=70,
            notes=note,
            confidence="schedule_only",
            flight_or_voyage=flight or None,
            raw={
                "departure_airport": dep,
                "arrival_airport": arr,
                "sub_fleet": raw.get("sub_fleet"),
                "days_of_operation": raw.get("days_of_operation"),
                "effective_date": raw.get("effective_date"),
                "end_date": raw.get("end_date"),
                "corridor_tag": corridor,
            },
        )
        # Stable-ish id from flight+airports+days
        slug = re.sub(r"[^A-Za-z0-9]+", "", f"{flight}{dep}{arr}{raw.get('days_of_operation')}")
        rec["id"] = f"SVF-{slug[:18] or datetime.utcnow().strftime('%H%M%S')}"
        rows.append(rec)

    st = source_status(
        source_id=SOURCE_ID,
        name=SOURCE_NAME,
        ok=True,
        rows=len(rows),
        http_status=200,
        url=CSV_URL,
        notes=(
            "Parsed public freighter CSV. Rows limited to legs touching KSA/UAE airports. "
            "kind=schedule; weight/volume left 0 (unknown leftover)."
        ),
    )
    return rows, st
