# GST Filing Automation — Spec for Business OS

> Handoff brief from a manual reconciliation session (June 2026 GSTR-1). Everything below was
> learned by hand-processing one month's data; read this before rebuilding it as a feature.
> Start a fresh chat for implementation — this doc is the context transfer.

## Goal

Admin uploads 3 files each month in the Business OS (admin-biz.html), the system reconciles
them into GSTR-1 tables (B2B, B2CS, HSN, Documents Issued), shows a review screen, and exports
files ready for the government's GST Offline Tool. Full pipeline per the confirmed scope:
calculation engine + review UI + filing history database + deadline reminders + month-over-month
trend dashboard. No automatic filing to the GST portal itself (out of scope, do not build this) —
output stays as downloadable files the admin uploads to the government tool manually.

## The 3 monthly input files

1. **Amazon MTR B2B** — CSV, filename pattern `MTR_B2B-<MONTH>-<YEAR>-<merchantId>.csv`. One row
   per B2B shipment (has a `Customer Bill To Gstid`). Always Amazon's own official tax report —
   authoritative source, don't second-guess its numbers.
2. **Amazon MTR B2C** — CSV, filename pattern `MTR_B2C-<MONTH>-<YEAR>-<merchantId>.csv`. Contains
   `Transaction Type` = `Cancel` / `Shipment` / `Refund` rows, mixed together, often spanning
   invoice dates from the previous month too (a June-dated credit note can reference a May invoice).
3. **Flipkart GSTR-1/GSTR-8 report** — `.xlsx`, filename is an opaque hash + timestamp (no period
   info in the filename or file content — **the admin must confirm which month it covers**; don't
   assume from the filename). Sheets: `Section 5B` (B2C Large), `Section 7(A)(2)` (B2C intra-state),
   `Section 7(B)(2)` (B2C interstate, state-wise, this is the main one), `Section 13` (Documents
   issued), `Section 12` (HSN), `Section 3` (GSTR-8/TCS, informational only — not part of GSTR-1).

## Core reconciliation algorithm (Amazon side)

Walk the B2C CSV row by row:

- **`Cancel` rows are noise.** Invoice Amount = 0, no Invoice Number. They exist because Amazon
  sometimes reuses the same `Shipment Item Id` for a failed pickup attempt followed by a
  successful reshipment under the same Order ID — match `Shipment Item Id` across rows to see
  this pairing. Cancel rows have zero GST impact; skip them, but do check whether the Order ID
  ever produces a real `Shipment` row elsewhere in the same file (if not, it's a genuinely dead
  order — still zero impact either way).
- **`Shipment` rows are sales.** One row per invoice. `Invoice Date` determines which month's
  GSTR-1 it belongs to (not Order Date, not Shipment Date).
- **`Refund` rows are credit notes.** Always paired with a `Shipment` row sharing the same
  `Shipment Item Id` and `Invoice Number`. The `Credit Note Date` (not the original Invoice Date)
  determines which month's GSTR-1 the credit note reduction belongs to. **A refund can reference
  an invoice from an earlier month** — this is common and correct; net it into the *current*
  month's Table 7, don't touch the earlier month's already-filed return.
- **State-of-supply netting**: group by `Ship To State`, sum `(Shipment taxable) − (Refund
  taxable)` per state for the period. A state can legitimately net negative if a credit note
  against an earlier month's invoice lands in a state with no current-month sale — this is
  correct GST-law treatment (credit note nets in month of issue), not a bug. Flag it for review,
  don't "fix" it to zero.
- **Intra-state vs inter-state**: compare `Ship From State` to `Ship To State`. Same state → CGST
  + SGST (each = rate/2). Different → IGST (full rate). The seller's own state code is a config
  value (this business: `09` Uttar Pradesh) — don't hardcode, read from GSTIN.
- **B2B split**: any row with a non-empty `Customer Bill To Gstid` in the B2C file, or any row in
  the B2B file, goes to GSTR-1 Table 4 instead of Table 7. Report per-invoice, not netted by state.
