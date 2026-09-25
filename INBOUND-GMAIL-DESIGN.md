# Gmail → soft-capacity inbound (design)

**Status:** Design only — no automated webhook overnight. Gmail MCP (`user-Gmail`) is connected for `eduard@streamhatchet.com`.

## Flow

1. Carrier / ops sends WhatsApp soft-space text.
2. Forward or BCC to Edu Gmail with subject tag `[CAPACITY]` or body starting with `CAPACITY:`.
3. Parent or cron-like agent:
   - `search_threads` query: `newer_than:1d subject:CAPACITY OR "soft space" OR "available truck" OR "راجعة فاضية"`
   - `get_thread` → plaintext
   - `POST http://localhost:8090/api/inbound/capacity` with `{"text": "...", "channel": "email"}`
4. Result: `kind=published`, `confidence=carrier_published`.

## Optional filter

Create Gmail label `CargoMatch/Capacity` via `create_label` + filter on subject `CAPACITY`.

## WhatsApp Cloud API (later)

Requires Meta Business app, phone number, webhook URL — not free/overnight. Same parser endpoint once messages arrive.
