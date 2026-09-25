"""OpenFlights public routes.dat — UAE↔KSA airline service listings.

https://github.com/jpatokal/openflights (ODbL / database contents per project license)
Label: public_listing — route exists in OpenFlights snapshot; NOT a schedule or soft space.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from ..httputil import fetch
from ..schema import soft_capacity, source_status, utc_now_iso

SOURCE_ID = "openflights_uae_ksa"
SOURCE_NAME = "OpenFlights UAE↔KSA routes"
ROUTES_URL = "https://raw.githubusercontent.com/jpatokal/openflights/master/data/routes.dat"
AIRLINES_URL = "https://raw.githubusercontent.com/jpatokal/openflights/master/data/airlines.dat"
AIRPORTS_URL = "https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat"
PROJECT_URL = "https://openflights.org/data.html"

UAE = {"DXB", "DWC", "AUH", "SHJ", "RKT", "AAN", "FJR"}
KSA = {
    "JED", "RUH", "DMM", "MED", "AHB", "TUU", "ELQ", "YNB", "GIZ", "HAS",
    "BHH", "TIF", "NUM", "ULH", "EAM", "ABT", "RAE", "DWD", "HOF", "AJF",
}


def _load_airlines(text: str) -> dict[str, str]:
    # Airline ID, Name, Alias, IATA, ICAO, Callsign, Country, Active
    out: dict[str, str] = {}
    for line in text.splitlines():
        parts = _csv_split(line)
        if len(parts) < 5:
            continue
        name, iata = parts[1], parts[3]
        if iata and iata != "\\N":
            out[iata] = name
    return out


def _load_airports(text: str) -> dict[str, str]:
    # Airport ID, Name, City, Country, IATA, ICAO, ...
    out: dict[str, str] = {}
    for line in text.splitlines():
        parts = _csv_split(line)
        if len(parts) < 5:
            continue
        city, iata = parts[2], parts[4]
        if iata and iata != "\\N":
            out[iata] = city
    return out


def _csv_split(line: str) -> list[str]:
    """Minimal CSV split respecting quotes."""
    out: list[str] = []
    cur = []
    in_q = False
    for ch in line:
        if ch == '"':
            in_q = not in_q
            continue
        if ch == "," and not in_q:
            out.append("".join(cur))
            cur = []
            continue
        cur.append(ch)
    out.append("".join(cur))
    return out


def fetch_openflights_uae_ksa(cache_dir: Path | None = None) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    fetched_at = utc_now_iso()
    cache = Path(cache_dir) if cache_dir else None

    def get(url: str, name: str) -> tuple[int, str]:
        if cache:
            cache.mkdir(parents=True, exist_ok=True)
            path = cache / name
        else:
            path = None
        status, body, _ = fetch(url, timeout=90, accept="text/plain,*/*")
        text = body.decode("utf-8", errors="replace") if body else ""
        if status == 200 and text and path is not None:
            path.write_text(text, encoding="utf-8")
        elif status != 200 and path is not None and path.exists():
            # fall back to cache
            return 200, path.read_text(encoding="utf-8")
        return status, text

    st_r, routes_txt = get(ROUTES_URL, "routes.dat")
    st_a, airlines_txt = get(AIRLINES_URL, "airlines.dat")
    st_p, airports_txt = get(AIRPORTS_URL, "airports.dat")

    if st_r != 200 or not routes_txt:
        return [], source_status(
            source_id=SOURCE_ID,
            name=SOURCE_NAME,
            ok=False,
            error=f"routes.dat HTTP {st_r}",
            http_status=st_r,
            url=ROUTES_URL,
        )

    airlines = _load_airlines(airlines_txt) if st_a == 200 else {}
    airports = _load_airports(airports_txt) if st_p == 200 else {}

    rows: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()
    for line in routes_txt.splitlines():
        parts = line.strip().split(",")
        if len(parts) < 5:
            continue
        airline_iata, src, dst = parts[0], parts[2], parts[4]
        if not ((src in UAE and dst in KSA) or (src in KSA and dst in UAE)):
            continue
        key = (airline_iata, src, dst)
        if key in seen:
            continue
        seen.add(key)
        carrier = airlines.get(airline_iata, airline_iata or "Unknown airline")
        origin = airports.get(src, src)
        dest = airports.get(dst, dst)
        equipment = parts[7] if len(parts) > 7 else ""
        rec = soft_capacity(
            carrier=carrier,
            mode="air",
            pickup_city=origin,
            drop_city=dest,
            kind="public_listing",
            source=SOURCE_ID,
            source_url=PROJECT_URL,
            fetched_at=fetched_at,
            departure_window="OpenFlights route listing (no timetable)",
            eta_hours=3 if {src, dst} <= UAE | KSA else 4,
            available_weight_kg=0,
            available_volume_cbm=0,
            reliability=55,
            notes=(
                "OpenFlights public route listing — indicates airline service on lane. "
                "NOT a flight schedule and NOT leftover soft capacity. "
                f"Airports {src}→{dst}; equipment field={equipment or 'n/a'}."
            ),
            confidence="service_exists",
            flight_or_voyage=airline_iata or None,
            raw={
                "airline_iata": airline_iata,
                "src_iata": src,
                "dst_iata": dst,
                "equipment": equipment,
            },
            id=f"OF-{airline_iata or 'XX'}-{src}-{dst}",
        )
        rows.append(rec)

    return rows, source_status(
        source_id=SOURCE_ID,
        name=SOURCE_NAME,
        ok=True,
        rows=len(rows),
        http_status=200,
        url=ROUTES_URL,
        notes=(
            "Deduped airline+airport pairs for UAE↔KSA. "
            "ODbL / see OpenFlights data page for license. kind=public_listing."
        ),
    )
