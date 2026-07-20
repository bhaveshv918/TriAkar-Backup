# Business OS Phase 10+ Audit and Open Questions

Read-only audit against the A-L requirements. No code was changed in this session.
All findings below are from live grep/read of `admin-biz.html`, `admin-theme.css`,
`server/`, and `supabase/migrations/` on the current `main` branch (includes the
already-shipped Phase 1-5 nav/header/command-palette work and the Phase 6-9 filters/
quick-actions/spool/graphs questions doc, `BIZ-OS-PHASE-6-9-QUESTIONS.md`).

M and N are not included, per instruction.

---

## Conflict zones: where this work overlaps other in-flight sessions

This is the most important section to read before running any of A-L. Six areas of
`admin-biz.html` (plus one file in `admin-theme.css`) are also the exact areas touched
by work that has either already shipped in this repo (Phase 1-5) or was scoped as
upcoming work in `BIZ-OS-PHASE-6-9-QUESTIONS.md`. If another session is running either
of those in parallel, these are the specific collision points, not the whole file.

1. **Header markup and CSS.** `.biz-topbar` in `admin-biz.html` (around line 700-720)
   and `admin-theme.css` sections 20-23 (roughly lines 294-520: header, category nav,
   mega-dropdown, command palette, cheat sheet) were built by the Phase 1-5 work
   already merged to `main`. **E rewrites this exact markup and CSS.** Confirm first
   whether "the other session running Phase 1-5" means that work is still in flight
   (unaware Phase 1-5 already shipped) or means something else, before scheduling E.
   Recommend E run strictly after whatever else is touching the header lands, not in
   parallel with it.
2. **`NAV_CONFIG` array.** A single ~50-line object in `admin-biz.html` (around line
   3140-3190) is the single source of truth for the sidebar-replacement header, the
   command palette, and the shortcut cheat sheet (all Phase 1-5 output). **B** (a new
   Quotation nav entry), **D** (renaming `All Sales` to `All Orders` and adding a new
   `Sales` entry), and **K** (renaming `Add Sale` to `Add Order`) all need to edit this
   same array. Doing these three in one pass, by one session, avoids a three-way merge
   conflict on the same object.
3. **`panelSales` / `loadSales()`.** `BIZ-OS-PHASE-6-9-QUESTIONS.md` Phase 6 already
   named All Sales as the first table to get the new shared filter component. **D**
   restructures this same panel (rename plus a new sibling "Sales" view). If Phase 6
   filter work and D run in parallel, they will conflict on the same query/panel.
   Sequence one after the other.
4. **`panelQuickadd` / `submitQuickAdd()` / `openEditSale()`.** `BIZ-OS-PHASE-6-9-
   QUESTIONS.md` Phase 7 (Quick Actions layer) already scoped "Add Sale" as one of the
   five quick actions to wire into the header/palette. **K** is a much larger rewrite
   of the same panel (rename, payment sub-system, edit-flow overhaul). K should land
   before Phase 7 wires Quick Add Sale into the Quick Actions bar, or Phase 7 will be
   pointing at a UI that's about to change shape.
5. **Business Settings / Document Settings.** `admin-biz.html` around line 2864-2945
   (panel markup) and 2989-3020 (`_docRender`/`saveDocCustomization`/`loadBizDefaults`)
   were just touched in this same work thread to fix a layout bug (the settings page
   was capped at `max-width:560px` from the old sidebar-width assumption, now a
   responsive 2-column grid). **B** adds a third toggle group to this same pattern.
   Low risk since it's additive, but confirm the settings layout fix has landed first.
6. **Balance Sheet.** `admin-biz.html` around line 2796-2822 (panel) and 5072-5117
   (`loadBalanceSheet()`). **H** adds a new asset-category line here. No other planned
   work currently touches this panel, low risk, listed for completeness.

---

## A. ID and Document Architecture

