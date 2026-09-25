"""Minimal HTTP helpers (stdlib urllib)."""

from __future__ import annotations

import ssl
import urllib.error
import urllib.request
from typing import Any


DEFAULT_UA = (
    "CargoMatchIngestBot/0.1 (+research; UAE-KSA capacity+demand ingest; stdlib)"
)


def fetch(
    url: str,
    *,
    timeout: float = 45.0,
    headers: dict[str, str] | None = None,
    accept: str | None = None,
) -> tuple[int, bytes, dict[str, str]]:
    """GET url → (status, body, response_headers_lower). Raises on network errors."""
    hdrs = {"User-Agent": DEFAULT_UA, "Accept": accept or "*/*"}
    if headers:
        hdrs.update(headers)
    req = urllib.request.Request(url, headers=hdrs, method="GET")
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            status = getattr(resp, "status", 200) or 200
            body = resp.read()
            rh = {k.lower(): v for k, v in resp.headers.items()}
            return int(status), body, rh
    except urllib.error.HTTPError as e:
        body = e.read() if hasattr(e, "read") else b""
        rh = {k.lower(): v for k, v in (e.headers.items() if e.headers else [])}
        return int(e.code), body, rh


def fetch_text(url: str, **kwargs: Any) -> tuple[int, str]:
    status, body, _ = fetch(url, **kwargs)
    return status, body.decode("utf-8", errors="replace")
