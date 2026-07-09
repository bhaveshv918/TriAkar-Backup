# TriAkar Admin Panel + Business OS — Overhaul Status Report

_Last updated: 2026-07-09 (Round 3, Batches 1-5 complete)_

---

## Round 3 (~45-item feature dump) — ALL 5 batches DONE, code-verified, NOT yet live-tested

Owner asked to run straight through all 5 batches without stopping and push each to `origin`
(deploy is automatic from there). All 5 are pushed. Every batch: inline JS parsed clean
(`vm.Script`), function references checked, but **none of it has been visually/functionally
tested** — both panels are login-gated against production Supabase (confirmed via local preview:
admin-biz.html correctly shows the Sign In screen, no console errors on load/parse). Full plan at
`C:\Users\bhave\.claude\plans\linked-sauteeing-lake.md`.

**4 migrations must be run in Supabase SQL Editor, in this order, before the new features work:**
1. `20260709_biz_sales_status_extend.sql` — widens `biz_sales.status` CHECK for the new lifecycle values
2. `20260709_biz_machinery.sql` — `biz_printers`, `biz_print_attempts`
3. `20260709_biz_invoicing.sql` — `biz_invoice_counters`, `biz_invoices`, `biz_next_invoice_number` RPC,
   `biz_expenses.recurring`/`source` columns, `biz_gst_filings` + `biz-gst` storage bucket
4. `20260709_biz_sales_customer_id.sql` — `biz_sales.customer_id` FK

**Batch 1 — Dashboard chart overhaul.** Top 10 Customers chart (month/year), Orders-by-Channel
cards, clickable Revenue-by-Channel (filters Top Products + new Top-Items-by-Channel), axis
cleanup on Monthly Trend/Top Products/Revenue Share (%+labels), sortable Top Products + Returns
headers, Bottom-10 returned items + Bottom-10 customers-by-return. New reusable `hbarLabelsPlugin()`
for in-bar chart labels. No schema changes.

**Batch 2 — Order lifecycle & status rework.** Extended `UNIFIED_STATUSES` (delaying,
return_initiated, return_picked_up, claim_filed, cancelled_before_dispatch/delivery). Reaching
return_initiated/returned now auto-syncs a `biz_returns` row (`syncReturnRowForStatus`) so Returns
& Claims populates from the order lifecycle. Claim fields in the Returns form now gate on
stage/type instead of always showing; fixed a missing `claim_paid` label. Open Orders: bulk
select + bulk status/delete, SKU shown in item column, "Dispatched — Tracking" → "Dispatched"
(both instances). Studio Add Sale defaults to Walk-in + Self Pickup. "Shop" → "Studio" label
rename (admin + biz). Header Admin/Business-OS links now orange. Activity Log moved under a
System nav section. Fixed the eye-icon privacy mask surviving re-renders (was showing raw values
again after tab switches) + added chart-canvas blur. All Sales badge excludes cancelled orders.
Removed "· N items" text, recolored "+1 more" orange.

**Batch 3 — Machinery, print attempts, dashboard rollups.** New Machinery tab: printer/equipment
CRUD (specs + purchase value feeding the Balance Sheet as an asset) + a print-attempt log
(reprint_guarantee/power_cut/filament_runout/quality_issue/other + free-text note). Dashboard:
Studio Hours daily/7-day/monthly rollup off the **existing** `biz_shop_log` punch-clock (already
built pre-Round-3 as "Studio Hours" tab — no new table needed), SLA met/not-met % card, New
Customers by Channel. Filament dropdown now excludes 0g/finished rolls + groups by company;
added Brand/Filament-Type datalists to the Spool Tracker add-roll form. **Fixed a pre-existing
crash** in `loadBalanceSheet()` — referenced undefined `rolls`/`cost_total` (should've been
`spools`/`price`) — Balance Sheet was throwing on every render before this.

**Batch 4 — GST Portal, real Invoicing, expenses.** `printInvoice()` now allocates a real
per-financial-year sequential invoice number (`TRK/2026-27/000123`, DB-backed atomic counter,
logged to `biz_invoices`, reused on reprint) instead of the old localStorage-only counter
(per-device, lost on clear). New Invoicing tab lists every invoice + links to its order. New GST
Portal tab: upload filed GSTR-1/GSTR-3B files, state-wise sales/tax by platform, filing reminders
(10th/19th, 2 days ahead) also surfaced on Open Orders. Expenses: Staff Salary category
(auto-names "<Name>'s Salary"), Recurring flag + duplicate-to-next-month action, "Debited From"
source field. Added GPay/Paytm payment-mode option everywhere a payment mode is picked.

**Batch 5 — Customer normalization, bulk edit, dashboard drag-drop, misc.** `biz_sales.customer_id`
FK — Add Sale now resolves-or-creates a real `biz_customers` row on save
(`resolveCustomerId`/`insertSalesResilient`) instead of only free text (CSV/label imports and Edit
Sale do **not** yet attach customer_id — only the primary Add Sale path does; noted as a follow-up).
Bulk-select added to Products (set category / archive) and Customers (mark reviewed / export)
tabs. Import CSV gained a "Default Grams per Order" field to match Labels. Dashboard widgets:
native HTML5 drag-and-drop reorder (additive — the ↑/↓ buttons still work) + a 3-step size cycle
(sm/md/lg, cycles the tile's grid-column span). Expenses: logging a Materials expense can now
bump an existing spool's `total_grams` directly (`applyExpenseToSpoolStock`).

**Explicitly descoped this round (flagged to the owner, not silently dropped):**
- **Stories/testimonials CMS** — `stories.html` is fully static hardcoded HTML today, no admin CRUD
  exists at all. Adding a Year field + multiple-stories-per-month needs a new DB table + admin CRUD
  UI + rewiring the storefront page to fetch dynamically — a real net-new CMS feature, customer-
  facing, and risky to rush. Deserves its own focused session.
- **Full Labels + Import CSV tab merge** — added the missing "Default Grams" field to Import CSV
  for parity, but did not physically merge the two panels/flows; that's a bigger UI restructure with
  real risk to a working import pipeline for a cosmetic consolidation.
- **Full download→upload audit** — "every CSV export should have a matching importer" was too broad
  to safely execute blindly across every tab in this pass; needs a specific inventory of which
  exports currently lack an importer before touching each one.
- **customer_id backfill for historical rows** — left NULL on purpose; automated name-matching
  against old free-text data isn't safe to run unattended.

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