**What exists today:**
- **Order ID** (`order_id` on `biz_sales`): hybrid. If the user types one into
  `qa_orderid` it's used as-is; otherwise `genOrderId()` (`admin-biz.html:8424-8434`)
  generates `TRK-YYYYMMDD-XXXXXXX` client-side, with no server-side uniqueness check or
  collision handling. For Amazon/Flipkart imports, it's the platform's own order number.
  Multi-item orders share one `order_id` across multiple `biz_sales` rows.
- **Invoice Number**: two separate things already exist. (1) `invoice_no` on
  `biz_sales`, a free-text field for a platform-issued invoice number. (2) A real,
  already-built FY-based sequential numbering system: `allocateInvoiceNumber()`
  (`admin-biz.html:8461-8486`) calls an atomic RPC `biz_next_invoice_number` and formats
  `TRK/${fy}/${seq}` e.g. `TRK/2026-27/000001`, logged in table `biz_invoices`, reused
  on reprint, editable via `editInvoiceLog()`. **This already matches the requested
  format almost exactly.** No duplicate/gap warning exists on manual entry today.
- **Quotation**: confirmed fully absent. No table, field, or UI, anywhere.
- **Unified order-record view including cancelled**: All Sales (`loadSales()`,
  `admin-biz.html:5208-5237`) already includes cancelled/returned rows by default (no
  status filter applied unless the user picks one), so this already exists in substance,
  it just isn't labeled as a "unified view" and doesn't include quotations.

**Open questions:**
1. "Universal Record ID for every entry type": one shared ID scheme across sales,
   expenses, purchases, returns, customers, etc., or a per-type sequential ID each?
   Need the target format.
2. Order ID must stay as-is per your instruction, but `genOrderId()` has no
   server-side uniqueness check today. Leave that risk as-is (unchanged), or add a
   uniqueness guarantee without changing the visible ID format/behavior?
3. The FY-based invoice numbering already exists (`allocateInvoiceNumber()`). Is the
   ask to change *when* it's shown (pre-filled/suggested earlier in the flow, before
   invoice generation, not just allocated at generation time), or to change the
   underlying numbering scheme itself?
4. Duplicate/gap soft-warning: warn against what exactly, existing rows in
   `biz_invoices`, or the last-issued sequence number for the current FY?
5. Quotation ID: new dedicated table (`biz_quotations`), or reuse `biz_sales`/
   `biz_invoices`-style with a `doc_kind='quotation'` flag (mirroring how `biz_invoices`
   already distinguishes doc kinds)?
6. Should quotations appear as rows in the same "unified order-record view" as actual
   orders, or stay in a separate list until converted?

---

## B. New Quotation Module

**What exists today:** the Document Settings toggle pattern (`admin-biz.html:2893-2901`
markup, `_docRender`/`saveDocCustomization`/`loadBizDefaults` around lines 2989-3020) is
two hand-copied groups (Invoice's 19 fields, Order Record's 16 fields), not a generic
loop over an arbitrary list of doc kinds. The render/collect helpers themselves are
generic enough to extend with a third group without a rewrite.

**Open questions:**
7. Extend the existing pattern with a third hardcoded group (small change, matches
   current code shape), or use this as the moment to generalize it into a config-driven
   loop so a future 4th doc kind doesn't need hand-copied code again?
8. What specific fields belong in a Quotation's own toggle list? Need a first-draft
   field list (distinct from Invoice's 19 and Order Record's 16) before implementation.
9. Does Quotation need its own tab/panel (new `NAV_CONFIG` entry, see conflict zone 2),
   or does it live as a `doc_kind` variant reachable from an existing context, the way
   "Make Invoice" already works as a button inside Quick Add Sale?
10. Is converting an accepted Quotation into a real Order in scope for this phase (a
    defined one-click "Convert to Order" flow), or are quotations standalone documents
    for now, with conversion handled manually?

---

## C. Import & Labels on Today's Tasks

