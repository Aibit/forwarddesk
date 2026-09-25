"""Run all ingest fetchers and persist normalized rows."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Callable

from .fetchers import ALL_FETCHERS
from .schema import utc_now_iso
from .store import CapacityStore

Fetcher = Callable[..., tuple[list[dict[str, Any]], dict[str, Any]]]


def run_ingest(
    store: CapacityStore,
    *,
    cache_dir: Path | None = None,
    fetchers: list[Fetcher] | None = None,
) -> dict[str, Any]:
    cache = cache_dir or (store.root.parent / "cache")
    cache.mkdir(parents=True, exist_ok=True)

    statuses: list[dict[str, Any]] = []
    total_new = 0
    by_source: dict[str, int] = {}

    for fetch in fetchers or ALL_FETCHERS:
        try:
            rows, status = fetch(cache_dir=cache)
        except Exception as e:  # noqa: BLE001 — isolate fetcher failures
            status = {
                "id": getattr(fetch, "__name__", "unknown"),
                "name": getattr(fetch, "__name__", "unknown"),
                "ok": False,
                "rows": 0,
                "error": f"exception: {e}",
                "http_status": None,
                "url": None,
                "notes": None,
                "checked_at": utc_now_iso(),
            }
            rows = []
        statuses.append(status)
        source = status.get("id") or "unknown"
        if rows:
            store.replace_source_rows(source, rows)
            total_new += len(rows)
            by_source[source] = len(rows)
        elif status.get("ok") is False:
            # Clear stale rows for failed sources? Keep previous successful data.
            pass
        else:
            # ok but empty — clear that source's prior rows
            store.replace_source_rows(source, [])
            by_source[source] = 0

    store.save_source_statuses(statuses)
    return {
        "ok": True,
        "ran_at": utc_now_iso(),
        "sources": statuses,
        "rows_written_by_source": by_source,
        "total_capacity_rows": len(store.all()),
        "ingested_this_run": total_new,
    }
