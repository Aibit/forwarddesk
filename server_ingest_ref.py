#!/usr/bin/env python3
"""
CargoMatch ingest + publish intake (capacity + soft demand).
Python 3 stdlib only.

  python3 server.py
  → http://localhost:8090/           Capacity Inbox
  → http://localhost:8090/demand     Demand Inbox

Capacity:
  GET  /api/capacity
  POST /api/capacity/publish
  POST /api/ingest/run
  GET  /api/sources

Demand:
  GET  /api/demand
  POST /api/demand/publish
  POST /api/ingest/demand/run
  GET  /api/sources/demand
"""

from __future__ import annotations

import json
import mimetypes
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from ingest.runner import run_ingest  # noqa: E402
from ingest.demand_runner import run_demand_ingest  # noqa: E402
from ingest.schema import soft_capacity, soft_demand, utc_now_iso  # noqa: E402
from ingest.store import CapacityStore  # noqa: E402
from ingest.demand_store import DemandStore  # noqa: E402

DATA = ROOT / "data"
CACHE = ROOT / "cache"
STATIC = ROOT / "static"
PORT = int(os.environ.get("PORT", "8090"))

store = CapacityStore(DATA)
demand_store = DemandStore(DATA)


def _read_json(handler: BaseHTTPRequestHandler) -> dict:
    length = int(handler.headers.get("Content-Length") or 0)
    raw = handler.rfile.read(length) if length else b"{}"
    if not raw:
        return {}
    return json.loads(raw.decode("utf-8"))


def _truthy(v) -> bool:
    if isinstance(v, bool):
        return v
    return str(v).strip().lower() in {"1", "true", "yes", "y", "on"}


def _parse_body(handler: BaseHTTPRequestHandler) -> dict:
    ctype = (handler.headers.get("Content-Type") or "").lower()
    if "application/json" in ctype:
        return _read_json(handler)
    length = int(handler.headers.get("Content-Length") or 0)
    raw = handler.rfile.read(length) if length else b""
    qs = parse_qs(raw.decode("utf-8", errors="replace"))
    return {k: (v[0] if v else "") for k, v in qs.items()}


