// Synthetic-fixture regression check for the GST reconciliation engine.
//
// The spec's own regression fixture (June 2026 known-good totals) needs the admin's
// real raw Amazon/Flipkart files, which aren't in this repo. This script instead
// exercises every branch of the algorithm with hand-built synthetic data (cancel row,
// matched same-month refund, unmatched cross-month refund landing in a state with no
// other sale, B2B pulled out of the B2C file, cancelled-but-numbered invoice, Amazon+
// Flipkart merge into one B2CS row per state, Flipkart cross-check pass and fail cases)
// so the logic can be sanity-checked without the real month's numbers. Run with:
//   node server/scripts/gst-regression-check.mjs
import * as XLSX from 'xlsx';
import { reconcileGstPeriod } from '../services/gst-reconciliation.js';

function csv(headers, rows) {
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map((h) => (r[h] ?? '')).join(','));
  return Buffer.from(lines.join('\n'), 'utf8');
}

const b2cHeaders = [
  'Transaction Type', 'Order Id', 'Shipment Item Id', 'Invoice Number', 'Invoice Date',
  'Credit Note No', 'Credit Note Date', 'Invoice Amount', 'Tax Exclusive Gross',
  'Cgst Tax', 'Sgst Tax', 'Igst Tax', 'Igst Rate', 'Hsn/Sac', 'Quantity',
  'Ship From State', 'Ship To State', 'Customer Bill To Gstid',
];
const b2cRows = [
  // 1. Cancel, no invoice number, dead order, zero impact, no doc entry.
  { 'Transaction Type': 'Cancel', 'Order Id': 'O1', 'Shipment Item Id': 'SI1' },
  // 2. Cancel WITH an invoice number reserved, order never really ships, cancelled doc.
  { 'Transaction Type': 'Cancel', 'Order Id': 'O2', 'Shipment Item Id': 'SI2', 'Invoice Number': 'INV-002' },
  // 3. Intra-state shipment (UP -> UP), 18%.
  { 'Transaction Type': 'Shipment', 'Order Id': 'O3', 'Shipment Item Id': 'SI3', 'Invoice Number': 'INV-003', 'Invoice Date': '2026-06-05', 'Invoice Amount': 1180, 'Tax Exclusive Gross': 1000, 'Cgst Tax': 90, 'Sgst Tax': 90, 'Hsn/Sac': '3926', Quantity: 1, 'Ship From State': 'Uttar Pradesh', 'Ship To State': 'Uttar Pradesh' },
  // 4. Inter-state shipment (UP -> Maharashtra), 18%.
  { 'Transaction Type': 'Shipment', 'Order Id': 'O4', 'Shipment Item Id': 'SI4', 'Invoice Number': 'INV-004', 'Invoice Date': '2026-06-10', 'Invoice Amount': 2360, 'Tax Exclusive Gross': 2000, 'Igst Tax': 360, 'Igst Rate': 18, 'Hsn/Sac': '3926', Quantity: 1, 'Ship From State': 'Uttar Pradesh', 'Ship To State': 'Maharashtra' },
  // 5. Refund matching #4, same month, nets Maharashtra down. Amazon reports refund money columns
  //    as already-negative (confirmed against a real live May 2026 MTR export), not positive
  //    magnitudes for the code to subtract, so these fixture values are negative to match.
  { 'Transaction Type': 'Refund', 'Order Id': 'O4', 'Shipment Item Id': 'SI4', 'Invoice Number': 'INV-004', 'Credit Note No': 'CN-001', 'Credit Note Date': '2026-06-20', 'Tax Exclusive Gross': -500, 'Igst Tax': -90, 'Hsn/Sac': '3926', Quantity: 1, 'Ship From State': 'Uttar Pradesh', 'Ship To State': 'Maharashtra' },
  // 6. Refund with NO matching shipment in this file, referencing an earlier month's invoice.
  //    Lands in Karnataka which has no other current-month sale -> negative net, flagged.
  { 'Transaction Type': 'Refund', 'Order Id': 'O99', 'Shipment Item Id': 'SI99', 'Invoice Number': 'INV-OLD-099', 'Credit Note No': 'CN-002', 'Credit Note Date': '2026-06-25', 'Tax Exclusive Gross': -300, 'Igst Tax': -54, 'Hsn/Sac': '3926', Quantity: 1, 'Ship From State': 'Uttar Pradesh', 'Ship To State': 'Karnataka' },
  // 7. Shipment carrying a customer GSTIN -> pulled into Table 4 (B2B), not netted into B2CS.
  { 'Transaction Type': 'Shipment', 'Order Id': 'O7', 'Shipment Item Id': 'SI7', 'Invoice Number': 'INV-007', 'Invoice Date': '2026-06-12', 'Invoice Amount': 5900, 'Tax Exclusive Gross': 5000, 'Igst Tax': 900, 'Hsn/Sac': '3926', Quantity: 1, 'Ship From State': 'Uttar Pradesh', 'Ship To State': 'Maharashtra', 'Customer Bill To Gstid': '27ABCDE1234F1Z5' },
];

