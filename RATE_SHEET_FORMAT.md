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
| `side` | yes | `origin`, `freight`, `destination`, `customs` — drives ### Several lines per lane (options)

Put the freight rows of every line you have for a lane in the sheet, each with its own `carrier`
(and optionally `routing`, `free_days`, `sails`). ForwardDesk prices each carrier as an option
(main freight from that carrier's rows, origin/destination/customs charges shared), shows them side by
side with the difference vs the cheapest (price, transit days, free time) and badges *Cheapest*,
*Fastest*, *Most free time* and *Recommended*. Recommended = lowest price after adding 1% per extra
transit day, among options with no stale rows. You tick which options go into the customer quote;
Copy quote and Generate PDF then show one option or a comparison of several (sell prices only;
the Internal PDF also shows buy and margin).

`routing`, `free_days` and `sails` only need to be on one freight row per carrier and lane.

Example (two lines on one lane):

```
mode,origin,destination,equipment,charge,side,basis,currency,buy,min,valid_until,transit_days,carrier,routing,free_days,sails
fcl,Bandar Abbas,Nhava Sheva,20GP,Ocean freight,freight,per_container,USD,690,,2026-12-01,5,Line A,Direct,10,Tue
fcl,Bandar Abbas,Nhava Sheva,20GP,Ocean freight,freight,per_container,USD,560,,2026-12-01,8,Line B,via Jebel Ali,14,Sat
```

Incoterm scope |
| `basis` | yes | `per_container`, `per_kg` (air uses chargeable kg at 1:6000), `per_wm` (LCL, max of cbm / tonnes, min 1), `per_truck`, `per_shipment` |
| `currency` | no | default `USD`; amounts are not FX-converted |
| `buy` | yes | buy rate per basis unit (decimal comma OK) |
| `min` | no | minimum line amount |
| `valid_until` | yes | `YYYY-MM-DD` or `DD/MM/YYYY`; past dates are flagged **STALE** |
| `transit_days` | no | on the freight row |
| `carrier` | no | line / airline / haulier name. **Each distinct carrier on a lane becomes a separate quote option** |
| `routing` | no | e.g. `Direct`, `via Port Klang`, `Direct (express)` — shown per option |
| `free_days` | no | destination free time in days (e.g. `10`, `14`, `21`), FCL only |
| `sails` | no | sailing weekday (`Mon`…`Sun`) or `daily`; used for the indicative ETD → ETA |

A lane quotes when there is at least one `freight` row with exactly that origin + destination + mode
(+ equipment for FCL/road). Known names (e.g. `Shanghai (Yangshan)`, `Jebel Ali`, `Madrid (MAD)`) are matched to
the request parser; any new name in your sheet is also recognised when it appears in a pasted request.

Incoterm scope (who pays what is assumed from the customer's Incoterm):
EXW → origin + freight + destination + customs · FCA/FAS/FOB → freight + destination + customs ·
CFR/CIF/CPT/CIP → destination + customs · DAP/DPU → origin + freight + destination · DDP → all (duties not included).
