# ForwardDesk — forwarder quoting desk (prototype)

Interactive demo of a **freight-forwarder quoting desk**: customer RFQs, buy-side soft capacity, buy/sell/margin quotes, match negotiation, compliance veto, booking under policy, and exception rematch. Lane/corridor is a filter on the data — not the product identity (demo seed still includes UAE↔KSA plus other example lanes).

> **Demo only.** No real bookings, carrier APIs, payments, or customs filings. Carrier names are illustrative.

## Run with Python only (recommended for Edu)

No Node/npm required to **run** the demo:

```bash
cd cargo-match-prototype   # or extract cargomatch-deploy /
PORT=8080 python3 server.py
```

Open **http://localhost:8080** (board). Also: `/capacity` inbox · `/demand` inbox.

Binds `0.0.0.0` and reads `PORT` from the environment (default **8080**).

On macOS you can also double-click `start.command`.

### Live TMS stub (CSV)

Soft capacity is served from a stub that mimics a TMS soft-capacity feed:

1. Edit `tms-stub/capacity.csv` (add/change rows, rates, docs flags, etc.)
2. In the UI click **Refresh from TMS** (or reload the page)
3. The soft-capacity board updates — the server **re-reads the CSV on every GET**

Optional shipper demand: `tms-stub/rfqs.csv` (same pattern via `GET /api/rfqs`).

API endpoints:

| Endpoint | Behavior |
|----------|----------|
| `GET /api/capacity` | JSON array from `tms-stub/capacity.csv` (re-read each request) |
| `GET /api/rfqs` | JSON array from `tms-stub/rfqs.csv` |
| `GET /api/health` | `{ "ok": true, "source": "tms-stub/capacity.csv" }` |
| `POST /api/capacity/reload` | Confirms files readable (GET already re-reads) |

If the API is unreachable (e.g. opened `dist/index.html` as a file), the UI falls back to **Seed data (offline)** from `src/data.ts`. A banner shows **Data source: TMS stub (CSV)** vs **Seed data (offline)**.




## Deploy (public hosting)

Python **stdlib only** — `requirements.txt` is empty (no pip deps). The built React board lives in `dist/` and talks to **relative** `/api/*` (same-origin on any host).

### Render (recommended free tier)

