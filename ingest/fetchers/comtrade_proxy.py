"""UN Comtrade public preview — UAE→KSA annual export value (PROXY only).

GET https://comtradeapi.un.org/public/v1/preview/C/A/HS?...
Works without API key (preview). Kind: proxy — trade intensity, NOT soft demand.
Multi-period queries return HTTP 400 — fetch years one at a time.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ..httputil import fetch
from ..schema import soft_demand, source_status, utc_now_iso

SOURCE_ID = "comtrade_uae_ksa"
SOURCE_NAME = "UN Comtrade UAE→KSA exports (proxy)"
PERIODS = ("2021", "2022", "2023")


def _url(period: str) -> str:
    return (
        "https://comtradeapi.un.org/public/v1/preview/C/A/HS"
        f"?reporterCode=784&partnerCode=682&period={period}&flowCode=X&cmdCode=TOTAL"
    )


def fetch_comtrade_uae_ksa(*, cache_dir: Path | None = None) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    del cache_dir
    fetched = utc_now_iso()
    rows: list[dict[str, Any]] = []
    errors: list[str] = []
    last_code = None
    last_url = _url(PERIODS[-1])

    for period in PERIODS:
        url = _url(period)
        last_url = url
        code, body, _ = fetch(url, timeout=45.0, accept="application/json")
        last_code = code
        if code != 200 or not body:
            errors.append(f"{period}: HTTP {code}")
            continue
        try:
            payload = json.loads(body.decode("utf-8", errors="replace"))
        except json.JSONDecodeError as e:
            errors.append(f"{period}: JSON {e}")
            continue
        for item in payload.get("data") or []:
            value = item.get("primaryValue") or item.get("fobvalue") or 0
            try:
                value_f = float(value)
            except (TypeError, ValueError):
                value_f = 0.0
            usd_b = value_f / 1e9
            rows.append(
                soft_demand(
                    id=f"DEM-comtrade-are-sau-x-{period}",
                    shipper_or_broker="UN Comtrade (aggregate trade)",
                    origin="United Arab Emirates",
                    dest="Saudi Arabia",
                    kind="proxy",
                    source=SOURCE_ID,
                    source_url=url,
                    fetched_at=fetched,
                    commodity="TOTAL (all HS)",
                    window=f"calendar year {period}",
                    notes=(
                        f"PROXY only — ARE→SAU merchandise exports ≈ USD {usd_b:.2f}B in {period}. "
                        "Implies corridor freight intensity; not an RFQ or tender."
                    ),
                    mode="road",
                    confidence="trade_stats_proxy",
                    raw={"period": period, "primaryValue": value_f, "flowCode": item.get("flowCode")},
                )
            )

    ok = len(rows) > 0
    return rows, source_status(
        source_id=SOURCE_ID,
        name=SOURCE_NAME,
        ok=ok,
        rows=len(rows),
        error="; ".join(errors) if errors and not rows else ("; ".join(errors) or None),
        http_status=last_code,
        url=last_url,
        notes="Public preview API (no key). PROXY — do not treat as soft demand."
        + (f" Partial: {'; '.join(errors)}" if errors and rows else ""),
    )