- **Cancelled invoice numbers**: Amazon sometimes allocates an invoice number to a `Cancel` row
  (Invoice Amount 0, no Invoice Date) — the number was reserved but no real tax invoice was ever
  issued. Surface this distinctly in Table 13 (Documents Issued) as a cancelled document within
  the invoice number range, don't silently drop it from the range.

## Flipkart side

Flipkart's `Section 7(B)(2)` already reports **net-of-return** figures per state — don't try to
net it again. But do run this sanity check every time: per-state `(Gross Taxable − Taxable Sales
Return)` must equal the reported `Net (Aggregate) Taxable Value` for every row — if any row fails
this, stop and flag it (bad data). Also cross-check: `sum(Net Taxable across all states)` must
equal `Section 12`'s `Total Taxable Value` and `Section 3`'s `Net Taxable Value` — these three
independent figures should tie to the paisa. In the one month processed manually, the per-state
**Gross** and **Return** subtotals did *not* match Section 3's single aggregate Gross/Return
(off by an identical amount in opposite directions — net unaffected) — this looks like a
recurring Flipkart report quirk, not a one-off; the engine should compute this cross-check
automatically every month and only alert if the *net* figures fail to tie out (gross/return
mismatch alone is a soft warning, not a blocker).

Also cross-check `Section 12` (HSN) quantity against `Section 3` (GSTR-8) `Invoice Qty (Net)` —
these disagreed by 1 unit in the sample month. Not resolved; the engine should surface both
numbers rather than picking one silently.

Flipkart's report has **no invoice-level/customer-level detail** — only state aggregates. Don't
try to build a per-transaction audit trail for Flipkart the way you can for Amazon; store the
sheet as-is as the audit backup.

## Merging Amazon + Flipkart into one Table 7 (B2CS)

Group by **state only** (not by channel) — a state that has both an Amazon and a Flipkart
component must appear as **one summed row**, not two. This was a real bug caught during manual
building: the GST Offline Tool treats each `(state, rate, type)` combination as a unique key on
import and *overwrites* rather than *sums* on collision — submitting two separate rows for the
same state silently drops one channel's numbers. Always pre-aggregate to one row per unique
`(state, rate, intra/inter)` combination before generating any export.

## Output format — GST Offline Tool compatibility

**Do not hand-build the upload JSON.** The GST portal's JSON schema has an internal
version/checksum structure that a hand-rolled JSON reliably fails ("File could not be uploaded").
The only two paths that work:

1. Generate CSVs matching the *exact* column order the government's own
   `Section_wise_CSV_files/GSTR1/*.csv` templates use (available inside the "GST Offline Tool"
   zip download from gst.gov.in — bundle a copy in the repo as reference, headers are strict and
   column order for `b2cs.csv` differs from the order used inside the Excel Workbook Template for
   the same table — verify both if supporting both import paths). Import section-by-section via
   the tool's "IMPORT CSV" button, let the tool itself generate the JSON.
2. Fill the official `GSTR1_Excel_Workbook_Template` (also from gst.gov.in) sheet-by-sheet and let
   the admin use "IMPORT EXCEL". Caution: resaving that macro-enabled template through a library
   like openpyxl can silently strip data-validation extensions the file relies on and cause the
   tool's import to hang indefinitely — if this path is built, test an actual round-trip import
   before shipping it, or prefer path 1 (plain CSV) as the default since it has no such fragility.

**E-Commerce GSTIN field**: Table 4/7 have an optional `E-Commerce GSTIN` column plus a `Type`
flag (`E` = via e-commerce operator, `OE` = not). In the one month processed, marking these rows
`E` with a GSTIN populated caused the Offline Tool to reject every such row (reason not
conclusively diagnosed — checksum-valid GSTIN, still failed; suspect an internal e-commerce-
operator master-list check). Marking `OE` (blank GSTIN) imported cleanly with identical tax
figures — this field is reconciliation metadata only, doesn't affect any tax amount. Since then,
**real operator GSTINs were found via an actual GSTR-2B pull** (suppliers' own filings, which
include Amazon/Flipkart as suppliers of platform fees):
- Amazon Seller Services Pvt Ltd: `29AAICA3918J1ZE` (Karnataka)
- Flipkart Internet Pvt Ltd: `29AACCF0683K1ZD` (Karnataka) — note Flipkart's own seller-facing
  report (Section 3/GSTR-8) instead lists `09AACCF0683K1ZF` (Uttar Pradesh) as "GSTIN of
  Flipkart.Com" — both are real, different state registrations of the same company. The UP one is
  what got rejected by the Offline Tool; the Karnataka one from GSTR-2B has not been tried yet and
  is the more likely candidate for the `E` + GSTIN path. Try it before defaulting to `OE`.