const b2bHeaders = ['Customer Bill To Gstid', 'Invoice Number', 'Invoice Date', 'Tax Exclusive Gross', 'Cgst Tax', 'Sgst Tax', 'Hsn/Sac', 'Quantity', 'Ship From State', 'Ship To State'];
const b2bRows = [
  { 'Customer Bill To Gstid': '09XYZAB5678L1Z3', 'Invoice Number': 'INV-B01', 'Invoice Date': '2026-06-08', 'Tax Exclusive Gross': 3000, 'Cgst Tax': 270, 'Sgst Tax': 270, 'Hsn/Sac': '3926', Quantity: 1, 'Ship From State': 'Uttar Pradesh', 'Ship To State': 'Uttar Pradesh' },
];

function flipkartBuffer(sheetNames = {}) {
  const wb = XLSX.utils.book_new();
  const sec7b2 = XLSX.utils.json_to_sheet([
    { 'Place of Supply': 'Uttar Pradesh', Rate: 18, 'Gross Taxable Value': 1200, 'Taxable Sales Return': 200, 'Net (Aggregate) Taxable Value': 1000, IGST: 0 },
    { 'Place of Supply': 'Karnataka', Rate: 18, 'Gross Taxable Value': 800, 'Taxable Sales Return': 0, 'Net (Aggregate) Taxable Value': 800, IGST: 144 },
    // Deliberately bad row: gross - return != net -> should raise a blocker flag.
    { 'Place of Supply': 'Rajasthan', Rate: 18, 'Gross Taxable Value': 500, 'Taxable Sales Return': 100, 'Net (Aggregate) Taxable Value': 500, IGST: 90 },
  ]);
  const sec12 = XLSX.utils.json_to_sheet([
    { HSN: '3926', 'Total Quantity': 5, 'Total Taxable Value': 2300 },
  ]);
  const sec13 = XLSX.utils.json_to_sheet([
    { Series: 'Flipkart', 'Sr No From': 'FK-001', 'Sr No To': 'FK-010', 'Total Number': 10, Cancelled: 1 },
  ]);
  const sec3 = XLSX.utils.json_to_sheet([
    { 'Net Taxable Value': 2300, 'Invoice Qty (Net)': 5 },
  ]);
  XLSX.utils.book_append_sheet(wb, sec7b2, sheetNames.sec7b2 || 'Section 7(B)(2)');
  XLSX.utils.book_append_sheet(wb, sec12, sheetNames.sec12 || 'Section 12');
  XLSX.utils.book_append_sheet(wb, sec13, sheetNames.sec13 || 'Section 13');
  XLSX.utils.book_append_sheet(wb, sec3, sheetNames.sec3 || 'Section 3');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

const result = reconcileGstPeriod({
  gstin: '09XYZAB5678L1Z3',
  period: '2026-06',
  amazonB2bBuffer: csv(b2bHeaders, b2bRows),
  amazonB2cBuffer: csv(b2cHeaders, b2cRows),
  flipkartBuffer: flipkartBuffer(),
});

console.log(JSON.stringify(result, null, 2));

const checks = [];
function check(name, cond) { checks.push({ name, ok: !!cond }); }

check('seller state resolved to Uttar Pradesh', result.sellerState === 'Uttar Pradesh');
check('Table 4 has 2 invoices (B2B file + B2C-with-GSTIN)', result.tables.b2b.length === 2);
check('Table 4 includes INV-B01', result.tables.b2b.some((r) => r.invoiceNumber === 'INV-B01'));
check('Table 4 includes INV-007', result.tables.b2b.some((r) => r.invoiceNumber === 'INV-007'));
const uttarPradeshRow = result.tables.b2cs.find((r) => r.state === 'Uttar Pradesh');
check('UP intra-state B2CS row merges Amazon (1000) + Flipkart (1000) = 2000', uttarPradeshRow?.taxable === 2000);
check('UP row is intra (Ship From == Ship To == Uttar Pradesh)', uttarPradeshRow?.placeOfSupplyType === 'intra');
const maharashtraRow = result.tables.b2cs.find((r) => r.state === 'Maharashtra');
check('Maharashtra netted taxable = 2000-500 = 1500', maharashtraRow?.taxable === 1500);
check('Maharashtra row is inter (Ship From UP != Ship To Maharashtra)', maharashtraRow?.placeOfSupplyType === 'inter');
const karnatakaAmazon = result.tables.b2cs.filter((r) => r.state === 'Karnataka');
const karnatakaNet = karnatakaAmazon.reduce((s, r) => s + r.taxable, 0);
// Amazon Karnataka refund (-300) + Flipkart Karnataka (800) merged into one row per (state,rate,inter):
// same rate/inter-ness so should be ONE row, not two.
check('Karnataka merged into a single B2CS row (Amazon+Flipkart same state/rate/inter)', karnatakaAmazon.length === 1);
check('Karnataka merged net = -300 + 800 = 500', Math.abs(karnatakaNet - 500) < 0.01);
check('negative_net_state warning raised (for the Amazon-only Karnataka leg before merge)', result.flags.some((f) => f.code === 'negative_net_state'));
check('unmatched_refund warning raised for CN-002', result.flags.some((f) => f.code === 'unmatched_refund'));
check('flipkart_state_net_mismatch blocker raised for Rajasthan', result.flags.some((f) => f.code === 'flipkart_state_net_mismatch'));
check('flipkart_hsn_total_mismatch NOT raised (totals were made to tie)', !result.flags.some((f) => f.code === 'flipkart_hsn_total_mismatch'));
check('flipkart_tcs_total_mismatch NOT raised (totals were made to tie)', !result.flags.some((f) => f.code === 'flipkart_tcs_total_mismatch'));
const hsn3926 = result.tables.hsn.find((r) => r.hsn === '3926');
// Regression guard for the real bug found against June 2026 data: Table 12 (HSN) must include
// B2B supplies too, not just B2C. Amazon B2C net qty for 3926 is 0 (two shipments net out with
// two refunds), Amazon B2B contributes 2 (INV-B01 + INV-007, both qty 1), Flipkart Section 12
// contributes 5 -> 7 total. Before this fix B2B was silently excluded, undercounting Table 12.
check('HSN 3926 qty includes B2B contribution (0 B2C net + 2 B2B + 5 Flipkart = 7)', hsn3926 && hsn3926.qty === 7);
const amazonInvoices = result.tables.docs.find((d) => d.series === 'Amazon Invoices');
check('Amazon invoice series spans INV-003..INV-007 with 1 cancelled (INV-002)', amazonInvoices && amazonInvoices.cancelled === 1);
// Regression guard for the real bug found against June 2026 data: Amazon credit notes (CN-001
// matched to a shipment, CN-002 unmatched) must show up as their OWN Table 13 series, not be
// silently dropped the way they were before this fix.
const amazonCreditNotes = result.tables.docs.find((d) => d.series === 'Amazon Credit Notes');
check('Amazon credit notes appear as their own Table 13 series (CN-001, CN-002)', amazonCreditNotes && amazonCreditNotes.totalNumber === 2);
const flipkartDocs = result.tables.docs.find((d) => d.series === 'Flipkart');
check('Flipkart Section 13 docs row passed through', flipkartDocs && flipkartDocs.totalNumber === 10);
check('Total net documents = 3 Amazon invoices net + 2 Amazon credit notes + 9 Flipkart net = 14', result.summary.docCount === 14);

// Regression guard for the real bug found against June 2026 data: a Shipment row carrying an
// explicit half-rate 'Cgst Rate' column (9, not the true 18% total) must still bucket together
// with its matching Refund row (which has no such column and falls back to the correctly-implied
// total rate), netting to exactly zero. This is the Odisha "should be ₹0 but showed ₹1,693" bug.
const b2cRateBugHeaders = ['Transaction Type', 'Shipment Item Id', 'Invoice Number', 'Invoice Date', 'Tax Exclusive Gross', 'Cgst Tax', 'Sgst Tax', 'Cgst Rate', 'Credit Note No', 'Credit Note Date', 'Ship From State', 'Ship To State'];
const b2cRateBugRows = [
  { 'Transaction Type': 'Shipment', 'Shipment Item Id': 'SIX1', 'Invoice Number': 'INV-X01', 'Invoice Date': '2026-06-08', 'Tax Exclusive Gross': 2000, 'Cgst Tax': 180, 'Sgst Tax': 180, 'Cgst Rate': 9, 'Ship From State': 'Uttar Pradesh', 'Ship To State': 'Odisha' },
  { 'Transaction Type': 'Refund', 'Shipment Item Id': 'SIX1', 'Invoice Number': 'INV-X01', 'Tax Exclusive Gross': -2000, 'Cgst Tax': -180, 'Sgst Tax': -180, 'Credit Note No': 'CN-X01', 'Credit Note Date': '2026-06-15', 'Ship From State': 'Uttar Pradesh', 'Ship To State': 'Odisha' },
];
const rateBugCsv = csv(b2cRateBugHeaders, b2cRateBugRows);
const rateBugResult = reconcileGstPeriod({ gstin: '09XYZAB5678L1Z3', period: '2026-06', amazonB2cBuffer: rateBugCsv });
const odishaRow = rateBugResult.tables.b2cs.find((r) => r.state === 'Odisha');
check('Full-refund Odisha nets to exactly zero despite a half-rate Cgst Rate column on the shipment only', !odishaRow || Math.abs(odishaRow.taxable) < 0.01);
check('Odisha does NOT split into two separate rows (rate-bucket collision fixed)', rateBugResult.tables.b2cs.filter((r) => r.state === 'Odisha').length <= 1);

// Regression guard for the real bug found against June 2026 data: "File upload requirements"
// (GST-AUTOMATION-SPEC.md) says none of the 3 files are mandatory and a single-file upload
// (Flipkart-only, reproduced live) produced a silent blank/zero result instead of a real
// calculation. None of these 3 checks should crash or blank out.
const flipkartOnlyResult = reconcileGstPeriod({ gstin: '09XYZAB5678L1Z3', period: '2026-06', flipkartBuffer: flipkartBuffer() });
check('Flipkart-only calculation produces a real (non-zero) result, not a silent blank', flipkartOnlyResult.summary.taxable > 0);
check('Flipkart-only calculation warns about missing Amazon files, not silently', flipkartOnlyResult.flags.some((f) => f.code === 'missing_amazon_b2c'));
check('Flipkart-only calculation still produces real B2CS rows from the Flipkart data', flipkartOnlyResult.tables.b2cs.length > 0);

const amazonOnlyResult = reconcileGstPeriod({ gstin: '09XYZAB5678L1Z3', period: '2026-06', amazonB2cBuffer: csv(b2cHeaders, b2cRows) });
check('Amazon-B2C-only calculation produces a real (non-zero) result, not a silent blank', amazonOnlyResult.summary.taxable > 0);

const noFilesResult = reconcileGstPeriod({ gstin: '09XYZAB5678L1Z3', period: '2026-06' });
check('Zero files uploaded raises an explicit blocker instead of failing silently', noFilesResult.flags.some((f) => f.code === 'no_files_provided'));

// Regression guard: if a real Flipkart file's sheet names don't match any of the candidates
// (the actual root cause of the live silent-failure bug), that must surface as a loud, specific
// blocker naming the sheets that WERE found, not a quiet zero.
const wrongSheetNamesResult = reconcileGstPeriod({ gstin: '09XYZAB5678L1Z3', period: '2026-06', flipkartBuffer: flipkartBuffer({ sec7b2: 'B2C Interstate Summary' }) });
check('Unrecognised Section 7(B)(2) sheet name raises flipkart_sheet_not_found, not a silent blank', wrongSheetNamesResult.flags.some((f) => f.code === 'flipkart_sheet_not_found'));

// Regression guard for the LIVE bug: a real Flipkart file (confirmed by hand, May and June 2026)
// names its sheets "Section <N> in GSTR-<form>" (e.g. "Section 7(B)(2) in GSTR-1"), which an
// exact-equality-after-normalization match can never catch (it's a real sheet with extra suffix
// text, not a typo). All 4 sheets must resolve correctly under this exact real-world naming.
const realWorldNamesResult = reconcileGstPeriod({ gstin: '09XYZAB5678L1Z3', period: '2026-06', flipkartBuffer: flipkartBuffer({
  sec7b2: 'Section 7(B)(2) in GSTR-1', sec12: 'Section 12 in GSTR-1', sec13: 'Section 13 in GSTR-1', sec3: 'Section 3 in GSTR-8',
}) });
check('Real-world "Section 7(B)(2) in GSTR-1" sheet name is found (no flipkart_sheet_not_found)', !realWorldNamesResult.flags.some((f) => f.code === 'flipkart_sheet_not_found'));
check('Real-world Flipkart sheet names still produce the correct state-wise data', realWorldNamesResult.tables.b2cs.some((r) => r.state === 'Karnataka' && r.taxable === 800));
check('Real-world Flipkart sheet names still produce the correct HSN data', realWorldNamesResult.tables.hsn.some((r) => r.hsn === '3926' && r.qty === 5));
check('Real-world Flipkart sheet names still produce the correct Documents Issued data', realWorldNamesResult.tables.docs.some((d) => d.series === 'Flipkart' && d.totalNumber === 10));
check('Real-world Flipkart sheet names do NOT raise flipkart_hsn_total_mismatch (Section 12 found and ties out)', !realWorldNamesResult.flags.some((f) => f.code === 'flipkart_hsn_total_mismatch'));

// Regression guard for a second "shows Done but nothing appears" bug: 'Transaction Type' is a
// CELL VALUE, not a header, so header-normalization never touches it. A raw === 'Shipment'
// comparison would classify every row as unrecognized (silently zero GST impact) if the real
// file spells it differently, e.g. lowercase or "Shipped" instead of "Shipment".
const lowercaseTxTypeHeaders = ['Transaction Type', 'Shipment Item Id', 'Invoice Number', 'Invoice Date', 'Tax Exclusive Gross', 'Cgst Tax', 'Sgst Tax', 'Ship From State', 'Ship To State'];
const lowercaseTxTypeRows = [
  { 'Transaction Type': 'shipment', 'Shipment Item Id': 'SIY1', 'Invoice Number': 'INV-Y01', 'Invoice Date': '2026-06-08', 'Tax Exclusive Gross': 1000, 'Cgst Tax': 90, 'Sgst Tax': 90, 'Ship From State': 'Uttar Pradesh', 'Ship To State': 'Uttar Pradesh' },
  { 'Transaction Type': 'Shipped', 'Shipment Item Id': 'SIY2', 'Invoice Number': 'INV-Y02', 'Invoice Date': '2026-06-09', 'Tax Exclusive Gross': 500, 'Cgst Tax': 45, 'Sgst Tax': 45, 'Ship From State': 'Uttar Pradesh', 'Ship To State': 'Uttar Pradesh' },
];
const lowercaseTxTypeResult = reconcileGstPeriod({ gstin: '09XYZAB5678L1Z3', period: '2026-06', amazonB2cBuffer: csv(lowercaseTxTypeHeaders, lowercaseTxTypeRows) });
check('Lowercase/varied Transaction Type values ("shipment", "Shipped") are still recognized as Shipment', lowercaseTxTypeResult.summary.taxable === 1500);
check('Lowercase Transaction Type does NOT raise the unrecognized-type blocker', !lowercaseTxTypeResult.flags.some((f) => f.code === 'amazon_b2c_transaction_type_unrecognized'));

// And the loud-failure side: if NONE of the values match any known spelling at all, that must
// block with the actual values found, not silently return a blank/zero result.
const unknownTxTypeHeaders = ['Transaction Type', 'Invoice Number', 'Invoice Date', 'Tax Exclusive Gross', 'Ship From State', 'Ship To State'];
const unknownTxTypeRows = [
  { 'Transaction Type': 'Dispatch Completed', 'Invoice Number': 'INV-Z01', 'Invoice Date': '2026-06-08', 'Tax Exclusive Gross': 1000, 'Ship From State': 'Uttar Pradesh', 'Ship To State': 'Uttar Pradesh' },
];
const unknownTxTypeResult = reconcileGstPeriod({ gstin: '09XYZAB5678L1Z3', period: '2026-06', amazonB2cBuffer: csv(unknownTxTypeHeaders, unknownTxTypeRows) });
const unknownTxTypeFlag = unknownTxTypeResult.flags.find((f) => f.code === 'amazon_b2c_transaction_type_unrecognized');
check('Totally unrecognized Transaction Type values raise a blocker naming the actual value found', unknownTxTypeFlag && unknownTxTypeFlag.message.includes('Dispatch Completed'));

// Regression guard for the LIVE bug reported after the sheet-name fix shipped: sheet found, rows
// have a resolvable state (so flipkart_state_col_unmatched never fires), but the money columns
// ("Gross Taxable Value" etc.) use headers this file's candidates don't match, so every row taxes
// at ₹0 and Flipkart's whole contribution silently disappears from the totals with ZERO flags,
// producing exactly the reported symptom (16 documents instead of 54, no error shown).
function flipkartBufferWrongMoneyColumns() {
  const wb = XLSX.utils.book_new();
  const sec7b2 = XLSX.utils.json_to_sheet([
    { 'Place of Supply': 'Karnataka', Rate: 18, 'Some Other Gross Column': 800, 'Some Other Return Column': 0, 'Some Other Net Column': 800, IGST: 144 },
  ]);
  XLSX.utils.book_append_sheet(wb, sec7b2, 'Section 7(B)(2) in GSTR-1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
const wrongMoneyColsResult = reconcileGstPeriod({ gstin: '09XYZAB5678L1Z3', period: '2026-06', flipkartBuffer: flipkartBufferWrongMoneyColumns() });
check('Flipkart rows with a resolvable state but unmatched money columns raise flipkart_state_amount_col_unmatched', wrongMoneyColsResult.flags.some((f) => f.code === 'flipkart_state_amount_col_unmatched'));
check('That blocker does NOT fire when money columns tie out correctly (existing fixture)', !flipkartOnlyResult.flags.some((f) => f.code === 'flipkart_state_amount_col_unmatched'));

// Regression guard for the LIVE bug reported this round: the exact real-world column set the
// admin confirmed by hand ("GSTIN, Place of Supply, Gross Taxable Value, Taxable Sales Return
// Value, Net Taxable Value, IGST %, IGST Amount, Cess %, Cess Amount, State, State Code") must
// parse correctly end to end. This is also the exact case that exposed a second, self-inflicted
// bug: 'IGST %' and 'IGST' (an entirely different, already-present column) both normalized to
// the same key once '%' was stripped, so the new 'IGST %' candidate silently grabbed the IGST
// AMOUNT column's value instead of the rate; normKey now keeps '%' specifically to prevent this.
function flipkartBufferRealColumnSet() {
  const wb = XLSX.utils.book_new();
  const sec7b2 = XLSX.utils.json_to_sheet([
    { GSTIN: '09XYZAB5678L1Z3', 'Place of Supply': 'Karnataka', 'Gross Taxable Value': 800, 'Taxable Sales Return Value': 0, 'Net Taxable Value': 800, 'IGST %': 18, 'IGST Amount': 144, 'Cess %': 0, 'Cess Amount': 0, State: 'Karnataka', 'State Code': 29 },
    { GSTIN: '09XYZAB5678L1Z3', 'Place of Supply': 'Maharashtra', 'Gross Taxable Value': '₹1,200.00', 'Taxable Sales Return Value': '₹200.00', 'Net Taxable Value': '₹1,000.00', 'IGST %': '18%', 'IGST Amount': 180, 'Cess %': 0, 'Cess Amount': 0, State: 'Maharashtra', 'State Code': 27 },
  ]);
  XLSX.utils.book_append_sheet(wb, sec7b2, 'Section 7(B)(2) in GSTR-1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
const realColumnSetResult = reconcileGstPeriod({ gstin: '09XYZAB5678L1Z3', period: '2026-06', flipkartBuffer: flipkartBufferRealColumnSet() });
check('Real-world Flipkart column set does NOT raise flipkart_state_amount_col_unmatched', !realColumnSetResult.flags.some((f) => f.code === 'flipkart_state_amount_col_unmatched'));
check('Real-world Flipkart column set: net taxable totals 800 + 1000 = 1800 (incl. currency-formatted cells)', realColumnSetResult.summary.taxable === 1800);
const karnatakaRow = realColumnSetResult.tables.b2cs.find((r) => r.state === 'Karnataka');
check('Real-world Flipkart column set: IGST % (18) read as the rate, not the IGST Amount column (144)', karnatakaRow && karnatakaRow.rate === 18);

// Regression guard for the LIVE bug reported after every column-name fix shipped: calculate
// returned "Done" with EXACTLY ONE flag (the unrelated "no B2C file" warning), zero Flipkart
// flags, and ₹0 across the board. That combination is only possible if sheet_to_json returned
// literally zero rows, which happens when a title/banner row sits above the real header row (a
// very common real-world export pattern) and plain "row 1 is always the header" parsing breaks.
function flipkartBufferWithTitleRowAboveHeader() {
  const wb = XLSX.utils.book_new();
  const aoa = [
    ['Flipkart GSTR-1 Report', '', '', '', '', '', '', '', '', '', ''], // banner/title row
    ['GSTIN', 'Place of Supply', 'Gross Taxable Value', 'Taxable Sales Return Value', 'Net Taxable Value', 'IGST %', 'IGST Amount', 'Cess %', 'Cess Amount', 'State', 'State Code'],
    ['09XYZAB5678L1Z3', 'Karnataka', 800, 0, 800, 18, 144, 0, 0, 'Karnataka', 29],
    ['09XYZAB5678L1Z3', 'Kerala', 1500, 0, 1500, 18, 270, 0, 0, 'Kerala', 32],
  ];
  const sec7b2 = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, sec7b2, 'Section 7(B)(2) in GSTR-1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
const titleRowResult = reconcileGstPeriod({ gstin: '09XYZAB5678L1Z3', period: '2026-06', flipkartBuffer: flipkartBufferWithTitleRowAboveHeader() });
check('Title/banner row above the real header does NOT produce a silent ₹0 result', titleRowResult.summary.taxable > 0);
check('Title row case: net taxable = 800 + 1500 = 2300, correctly skipping the banner row', titleRowResult.summary.taxable === 2300);
check('Title row case does NOT raise flipkart_state_sheet_empty (header correctly auto-detected)', !titleRowResult.flags.some((f) => f.code === 'flipkart_state_sheet_empty'));
check('Title row case does NOT raise flipkart_state_col_unmatched', !titleRowResult.flags.some((f) => f.code === 'flipkart_state_col_unmatched'));

// A genuinely empty sheet (header only, zero data rows) must still be flagged, not silently zero.
function flipkartBufferHeaderOnlyNoData() {
  const wb = XLSX.utils.book_new();
  const sec7b2 = XLSX.utils.aoa_to_sheet([
    ['GSTIN', 'Place of Supply', 'Gross Taxable Value', 'Taxable Sales Return Value', 'Net Taxable Value', 'IGST %', 'IGST Amount'],
  ]);
  XLSX.utils.book_append_sheet(wb, sec7b2, 'Section 7(B)(2) in GSTR-1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
const emptyDataResult = reconcileGstPeriod({ gstin: '09XYZAB5678L1Z3', period: '2026-06', flipkartBuffer: flipkartBufferHeaderOnlyNoData() });
check('Header-only sheet (zero data rows) raises flipkart_state_sheet_empty, not a silent ₹0', emptyDataResult.flags.some((f) => f.code === 'flipkart_state_sheet_empty'));

console.log('\n── Checks ──');
let failed = 0;
for (const c of checks) {
  console.log(`${c.ok ? '✓' : '✗'} ${c.name}`);
  if (!c.ok) failed++;
}
console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
