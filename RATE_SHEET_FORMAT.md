# ForwardDesk rate sheet (CSV) format

The Quote view prices a pasted customer request from a rate sheet. It ships with **sample** rates
(illustrative, not market rates). Load your own sheet with **Load rate sheet (CSV)**; it is read in the
browser only and never uploaded anywhere.

Template: [`public/rate-sheet-template.csv`](public/rate-sheet-template.csv) (also linked in the UI as
*Download rate sheet template*).

One row per charge. Header row required. Comma or semicolon separated (Excel ES/EU exports with `;` work).

| column | required | values |
|---|---|---|
| `mode` | yes | `fcl`, `lcl`, `air`, `road` |
| `origin` | yes | port / airport / city name, or `*` for any (destination-side local charges) |
| `destination` | yes | name, or `*` for any (origin-side local charges) |
| `equipment` | no | `20GP`, `40GP`, `40HC`, `45HC`, `FTL`, or `*` / empty for any |
| `charge` | yes | free text, e.g. `Ocean freight`, `BAF`, `Origin THC` |
| `side` | yes | `origin`, `freight`, `destination`, `customs` — drives Incoterm scope |
| `basis` | yes | `per_container`, `per_kg` (air uses chargeable kg at 1:6000), `per_wm` (LCL, max of cbm / tonnes, min 1), `per_truck`, `per_shipment` |
| `currency` | no | default `USD`; amounts are not FX-converted |
| `buy` | yes | buy rate per basis unit (decimal comma OK) |
| `min` | no | minimum line amount |
| `valid_until` | yes | `YYYY-MM-DD` or `DD/MM/YYYY`; past dates are flagged **STALE** |
| `transit_days` | no | on the freight row |
| `carrier` | no | free text |

A lane quotes when there is at least one `freight` row with exactly that origin + destination + mode
(+ equipment for FCL/road). Known names (e.g. `Shanghai (Yangshan)`, `Jebel Ali`, `Madrid (MAD)`) are matched to
the request parser; any new name in your sheet is also recognised when it appears in a pasted request.

Incoterm scope (who pays what is assumed from the customer's Incoterm):
EXW → origin + freight + destination + customs · FCA/FAS/FOB → freight + destination + customs ·
CFR/CIF/CPT/CIP → destination + customs · DAP/DPU → origin + freight + destination · DDP → all (duties not included).
