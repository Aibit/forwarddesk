"""Etimad visitor tenders — expected bot wall / auth.

https://tenders.etimad.sa/Tender/AllTendersForVisitor
Records failure honestly; zero fabricated rows.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from ..httputil import fetch
from ..schema import source_status

SOURCE_ID = "etimad_visitor"
SOURCE_NAME = "Etimad visitor tenders (KSA)"
URL = "https://tenders.etimad.sa/Tender/AllTendersForVisitor"


def fetch_etimad_visitor(*, cache_dir: Path | None = None) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    del cache_dir
    code, body, _ = fetch(URL, timeout=30.0, accept="text/html")
    text = (body or b"").decode("utf-8", errors="replace")
    blocked = (
        code != 200
        or "TSPD" in text
        or "bot" in text.lower()[:2000]
        or "captcha" in text.lower()
        or len(text) < 5000
        and "tender" not in text.lower()
    )
    # Heuristic: challenge pages are short / contain bobcmn / TSPD
    if "bobcmn" in text or "TSPD" in text or code in {403, 429, 503}:
        blocked = True

    if blocked or code != 200:
        return [], source_status(
            source_id=SOURCE_ID,
            name=SOURCE_NAME,
            ok=False,
            rows=0,
            error="Bot wall / challenge (TSPD) or non-200 — no public JSON without account",
            http_status=code,
            url=URL,
            notes="Official API via apiportal.etimad.sa requires subscription + keys",
        )

    # If somehow HTML listing is readable, we still do not invent structured lots
    # without a stable parser — leave empty with ok note.
    return [], source_status(
        source_id=SOURCE_ID,
        name=SOURCE_NAME,
        ok=True,
        rows=0,
        http_status=code,
        url=URL,
        notes="Page loaded but no reliable anonymous JSON feed; use developer portal API with keys",
    )
