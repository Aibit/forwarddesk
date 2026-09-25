"""Run all soft-demand ingest fetchers."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Callable

from .fetchers import ALL_DEMAND_FETCHERS
from .schema import utc_now_iso
from .demand_store import DemandStore

Fetcher = Callable[..., tuple[list[dict[str, Any]], dict[str, Any]]]


def run_demand_ingest(
    store: DemandStore,
    *,
    cache_dir: Path | None = None,
    fetchers: list[Fetcher] | None = None,
) -> dict[str, Any]:
    cache = cache_dir or (store.root.parent / "cache")
    cache.mkdir(parents=True, exist_ok=True)

    statuses: list[dict[str, Any]] = []
    total_new = 0
    by_source: dict[str, int] = {}

    for fetch in fetchers or ALL_DEMAND_FETCHERS:
        try:
            rows, status = fetch(cache_dir=cache)
        except Exception as e:  # noqa: BLE001
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
            pass
        else:
            store.replace_source_rows(source, [])
            by_source[source] = 0

    store.save_source_statuses(statuses)
    return {
        "ok": True,
        "ran_at": utc_now_iso(),
        "sources": statuses,
        "rows_written_by_source": by_source,
        "total_demand_rows": len(store.all()),
        "ingested_this_run": total_new,
    }