class Handler(BaseHTTPRequestHandler):
    server_version = "CargoMatchIngest/0.2"

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, code: int, payload: object) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self._cors()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _html(self, code: int, html: str) -> None:
        body = html.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self._cors()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        qs = parse_qs(urlparse(self.path).query)

        if path == "/api/health":
            self._json(
                200,
                {
                    "ok": True,
                    "service": "cargo-match-ingest",
                    "capacity_rows": len(store.all()),
                    "demand_rows": len(demand_store.all()),
                    "data": str(DATA),
                    "time": utc_now_iso(),
                },
            )
            return

        if path == "/api/capacity":
            rows = sorted(store.all(), key=lambda r: r.get("fetched_at") or "", reverse=True)
            self._json(200, rows)
            return

        if path == "/api/demand":
            rows = demand_store.all()
            kind_filter = (qs.get("kind") or [""])[0].strip()
            if kind_filter:
                rows = [r for r in rows if r.get("kind") == kind_filter]
            exclude_proxy = (qs.get("exclude_proxy") or [""])[0] in {"1", "true", "yes"}
            if exclude_proxy:
                rows = [r for r in rows if r.get("kind") != "proxy"]
            rows = sorted(rows, key=lambda r: r.get("fetched_at") or "", reverse=True)
            self._json(200, rows)
            return

        if path == "/api/sources":
            self._json(200, store.load_source_statuses())
            return

        if path == "/api/sources/demand":
            self._json(200, demand_store.load_source_statuses())
            return

        if path in {"/", "/capacity", "/capacity/", "/index.html"}:
            page = STATIC / "capacity.html"
            if page.exists():
                self._html(200, page.read_text(encoding="utf-8"))
            else:
                self._html(500, "<h1>capacity.html missing</h1>")
            return

        if path in {"/demand", "/demand/", "/demand.html"}:
            page = STATIC / "demand.html"
            if page.exists():
                self._html(200, page.read_text(encoding="utf-8"))
            else:
                self._html(500, "<h1>demand.html missing</h1>")
            return

        rel = path.lstrip("/")
        candidate = (STATIC / rel).resolve()
        try:
            candidate.relative_to(STATIC.resolve())
        except ValueError:
            self.send_error(403)
            return
        if candidate.is_file():
            ctype, _ = mimetypes.guess_type(str(candidate))
            data = candidate.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", ctype or "application/octet-stream")
            self.send_header("Content-Length", str(len(data)))
            self._cors()
            self.end_headers()
            self.wfile.write(data)
            return

        self._json(404, {"ok": False, "error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path

        if path == "/api/ingest/run":
            result = run_ingest(store, cache_dir=CACHE)
            self._json(200, result)
            return

        if path == "/api/ingest/demand/run":
            result = run_demand_ingest(demand_store, cache_dir=CACHE)
            self._json(200, result)
            return

        if path == "/api/capacity/publish":
            try:
                data = _parse_body(self)
            except Exception as e:  # noqa: BLE001
                self._json(400, {"ok": False, "error": f"bad body: {e}"})
                return

            carrier = str(data.get("carrier") or "").strip()
            origin = str(data.get("origin") or data.get("pickupCity") or "").strip()
            dest = str(data.get("destination") or data.get("dropCity") or "").strip()
            mode = str(data.get("mode") or "road").strip()
            if not carrier or not origin or not dest:
                self._json(
                    400,
                    {"ok": False, "error": "carrier, origin, destination are required"},
                )
                return

            try:
                weight = int(float(data.get("availableWeightKg") or 0))
            except ValueError:
                weight = 0
            try:
                volume = float(data.get("availableVolumeCbm") or 0)
            except ValueError:
                volume = 0.0
            try:
                rate_min = int(float(data.get("rateMinUsd") or 0))
                rate_max = int(float(data.get("rateMaxUsd") or rate_min))
            except ValueError:
                rate_min = rate_max = 0
            try:
                eta = int(float(data.get("etaHours") or 18))
            except ValueError:
                eta = 18

            row = soft_capacity(
                carrier=carrier,
                mode=mode,
                pickup_city=origin,
                drop_city=dest,
                kind="published",
                source="carrier_publish_intake",
                source_url="/api/capacity/publish",
                departure_window=str(data.get("departureWindow") or "TBD"),
                eta_hours=eta,
                available_weight_kg=weight,
                available_volume_cbm=volume,
                rate_min_usd=rate_min,
                rate_max_usd=rate_max,
                reliability=int(float(data.get("reliability") or 80)),
                docs_ok=_truthy(data.get("docsOk")),
                restricted_ok=_truthy(data.get("restrictedOk")),
                hazmat_ok=_truthy(data.get("hazmatOk")),
                notes=str(data.get("notes") or "").strip() or None,
                confidence="carrier_published",
                flight_or_voyage=str(data.get("flightOrVoyage") or "").strip() or None,
            )
            store.append_published(row)
            self._json(201, {"ok": True, "record": row})
            return

        if path == "/api/demand/publish":
            try:
                data = _parse_body(self)
            except Exception as e:  # noqa: BLE001
                self._json(400, {"ok": False, "error": f"bad body: {e}"})
                return

            shipper = str(
                data.get("shipper_or_broker")
                or data.get("shipper")
                or data.get("broker")
                or ""
            ).strip()
            origin = str(data.get("origin") or data.get("pickupCity") or "").strip()
            dest = str(
                data.get("dest")
                or data.get("destination")
                or data.get("dropCity")
                or ""
            ).strip()
            if not shipper or not origin or not dest:
                self._json(
                    400,
                    {
                        "ok": False,
                        "error": "shipper_or_broker, origin, dest are required",
                    },
                )
                return

            weight = None
            volume = None
            max_price = None
            try:
                if data.get("weightKg") not in (None, ""):
                    weight = int(float(data.get("weightKg")))
            except ValueError:
                weight = None
            try:
                if data.get("volumeCbm") not in (None, ""):
                    volume = float(data.get("volumeCbm"))
            except ValueError:
                volume = None
            try:
                if data.get("max_price") not in (None, "") or data.get("maxPriceUsd") not in (
                    None,
                    "",
                ):
                    max_price = int(
                        float(data.get("max_price") or data.get("maxPriceUsd") or 0)
                    )
            except ValueError:
                max_price = None

            row = soft_demand(
                shipper_or_broker=shipper,
                origin=origin,
                dest=dest,
                kind="published",
                source="shipper_publish_intake",
                source_url="/api/demand/publish",
                commodity=str(data.get("commodity") or "").strip() or None,
                weight_kg=weight,
                volume_cbm=volume,
                window=str(
                    data.get("window") or data.get("deadline") or "TBD"
                ).strip()
                or "TBD",
                max_price=max_price,
                notes=str(data.get("notes") or "").strip() or None,
                mode=str(data.get("mode") or "road").strip(),
                confidence="shipper_published",
            )
            demand_store.append_published(row)
            self._json(201, {"ok": True, "record": row})
            return

        self._json(404, {"ok": False, "error": "not found"})


def main() -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    httpd = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print("=" * 64)
    print("  CargoMatch · Capacity + Soft-demand ingest")
    print(f"  Capacity →  http://localhost:{PORT}/")
    print(f"  Demand   →  http://localhost:{PORT}/demand")
    print(f"  API      →  GET  /api/capacity  |  /api/demand")
    print(f"           →  POST /api/capacity/publish  |  /api/demand/publish")
    print(f"           →  POST /api/ingest/run  |  /api/ingest/demand/run")
    print(f"           →  GET  /api/sources  |  /api/sources/demand")
    print(f"  Store    →  {DATA / 'capacity.jsonl'}  |  {DATA / 'demand.jsonl'}")
    print("  Honesty: proxies ≠ soft demand; schedules ≠ soft leftover.")
    print("=" * 64)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        httpd.server_close()


if __name__ == "__main__":
    main()