Recommend: try `E` + the Karnataka GSTINs above first; fall back to `OE` (current default) only if
that still fails. Either way this field never changes any tax amount — not a launch blocker.

**Table 14 (Supplies made through ECO)**: Do not populate this table for this business. It's for
Section 9(5) notified services (ride-hailing, food delivery, etc.) where the e-commerce operator
is the person liable to pay tax — not applicable to a seller shipping physical goods through a
marketplace that only collects TCS under Section 52.

## GSTR-3B and GSTR-2B cross-checks (post-filing verification, v2 scope)

Once GSTR-1 is filed, two more checks are worth automating rather than doing by hand every month:

- **GSTR-1 vs GSTR-3B Table 3.1(a)**: should match exactly (taxable value, IGST, CGST, SGST) — if
  it doesn't, something is wrong with the GSTR-3B draft, not GSTR-1.
- **GSTR-3B Table 3.2** (inter-state supplies to unregistered) should equal GSTR-1 Table 7's total
  *minus* any intra-state (same-state, CGST+SGST) rows — Table 3.2 is inter-state-only by
  definition. Don't flag this as a mismatch; it's expected.
- **GSTR-3B Table 4A(5) "All other ITC" vs a GSTR-2B B2B-section export**: these will *not* match
  by simple summation, and that's expected, not a bug to chase. The GSTR-2B "Auto-Drafted ITC
  Statement" summary screen (portal UI, not the section-specific Excel export) breaks ITC into
  **Part A** (gross ITC available, matches a plain sum of the B2B sheet) and **Part B** (credit
  notes from suppliers that must be *netted off* against Part A before it reaches GSTR-3B). GSTR-3B
  correctly shows `Part A − Part B`. If building an automated cross-check, pull the GSTR-2B summary
  screen's Part A and Part B figures specifically (not just the B2B-section Excel export, which is
  Part A only) — verified in June 2026: Part A ₹3,176.80 − Part B ₹276.92 = ₹2,899.88, which matched
  GSTR-3B exactly. A B2B-only export will always look short by whatever Part B contains; that's not
  evidence of a missing invoice.
- **RCM (reverse charge) sanity check**: any inward supply row marked "Supply Attract Reverse
  Charge = Yes" in GSTR-2B should sum to exactly GSTR-3B Table 3.1(d)/4A(3). In June 2026 this was
  Porter (GTA/delivery) charges, taxable ₹582 → IGST ₹29.10 at 5%. Remember for user-facing
  explanations: RCM tax must always be paid in cash (Electronic Cash Ledger), never offset against
  existing ITC balance in the Electronic Credit Ledger, even when that balance is large — this is a
  hard rule, not a portal quirk. The same amount becomes claimable as the recipient's own ITC in
  the same return, so it's cash-flow-neutral over the return cycle, just not offsettable in place.

## Downstream: feeding transactions into Business OS accounting (balance sheet accuracy)

