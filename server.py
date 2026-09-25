#!/usr/bin/env python3
"""
ForwardDesk unified server — board UI + capacity/demand ingest APIs.

Python 3 stdlib only. Bind 0.0.0.0; PORT from env (default 8080).

  PORT=8080 python3 server.py
  → http://localhost:8080/           Match board (dist/)
  → http://localhost:8080/capacity   Capacity Inbox
  → http://localhost:8080/demand     Demand Inbox
"""

from __future__ import annotations

import csv
import json
import mimetypes
import os
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from ingest.runner import run_ingest  # noqa: E402
from ingest.demand_runner import run_demand_ingest  # noqa: E402
from ingest.schema import soft_capacity, soft_demand, utc_now_iso  # noqa: E402
from ingest.inbound_parse import parse_inbound_text  # noqa: E402
from ingest.store import CapacityStore  # noqa: E402
from ingest.demand_store import DemandStore  # noqa: E402

DATA = ROOT / "data"
CACHE = ROOT / "cache"
STATIC = ROOT / "static"
DIST = ROOT / "dist"
TMS = ROOT / "tms-stub"
CAPACITY_CSV = TMS / "capacity.csv"
RFQS_CSV = TMS / "rfqs.csv"
PORT = int(os.environ.get("PORT", "8080"))

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


def _num(val: str | None, default: float = 0) -> float:
    if val is None or str(val).strip() == "":
        return default
    try:
        return float(str(val).strip())
    except ValueError:
        return default


