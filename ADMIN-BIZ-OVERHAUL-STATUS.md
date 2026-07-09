# TriAkar Admin Panel + Business OS — Overhaul Status Report

_Last updated: 2026-07-09 (Round 3, Batch 1)_

---

## Round 3 (new, ~45-item feature dump) — batched B1-B5, same cadence as Round 2

**Batch 1 — Dashboard chart overhaul: DONE (code-verified, NOT yet live-tested by owner).**
All changes in `admin-biz.html` Dashboard tab, no schema changes, no migration needed:
- Top 10 Customers chart (month/year toggle), horizontal bar, no axes, name+value drawn inside
  the bar via a new reusable `hbarLabelsPlugin()` helper (also used by Top Products, bottom-10
  returned items, bottom-10 customers-by-return).
- Orders-by-Channel count cards (Studio/Amazon/Flipkart/Website).
- Revenue by Channel bars are now clickable (`setDashChannelFilter`) — filters Top Products table/
  chart + new "Top 10 Items by Channel" section to the clicked channel; Y-axis value ticks removed,
  channel name labels kept.
- Monthly Revenue Trend: Y-axis value ticks removed, month labels only.
- Revenue Share doughnut: legend now shows channel name + % share.
- New "Top 10 Items by Channel" section (per-channel top-10 lists, respects the channel filter).
- Top Products table + Returns & Claims table: clickable sortable column headers.
- New "Bottom 10 — Highest Value Returned Items" and "Bottom 10 — Customers by Return Value" charts.
- Top Products chart: in-bar revenue labels, X-axis value ticks removed.
**Not live-tested here** — both panels are login-gated against production Supabase (confirmed via
local preview: admin-biz.html correctly shows the Sign In screen, no console errors on load/parse).
Owner needs to test on the deployed build before Batch 2 starts.

**Batches 2-5 (order lifecycle, filament/machinery, GST/invoicing, customer normalization/UX) —
planned, not yet started.** Full batch breakdown is in the approved plan
`C:\Users\bhave\.claude\plans\linked-sauteeing-lake.md`.

---

**Verification caveat:** "code-verified" = inline JS parsed clean (`vm.Script`) + code-reviewed.
**Nothing has been visually/functionally tested by me** — the panels are login-gated against the
production backend, so live testing is the owner's. This distinction is marked throughout.

**Deploy state:** all completed work is committed to `main` and pushed to `origin` across several
deploys; service worker at `ta-v65`. Migrations 1–6 run by owner; `biz_expenses` migration pending.

---

## 1. Completed (code-verified, deployed)

| Module | What shipped | Commit |
|---|---|---|
| **A1** Recycle Bin | true order hard-delete, killed Empty-All restore, account cascade | `1d2afbc` |
| **B5/B6** Import | COGS precedence, Flipkart name fix, label tabs/file input | `1d2afbc` |
| **B3** Quick Add Sale | status/lead/fulfillment chips, customer-above, serial+drag, grams, round-off, 4 buttons | `1025826` |
| **B4** All Sales | Filters panel, blurred order modal+Prev/Next, Paid→modal, Edit parity, bulk lifecycle | `1025826` |
| **5.1/5.2** SKU+HSN | auto-SKU, Colour/Material/Grams, HSN 3926 default | `a4eef19` |
| **5.3** Returns | full staged lifecycle + live COGS recompute (built the missing panel) | `a5b24f6` |
| **5.4** Settlement | upload → match → payout/fees ingestion | `3652929` |
| **5.5** Filament | rolls CRUD, bulk Excel, waste-on-empty, reorder alert, monthly printed/wasted | `3652929` |
| **B7** Customers | `biz_customers` CRUD + GSTIN + filters, merged with derived stats | `f627941` |
| **B14** Settings hub | Operational Defaults (HSN/GST/min-rolls) driving behavior | `9866f02` |
| **B15** Production | per-order stage chips (Queued → Packed) | `432de05` |
| **B16** Open Orders | landing command center: SLA countdown, production, reorder alert | `062d9a3` |
| **B17** Expenses | monthly log feeding P&L | `551eee3` |
| **B13** Reports | P&L Summary (+expenses → net, repeat-rate, top products) + Returns report | `2713f18` |
| **A4** Advance pay | %/₹ bidirectional off order total | `9866f02` |
| **§2c** Global search | Business OS sidebar search across sales/products/customers | `0f6c2bd` |
| **§2d** Dark mode | added to Business OS, shared `ta_theme` with Admin | `9183a41` |
| **Tab titles + single nav** | "TriAkar Admin / Business OS", merged duplicate nav | `9183a41` |
| **A6** Dispatch email | courier + tracking + Track link — already existed, verified | — |
| **B12** GST | reviewed — calc is correct, no fix needed | — |

