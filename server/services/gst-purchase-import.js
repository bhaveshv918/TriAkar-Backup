// ─────────────────────────────────────────────────────────────────────────────
// GST-sourced bulk import into Business OS accounting (Purchases / Expenses).
//
// Per GST-AUTOMATION-SPEC.md "Downstream: feeding transactions into Business OS
// accounting": the GSTR-2B B2B sheet (government-generated, supplier-filed inward-supply
// data) is the source for backfilling biz_purchases/biz_expenses so a financial
// year-end balance sheet doesn't need the same transactions re-entered by hand.
//
// Pure functions here (parse + categorize), no DB access — same separation as
// gst-reconciliation.js. The controller does the Supabase reads/writes and the
// duplicate-detection lookup against biz_gst_import_lines.
// ─────────────────────────────────────────────────────────────────────────────
import * as XLSX from 'xlsx';

function parseNumber(v) {
  if (v === '' || v === null || v === undefined) return 0;
  const n = Number(String(v).replace(/[, ₹]/g, ''));
  return Number.isFinite(n) ? n : 0;
}
function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
function normKey(s) { return String(s ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, ''); }

/** DD/MM/YYYY (the GST portal's date format on every export) -> YYYY-MM-DD. */
function parseGstDate(v) {
  const s = String(v || '').trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

// Government-template columns are fixed by position (confirmed against real March/April/
// May/June 2026 B2B sheets, single-sheet download and full-workbook download alike), but the
// exact header ROW moves if the portal ever adds a banner row above it, so the row itself is
// located by scanning for its one truly unique cell ("GSTIN of supplier") rather than assumed
// to always be row 4 like gst-reconciliation.js does for the Flipkart/Amazon files.
const COL = {
  gstin: 0, vendorName: 1, invoiceNumber: 2, invoiceType: 3, invoiceDate: 4, invoiceValue: 5,
  placeOfSupply: 6, rcm: 7, taxable: 8, igst: 9, cgst: 10, sgst: 11, cess: 12,
  gstr1Period: 13,
};

function findB2bSheet(wb) {
  // Exact match first (avoids "B2B" prefix-matching "B2BA" / "B2B-CDNR", which are different
  // tables — amendments and credit/debit notes, not part of this import).
  const exact = wb.SheetNames.find((n) => normKey(n) === 'b2b');
  if (exact) return wb.Sheets[exact];
  return null;
}

function findHeaderRow(aoa) {
  for (let i = 0; i < Math.min(aoa.length, 15); i++) {
    if (normKey(aoa[i]?.[0]) === 'gstinofsupplier') return i;
  }
  return -1;
}

/**
 * @param {Buffer} buffer GSTR-2B B2B xlsx (single-sheet "B2B_..." download, or the full
 *   multi-sheet GSTR-2B workbook — both confirmed to carry the same "B2B" sheet internally).
 * @returns {{ rows: Array, error: string|null }}
 */
export function parseGstr2bB2b(buffer) {
  let wb;
  try {
    wb = XLSX.read(buffer, { type: 'buffer' });
  } catch (e) {
    return { rows: [], error: `Could not parse the GSTR-2B file: ${e.message}` };
  }
  const ws = findB2bSheet(wb);
  if (!ws) {
    return { rows: [], error: `Could not find a "B2B" sheet in this file. Sheets present: ${wb.SheetNames.join(', ') || '(none)'}.` };
  }
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });
  const headerIdx = findHeaderRow(aoa);
  if (headerIdx === -1) {
    return { rows: [], error: 'Found a "B2B" sheet but could not locate its header row ("GSTIN of supplier"). The GSTR-2B export format may have changed.' };
  }
  const dataStart = headerIdx + 2; // row headerIdx = table headers, +1 = sub-headers, +2 = first data row
  const rows = [];
  for (let i = dataStart; i < aoa.length; i++) {
    const r = aoa[i];
    if (!r || r.every((c) => String(c ?? '').trim() === '')) continue;
    const gstin = String(r[COL.gstin] || '').trim().toUpperCase();
    if (!gstin) continue;
    rows.push({
      gstin,
      vendorName: String(r[COL.vendorName] || '').trim(),
      invoiceNumber: String(r[COL.invoiceNumber] || '').trim(),
      invoiceDate: parseGstDate(r[COL.invoiceDate]),
      rcm: normKey(r[COL.rcm]) === 'yes',
      taxable: round2(parseNumber(r[COL.taxable])),
      igst: round2(parseNumber(r[COL.igst])),
      cgst: round2(parseNumber(r[COL.cgst])),
      sgst: round2(parseNumber(r[COL.sgst])),
      cess: round2(parseNumber(r[COL.cess])),
      gstr1Period: String(r[COL.gstr1Period] || '').trim(),
    });
  }
  return { rows, error: null };
}

// Amazon/Flipkart's own fee-charging entities. Confirmed with the user: marketplace payouts
// logged in biz_income are already NET of platform fee and return fee (settlement = sale value
// minus these, only the net lands in the bank). Importing these lines again as a separate
// Expense would double-subtract the same fee from the balance sheet, so they default to
// "exclude" rather than "expense" — but are still surfaced in the review list (never silently
// dropped), with an override available since the admin may disagree for a specific invoice.
const MARKETPLACE_FEE_VENDOR_KEYWORDS = ['amazonsellerservices', 'clicktechretail', 'flipkartinternet', 'retailez'];

/**
 * Suggest a target table + category for one GSTR-2B B2B line, using ONLY the categories that
 * already exist in biz_expenses/biz_purchases (per spec: don't invent a new scheme). Never
 * silent — every row gets a `reason` explaining the suggestion, shown on the review screen so
 * the admin can override before anything is committed.
 */
export function suggestCategorization(row) {
  const name = normKey(row.vendorName);

  if (MARKETPLACE_FEE_VENDOR_KEYWORDS.some((k) => name.includes(k))) {
    return { target: 'exclude', category: null, reason: `${row.vendorName} is a marketplace fee entity, already netted into the payout amount logged in Money In/Out. Importing this separately would double-count it.` };
  }
  if (row.rcm || name.includes('porter')) {
    return { target: 'expense', category: 'shipping', reason: 'Reverse-charge / GTA (delivery) charge, e.g. Porter.' };
  }
  if (name.includes('google')) {
    return { target: 'expense', category: 'marketing', reason: 'Ad spend.' };
  }
  if (name.includes('razorpay')) {
    return { target: 'expense', category: 'other', reason: 'Payment gateway fee (no dedicated category exists yet).' };
  }
  if (name.includes('bank')) {
    return { target: 'expense', category: 'other', reason: 'Bank charges (no dedicated category exists yet).' };
  }
  // Unrecognized vendor: default to Purchases (raw material) since most B2B invoices for this
  // business are material/component vendors, but flag for the admin to confirm, don't assume.
  return { target: 'purchase', category: 'raw_material', reason: 'Unrecognized vendor, please verify the category before importing.' };
}