def _agent_slug(carrier: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9]+", "", carrier.split("(")[0].strip())
    if not slug:
        slug = "Carrier"
    return f"CarrierAgent-{slug[:28]}"


def read_tms_capacity() -> list[dict]:
    if not CAPACITY_CSV.exists():
        return []
    rows: list[dict] = []
    with CAPACITY_CSV.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for raw in reader:
            origin = (raw.get("origin") or raw.get("pickupCity") or "").strip()
            dest = (raw.get("destination") or raw.get("dropCity") or "").strip()
            carrier = (raw.get("carrier") or "Unknown Carrier").strip()
            mode = (raw.get("mode") or "road").strip()
            d_start = (raw.get("departureStart") or "").strip()
            d_end = (raw.get("departureEnd") or "").strip()
            if d_start and d_end:
                window = f"{d_start}–{d_end.split()[-1] if ' ' in d_end else d_end} GST"
            elif d_start:
                window = f"{d_start} GST"
            else:
                window = (raw.get("departureWindow") or "").strip() or "TBD"
            rows.append(
                {
                    "id": (raw.get("id") or "").strip() or f"CAP-{len(rows)+1}",
                    "carrier": carrier,
                    "carrierAgent": (raw.get("carrierAgent") or "").strip()
                    or _agent_slug(carrier),
                    "mode": mode if mode in {"road", "air", "road+air"} else "road",
                    "lane": (raw.get("lane") or "").strip() or f"{origin} → {dest}",
                    "pickupCity": origin,
                    "dropCity": dest,
                    "origin": origin,
                    "destination": dest,
                    "availableWeightKg": int(_num(raw.get("availableWeightKg"))),
                    "availableVolumeCbm": _num(raw.get("availableVolumeCbm")),
                    "rateMinUsd": int(_num(raw.get("rateMinUsd"))),
                    "rateMaxUsd": int(_num(raw.get("rateMaxUsd"))),
                    "departureWindow": window,
                    "etaHours": int(_num(raw.get("etaHours"), 18)),
                    "reliability": int(_num(raw.get("reliability"), 80)),
                    "docsOk": _truthy(raw.get("borderDocsOk") or raw.get("docsOk")),
                    "restrictedOk": _truthy(
                        raw.get("restrictedCapable") or raw.get("restrictedOk")
                    ),
                    "hazmatOk": _truthy(
                        raw.get("hazmatCapable") or raw.get("hazmatOk")
                    ),
                    "status": (raw.get("status") or "available").strip() or "available",
                    "notes": (raw.get("notes") or "").strip() or None,
                    "kind": "tms_stub",
                    "source": "tms-stub/capacity.csv",
                }
            )
    return rows


def read_tms_rfqs() -> list[dict]:
    if not RFQS_CSV.exists():
        return []
    rows: list[dict] = []
    with RFQS_CSV.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for raw in reader:
            commodity = (raw.get("commodity") or "general").strip()
            rows.append(
                {
                    "id": (raw.get("id") or "").strip() or f"RFQ-{len(rows)+1}",
                    "shipper": (raw.get("shipper") or "Unknown Shipper").strip(),
                    "commodity": commodity,
                    "commodityLabel": (raw.get("commodityLabel") or commodity).strip(),
                    "weightKg": int(_num(raw.get("weightKg"))),
                    "volumeCbm": _num(raw.get("volumeCbm")),
                    "pickupCity": (raw.get("pickupCity") or "").strip(),
                    "dropCity": (raw.get("dropCity") or "").strip(),
                    "deadline": (raw.get("deadline") or "").strip(),
                    "maxPriceUsd": int(_num(raw.get("maxPriceUsd"))),
                    "hazmat": _truthy(raw.get("hazmat")),
                    "notes": (raw.get("notes") or "").strip() or None,
                    "status": (raw.get("status") or "open").strip() or "open",
                }
            )
    return rows


def board_rfqs() -> list[dict]:
    """Matchable demand for the board; fall back to TMS stub CSV if empty."""
    rows = demand_store.matchable()
    if rows:
        return rows
    return read_tms_rfqs()


def board_capacity() -> list[dict]:
    """Ingested + published capacity; fall back to TMS stub if store empty."""
    rows = store.all()
    if rows:
        return sorted(rows, key=lambda r: r.get("fetched_at") or "", reverse=True)
    return read_tms_capacity()


class Handler(BaseHTTPRequestHandler):
    server_version = "ForwardDesk/0.3"

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

    def _bytes(self, code: int, data: bytes, ctype: str) -> None:
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self._cors()
        self.end_headers()
        self.wfile.write(data)

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
                    "service": "forwarddesk",
                    "capacity_rows": len(store.all()),
                    "demand_rows": len(demand_store.all()),
                    "matchable_rfqs": len(demand_store.matchable()),
                    "data": str(DATA),
                    "time": utc_now_iso(),
                },
            )
            return

        if path == "/api/capacity":
            self._json(200, board_capacity())
            return

        if path == "/api/tms/capacity":
            self._json(200, read_tms_capacity())
            return

        if path == "/api/rfqs":
            self._json(200, board_rfqs())
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

        # Inbox pages (static HTML forms)
        if path in {"/capacity", "/capacity/", "/capacity.html"}:
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

        # Prefer explicit static/ assets (inbox helpers)
        if path.startswith("/static/"):
            rel = path[len("/static/") :]
            candidate = (STATIC / rel).resolve()
            try:
                candidate.relative_to(STATIC.resolve())
            except ValueError:
                self.send_error(403)
                return
            if candidate.is_file():
                ctype, _ = mimetypes.guess_type(str(candidate))
                self._bytes(200, candidate.read_bytes(), ctype or "application/octet-stream")
                return

        # Board SPA from dist/ (default / and assets)
        self._serve_dist(path)

    def _serve_dist(self, path: str) -> None:
        if not DIST.is_dir():
            # Fallback: capacity inbox if dist missing
            page = STATIC / "capacity.html"
            if page.exists() and path in {"/", "/index.html"}:
                self._html(200, page.read_text(encoding="utf-8"))
                return
            self._json(
                503,
                {
                    "ok": False,
                    "error": "dist/ missing — run npm run build, or use the packaged deploy",
                },
            )
            return

        rel = path.lstrip("/") or "index.html"
        candidate = (DIST / rel).resolve()
        try:
            candidate.relative_to(DIST.resolve())
        except ValueError:
            self.send_error(403)
            return

        if candidate.is_dir():
            candidate = candidate / "index.html"

        if not candidate.exists() or not candidate.is_file():
            candidate = DIST / "index.html"
            if not candidate.exists():
                self.send_error(404)
                return

        ctype, _ = mimetypes.guess_type(str(candidate))
        if ctype is None:
            ctype = "application/octet-stream"
        # HTML shell: no-store so deploys pick up new asset hashes
        if candidate.name == "index.html":
            data = candidate.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(data)))
            self._cors()
            self.end_headers()
            self.wfile.write(data)
            return
        self._bytes(200, candidate.read_bytes(), ctype)

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path

        if path in {"/api/capacity/reload", "/api/reload"}:
            caps = board_capacity()
            rfqs = board_rfqs()
            self._json(
                200,
                {
                    "ok": True,
                    "capacityCount": len(caps),
                    "rfqCount": len(rfqs),
                },
            )
            return

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

        if path == "/api/inbound/parse":
            try:
                data = _parse_body(self)
            except Exception as e:  # noqa: BLE001
                self._json(400, {"ok": False, "error": f"bad body: {e}"})
                return
            text_in = str(data.get("text") or data.get("body") or data.get("message") or "")
            role = str(data.get("default_role") or data.get("role") or "").strip() or None
            parsed = parse_inbound_text(text_in, default_role=role)
            parsed["channel"] = str(data.get("channel") or "manual")
            self._json(200 if parsed.get("ok") else 422, parsed)
            return

        if path in {"/api/inbound/capacity", "/api/inbound/demand"}:
            try:
                data = _parse_body(self)
            except Exception as e:  # noqa: BLE001
                self._json(400, {"ok": False, "error": f"bad body: {e}"})
                return
            text_in = str(data.get("text") or data.get("body") or data.get("message") or "")
            force = "capacity" if path.endswith("capacity") else "demand"
            role = "carrier" if force == "capacity" else "shipper"
            parsed = parse_inbound_text(text_in, default_role=role)
            if not parsed.get("ok"):
                self._json(422, {"ok": False, "parse": parsed})
                return
            fields = parsed["fields"]
            channel = str(data.get("channel") or "whatsapp_or_email")
            if force == "capacity":
                row = soft_capacity(
                    carrier=str(fields.get("carrier") or "Inbound carrier"),
                    mode=str(fields.get("mode") or "road"),
                    pickup_city=str(fields.get("origin") or fields.get("pickupCity") or ""),
                    drop_city=str(fields.get("destination") or fields.get("dest") or ""),
                    kind="published",
                    source=f"inbound_{channel}",
                    source_url="/api/inbound/capacity",
                    departure_window=str(fields.get("departureWindow") or "from inbound message"),
                    eta_hours=int(float(fields.get("etaHours") or 24)),
                    available_weight_kg=int(float(fields.get("availableWeightKg") or 0)),
                    available_volume_cbm=float(fields.get("availableVolumeCbm") or 0),
                    rate_min_usd=int(float(fields.get("rateMinUsd") or 0)),
                    rate_max_usd=int(
                        float(fields.get("rateMaxUsd") or fields.get("rateMinUsd") or 0)
                    ),
                    reliability=70,
                    notes=str(fields.get("notes") or "")[:500] or None,
                    confidence="carrier_published",
                )
                store.append_published(row)
                self._json(201, {"ok": True, "record": row, "parse": parsed})
                return
            else:
                weight = fields.get("weightKg")
                volume = fields.get("volumeCbm")
                max_price = fields.get("max_price")
                row = soft_demand(
                    shipper_or_broker=str(fields.get("shipper_or_broker") or "Inbound shipper"),
                    origin=str(fields.get("origin") or ""),
                    dest=str(fields.get("dest") or fields.get("destination") or ""),
                    kind="published",
                    source=f"inbound_{channel}",
                    source_url="/api/inbound/demand",
                    commodity=str(fields.get("commodity") or "").strip() or None,
                    weight_kg=int(weight) if weight not in (None, "") else None,
                    volume_cbm=float(volume) if volume not in (None, "") else None,
                    window=str(fields.get("window") or "from inbound message"),
                    max_price=int(max_price) if max_price not in (None, "") else None,
                    notes=str(fields.get("notes") or "")[:500] or None,
                    mode=str(fields.get("mode") or "road"),
                    confidence="shipper_published",
                )
                demand_store.append_published(row)
                self._json(201, {"ok": True, "record": row, "parse": parsed})
                return

        self._json(404, {"ok": False, "error": "not found"})


