"""BidsFactory UAE tender index — aggregator of UAE MOF / Dubai eSupply notices.

Public HTML listing at https://bidsfactory.com/en/tenders/country/ae
Official portals (eSupply, Etimad, MOF DPP) need login or bot walls; this
aggregator is the workable public mirror for logistics-adjacent lots.

Kind: tender — procurement intent (soft demand if logistics-related; others
kept only when keyword-filtered for transport/logistics/freight/warehousing).
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

from ..httputil import fetch
from ..schema import soft_demand, source_status, utc_now_iso

SOURCE_ID = "bidsfactory_uae"
SOURCE_NAME = "BidsFactory UAE tenders (logistics filter)"
LIST_URL = "https://bidsfactory.com/en/tenders/country/ae"
TRANSPORT_URL = "https://bidsfactory.com/en/tenders/sector/transport/country/ae"
BASE = "https://bidsfactory.com"

LOGISTICS_RE = re.compile(
    r"transport|logistic|freight|warehous|cargo|shipping|truck|fleet|"
    r"customs|distribution|haulage|container|cold.?chain|storage",
    re.I,
)


def _titles_from(html: str) -> list[tuple[str, str]]:
    """Return (path, title) pairs for tender detail links."""
    pairs = re.findall(
        r'href="(/en/tenders/(?!sector/|country/|region/|source/|categories|browse)[^"]+)"[^>]*>([^<]{3,220})',
        html,
    )
    out: list[tuple[str, str]] = []
    seen: set[str] = set()
    for path, title in pairs:
        if path in seen:
            continue
        title = (
            title.replace("&amp;", "&")
            .replace("&#x27;", "'")
            .replace("&quot;", '"')
            .strip()
        )
        if not title or title.lower().startswith("view all"):
            continue
        seen.add(path)
        out.append((path, title))
    return out


def fetch_bidsfactory_uae(*, cache_dir: Path | None = None) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    del cache_dir
    fetched = utc_now_iso()
    rows: list[dict[str, Any]] = []
    errors: list[str] = []
    http_ok = None

    for url in (TRANSPORT_URL, LIST_URL):
        code, body, _ = fetch(url, timeout=40.0, accept="text/html")
        http_ok = code if http_ok is None else http_ok
        if code != 200 or not body:
            errors.append(f"{url} → HTTP {code}")
            continue
        html = body.decode("utf-8", errors="replace")
        for path, title in _titles_from(html):
            # Prefer logistics keyword match; transport sector page already scoped
            from_transport = "sector/transport" in url
            if not from_transport and not LOGISTICS_RE.search(title) and not LOGISTICS_RE.search(path):
                continue
            full = urljoin(BASE, path)
            # Stable id from path slug tail
            slug = path.rstrip("/").rsplit("/", 1)[-1]
            dem_id = f"DEM-bf-{slug[-24:]}"
            # Avoid dupes across the two pages
            if any(r.get("source_url") == full for r in rows):
                continue
            source_tag = "uae_mof" if "uae_mof" in path else (
                "dubai_esupply" if "dubai_esupply" in path else "bidsfactory"
            )
            rows.append(
                soft_demand(
                    id=dem_id,
                    shipper_or_broker=f"UAE public procurement ({source_tag})",
                    origin="UAE (see tender)",
                    dest="UAE / GCC (see tender)",
                    kind="tender",
                    source=SOURCE_ID,
                    source_url=full,
                    fetched_at=fetched,
                    commodity="logistics/procurement lot",
                    window="see tender deadline on source",
                    notes=f"{title} · mirrored via BidsFactory from {source_tag}",
                    mode="road",
                    confidence="tender_aggregator",
                    raw={"title": title, "path": path, "list_url": url},
                )
            )

    ok = len(rows) > 0 or not errors
    return rows, source_status(
        source_id=SOURCE_ID,
        name=SOURCE_NAME,
        ok=ok if rows or not errors else False,
        rows=len(rows),
        error="; ".join(errors) if errors and not rows else None,
        http_status=http_ok,
        url=LIST_URL,
        notes=(
            "Aggregator of UAE MOF / Dubai eSupply; keyword+transport sector filter. "
            "Lots are often goods/services — not lane-specific RFQs."
            + (f" Partial errors: {'; '.join(errors)}" if errors and rows else "")
        ),
    )
