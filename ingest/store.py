"""JSONL + optional SQLite capacity store."""

from __future__ import annotations

import json
import sqlite3
import threading
from pathlib import Path
from typing import Any

from .schema import utc_now_iso

_lock = threading.RLock()


class CapacityStore:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)
        self.jsonl_path = self.root / "capacity.jsonl"
        self.db_path = self.root / "capacity.db"
        self.status_path = self.root / "sources_status.json"
        self._init_db()

    def _init_db(self) -> None:
        with _lock:
            con = sqlite3.connect(self.db_path)
            try:
                con.execute(
                    """
                    CREATE TABLE IF NOT EXISTS capacity (
                        id TEXT PRIMARY KEY,
                        kind TEXT,
                        source TEXT,
                        fetched_at TEXT,
                        payload TEXT NOT NULL
                    )
                    """
                )
                con.execute(
                    """
                    CREATE TABLE IF NOT EXISTS source_runs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        source_id TEXT,
                        checked_at TEXT,
                        ok INTEGER,
                        rows INTEGER,
                        error TEXT,
                        payload TEXT
                    )
                    """
                )
                con.commit()
            finally:
                con.close()

    def replace_source_rows(self, source: str, rows: list[dict[str, Any]]) -> None:
        """Replace all non-published rows for a given ingest source."""
        with _lock:
            existing = self._read_all_unlocked()
            kept = [
                r
                for r in existing
                if r.get("kind") == "published" or r.get("source") != source
            ]
            kept.extend(rows)
            self._rewrite_unlocked(kept)

    def append_published(self, row: dict[str, Any]) -> dict[str, Any]:
        with _lock:
            rows = self._read_all_unlocked()
            rows.append(row)
            self._rewrite_unlocked(rows)
            return row

    def all(self) -> list[dict[str, Any]]:
        with _lock:
            return self._read_all_unlocked()

    def _read_all_unlocked(self) -> list[dict[str, Any]]:
        if not self.jsonl_path.exists():
            return []
        out: list[dict[str, Any]] = []
        with self.jsonl_path.open(encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    out.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
        return out

    def _rewrite_unlocked(self, rows: list[dict[str, Any]]) -> None:
        tmp = self.jsonl_path.with_suffix(".jsonl.tmp")
        with tmp.open("w", encoding="utf-8") as f:
            for r in rows:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        tmp.replace(self.jsonl_path)

        con = sqlite3.connect(self.db_path)
        try:
            con.execute("DELETE FROM capacity")
            con.executemany(
                "INSERT INTO capacity (id, kind, source, fetched_at, payload) VALUES (?,?,?,?,?)",
                [
                    (
                        r.get("id"),
                        r.get("kind"),
                        r.get("source"),
                        r.get("fetched_at"),
                        json.dumps(r, ensure_ascii=False),
                    )
                    for r in rows
                ],
            )
            con.commit()
        finally:
            con.close()

    def save_source_statuses(self, statuses: list[dict[str, Any]]) -> None:
        with _lock:
            payload = {"updated_at": utc_now_iso(), "sources": statuses}
            self.status_path.write_text(
                json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8"
            )
            con = sqlite3.connect(self.db_path)
            try:
                for s in statuses:
                    con.execute(
                        "INSERT INTO source_runs (source_id, checked_at, ok, rows, error, payload) VALUES (?,?,?,?,?,?)",
                        (
                            s.get("id"),
                            s.get("checked_at"),
                            1 if s.get("ok") else 0,
                            int(s.get("rows") or 0),
                            s.get("error"),
                            json.dumps(s, ensure_ascii=False),
                        ),
                    )
                con.commit()
            finally:
                con.close()

    def load_source_statuses(self) -> dict[str, Any]:
        if not self.status_path.exists():
            return {"updated_at": None, "sources": []}
        try:
            return json.loads(self.status_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {"updated_at": None, "sources": []}
