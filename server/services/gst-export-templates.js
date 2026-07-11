// ─────────────────────────────────────────────────────────────────────────────
// GST Filing Automation, CSV export matching the GST Offline Tool's section-wise
// CSV format (b2b.csv, b2cs.csv, hsn.csv, docs.csv), per GST-AUTOMATION-SPEC.md:
// generate CSVs for the tool's "IMPORT CSV" flow rather than hand-building the
// upload JSON (the JSON has an internal version/checksum a hand-rolled file fails).
//
// CAVEAT (do not remove): the column names below are the well-documented GSTR-1
// field names used consistently across GSTN's own return-format documentation and
// major GST software (Tally, ClearTax, etc.), but the *exact* literal headers/column
// order inside a specific version of the Offline Tool's own CSV template were not
// verifiable from this environment (no internet access to gst.gov.in, no bundled
// copy of Section_wise_CSV_files in this repo). Per the spec: do ONE real round-trip
// "IMPORT CSV" test against the actual GST Offline Tool before relying on this for a
// real filing, and if headers are rejected, fix them against the real downloaded
// template rather than guessing again.
// ─────────────────────────────────────────────────────────────────────────────

function csvEscape(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers, rows) {
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  return lines.join('\r\n');
}

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
const invoiceTaxRate = (r) => round2(((r.cgst * 2 + r.igst) / (r.taxable || 1)) * 100);

export function buildB2bCsv(b2bRows) {
  const headers = [
    'GSTIN/UIN of Recipient', 'Invoice Number', 'Invoice date', 'Invoice Value',
    'Place Of Supply', 'Reverse Charge', 'Applicable % of Tax Rate', 'Invoice Type',
    'E-Commerce GSTIN', 'Rate', 'Taxable Value', 'Cess Amount',
  ];
  const rows = b2bRows.map((r) => ({
    'GSTIN/UIN of Recipient': r.gstin,
    'Invoice Number': r.invoiceNumber,
    'Invoice date': r.invoiceDate,
    'Invoice Value': round2(r.taxable + r.cgst + r.sgst + r.igst),
    'Place Of Supply': r.state,
    'Reverse Charge': 'N',
    'Applicable % of Tax Rate': '',
    'Invoice Type': 'Regular',
    'E-Commerce GSTIN': '', // OE by default, per spec (see gst-reconciliation.js summary/flags)
    'Rate': invoiceTaxRate(r),
    'Taxable Value': round2(r.taxable),
    'Cess Amount': 0,
  }));
  return toCsv(headers, rows);
}

export function buildB2csCsv(b2csRows) {
  const headers = ['Type', 'Place Of Supply', 'Applicable % of Tax Rate', 'Rate', 'Taxable Value', 'Cess Amount', 'E-Commerce GSTIN'];
  const rows = b2csRows.map((r) => ({
    'Type': 'OE',
    'Place Of Supply': r.state,
    'Applicable % of Tax Rate': '',
    'Rate': r.rate,
    'Taxable Value': round2(r.taxable),
    'Cess Amount': 0,
    'E-Commerce GSTIN': '',
  }));
  return toCsv(headers, rows);
}

export function buildHsnCsv(hsnRows) {
  const headers = [
    'HSN', 'Description', 'UQC', 'Total Quantity', 'Total Value', 'Rate',
    'Taxable Value', 'Integrated Tax Amount', 'Central Tax Amount', 'State/UT Tax Amount', 'Cess Amount',
  ];
  const rows = hsnRows.map((r) => ({
    'HSN': r.hsn,
    'Description': '',
    'UQC': 'PCS',
    'Total Quantity': r.qty,
    'Total Value': round2(r.taxable + r.cgst + r.sgst + r.igst),
    'Rate': round2(((r.cgst * 2 + r.igst) / (r.taxable || 1)) * 100),
    'Taxable Value': round2(r.taxable),
    'Integrated Tax Amount': round2(r.igst),
    'Central Tax Amount': round2(r.cgst),
    'State/UT Tax Amount': round2(r.sgst),
    'Cess Amount': 0,
  }));
  return toCsv(headers, rows);
}

export function buildDocsCsv(docsRows) {
  const headers = ['Nature of Document', 'Sr. No. From', 'Sr. No. To', 'Total Number', 'Cancelled'];
  const rows = docsRows.map((d) => ({
    'Nature of Document': d.series,
    'Sr. No. From': d.from,
    'Sr. No. To': d.to,
    'Total Number': d.totalNumber,
    'Cancelled': d.cancelled,
  }));
  return toCsv(headers, rows);
}

export function buildExportCsv(table, tables) {
  if (table === 'b2b') return buildB2bCsv(tables.b2b);
  if (table === 'b2cs') return buildB2csCsv(tables.b2cs);
  if (table === 'hsn') return buildHsnCsv(tables.hsn);
  if (table === 'docs') return buildDocsCsv(tables.docs);
  throw new Error(`Unknown GST export table "${table}"`);
}
