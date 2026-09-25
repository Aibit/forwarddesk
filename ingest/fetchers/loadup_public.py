"""LoadUp UAE public location pages — shipper load listings.

Public HTML at https://loadupae.com/locations/dubai-emirate embeds load cards
and /loads/{slug}-{id} links. API /api/v1/loads redirects to login.

Kind: public_rfq — marketplace shipper intent (soft demand), not a hard booking.
Corridor: keep UAE↔KSA and UAE-origin loads; drop pure intra-UAE if desired
but we keep all Dubai-page shipper loads with provenance for honesty.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

from ..httputil import fetch
from ..schema import soft_demand, source_status, utc_now_iso

SOURCE_ID = "loadup_public"
SOURCE_NAME = "LoadUp public shipper loads (Dubai location page)"
LIST_URL = "https://loadupae.com/locations/dubai-emirate"
BASE = "https://loadupae.com"

# Destination / origin tokens that imply KSA corridor relevance
KSA_HINTS = ("riyadh", "jeddah", "dammam", "neom", "saudi", "ksa", "makkah", "madinah", "medina")
UAE_HINTS = (
    "dubai",
    "jebel ali",
    "abu dhabi",
    "sharjah",
    "ajman",
    "ras al khaimah",
    "fujairah",
    "uae",
    "united arab",
)


def _is_ksa(text: str) -> bool:
    t = text.lower()
    return any(h in t for h in KSA_HINTS)


def _is_uae(text: str) -> bool:
    t = text.lower()
    return any(h in t for h in UAE_HINTS)


def _parse_slug(slug: str) -> tuple[str, str] | None:
    """dubai-emirate-to-riyadh-region-364 → (Dubai Emirate, Riyadh Region)"""
    m = re.match(r"^(.+)-to-(.+)-(\d+)$", slug)
    if not m:
        return None
    origin = m.group(1).replace("-", " ").title()
    dest = m.group(2).replace("-", " ").title()
    # Normalize common UAE place phrasing
    origin = origin.replace("United Arab Emirates", "UAE")
    dest = dest.replace("United Arab Emirates", "UAE")
    return origin, dest


def _equipment_near(html: str, href: str) -> str | None:
    # Look a bit after the href for equipment labels
    idx = html.find(href)
    if idx < 0:
        return None
    chunk = html[idx : idx + 1200]
    for label in (
        "Container 40ft",
        "Container 20ft",
        "Reefer Truck",
        "Reefer",
        "Flatbed",
        "Curtain",
        "Pickup",
        "Any equipment",
    ):
        if label in chunk:
            return label
    return None


def _age_near(html: str, href: str) -> str | None:
    idx = html.find(href)
    if idx < 0:
        return None
    chunk = html[max(0, idx - 800) : idx + 200]
    m = re.search(r"(\d+\s+(?:day|days|month|months|hour|hours|week|weeks)\s+ago)", chunk, re.I)
    return m.group(1) if m else None


def fetch_loadup_public(*, cache_dir: Path | None = None) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    del cache_dir  # unused
    status_code, body, _ = fetch(LIST_URL, timeout=40.0, accept="text/html")
    if status_code != 200 or not body:
        return [], source_status(
            source_id=SOURCE_ID,
            name=SOURCE_NAME,
            ok=False,
            rows=0,
            error=f"HTTP {status_code} or empty body",
            http_status=status_code,
            url=LIST_URL,
            notes="Public location page failed",
        )

    html = body.decode("utf-8", errors="replace")
    # Links may be absolute (https://loadupae.com/loads/...) or relative (/loads/...)
    found = re.findall(r'(?:href=["\'])?(https?://loadupae\.com)?(/loads/[a-z0-9\-]+)', html, re.I)
    paths = []
    for _host, path in found:
        paths.append(path)
    # Also catch bare /loads/slug in HTML without relying on href=
    paths.extend(re.findall(r'/loads/[a-z0-9\-]+', html))

    seen: set[str] = set()
    rows: list[dict[str, Any]] = []
    fetched = utc_now_iso()

    for href in paths:
        if href in seen:
            continue
        seen.add(href)
        slug = href.rsplit("/", 1)[-1]
        parsed = _parse_slug(slug)
        if not parsed:
            continue
        origin, dest = parsed
        # Prefer corridor-relevant; still ingest UAE-origin shipper loads from this page
        corridor = (_is_uae(origin) and _is_ksa(dest)) or (_is_ksa(origin) and _is_uae(dest))
        equip = _equipment_near(html, href)
        age = _age_near(html, href)
        url = urljoin(BASE, href)
        notes_parts = []
        if equip:
            notes_parts.append(f"equipment: {equip}")
        if age:
            notes_parts.append(f"listed: {age}")
        if corridor:
            notes_parts.append("UAE↔KSA corridor")
        else:
            notes_parts.append("UAE-page listing (may be intra-GCC / other)")

        load_id = None
        m = re.search(r"-(\d+)$", slug)
        if m:
            load_id = f"DEM-loadup-{m.group(1)}"

        rows.append(
            soft_demand(
                id=load_id,
                shipper_or_broker="LoadUp shipper (public listing)",
                origin=origin,
                dest=dest,
                kind="public_rfq",
                source=SOURCE_ID,
                source_url=url,
                fetched_at=fetched,
                commodity=equip or "general freight",
                window=age or "flexible / see listing",
                notes="; ".join(notes_parts),
                mode="road",
                confidence="public_load_board",
                raw={"slug": slug, "list_url": LIST_URL, "corridor_uae_ksa": corridor},
            )
        )

    # Sort: corridor first
    rows.sort(key=lambda r: (0 if (r.get("raw") or {}).get("corridor_uae_ksa") else 1, r.get("id") or ""))

    return rows, source_status(
        source_id=SOURCE_ID,
        name=SOURCE_NAME,
        ok=True,
        rows=len(rows),
        http_status=status_code,
        url=LIST_URL,
        notes=(
            f"{sum(1 for r in rows if (r.get('raw') or {}).get('corridor_uae_ksa'))} UAE↔KSA; "
            "HTML scrape of public location page (API requires login)"
        ),
    )
