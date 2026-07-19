# Business OS UI Overhaul: Open Questions for Phases 6-9

Compiled from a read-only audit of `admin-biz.html` before writing any Phase 6-9 code.
Phases 1-5 (nav config, header, hover mega-menu, command palette, sidebar removal) are
done and verified. Answer each item below (one line is enough) so Phases 6-9 can run
back-to-back without further questions.

---

## Phase 6: Global filter system

Three different, non-shared filter patterns already exist in the codebase: a collapsible
"⚙ Filters" panel (All Sales, Customers), an always-visible filter bar (Returns & Claims),
and a "View: This FY / Month / Custom Range" selector (Expenses, Purchases, Ledger,
GST Portal state-wise table). Products, Stock, Import, Invoicing, Reports, Machinery,
Activity Log, and Balance Sheet have no filter UI at all. No `URLSearchParams`/routing
exists anywhere in the file, so filters are always lost on refresh. No saved-view table
exists; the closest precedent is the `site_settings` key/value table (used for
cross-device settings) versus `localStorage` (used for device-local UI state like
sidebar state or dashboard widget choice).

1. **Rollout order after All Sales + Returns & Claims**: which tables next, in what
   order? (Candidates with *some* existing filter UI to migrate: Customers, Expenses,
   Purchases, Ledger, GST Portal, Spool Tracker. Candidates with *none* today: Products,
   Stock, Import, Invoicing, Reports, Machinery, Activity Log, Balance Sheet.)
2. **Replace or template?** Should the shared filter component replace the three existing
   divergent patterns everywhere it lands, or just be the default for tables that
   currently have nothing, leaving the view-select+month pattern alone on
   Expenses/Purchases/Ledger/GST Portal?
3. **URL state**: introduce query-param sync now (e.g. `?tab=sales&channel=amazon`),
   given the app has no router/hash-routing at all today, or keep filters in-memory only
   (status quo) until routing is tackled as its own piece of work?
4. **Saved-view storage**: `site_settings` (syncs across devices, matches how other
   cross-device settings are stored), a new dedicated table, or `localStorage`
   (device-only, zero schema work, matches how sidebar/dashboard-widget state is stored
   today)?

---

## Phase 7: Quick Actions layer

Three of the five target actions (Expense, Purchase, Filament Arrived) already have
**two parallel implementations each**: a full modal with every field (`showAddExpense`/
`showAddPurchase`, full validation, GST/vendor/invoice fields) and a separate, already-
live "Quick Log" mini-form on the Open Orders panel (`qlExpense`/`qlPayment`/
`qlFilament`) with a stripped-down field set and its own independent save function.
Quick Add Sale is a full tab/page, not a modal. Resell Spool is a modal, but hardcoded
to the Spool Tracker panel's in-memory row array (`_spoolRows`), so it has no concept of
"which spool" outside that context. True inline (in-row, no-modal) quick-edit does not
exist anywhere in the codebase today (confirmed via grep); the two closest patterns are
the full edit modal (single row, All Sales' pencil icon) and bulk status-set (multi-row
dropdown in the selection toolbar, no modal).

5. **Expense / Purchase / Filament Arrived, which form wins?** Open the existing full
   modal, open the existing stripped-down Quick Log form, or consolidate the two into one
   before wiring it into Quick Actions, to avoid building a *third* parallel
   implementation?
6. **Add Sale**: Quick Actions triggers navigation to the existing Quick Add Sale tab
   as-is, or does "quick" require an actual lightweight modal version that doesn't exist
   yet (bigger scope)?
7. **Resell Spool with no row context**: from the header/palette there's no spool
   already selected. Open Spool Tracker with a spool-picker step first, or build a
   searchable spool picker directly into the quick-action modal?
8. **Inline quick-edit scope**: "extend inline quick-edit to Products and Stock" assumes
   a pattern that doesn't exist yet anywhere (confirmed no in-cell/contenteditable
   pattern in the codebase). Build genuine in-cell editing from scratch (real new scope),
   or is a bulk-style always-visible per-row status dropdown, matching the existing
   `bulkMarkStatus` pattern, an acceptable substitute for "quick edit"?

---

## Phase 8: Spool reselling workflow

