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
  // 5. Refund matching #4, same month, nets Maharashtra down.
  { 'Transaction Type': 'Refund', 'Order Id': 'O4', 'Shipment Item Id': 'SI4', 'Invoice Number': 'INV-004', 'Credit Note No': 'CN-001', 'Credit Note Date': '2026-06-20', 'Tax Exclusive Gross': 500, 'Igst Tax': 90, 'Hsn/Sac': '3926', Quantity: 1, 'Ship From State': 'Uttar Pradesh', 'Ship To State': 'Maharashtra' },
  // 6. Refund with NO matching shipment in this file, referencing an earlier month's invoice.
  //    Lands in Karnataka which has no other current-month sale -> negative net, flagged.
  { 'Transaction Type': 'Refund', 'Order Id': 'O99', 'Shipment Item Id': 'SI99', 'Invoice Number': 'INV-OLD-099', 'Credit Note No': 'CN-002', 'Credit Note Date': '2026-06-25', 'Tax Exclusive Gross': 300, 'Igst Tax': 54, 'Hsn/Sac': '3926', Quantity: 1, 'Ship From State': 'Uttar Pradesh', 'Ship To State': 'Karnataka' },
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
  { 'Transaction Type': 'Refund', 'Shipment Item Id': 'SIX1', 'Invoice Number': 'INV-X01', 'Tax Exclusive Gross': 2000, 'Cgst Tax': 180, 'Sgst Tax': 180, 'Credit Note No': 'CN-X01', 'Credit Note Date': '2026-06-15', 'Ship From State': 'Uttar Pradesh', 'Ship To State': 'Odisha' },
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

console.log('\n── Checks ──');
let failed = 0;
for (const c of checks) {
  console.log(`${c.ok ? '✓' : '✗'} ${c.name}`);
  if (!c.ok) failed++;
}
console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