1. Push this repo to GitHub.
2. [Render](https://render.com) → **New** → **Web Service** → connect the repo.
3. Settings (or use the included `render.yaml` blueprint):
   - **Runtime:** Python
   - **Build Command:** `true` (nothing to build; `dist/` is committed)
   - **Start Command:** `python server.py`
   - **Instance:** Free
4. Render sets `PORT` automatically; the app reads it and binds `0.0.0.0`.
5. Open the `.onrender.com` URL → board at `/`, inboxes at `/capacity` and `/demand`.

Blueprint: [`render.yaml`](./render.yaml).

### Docker

```bash
docker build -t cargomatch .
docker run --rm -p 8080:8080 -e PORT=8080 cargomatch
```

### Railway / Procfile

- `Procfile`: `web: python server.py`
- `railway.json` points at the Dockerfile (optional)

### Fly.io (optional)

```bash
fly launch --name cargomatch --dockerfile Dockerfile
fly deploy
```

Ensure the Fly process uses `PORT` from the platform (already the default in `server.py`).

### Local verify before push

```bash
PORT=8080 python3 server.py
curl -s http://127.0.0.1:8080/api/health
curl -s http://127.0.0.1:8080/api/capacity | head -c 200
```

## Soft-capacity ingest (real sources)

Capacity discovery lives in `ingest/` + Capacity Inbox:

```bash
python3 server.py
# Board:    http://localhost:8080/
# Inbox:    http://localhost:8080/capacity
```

1. Open **Capacity Inbox** → **Run ingest** (or `POST /api/ingest/run`)
2. Live rows appear with provenance: `schedule` | `public_listing` | `derived` | `published`
3. **Publish soft capacity** when public leftover data is thin (`kind=published`)

See [CAPACITY_SOURCES.md](./CAPACITY_SOURCES.md) and [CAPACITY_INGEST.md](./CAPACITY_INGEST.md).

| Endpoint | Purpose |
|----------|---------|
| `GET /api/capacity` | Ingested + published rows (provenance) |
| `GET /api/tms/capacity` | Legacy demo CSV stub |
| `POST /api/ingest/run` | Fetch public sources now |
| `POST /api/capacity/publish` | Carrier soft-capacity intake |
| `GET /api/sources` | Per-source status |

**Honesty:** schedules and route listings are **not** leftover soft space. Weight/volume stay 0 unless a carrier publishes.

Standalone package: `/workspace/cargo-capacity-ingest.tar.gz` (Python 3 stdlib only).


## Soft-demand ingest (real sources)

Demand discovery lives alongside capacity:

```bash
python3 server.py
# Demand Inbox: http://localhost:8080/demand
```

1. **Run demand ingest** (`POST /api/ingest/demand/run`) — LoadUp / BidsFactory / Comtrade proxy  
2. **Publish soft RFQ** when public intent is thin (`kind=published`)  
3. Board `GET /api/rfqs` merges matchable demand (`published` + `public_rfq` + `tender`); proxies stay out of matching  

See [DEMAND.md](./DEMAND.md) and [DEMAND_SOURCES.md](./DEMAND_SOURCES.md).

| Endpoint | Purpose |
|----------|---------|
| `GET /api/demand` | Ingested + published soft demand |
| `POST /api/demand/publish` | Shipper soft-RFQ intake |
| `POST /api/ingest/demand/run` | Fetch public demand sources |
| `GET /api/sources/demand` | Per-source status |

Standalone dual package: `/workspace/cargo-match-ingest.tar.gz` (capacity + demand, Python 3 stdlib).

## Dev (requires npm — for contributors)

```bash
npm install
npm run dev          # Vite at http://localhost:5173 (API calls fail → seed fallback)
npm run build        # rebuild dist/ for server.py
```

## What to try

1. **Happy path:** Select `RFQ-1001` (electronics Jebel Ali → Riyadh) → **Run match** → watch agents in the feed → **Accept & book** on a compliance-PASS card.
2. **Compliance veto:** Click **Demo: restricted + veto** (or match `RFQ-1005`). BudgetWheels is vetoed (missing border docs / no controlled-goods clearance); ClearPath can pass.
3. **Hazmat:** **Demo: hazmat match** (`RFQ-1004`) — only hazmat-capable capacity clears ComplianceAgent. `CAP-509` (NoHaz CheapHaul) fails hazmat.
4. **Exception rematch:** After booking, click **Exception: truck no-show** (or sailing slip) → ExceptionAgent frees the load and MatchAgent proposes next-best capacity.
5. **Forms:** **+ Shipper RFQ** / **+ Soft capacity** add live board rows (in-memory only; not written back to CSV).
6. **TMS edit:** Change a rate in `tms-stub/capacity.csv` → **Refresh from TMS** → board updates.

## Stack

- Vite + React 19 + TypeScript (built into `dist/`)
- Matching / compliance / booking client-side (`src/matching.ts`)
- **Python 3 stdlib** server (`server.py`) serves `dist/` board + `/capacity`/`/demand` inboxes + ingest APIs (`0.0.0.0:$PORT`)
- TMS stub CSVs in `tms-stub/`

## Project docs

See [PRODUCT.md](./PRODUCT.md) for the wedge narrative.

## Screenshots

Captured demos (optional):

- `screenshots/01-dashboard.png` — live board
- `screenshots/02-match-proposals.png` — scored proposals + agent feed
- `screenshots/03-booked.png` — booked under policy
- `screenshots/04-exception-rematch.png` — truck no-show → rematch
- `screenshots/05-compliance-veto.png` — BudgetWheels veto / ClearPath pass

## Packaged demo

`/workspace/cargo-match-demo.tar.gz` contains everything needed **without npm**:

- `dist/`, `server.py`, `tms-stub/`, `README.md`, `start.command`