Resell Spool already exists and is fully wired: it writes a `biz_income` ledger row
(category `filament_resale`), a `biz_filament_resales` row (buyer, cost, sale price,
computed profit, bidirectional FK to the income row), and updates
`filament_inventory.status='Finsh', finish_reason='resold'` (schema:
`supabase/migrations/20260719_filament_resale_system.sql`). The **existing** status
field is `Packed / Opened / TBR / Finsh`, yes, "Finsh" is a real stored value, not a
typo in the UI, plus the secondary `finish_reason` ('used'/'resold') that only applies
once status is `Finsh`. This does **not** map 1:1 onto the plan's proposed lifecycle
(New to In Use to Partial/Leftover to Listed for Resale to Sold). The current flow also
always zeroes `grams_used` on resale, meaning it assumes **whole-spool** resale; nothing
in the schema or UI supports listing/selling only part of a spool's remaining grams.

9. **Status model**: keep the existing 4 statuses and layer the new lifecycle on top
   (e.g. a `listed_for_resale: boolean` flag, or a 5th status value), or do a full
   status-model migration to match the plan's 5-stage lifecycle exactly? (Higher risk:
   touches every existing query/filter/report that already reads `status='Finsh'` etc.)
10. **What actually triggers "Listed for Resale"?** Today, filling in buyer and price and
    saving means immediately sold, in one step. Does Phase 8 need a real separate "list
    it" action (spool marked as available-for-resale and visible somewhere *before* a
    buyer exists), or is "Listed for Resale" just a filter/label applied at the same
    moment as the sale, with no real intermediate state, cosmetic only?
11. **Partial/Leftover spools that never get resold**: no rule exists today for a spool
    that's opened, partially used, and then just sits. Is defining that behavior in
    scope for Phase 8, or explicitly out of scope for this pass?
12. **Partial-spool resale**: does "remaining grams" on resale need to support selling
    *some* grams while keeping the rest in active use (a real behavior change to the
    schema and the always-zero-grams-used assumption in `saveResellSpool()`), or is
    whole-spool-only resale (current behavior) still the intended scope?

---

## Phase 9: Analytics/graphs modernization

Charting library is **Chart.js v4.4.0** (CDN, no build step), 8 chart instances total,
all Dashboard except one (GSTR-1 trend). Only **1 of 8** has any click handler wired
today (the channel chart, via native Chart.js `onClick` calling `setDashChannelFilter`,
cross-filtering Top Products and returned-items). No zoom/pan plugin is installed
anywhere (`chartjs-plugin-zoom` is not present); Chart.js core has no zoom/pan built in.
Adding click-to-drill to the other 7 charts needs **no new dependency** (native
`onClick` support already proven working on chart #1); zoom/pan specifically **does**
need one small addition (`chartjs-plugin-zoom`, same CDN pattern already used for
Chart.js itself) rather than a full library swap.

13. **Zoom/pan approach**: add `chartjs-plugin-zoom` (small, keeps all 8 existing chart
    instances as-is, lowest migration cost) as the default plan, or do you want visx/
    Tremor evaluated anyway despite the higher migration cost across 8 instances?
14. **Drill-down scope**: wire click-to-drill on all 7 currently-unwired charts (monthly
    trend, channel share, top products, top customers, bottom-returned-items,
    bottom-return-customers, GSTR-1 trend), or a smaller subset for this pass, e.g. skip
    the GSTR-1 trend chart, which lives on a different panel and may not need the same
    treatment as the Dashboard charts?
15. **Period-comparison mode**: none of the 8 charts currently support two overlaid
    series (this month vs last month). Each chart's data-loading function needs a second
    parallel query to support this. Build it for all 8, or scope the first pass to just
    the monthly trend and channel charts, the two most likely to be read that way?
16. **Chart color source**: the JS `CH_COLORS` object (raw hex, feeds Chart.js datasets)
    still duplicates the values now tokenized as CSS custom properties in Phase 2
    (`--ch-studio` etc., see `admin-theme.css`). If Phase 9 touches chart color logic
    anyway, should it read the CSS custom properties via `getComputedStyle` so there's a
    single source of truth, or is keeping `CH_COLORS` as its own hardcoded copy fine for
    now (current state, zero risk, but two places to update if a channel color changes)?