Not yet spec'd in detail, but a confirmed goal: the same source data this engine reconciles
(Amazon/Flipkart sales by state, RCM-liable purchases like Porter, ITC-eligible purchases from
GSTR-2B) should also populate Business OS's accounting views (`Purchases`, `Expenses`, `Money
In/Out`, `Balance Sheet` in the admin-biz.html sidebar) with correct categorization, so that at
financial year-end the balance sheet is accurate without separate manual re-entry of the same
transactions. Before building this, check what categorization scheme the existing Purchases/
Expenses/Balance Sheet modules already use (query the relevant Supabase tables and existing admin
UI) rather than inventing a new one — this should slot into whatever chart-of-accounts-like
structure already exists, not replace it. Scope this as a second phase after the core GST engine
is reliable, since it depends on the same reconciled data being trustworthy first.

**Scope confirmed with user**: this needs to cover the business's full history (multiple months/
years), not just June 2026, and the user explicitly wants a **bulk-import tool built first**
rather than one-off manual data entry — because this will recur every month going forward, same
as the GST engine itself. Treat this as a proper feature, not a data-cleanup script:

- Input: historical GST filing files per month (GSTR-1 exports, GSTR-2B pulls, GSTR-3B PDFs — same
  file types this session worked with) for as many past months as the user can supply, plus
  whatever this session already reconciled for June 2026 as the first known-good month.
- Needs a categorization scheme for non-sales items (RCM/GTA charges like Porter, ad spend like
  Google, payment gateway fees like Razorpay, bank charges, etc.) — derive categories by first
  reading how `Purchases`, `Expenses`, and `Balance Sheet` already categorize things in the
  Supabase schema, don't invent new categories that don't map to what the balance sheet already
  expects.
- Since this is backfilling *historical* financial records (not just this month's live entry), be
  extra careful about duplicate-detection (re-running the import for a month that's already been
  entered) and about matching the emphasis on verification from
  [[gst-reconciliation-verification-discipline]] — a bulk historical import is exactly the kind of
  operation where a silent double-count or mis-categorization would corrupt the balance sheet
  without being obvious until year-end.
- Before writing any data, confirm with the user which months are already reflected in the Business
  OS (Purchases/Expenses/Money In-Out) via other means (e.g. already manually entered) versus which
  are genuinely missing — don't assume the OS is empty for past months.

## File upload requirements — none of the 3 are mandatory

Each channel can legitimately have zero activity in a given month (Flipkart hadn't launched yet
in some months; B2B-via-Amazon sales don't happen every month). The engine must calculate from
whatever subset of the 3 files is present — reconcile Amazon-only, Flipkart-only, B2B-only, or
any combination, not just "all 3 or nothing."

**Confirmed bug (live, reproduced):** uploading a single file alone (tested: Flipkart-only, one
month) produces a **silent failure** — no error message, no calculation, blank/zero result. The
upload/calculate flow currently appears to require all 3 files present before it will run at all,
and fails without telling the user why. Fix: (1) run the calculation on whatever files are
present, treating a missing file as "zero supplies for that channel" rather than a precondition,
(2) if a truly blocking condition exists (e.g., need at least 1 file), surface an explicit error
message — never fail silently.

## Suggested build shape

- New Supabase tables: `gst_filings` (one row per period: gstin, period, status, totals,
  created_at), `gst_filing_line_items` (per-state/per-invoice breakdown, foreign key to filing),
  `gst_filing_flags` (the audit-flag list — negative states, cancelled invoices, cross-checks that
  failed — structured, not just prose, so the review UI can render them as a checklist).
- Backend: `server/services/gst-reconciliation.js` (pure calculation, unit-testable against the
  known-good June 2026 numbers as a regression fixture), `server/routes/admin.js` gets new
  endpoints for upload + calculate + fetch history, matching existing admin auth middleware.
- Admin UI: new tab in `admin-biz.html` (Business OS) — 3 file dropzones, a review screen showing
  the same breakdown structure used in this session's Excel workbook (Summary / state table /
  audit flags), download buttons for the CSV set, and a filing history list.
- Reminders: reuse whatever notification mechanism already exists for other admin alerts (check
  `services/` and `server/routes/notify.js` first — don't build a second notification pathway).

## Known-good regression fixture (June 2026)

Once the engine exists, running it against this month's 3 source files should reproduce:
Taxable ₹17,654.72, Tax ₹3,177.80 (IGST 3,025.42 + CGST 76.19 + SGST 76.19), Total ₹20,832.52,
54 net documents issued, HSN 3926 net qty 27. Use this as the first test case.
