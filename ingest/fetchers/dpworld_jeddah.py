"""DP World Jeddah public berthing schedule — attempt + honest failure record.

Public UI: https://dpworld.sa/berthingschedule
Backend (from Angular controller): GET /api/BerthingScheduleApi/GetBerthingSchedule
Cloudflare frequently blocks non-browser / datacenter clients on the API path.
"""

from __future__ import annotations

import json
from datetime import date, timedelta
from typing import Any
from urllib.parse import urlencode

from ..httputil import fetch
from ..schema import soft_capacity, source_status, utc_now_iso

SOURCE_ID = "dpworld_jeddah_berth"
SOURCE_NAME = "DP World Jeddah berthing schedule"
PAGE_URL = "https://dpworld.sa/berthingschedule"
API_PATH = "https://dpworld.sa/api/BerthingScheduleApi/GetBerthingSchedule"


def fetch_dpworld_jeddah(cache_dir=None) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    fetched_at = utc_now_iso()
    today = date.today()
    start = today.strftime("%d/%m/%Y")
    end = (today + timedelta(days=7)).strftime("%d/%m/%Y")
    url = API_PATH + "?" + urlencode({"StartDate": start, "EndDate": end})

    # Warm-up page (cookie / cf_bm) then API
    page_status, _, _ = fetch(PAGE_URL, timeout=30, accept="text/html")
    api_status, body, _ = fetch(
        url,
        timeout=30,
        accept="application/json",
        headers={
            "Referer": PAGE_URL,
            "X-Requested-With": "XMLHttpRequest",
        },
    )

    if api_status != 200:
        return [], source_status(
            source_id=SOURCE_ID,
            name=SOURCE_NAME,
            ok=False,
            rows=0,
            error=(
                f"API HTTP {api_status} after page HTTP {page_status}. "
                "Likely Cloudflare bot protection on /api/*."
            ),
            http_status=api_status,
            url=url,
            notes=(
                "Angular UI calls api/BerthingScheduleApi/GetBerthingSchedule with "
                "StartDate/EndDate. Endpoint exists but is not reliably fetchable "
                "without a browser challenge. No fabricated berthing rows stored."
            ),
        )

    try:
        data = json.loads(body.decode("utf-8", errors="replace"))
    except json.JSONDecodeError as e:
        return [], source_status(
            source_id=SOURCE_ID,
            name=SOURCE_NAME,
            ok=False,
            error=f"JSON parse failed: {e}",
            http_status=api_status,
            url=url,
        )

    if not data.get("Success"):
        return [], source_status(
            source_id=SOURCE_ID,
            name=SOURCE_NAME,
            ok=False,
            error=f"Success=false payload keys={list(data)[:12]}",
            http_status=api_status,
            url=url,
        )

    upcoming = data.get("UpcomingVessel") or []
    on_berth = data.get("VesselOnBerth") or []
    rows: list[dict[str, Any]] = []
    for v in list(upcoming) + list(on_berth):
        name = (v.get("VesselName") or "Unknown vessel").strip()
        voyage = (v.get("VoyageNo") or "").strip()
        eta = v.get("eta") or v.get("ATA") or v.get("ata") or ""
        etd = v.get("etd") or v.get("ETD") or ""
        rec = soft_capacity(
            carrier=f"Vessel {name}",
            mode="ocean",
            pickup_city="Jeddah (DP World)",
            drop_city="Port call (berthing)",
            kind="schedule",
            source=SOURCE_ID,
            source_url=PAGE_URL,
            fetched_at=fetched_at,
            departure_window=f"ETA {eta} · ETD {etd}".strip(" ·"),
            eta_hours=0,
            notes=(
                "Port berthing SCHEDULE — vessel call, not leftover container soft space. "
                f"Voyage={voyage}."
            ),
            confidence="schedule_only",
            flight_or_voyage=voyage or name,
            raw=v,
            id=f"DPWJ-{(v.get('Visit_RefNo') or voyage or name)[:16]}".replace(" ", ""),
        )
        rows.append(rec)

    return rows, source_status(
        source_id=SOURCE_ID,
        name=SOURCE_NAME,
        ok=True,
        rows=len(rows),
        http_status=200,
        url=url,
        notes="Parsed UpcomingVessel + VesselOnBerth. kind=schedule.",
    )