def main() -> None:
    # Prefer line-buffered logs on PaaS
    try:
        sys.stdout.reconfigure(line_buffering=True)
        sys.stderr.reconfigure(line_buffering=True)
    except Exception:
        pass

    DATA.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    if not DIST.is_dir():
        print(
            "WARNING: dist/ not found. Board UI unavailable until `npm run build`.",
            file=sys.stderr,
        )
    httpd = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print("=" * 64, flush=True)
    print("  ForwardDesk · board + capacity/demand ingest")
    print(f"  Board    →  http://0.0.0.0:{PORT}/")
    print(f"  Capacity →  http://0.0.0.0:{PORT}/capacity")
    print(f"  Demand   →  http://0.0.0.0:{PORT}/demand")
    print(f"  API      →  GET  /api/capacity  |  /api/rfqs  |  /api/demand")
    print(f"           →  POST /api/capacity/publish  |  /api/demand/publish")
    print(f"           →  POST /api/ingest/run  |  /api/ingest/demand/run")
    print(f"           →  GET  /api/sources  |  /api/sources/demand  |  /api/health")
    print(f"  Store    →  {DATA / 'capacity.jsonl'}  |  {DATA / 'demand.jsonl'}")
    print("  Bind     →  0.0.0.0  ·  PORT env (default 8080)")
    print("=" * 64)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        httpd.server_close()


if __name__ == "__main__":
    main()