**What exists today:** confirmed fully absent, no button, link, or reference to the
`import` tab anywhere inside the Today's Tasks panel (`panelOpenorders`,
`admin-biz.html:939-1021`). The existing quick-log strip already has 4 similar one-click
buttons (`admin-biz.html:945-990`: Add Sale, Studio Open/Break/Close, +Expense,
+Payment Received, +Filament Arrived) to match the pattern against.

**Open questions:**
11. Simple addition of one more button in the existing quick-log strip, label/icon
    preference (e.g. "🏷 Import & Labels")?
12. Should it default to the CSV-import step or the Shipping-Labels step
    (`setImportKind('csv')` vs `'labels'`), or just open the panel as last-left (the
    panel already remembers its last mode)?

---

## D. All Sales → All Orders, new Sales view, stat cards, comparison

**What exists today:** All Sales (`loadSales()`) already includes cancelled/returned by
default, no status exclusion unless the user opts in via the `sfStatus` filter. There is
no "confirmed/locked orders only" preset anywhere. "Locked" in the existing codebase
means paid (`is_paid`), a manual per-order toggle (`togglePaidOrder`), not an
order-confirmation concept distinct from payment or delivery status. All Sales has zero
stat/summary cards today, only a text subtitle ("N orders · N items").

**Open questions:**
13. Is "Sales" a new separate tab/panel (own `NAV_CONFIG` entry, own query, own load
    function), or a filter preset/sub-view on the same renamed "All Orders" table (a
    toggle that just pre-applies a status exclusion)? This is the scope-defining
    question, small filter vs. new panel.
14. Definition of "confirmed/locked": does Sales = paid orders (`is_paid=true`)
    excluding cancelled/returned, using the existing flag, or does this need a genuinely
    new status/flag that doesn't exist today (distinct from both payment and delivery)?
15. What specific stats go on the new stat cards for each view (revenue, order count,
    average order value, something else)? All Sales has none today, this is net-new UI
    on both sides.
16. "Comparison view": side-by-side numbers for the current period, or a dedicated
    chart/table comparing Orders vs Sales over time? Scope-defining.
17. See conflict zone 3: confirm this supersedes or is sequenced against the Phase 6
    filter-component work already scoped to target All Sales first.

---

## E. Header Visual Polish

**What exists today:** the current header (`.biz-topbar`) already has a text wordmark
("TriĀkar · Business OS"), a manually-hardcoded version badge ("v124"), the 5
NAV_CONFIG-driven category buttons (already color-coded per section from Phase 2), a
search bar, a live clock, a "Business OS Online" status pulse, and icon buttons for
refresh/privacy/theme, plus text-labeled Admin and Sign Out buttons that already
collapse to icon-only below 768px (`.biz-tb-admin-link::before{content:"◳"}` etc, a
Phase 5 mobile rule).

**Open questions (see conflict zone 1 before starting any of these):**
18. "Add more color, currently too monochrome": which elements specifically? The
    category buttons already have per-section accent colors; is this about the
    icon-button row (refresh/privacy/theme, currently monochrome grey) or something
    else?
19. "Remove wordmark text, keep only logo mark": does a standalone icon-only logo
    asset already exist to use, or does one need to be created/exported first?
