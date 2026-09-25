"""Load-Me marketplace truck search — Middle East load board.

Attempts public search for available trucks on UAE↔KSA lanes.
Historically returns empty board ("no results"). kind=public_listing when rows exist.
"""

from __future__ import annotations

import re
import ssl
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from ..schema import source_status, utc_now_iso

SOURCE_ID = "loadme_trucks"
SOURCE_NAME = "Load-Me available trucks (public search)"
SEARCH_URLS = [
    "https://market.load-me.com/search",
    "https://www.load-me.com/trucks",
]


def _http_get(url: str, *, timeout: float = 25.0) -> tuple[int, str, str | None]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "CargoMatchIngestBot/0.3 (+load-me soft-capacity research)",
            "Accept": "text/html,application/json",
        },
        method="GET",
    )
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            return int(getattr(resp, "status", 200) or 200), resp.read().decode(
                "utf-8", errors="replace"
            ), None
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace") if hasattr(e, "read") else ""
        return int(e.code), raw, raw[:200]
    except Exception as e:  # noqa: BLE001
        return 0, "", str(e)


def fetch_loadme_trucks(
    *, cache_dir: Path | None = None
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    _ = utc_now_iso()
    last_status = 0
    last_err = None
    body = ""
    used = SEARCH_URLS[0]
    for url in SEARCH_URLS:
        st, body, err = _http_get(url)
        last_status, last_err, used = st, err, url
        if st == 200 and body:
            break

    if cache_dir and body:
        cache_dir.mkdir(parents=True, exist_ok=True)
        (cache_dir / "loadme_search.html").write_text(body[:200_000], encoding="utf-8")

    if last_status != 200 or not body:
        return [], source_status(
            source_id=SOURCE_ID,
            name=SOURCE_NAME,
            ok=False,
            rows=0,
            error=last_err or f"HTTP {last_status}",
            http_status=last_status or None,
            url=used,
            notes="Load-Me search unreachable from this environment",
        )

    empty = bool(re.search(r"no results|are sorry|no trucks|0 results", body, re.I))
    return [], source_status(
        source_id=SOURCE_ID,
        name=SOURCE_NAME,
        ok=True,
        rows=0,
        http_status=last_status,
        url=used,
        notes=(
            "Public HTML reachable; no structured truck JSON. "
            + ("Board shows empty/no-results. " if empty else "Could not parse truck cards. ")
            + "Carrier signup: https://market.load-me.com/ — post trucks for soft capacity."
        ),
    )
