"""Parse free-text WhatsApp / email soft-capacity or soft-RFQ messages into publish payloads.

WhatsApp Cloud API automation is out of scope without a Meta business app.
This module powers:
  POST /api/inbound/parse          — dry-run parse
  POST /api/inbound/capacity       — parse + publish capacity
  POST /api/inbound/demand         — parse + publish demand

Expected human message examples (EN/AR mix OK):

  CAPACITY: Dubai → Riyadh | flatbed | 20t | available Thu | rate 4500 SAR
  Soft space DXB-JED 3000kg / 12cbm tonight EK freighter leftover
  حمولة: جدة إلى دبي | براد | 24 طن

Design for ops: forward WhatsApp text to a dedicated email / paste into inbox /
POST JSON { "text": "...", "channel": "whatsapp"|"email", "default_role": "carrier"|"shipper" }.
"""

from __future__ import annotations

import re
from typing import Any

ARROW = re.compile(
    r"(?P<origin>.+?)\s*(?:→|->|=>|to|إلى|الى)\s*(?P<dest>.+)",
    re.I,
)

WEIGHT = re.compile(
    r"(?P<n>\d+(?:\.\d+)?)\s*(?P<u>kg|kgs|tons?|t|طن|cbm|م3)",
    re.I,
)

RATE = re.compile(
    r"(?P<n>\d+(?:[.,]\d+)?)\s*(?P<c>sar|usd|aed|\$|ر\.?س)",
    re.I,
)

CAPACITY_HINTS = (
    "capacity",
    "soft space",
    "soft capacity",
    "empty",
    "backhaul",
    "available truck",
    "truck available",
    "leftover",
    "شاحنة متاحة",
    "فراغ",
    "راجعة فاضية",
)
DEMAND_HINTS = (
    "load",
    "rfq",
    "need truck",
    "looking for",
    "shipment",
    "حمولة",
    "مطلوب",
    "نحتاج",
)


def _clean_city(s: str) -> str:
    s = s.strip(" \t|-–—:")
    s = re.sub(
        r"^(?:capacity|soft\s*space|soft\s*capacity|load|rfq|shipment|need\s+truck|حمولة)\s*[:\-–]?\s*",
        "",
        s,
        flags=re.I,
    ).strip()
    s = re.split(r"\s*[|]\s*", s)[0].strip()
    s = re.sub(
        r"\s+(?:flatbed|reefer|curtainside|lowboy|dyna|container|truck|tons?|t\b|kg|cbm|by\s+\w+).*$",
        "",
        s,
        flags=re.I,
    ).strip()
    s = re.sub(r"\s+", " ", s)
    return s[:80]


def classify_role(text: str, default_role: str | None = None) -> str:
    t = text.lower()
    cap = sum(1 for h in CAPACITY_HINTS if h in t)
    dem = sum(1 for h in DEMAND_HINTS if h in t)
    if default_role in ("carrier", "shipper"):
        if default_role == "carrier":
            return "capacity"
        return "demand"
    if cap > dem:
        return "capacity"
    if dem > cap:
        return "demand"
    return "capacity" if "truck" in t and "need" not in t else "demand"


def parse_inbound_text(text: str, *, default_role: str | None = None) -> dict[str, Any]:
    """Return {ok, kind: capacity|demand, fields, warnings}."""
    raw = (text or "").strip()
    if not raw:
        return {"ok": False, "error": "empty text", "kind": None, "fields": {}, "warnings": []}

    kind = classify_role(raw, default_role)
    warnings: list[str] = []
    fields: dict[str, Any] = {"notes": raw[:500], "mode": "road"}

    lane = None
    for line in raw.splitlines():
        m = ARROW.search(line.strip())
        if m:
            lane = m
            break
    if not lane:
        lane = ARROW.search(raw.replace("\n", " "))
    if lane:
        fields["origin"] = _clean_city(lane.group("origin").split("|")[-1])
        fields["destination"] = _clean_city(lane.group("dest").split("|")[0])
        fields["dest"] = fields["destination"]
        fields["dropCity"] = fields["destination"]
        fields["pickupCity"] = fields["origin"]
    else:
        warnings.append("no origin→dest arrow found")

    for m in WEIGHT.finditer(raw):
        n = float(m.group("n"))
        u = m.group("u").lower()
        if u in ("cbm", "م3"):
            fields["availableVolumeCbm" if kind == "capacity" else "volumeCbm"] = n
        elif u in ("t", "ton", "tons", "طن"):
            kg = int(n * 1000)
            fields["availableWeightKg" if kind == "capacity" else "weightKg"] = kg
        else:
            fields["availableWeightKg" if kind == "capacity" else "weightKg"] = int(n)

    rm = RATE.search(raw)
    if rm:
        n = float(rm.group("n").replace(",", ""))
        c = rm.group("c").lower()
        usd = n
        if c in ("sar", "ر.س", "رس"):
            usd = n * 0.27
        elif c == "aed":
            usd = n * 0.27
        if kind == "capacity":
            fields["rateMinUsd"] = int(usd)
            fields["rateMaxUsd"] = int(usd)
        else:
            fields["max_price"] = int(usd)

    if kind == "capacity":
        fields.setdefault("carrier", "WhatsApp/email carrier")
        if "carrier:" in raw.lower():
            for line in raw.splitlines():
                if line.lower().startswith("carrier:"):
                    fields["carrier"] = line.split(":", 1)[1].strip() or fields["carrier"]
    else:
        fields.setdefault("shipper_or_broker", "WhatsApp/email shipper")
        if "shipper:" in raw.lower():
            for line in raw.splitlines():
                if line.lower().startswith("shipper:"):
                    fields["shipper_or_broker"] = (
                        line.split(":", 1)[1].strip() or fields["shipper_or_broker"]
                    )

    ok = bool(fields.get("origin") and (fields.get("destination") or fields.get("dest")))
    return {
        "ok": ok,
        "kind": kind,
        "fields": fields,
        "warnings": warnings,
        "error": None if ok else "could not parse origin/destination",
    }