20. "Keep version number visibly incrementing": is this just "don't remove the v124
    badge while redesigning," or does it need to become an actual automated build
    number (currently it's manually typed per edit) as part of this pass?
21. "ADMIN and SIGN OUT icon-only": they already become icon-only below 768px. Is the
    ask to make that the default at all widths, not just mobile?

---

## F. GST Reminder Overhaul (GSTR-1, GSTR-3B, GSTR-2B)

**What exists today:** GSTR-1 has a full pipeline (reminder card, auto-reconciliation
engine, CSV export, mark-filed/unmark-filed, manual filing log). GSTR-3B has a due-date
reminder (day 19, via the same `gstFilingReminderCard()` function that also handles
GSTR-1's day-10 reminder) and a manual filing-log upload (`biz_gst_filings` table), but
no auto-calculation "Auto-File" tab like GSTR-1 has. GSTR-2B has zero reminder/filing
concept, only a one-way import tool that backfills Purchases/Expenses from an uploaded
2B statement, correctly, since 2B is a government-auto-drafted statement the taxpayer
doesn't file. There is no generic notification/reminder system in the app to plug into,
`gstFilingReminderCard()` is a bespoke, purpose-built function.

**Explicitly not asked here:** the reference files for GSTR-2B parsing logic are coming
later. No questions below touch parsing.

**Open questions:**
22. GSTR-2B isn't filed by the taxpayer, so "reminder" and "overdue if unfiled" don't
    map onto it the same way they do for 1 and 3B. Does tracking GSTR-2B "separately"
    mean a different kind of reminder, e.g. "check whether the government has published
    this period's 2B for reconciliation," rather than a filing deadline?
23. Does F include building a GSTR-3B "Auto-File" calculation tab (mirroring GSTR-1's),
    or does F only add the reminder/mark-filed/overdue layer, leaving GSTR-3B's return
    values manual to calculate as they are today?
24. Should the existing `gstFilingReminderCard()` (hardcoded to exactly GSTR-1 day-10 /
    GSTR-3B day-19) be generalized into a config-driven list of return types so GSTR-2B
    and any future return type slot in without another hand-copied function?

---

## G. Clickable KPIs (SLA Breached, Due Today, Dispatched, In Production)

**What exists today:** all four KPIs exist exactly under these labels, all on the Open
Orders panel, none currently clickable. The Dashboard's `openDashDrilldown()` pattern
(the model to follow) depends on a precomputed `_dashCache` populated by
`loadDashboard()`, Open Orders has no equivalent cache today. Two of the four
("In Production", "Dispatched") already have full tables directly below them on the
same panel (`#prodOrdersBody`, `#trackOrdersBody`), the other two (SLA Breached, Due
Today) don't have a dedicated table anywhere yet.

**Open questions:**
25. For "In Production" and "Dispatched", which already have their own tables lower on
    the same panel, does the click need to open a popup at all, or just scroll-to and
    highlight the existing table (cheaper, reuses what's there)?
26. For "SLA Breached" and "Due Today", which have no dedicated table today, build a
    new drilldown data source (new query/cache) for these two specifically?
27. Should all four reuse the existing `#dashDrilldown` modal component, or does Open
    Orders get its own, lighter drawer since it's a different data source
    (`_dashCache` is Dashboard-specific)?

---

## H. Rack/Shelf Inventory Tracking

**What exists today:** confirmed 100% net-new. No rack/shelf/location column exists
anywhere in `biz_products` or `filament_inventory`. Finished-product stock
(`biz_products`) isn't even currently valued as a Balance Sheet asset today, only raw
filament (by grams/spool) is. This is new schema, new panel, and a new Balance Sheet
line, not an extension of something existing.

**Open questions:**
28. Does rack inventory track finished products only (ready-to-ship stock on a shelf),
    or also raw filament/supplies physically on racks, separate from the existing
    gram-based Filament Stock Value line?
29. "Mark sold directly from rack view": does this create a real `biz_sales` row
    (going through the same flow as Add Order), or just decrement rack quantity without
    a full order (lighter, but then it won't show up consistently in
    Sales/Orders/the ledger)?
30. Valuation basis for the new Balance Sheet asset line: cost price, or selling price?
    (The existing Filament Stock Value line uses cost, not selling price.)

---

## I. Shipping Label Quick-Select

**What exists today:** the Shipping Labels flow already has an Amazon/Flipkart
segmented toggle right at the top (`#lblPlatformSeg`, Amazon default-active), separate
from CSV import's own 3-option toggle (Flipkart/Amazon/Other). This already looks like
what was asked for.

**Open questions:**
31. Is the ask for something faster than the existing 2-button in-panel toggle, e.g. a
    one-click entry point from Today's Tasks or the header that skips navigating to
    Import & Labels first, or is the existing toggle just not visible/discoverable
    enough and needs a polish pass rather than new functionality?

---

## J. Spool Tracker Grouping + Partial-Spool Surfacing

**What exists today:** the Spool Tracker table only sorts finished-last then by serial
number, no color/brand/material grouping exists. The sale-picker dropdown (Quick Add
Sale's spool select) already groups by brand alphabetically via `<optgroup>`, but
within a brand group there's no prioritization of already-opened/partial spools,
remaining grams are shown in the label text but don't affect sort order.

**Open questions:**
32. "Group by color, company, material type": all three nested simultaneously
    (Material → Brand → Color), or three independent grouping modes the user switches
    between?
33. Partial-spool surfacing: reorder within the existing brand `<optgroup>` structure
    (partial spools float to the top of each brand's group), or break out into a flat
    "already open, matching material" section at the very top of the whole list,
    outside the brand grouping?
34. "Matching material": matching against what exactly, the material already selected
    on the current item row in Quick Add Sale, or the chosen product's default
    material? Need the exact matching key.

---

## K. Add Order Rename + Payment Sub-System + Full-Page Edit

**What exists today:** confirmed zero partial/installment/advance-payment concept
anywhere, payment status today is only a boolean `is_paid` plus a `payment_mode`
string. Edit Sale is a modal that can only edit one line item of a multi-item order at
a time (each `biz_sales` row is separate; a multi-item order has multiple rows sharing
one `order_id`), and it's missing several fields Quick Add Sale has: customer GSTIN,
round-off, granular fulfillment detail, a proper courier dropdown (it's free-text in
Edit Sale), and 6 status values that exist elsewhere in the data model but aren't
selectable here.

**Open questions:**
35. New payment sub-system: new table (e.g. `biz_sale_payments`, one row per
    installment with amount/date/source), correct? Does the existing `is_paid` boolean
    get replaced by a computed value (`sum(payments) >= total`), or kept in parallel as
    a manual override (the existing lock/unlock convention already built around it,
    e.g. return-window gating, bulk-delete protection, would need to keep working)?
36. "Editing opens the same full Add Order page": does the new full-page edit need to
    support editing ALL line items of a multi-item order at once (add/remove items,
    matching Quick Add Sale's items grid), which Edit Sale cannot do today at all? This
    is materially bigger than "reuse the same page," Edit Sale has no concept of "the
    whole order" as one editable unit currently.
37. Should the full-page edit close all the gaps found (GSTIN, round-off, fulfillment
    detail, courier dropdown, per-item SKU/product/spool/waste, missing statuses), or
    is a subset in scope for this pass?
38. Rename scope: does "Add Sale" → "Add Order" also rename the `NAV_CONFIG` label/
    shortcut, the Today's Tasks button text, and other "Sale" references in copy, or
    just the panel title? (Same `NAV_CONFIG` block flagged in conflict zone 2.)

---

## L. Skeleton Loading States

**What exists today:** no skeleton/shimmer component exists anywhere in
`admin-biz.html`. The customer-facing site has one (per CLAUDE.md, already shipped),
but it is not shared or reused in the admin app, admin has its own separate inline
design system/tokens. Loading feedback today is inconsistent panel to panel: some
tables show a static "Loading…" text row, others (like All Sales) show a blank empty
table until the fetch resolves.

**Open questions:**
39. Reuse/adapt the customer-site skeleton CSS, or build an admin-specific one (given
    Business OS already has its own token system, separate from the customer site's)?
40. Scope: every table/panel in the app (broad, touches nearly every panel), or a
    prioritized subset first, e.g. Today's Tasks, All Sales/Orders, Dashboard, the
    panels people hit daily?