---

## 2. In progress (partial)

| Module | Done | Left |
|---|---|---|
| **§2a** Branding/header | titles, single nav | header-component parity + mobile-header polish |
| **§2e** Badges/refresh/log | status badges in use; refresh on Open Orders | unify badge system; refresh icon on every tab; log Business OS writes to the activity log |
| **A11** MakerWorld | manual API-key entry exists | bulk 20-link import + per-link status |
| **A10** Reviews | flag wired + admin-create (prior work) | confirm "single source of truth" vs public page; structured Google fields |

---

## 3. Not started

- **§2b** Collapsible sidebar (both panels)
- **A5** Admin order detail → modal with Next/Prev _(Business OS already has this)_
- **A7** Document Customization (invoice / order-record field toggles)
- **A8** Unified Inbox
- **A9** Products form rebuild (storefront-mirror, draft/publish, inline reviews)
- **A13** Site-content go-live verify · **A14** GA4 traffic panel
- **B2** Dashboard customizable widgets
- **A3** notification auto-clear · **A12** security-log device/browser/email
- _(A2 User Management was already fixed in a prior session — service-role + Auth Admin API)_

---

## 4. Bugs found (not in the original list)

1. **Recycle "Empty All" actively *restored* orders** (`deleted_at:null`) — worse than the reported silent-restore. Fixed in A1.
2. **Returns UI was entirely missing** — `loadReturns/saveReturn` etc. existed but their HTML (`returnForm`, `returnsBody`, `rf_*`) didn't; functions were orphaned. Rebuilt in 5.3.
3. **`account.html` order history lacked `.is('deleted_at',null)`** — soft-deleted orders leaked into the customer's account. Fixed in A1.
4. **Flipkart import used case-sensitive column lookup** — exact root cause of blank customer names. Fixed in B6.

---

## 5. Deviations from spec (+ why)

1. **5.4 Settlement** — parser matches common/known Flipkart/Amazon column names (best-effort), since real files will be shared later. Needs a real sample to finalize mapping.
2. **5.5 Filament** — spec wanted auto-deduction by colour/material on sale completion. Sales lines don't reliably store colour, so manual "+g log usage" + monthly "printed" from `grams_used` was used instead of full auto-FIFO. (Waste-on-empty + alerts are per spec.)
3. **B17 Expenses** — invoice attachment is a link/URL field, not a file upload (avoided an unverifiable Supabase Storage bucket setup). Easy to upgrade to real upload.
4. **B7 Customers** — kept the existing derived-from-sales list and *added* an editable `biz_customers` table merged in, rather than replacing it (preserves all historical buyers).
5. **Commits** — went to `main` per owner's choice; pushed only on request. 7 migrations total (6 run + `biz_expenses` pending).

---

## 6. Open questions / decisions needed

1. **The specific broken things observed on the live site** — "many things need fixing" was reported without specifics. This is the #1 unblock for every visual module.
2. **A14 GA4** — need a Google service-account JSON + GA4 property ID to build the traffic panel.
3. **5.4 Settlement** — need one real Flipkart + Amazon settlement file to tune the column mapping.
4. **B17** — invoice link field OK, or true file upload (wire Supabase Storage)?
5. **5.5 Filament** — is manual gram-logging acceptable, or is auto-deduction wanted (requires colour on products/sales)?
6. **A9 Products rebuild** — confirm mirroring the storefront product layout exactly, with draft / auto-save / Publish as the desired flow.

---

## Pending migration (run in Supabase SQL Editor)

`supabase/migrations/20260625_biz_expenses.sql` — required for the Expenses tab and the P&L
report's Expenses sheet. All other migrations are already applied.
