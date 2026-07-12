// ─────────────────────────────────────────────────────────────────────────────
// GST Filing Automation, pure reconciliation engine (no DB access).
//
// Reconciles the 3 monthly source files (Amazon MTR B2B/B2C CSV, Flipkart GSTR-1/8
// XLSX) into GSTR-1 tables (B2B, B2CS, HSN, Documents Issued), per the algorithm
// documented in GST-AUTOMATION-SPEC.md. Unit-testable in isolation, takes raw file
// buffers in, returns { summary, tables, flags } out.
//
// CAVEAT: the exact column headers used by Amazon's MTR export and Flipkart's GSTR-1
// report were not available to verify against (no sample files in this repo). Column
// lookup below tries several known/likely header spellings per logical field and
// raises a `blocker` flag naming the field when nothing matches, rather than silently
// computing wrong tax figures from a missing column. Before relying on this for a real
// filing, run it once against a real month's files and confirm every field populated
// (no "missing column" blockers) and the totals look sane.
// ─────────────────────────────────────────────────────────────────────────────
import { parse as parseCsv } from 'csv-parse/sync';
import * as XLSX from 'xlsx';

// Official GST state/UT codes (public, stable reference data, not seller-specific config).
export const STATE_CODES = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
  '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
  '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra', '28': 'Andhra Pradesh (Old)',
  '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu',
  '34': 'Puducherry', '35': 'Andaman and Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh',
  '38': 'Ladakh', '97': 'Other Territory', '99': 'Centre Jurisdiction',
};

// '%' is kept (not stripped like other punctuation) so a rate column ("IGST %") never collapses
// to the same key as its corresponding amount column ("IGST") once spacing/case is normalized
// away, since those two columns commonly coexist on the same sheet and mean very different things.
//
// Confirmed against a real live Flipkart export: every money column carries a trailing currency
// suffix as its own word, e.g. "Gross Taxable Value Rs.", "IGST Amount Rs.", which an exact-match
// candidate list like "Gross Taxable Value" can never catch. Strip that standalone " Rs"/" Rs."
// token (only when it's its own trailing word, not any string ending in "rs", so a real column
// legitimately named e.g. "Years" is untouched) before the punctuation-stripping below.
function normKey(s) {
  return String(s ?? '').trim().toLowerCase().replace(/\s+rs\.?\s*$/i, '').replace(/[^a-z0-9%]/g, '');
}

/** Build a case/punctuation-insensitive field picker for one parsed row. */
function rowPicker(row) {
  const map = new Map();
  for (const k of Object.keys(row)) map.set(normKey(k), row[k]);
  return (...candidates) => {
    for (const c of candidates) {
      const v = map.get(normKey(c));
      if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
    }
    return '';
  };
}

/**
 * Real-world spreadsheet exports sometimes carry thousands separators, a currency symbol, a
 * trailing "%", a non-breaking space, or accounting-style parentheses for negatives, none of
 * which `Number()` tolerates on its own (silently NaN -> would parse as 0 with the old version).
 * Strip all of that before converting, so a genuinely-populated money/rate cell never silently
 * reads as zero just because of formatting.
 */
function parseNumber(v) {
  if (v === '' || v === null || v === undefined) return 0;
  let s = String(v).trim();
  if (!s) return 0;
  const negative = /^\(.*\)$/.test(s);
  if (negative) s = s.slice(1, -1);
  s = s.replace(/[, %₹$]/g, '').replace(/\bRs\.?\b/gi, '').replace(/\bINR\b/gi, '').trim();
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return negative ? -Math.abs(n) : n;
}

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

/** Amazon date fields commonly arrive as YYYY-MM-DD or DD-MM-YYYY or DD/MM/YYYY. */
function parseFlexDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function monthOf(isoDate) { return isoDate ? isoDate.slice(0, 7) : null; }

function blocker(code, message, context) { return { severity: 'blocker', code, message, context: context || {} }; }
function warning(code, message, context) { return { severity: 'warning', code, message, context: context || {} }; }

function parseCsvBuffer(buffer) {
  const text = buffer.toString('utf8').replace(/^﻿/, '');
  return parseCsv(text, { columns: true, skip_empty_lines: true, trim: true, relax_column_count: true });
}

/**
 * Real Flipkart exports were found to name sheets like "Section 7(B)(2) in GSTR-1" rather than
 * the bare "Section 7(B)(2)", a suffix naming an exact-equality match after normalization can
 * never catch, and the old code printed the sheet in its own "sheets present" error list while
 * still reporting it as unmatched. Match by prefix instead: either the normalized sheet name
 * starts with the normalized candidate (handles the "... in GSTR-1/8" suffix), or vice versa
 * (handles a candidate carrying extra text the real, shorter sheet name doesn't have). Plain
 * substring containment (`includes`) is deliberately avoided: "Section 1" would then falsely
 * match inside "Section 12 in GSTR-1" since normalization strips the space between them.
 */
/**
 * Plain `sheet_to_json` blindly trusts row 1 as the header row. Real-world exports commonly have
 * a title/banner row (or several) above the actual header, e.g. a merged "Flipkart GSTR-1 Report"
 * row spanning the top: sheet_to_json would then either produce garbage single-cell keys, or, if
 * the sheet's `!ref` dimensions get confused by the banner, silently return ZERO rows even though
 * real data exists a row or two down. This produced exactly the reported bug: sheet found, no
 * column-mismatch flags (because there was nothing to mismatch, `sheet_to_json` returned nothing
 * at all), totals stayed ₹0. Scans the first several rows for the one that actually looks like a
 * header (several populated cells, at least one recognisable GST-report keyword) instead of
 * assuming it's always row 1.
 */
const HEADER_ROW_HINTS = ['gstin', 'placeofsupply', 'state', 'taxable', 'hsn', 'invoice', 'section', 'rate', 'quantity', 'document', 'gross', 'igst', 'cgst', 'sgst'];

/**
 * `sheet_to_json` trusts the sheet's own `!ref` dimension tag to know how much of the sheet to
 * read. Confirmed against a real live Flipkart export: its report generator (not real Excel)
 * writes a `!ref` that understates the actual populated range, so `sheet_to_json` silently
 * truncates to just the header row, header row detected fine, zero data rows, exactly the
 * flipkart_state_sheet_empty blocker seen in production. Recompute the true range by scanning
 * actual cell addresses present on the worksheet instead of trusting the claimed dimensions.
 */
function actualSheetRange(ws) {
  let minR = Infinity, minC = Infinity, maxR = -1, maxC = -1;
  for (const addr in ws) {
    if (addr[0] === '!') continue;
    const cell = XLSX.utils.decode_cell(addr);
    if (cell.r < minR) minR = cell.r;
    if (cell.c < minC) minC = cell.c;
    if (cell.r > maxR) maxR = cell.r;
    if (cell.c > maxC) maxC = cell.c;
  }
  if (maxR < 0) return null; // no cells at all
  return { s: { r: minR, c: minC }, e: { r: maxR, c: maxC } };
}

function sheetToRows(ws) {
  const range = actualSheetRange(ws);
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false, range: range || undefined });
  if (!aoa.length) return [];
  let headerRowIdx = 0;
  let bestScore = -1;
  for (let i = 0; i < Math.min(aoa.length, 15); i++) {
    const row = aoa[i];
    const populated = row.filter((c) => String(c ?? '').trim() !== '').length;
    if (populated < 2) continue; // a single banner cell spanning the row can't be a real header
    const normCells = row.map((c) => normKey(c));
    const hintMatches = HEADER_ROW_HINTS.filter((h) => normCells.some((c) => c.includes(h))).length;
    if (!hintMatches) continue; // require at least one recognisable column name, not just "populated"
    const score = hintMatches * 10 + populated;
    if (score > bestScore) { bestScore = score; headerRowIdx = i; }
  }
  // No row scored (no recognisable keywords anywhere in the first 15 rows): fall back to row 1,
  // the old assumption, rather than silently returning nothing.
  const headers = aoa[headerRowIdx].map((h) => String(h ?? '').trim());
  const rows = [];
  for (let i = headerRowIdx + 1; i < aoa.length; i++) {
    const raw = aoa[i];
    if (raw.every((c) => String(c ?? '').trim() === '')) continue;
    const obj = {};
    headers.forEach((h, idx) => { if (h) obj[h] = raw[idx] ?? ''; });
    rows.push(obj);
  }
  return rows;
}

function findSheet(wb, sheetNameCandidates) {
  for (const cand of sheetNameCandidates) {
    const normCand = normKey(cand);
    for (const sheetName of wb.SheetNames) {
      const normSheet = normKey(sheetName);
      if (normSheet.startsWith(normCand) || normCand.startsWith(normSheet)) {
        return sheetToRows(wb.Sheets[sheetName]);
      }
    }
  }
  return null; // no candidate matched any sheet name in the workbook
}

function stateKey(state, rate, interState) {
  return `${normKey(state)}|${rate}|${interState ? 'inter' : 'intra'}`;
}

/** Implied GST rate from whichever tax columns are populated, when no explicit rate column matched. */
function impliedRate(row) {
  if (row.cgst || row.sgst) return (row.cgst * 2 / (row.taxable || 1)) * 100;
  if (row.igst) return (row.igst / (row.taxable || 1)) * 100;
  return 0;
}

// GST only has these official slabs. A Shipment row and its matching Refund row must land in
// the SAME (state, rate, intra/inter) bucket to net correctly, and an Amazon leg must land in
// the SAME bucket as the matching Flipkart leg to merge (per spec's "overwrite not sum" warning).
// But a rate computed from raw tax-amount division drifts by fractions of a percent between
// rows (rounding in the source data) and would silently split what should be one bucket into two.
// Snapping every computed/implied rate to the nearest real slab makes bucketing exact-match safe.
const GST_RATE_SLABS = [0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 12, 18, 28];
function snapRate(r) {
  let best = GST_RATE_SLABS[0], bestDist = Infinity;
  for (const slab of GST_RATE_SLABS) {
    const dist = Math.abs(r - slab);
    if (dist < bestDist) { bestDist = dist; best = slab; }
  }
  return best;
}

/** Effective bucketing rate for a row: prefer an explicit TOTAL-rate column, else derive from
 *  tax amounts, then snap to the nearest real GST slab so equivalent rows always bucket together. */
function effectiveRate(row) {
  return snapRate(row.rate ?? impliedRate(row));
}

// Same class of bug as the Flipkart sheet-name matching: 'Transaction Type' is a CELL VALUE, not
// a column header, so rowPicker's header-normalization never touches it. A raw `=== 'Shipment'`
// comparison silently classifies every row as "unrecognized" (dropped with zero GST impact,
// exactly like a Cancel row) if the real file spells it differently, e.g. lowercase or "Shipped".
// Canonicalize known spellings and flag loudly when nothing in the file matches any of them.
const TX_TYPE_ALIASES = {
  shipment: 'Shipment', shipped: 'Shipment', delivered: 'Shipment', dispatched: 'Shipment', despatched: 'Shipment',
  cancel: 'Cancel', cancelled: 'Cancel', canceled: 'Cancel', cancellation: 'Cancel',
  refund: 'Refund', refunded: 'Refund', return: 'Refund', returned: 'Refund', creditnote: 'Refund',
};
function normTxType(v) {
  return TX_TYPE_ALIASES[normKey(v)] || null;
}

// ── Amazon B2C: Cancel / Shipment / Refund ──────────────────────────────────
function processAmazonB2c(rows, period, sellerState, flags) {
  const shipmentsByItemId = new Map(); // Shipment Item Id -> shipment row (standardized)
  const b2bFromB2c = [];               // Table 4 entries (has Customer Bill To Gstid)
  const stateNet = new Map();          // stateKey -> {taxable,cgst,sgst,igst}
  const hsnNet = new Map();            // hsn -> {qty,taxable,cgst,sgst,igst}
  const invoiceNumbers = [];           // {number,date,cancelled}
  const creditNoteNumbers = [];        // {number,date}, separate document series from invoices, Table 13
  const orderIdsWithShipment = new Set();

  const standardized = rows.map((raw) => {
    const p = rowPicker(raw);
    const transactionTypeRaw = p('Transaction Type');
    return {
      raw,
      transactionType: normTxType(transactionTypeRaw),
      transactionTypeRaw,
      orderId: p('Order Id', 'Order ID'),
      shipmentItemId: p('Shipment Item Id', 'Shipment Item ID'),
      invoiceNumber: p('Invoice Number'),
      invoiceDate: parseFlexDate(p('Invoice Date')),
      creditNoteNo: p('Credit Note No', 'Credit Note Number'),
      creditNoteDate: parseFlexDate(p('Credit Note Date')),
      invoiceAmount: parseNumber(p('Invoice Amount')),
      taxable: parseNumber(p('Tax Exclusive Gross', 'Taxable Value', 'Item Total', 'Principal Amount')),
      cgst: parseNumber(p('Cgst Tax', 'CGST Tax Amount', 'Cgst Tax Amount')),
      sgst: parseNumber(p('Sgst Tax', 'SGST Tax Amount', 'Sgst Tax Amount')),
      igst: parseNumber(p('Igst Tax', 'IGST Tax Amount', 'Igst Tax Amount')),
      // NOTE: intentionally does NOT include 'Cgst Rate' here, that column is HALF the total GST
      // rate (e.g. 9 for an 18% slab), and mixing a half-rate reading in for some rows with a
      // correctly-derived total rate for others silently splits one (state,rate,inter) bucket
      // into two, breaking Shipment/Refund netting and the Amazon/Flipkart merge (see effectiveRate).
      rate: parseNumber(p('Igst Rate', 'Gst Rate', 'Tax Rate', 'Rate')) || null,
      hsn: p('Hsn/Sac', 'HSN/SAC', 'Hsn Code', 'HSN'),
      qty: parseNumber(p('Quantity')) || 1,
      shipFromState: p('Ship From State'),
      shipToState: p('Ship To State'),
      customerGstin: p('Customer Bill To Gstid', 'Customer Bill To GSTID', 'Bill To Gstin'),
    };
  });

  // Loud failure instead of a silently blank result: every row with an unrecognized Transaction
  // Type is skipped exactly like a Cancel row (zero GST impact), which is correct for a genuine
  // typo/rare value but catastrophic if it happens on every row because the file's real values
  // don't match TX_TYPE_ALIASES at all. Surface the actual distinct values found so they can be
  // added directly, the same way the Flipkart sheet-name mismatch got fixed.
  const unrecognizedTypes = standardized.filter((r) => !r.transactionType);
  if (standardized.length && unrecognizedTypes.length === standardized.length) {
    const distinctValues = [...new Set(unrecognizedTypes.map((r) => r.transactionTypeRaw || '(blank)'))].slice(0, 10);
    flags.push(blocker('amazon_b2c_transaction_type_unrecognized', `Amazon B2C file has ${standardized.length} row(s) but none of the Transaction Type values matched Cancel/Shipment/Refund. Values found: ${distinctValues.map((v) => `"${v}"`).join(', ')}. Update TX_TYPE_ALIASES in gst-reconciliation.js with the real spelling.`));
  } else if (unrecognizedTypes.length) {
    const distinctValues = [...new Set(unrecognizedTypes.map((r) => r.transactionTypeRaw || '(blank)'))].slice(0, 10);
    flags.push(warning('amazon_b2c_transaction_type_partial', `Amazon B2C file: ${unrecognizedTypes.length} of ${standardized.length} row(s) had an unrecognized Transaction Type and were skipped (zero GST impact assumed). Values found: ${distinctValues.map((v) => `"${v}"`).join(', ')}.`));
  }

  // Loud failure for a wrong Period field, not just a wrong column name: Shipment rows outside
  // the selected period are correctly (and silently, by design) excluded from Table 7/13, since a
  // multi-month file legitimately has out-of-period rows. But if the file has real Shipment rows
  // and NONE of them fall in the selected period, that's not "a few excluded", it's almost
  // certainly the wrong period picked for this file (e.g. period says July, file is a June export),
  // which would otherwise silently zero out B2C's entire contribution with no flag at all.
  const shipmentRowsAll = standardized.filter((r) => r.transactionType === 'Shipment' && r.invoiceDate);
  if (shipmentRowsAll.length && !shipmentRowsAll.some((r) => monthOf(r.invoiceDate) === period)) {
    const sampleDates = [...new Set(shipmentRowsAll.map((r) => r.invoiceDate))].slice(0, 5);
    flags.push(blocker('amazon_b2c_period_mismatch', `Amazon B2C file has ${shipmentRowsAll.length} Shipment row(s) but none are dated in the selected period "${period}". Sample invoice dates found in the file: ${sampleDates.join(', ')}. Check the Period field, this file's B2C rows will otherwise contribute nothing to Table 7/13.`, { sampleDates }));
  }

  for (const row of standardized) {
    if (row.orderId && row.transactionType === 'Shipment') orderIdsWithShipment.add(row.orderId);
  }

  for (const row of standardized) {
    if (row.transactionType === 'Cancel') {
      // Zero GST impact either way; reserved invoice numbers still surfaced in docs table below.
      continue;
    }

    if (row.transactionType === 'Shipment') {
      const belongsToPeriod = monthOf(row.invoiceDate) === period;
      // Populate the shipment map for ALL rows regardless of period (a refund elsewhere in this
      // same file can legitimately reference an earlier month's shipment, per spec), but Table 13's
      // invoice-number range must only include invoices actually dated in the period being filed.
      if (row.shipmentItemId) shipmentsByItemId.set(row.shipmentItemId, row);
      if (belongsToPeriod && row.invoiceNumber) {
        invoiceNumbers.push({ number: row.invoiceNumber, date: row.invoiceDate, cancelled: false });
      }
      if (!belongsToPeriod) continue; // belongs to a different month's GSTR-1

      if (row.customerGstin) {
        b2bFromB2c.push(row);
        continue;
      }

      // Per spec: intra vs inter is Ship From State vs Ship To State (not the seller's GSTIN state).
      // Fall back to the GSTIN-derived seller state only if Ship From State is blank on the row.
      const inter = normKey(row.shipFromState || sellerState) !== normKey(row.shipToState);
      const rate = effectiveRate(row);
      const key = stateKey(row.shipToState, rate, inter);
      const acc = stateNet.get(key) || { state: row.shipToState, rate, inter, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
      acc.taxable += row.taxable; acc.cgst += row.cgst; acc.sgst += row.sgst; acc.igst += row.igst;
      stateNet.set(key, acc);

      if (row.hsn) {
        const h = hsnNet.get(row.hsn) || { hsn: row.hsn, qty: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
        h.qty += row.qty; h.taxable += row.taxable; h.cgst += row.cgst; h.sgst += row.sgst; h.igst += row.igst;
        hsnNet.set(row.hsn, h);
      }
    }

    if (row.transactionType === 'Refund') {
      const belongsToPeriod = monthOf(row.creditNoteDate) === period;
      if (!belongsToPeriod) continue; // credit note issued in a different month, that month's Table 7 already reflects it

      const original = shipmentsByItemId.get(row.shipmentItemId);
      if (!original) {
        flags.push(warning('unmatched_refund', `Refund row (Shipment Item Id ${row.shipmentItemId || 'unknown'}, Credit Note ${row.creditNoteNo || 'unknown'}) has no matching Shipment row in this file, netted using the refund row's own figures only.`, { shipmentItemId: row.shipmentItemId }));
      }

      // Credit notes are their own Table 13 document series (Nature of Document = "Credit Note"),
      // separate from the invoice series, GSTR-1 requires reporting both. Applies to B2B and B2C
      // credit notes alike, so this is tracked before the B2B/B2C branch below.
      if (row.creditNoteNo) {
        creditNoteNumbers.push({ number: row.creditNoteNo, date: row.creditNoteDate });
      }

      if (row.customerGstin) {
        // B2B credit note: net against the B2B totals downstream via b2bFromB2c using negative
        // amounts. qty must be negated too (not just the money fields), since these rows also
        // feed the HSN summary (Table 12) below and an un-negated qty would overcount there.
        b2bFromB2c.push({ ...row, taxable: -row.taxable, cgst: -row.cgst, sgst: -row.sgst, igst: -row.igst, qty: -row.qty, isCreditNote: true });
        continue;
      }

      const shipFromState = row.shipFromState || (original && original.shipFromState) || sellerState;
      const shipToState = row.shipToState || (original && original.shipToState);
      const inter = normKey(shipFromState) !== normKey(shipToState);
      // Reuse the ORIGINAL shipment's own effectiveRate() when matched, so a refund always lands
      // in the exact same bucket its shipment did (never re-derive independently from the refund
      // row's own, possibly partial, tax amounts, which can imply a different-looking rate).
      const rate = original ? effectiveRate(original) : effectiveRate(row);
      const key = stateKey(shipToState, rate, inter);
      const acc = stateNet.get(key) || { state: shipToState, rate, inter, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
      acc.taxable -= row.taxable; acc.cgst -= row.cgst; acc.sgst -= row.sgst; acc.igst -= row.igst;
      stateNet.set(key, acc);

      const hsn = row.hsn || (original && original.hsn);
      if (hsn) {
        const h = hsnNet.get(hsn) || { hsn, qty: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
        h.qty -= row.qty; h.taxable -= row.taxable; h.cgst -= row.cgst; h.sgst -= row.sgst; h.igst -= row.igst;
        hsnNet.set(hsn, h);
      }
    }
  }

  // Cancelled-but-numbered invoices: a Cancel row with an Invoice Number, no real Shipment for that order elsewhere.
  for (const row of standardized) {
    if (row.transactionType === 'Cancel' && row.invoiceNumber && !orderIdsWithShipment.has(row.orderId)) {
      invoiceNumbers.push({ number: row.invoiceNumber, date: row.invoiceDate, cancelled: true });
    }
  }

  // Negative-net states are correct GST-law treatment, not a bug, flag for review only.
  for (const [, acc] of stateNet) {
    if (acc.taxable < 0) {
      flags.push(warning('negative_net_state', `${acc.state}: net taxable value is negative (₹${round2(acc.taxable)}) after netting refunds. A credit note against an earlier month's invoice landed here with no current-month sale. This is correct GST treatment, review before filing.`, { state: acc.state }));
    }
  }

  return { stateNet, hsnNet, b2bFromB2c, invoiceNumbers, creditNoteNumbers };
}

// ── Amazon B2B file: every row goes to Table 4, per-invoice ────────────────
function processAmazonB2b(rows) {
  return rows.map((raw) => {
    const p = rowPicker(raw);
    return {
      gstin: p('Customer Bill To Gstid', 'Customer Bill To GSTID', 'Bill To Gstin', 'Gstin'),
      invoiceNumber: p('Invoice Number'),
      invoiceDate: parseFlexDate(p('Invoice Date')),
      shipFromState: p('Ship From State'),
      shipToState: p('Ship To State'),
      taxable: parseNumber(p('Tax Exclusive Gross', 'Taxable Value', 'Item Total', 'Principal Amount')),
      cgst: parseNumber(p('Cgst Tax', 'CGST Tax Amount', 'Cgst Tax Amount')),
      sgst: parseNumber(p('Sgst Tax', 'SGST Tax Amount', 'Sgst Tax Amount')),
      igst: parseNumber(p('Igst Tax', 'IGST Tax Amount', 'Igst Tax Amount')),
      hsn: p('Hsn/Sac', 'HSN/SAC', 'Hsn Code', 'HSN'),
      qty: parseNumber(p('Quantity')) || 1,
    };
  });
}

// ── Flipkart XLSX: Section 7(B)(2) state-wise net, Section 12 HSN, Section 13 docs, Section 3 cross-check ──
function processFlipkart(buffer, flags) {
  const wb = XLSX.read(buffer, { type: 'buffer' });

  // Real-world Flipkart exports (confirmed against May and June 2026 files) name each sheet
  // "Section <N> in GSTR-<form>", e.g. "Section 7(B)(2) in GSTR-1", "Section 3 in GSTR-8" for
  // the one section that's actually part of GSTR-8 rather than GSTR-1. findSheet's prefix match
  // already handles this suffix, but the confirmed exact strings are listed first regardless.
  const sec7b2 = findSheet(wb, ['Section 7(B)(2) in GSTR-1', 'Section 7(B)(2)', 'Section 7B2', '7(B)(2)', 'Section 7 B 2', '7B2']);
  const sec12 = findSheet(wb, ['Section 12 in GSTR-1', 'Section 12']);
  const sec13 = findSheet(wb, ['Section 13 in GSTR-1', 'Section 13']);
  const sec3 = findSheet(wb, ['Section 3 in GSTR-8', 'Section 3 in GSTR-1', 'Section 3']);

  // Loud failure instead of a silently blank result: Section 7(B)(2) is THE primary B2C table,
  // so if the sheet-name candidates above don't match anything in this workbook, say so and list
  // what sheets actually exist, rather than quietly returning an empty stateRows and letting the
  // whole calculation come back looking like "Flipkart had zero sales this month".
  if (sec7b2 === null) {
    flags.push(blocker('flipkart_sheet_not_found', `Could not find the Section 7(B)(2) sheet in this Flipkart file. Sheets present: ${wb.SheetNames.join(', ') || '(none)'}. Update the sheet-name candidates in gst-reconciliation.js to match.`));
  } else if (!sec7b2.length) {
    // Sheet found, header row detected (or the fallback row-1 assumption used), but there is
    // genuinely nothing below it. Distinct from flipkart_state_col_unmatched (rows existed but
    // couldn't resolve a state) and from flipkart_sheet_not_found (no matching sheet at all).
    flags.push(blocker('flipkart_state_sheet_empty', 'Flipkart Section 7(B)(2) sheet was found but no data rows could be read from it. If the sheet visibly has data, the header row (or a title/banner row above it) may not be getting detected correctly, check gst-reconciliation.js sheetToRows().'));
  }

  const stateRows = (sec7b2 || []).map((raw) => {
    const p = rowPicker(raw);
    const gross = parseNumber(p('Gross Taxable Value', 'Gross Taxable', 'Gross Taxable Amount'));
    // 'Taxable Sales Return Value' confirmed as the real header by hand-inspecting the live file;
    // the spec's own prose shorthand ("Taxable Sales Return") never actually appears verbatim.
    const ret = parseNumber(p('Taxable Sales Return Value', 'Taxable Sales Return', 'Sales Return', 'Taxable Value Return', 'Return Taxable Value'));
    const net = parseNumber(p('Net (Aggregate) Taxable Value', 'Net Aggregate Taxable Value', 'Net Taxable Value', 'Net Taxable Amount', 'Aggregate Taxable Value'));
    // 'Delivered State (PoS)' confirmed as the real header by hand-inspecting the live file.
    const state = p('Place of Supply', 'State', 'Ship To State', 'State of Supply', 'Destination State', 'Delivered State (PoS)', 'Delivered State');
    // Snap to a real GST slab so this bucket lines up exactly with the Amazon-side bucket for
    // the same state in the merge step below (see effectiveRate for why exact matching matters).
    // 'IGST %' confirmed as the real header. Normalizes to "igst" once the '%' is stripped,
    // which never matched the old 'IGST Rate'/'GST Rate' candidates (different word entirely).
    const rate = snapRate(parseNumber(p('IGST %', 'Rate', 'GST Rate', 'IGST Rate', 'Tax Rate', 'Rate (%)')));
    const igst = parseNumber(p('IGST', 'IGST Amount', 'Integrated Tax Amount', 'Integrated Tax'));
    if (state && Math.abs((gross - ret) - net) > 1) {
      flags.push(blocker('flipkart_state_net_mismatch', `Flipkart Section 7(B)(2), ${state}: Gross (₹${gross}) − Return (₹${ret}) ≠ reported Net (₹${net}). Bad data, stop and check the source file before filing.`, { state, gross, ret, net }));
    }
    return { state, rate, taxable: net, igst };
  }).filter((r) => r.state);

  // Same loud-failure principle: the sheet was found and has rows, but not one of them yielded a
  // usable state (Place of Supply) value, meaning the column-name candidates above are wrong for
  // this file. Without this flag, that degrades silently into "Flipkart contributed nothing".
  if (sec7b2 && sec7b2.length && !stateRows.length) {
    flags.push(blocker('flipkart_state_col_unmatched', `Flipkart Section 7(B)(2) has ${sec7b2.length} row(s) but none had a resolvable state column ("Place of Supply", "State", etc.), so 0 rows were counted. Check the actual column headers and update gst-reconciliation.js. See context.rawSampleRow for the actual first row as read from the sheet.`, { rawSampleRow: sec7b2[0] }));
  }

  // Section 12 (HSN) and Section 13 (Documents Issued) are both part of GSTR-1 itself, so a
  // missing sheet is worth a warning when the workbook otherwise has real sales data (stateRows).
  // Section 3 (GSTR-8/TCS) is explicitly informational-only per spec, so its absence is silent.
  if (sec12 === null && stateRows.length) {
    flags.push(warning('flipkart_hsn_sheet_not_found', `Could not find the Section 12 (HSN) sheet in this Flipkart file. Sheets present: ${wb.SheetNames.join(', ') || '(none)'}. HSN Summary will be missing Flipkart's contribution.`));
  }
  if (sec13 === null && stateRows.length) {
    flags.push(warning('flipkart_docs_sheet_not_found', `Could not find the Section 13 (Documents Issued) sheet in this Flipkart file. Sheets present: ${wb.SheetNames.join(', ') || '(none)'}. Documents Issued will be missing Flipkart's contribution.`));
  }
  const sec12Rows = sec12 || [];
  const sec13Rows = sec13 || [];
  const sec3Rows = sec3 || [];

  const netTotalFromStates = round2(stateRows.reduce((s, r) => s + r.taxable, 0));

  // Loud failure for the gap the other two checks above miss: the sheet was found AND rows had a
  // resolvable state (so flipkart_state_col_unmatched never fires), but the MONEY columns ("Gross
  // Taxable Value" / "Taxable Sales Return" / "Net (Aggregate) Taxable Value") didn't match this
  // file's real headers, so every row silently taxed at ₹0 and Flipkart's whole contribution
  // vanished from the totals without a single flag. This is the live bug: 16 documents came back
  // instead of 54 with zero Flipkart-related flags, which only fits "rows found, money read as 0".
  if (stateRows.length && netTotalFromStates === 0) {
    // Include the actual raw first row (headers AND values, verbatim as read from the sheet) in
    // the flag's context, not just the message. If this still fires after the confirmed real
    // header names were added, the raw sample below shows exactly what's different immediately,
    // no more back-and-forth manual Python inspection needed.
    flags.push(blocker('flipkart_state_amount_col_unmatched', `Flipkart Section 7(B)(2) has ${stateRows.length} row(s) with a resolvable state but the total net taxable value came out to ₹0. The money columns ("Gross Taxable Value", "Taxable Sales Return Value", "Net Taxable Value") likely don't match this file's real headers, or the cell values aren't parsing as numbers. See context.rawSampleRow for the actual first row as read from the sheet.`, { rawSampleRow: sec7b2[0] }));
  }

  // Same principle for Section 13: if Flipkart clearly had real sales this period (stateRows) but
  // its own Documents Issued sheet resolved to zero rows (found but empty, not merely missing),
  // that is unusual enough to warn about rather than silently reporting 0 Flipkart documents.
  if (sec13 !== null && !sec13Rows.length && stateRows.length) {
    flags.push(warning('flipkart_docs_sheet_empty', `Flipkart Section 13 (Documents Issued) sheet was found but has 0 rows, despite Flipkart having real sales this period per Section 7(B)(2). Documents Issued will be missing Flipkart's contribution.`));
  }

  const sec12Total = sec12Rows.reduce((s, raw) => s + parseNumber(rowPicker(raw)('Total Taxable Value', 'Taxable Value')), 0);
  const sec3NetTaxable = sec3Rows.reduce((s, raw) => s + parseNumber(rowPicker(raw)('Net Taxable Value', 'Taxable Value')), 0);
  if (sec12Rows.length && Math.abs(netTotalFromStates - round2(sec12Total)) > 1) {
    flags.push(blocker('flipkart_hsn_total_mismatch', `Flipkart: sum of Section 7(B)(2) net taxable (₹${netTotalFromStates}) does not tie to Section 12's Total Taxable Value (₹${round2(sec12Total)}).`));
  }
  if (sec3Rows.length && Math.abs(netTotalFromStates - round2(sec3NetTaxable)) > 1) {
    flags.push(blocker('flipkart_tcs_total_mismatch', `Flipkart: sum of Section 7(B)(2) net taxable (₹${netTotalFromStates}) does not tie to Section 3's Net Taxable Value (₹${round2(sec3NetTaxable)}).`));
  }

  // 'HSN Number' and 'Total Quantity in Nos.' confirmed as the real headers by hand-inspecting
  // the live file's rawSampleRow (the earlier candidates only covered a bare "HSN"/"Total Quantity").
  const hsnRows = sec12Rows.map((raw) => {
    const p = rowPicker(raw);
    return {
      hsn: p('HSN', 'HSN Code', 'Hsn', 'HSN/SAC', 'HSN/SAC Code', 'HSN Number'),
      qty: parseNumber(p('Total Quantity', 'Qty', 'Quantity', 'Total Qty', 'Net Quantity', 'Total Quantity in Nos.')),
      taxable: parseNumber(p('Total Taxable Value', 'Taxable Value')),
    };
  }).filter((r) => r.hsn);

  // Same loud-failure principle as Section 7(B)(2): sheet found with rows, but no HSN column matched.
  if (sec12Rows.length && !hsnRows.length) {
    flags.push(blocker('flipkart_hsn_col_unmatched', `Flipkart Section 12 has ${sec12Rows.length} row(s) but none had a resolvable HSN column, so 0 rows were counted. Check the actual column headers and update gst-reconciliation.js. See context.rawSampleRow for the actual first row as read from the sheet.`, { rawSampleRow: sec12Rows[0] }));
  }

  const sec12Qty = hsnRows.reduce((s, r) => s + r.qty, 0);
  const sec3Qty = sec3Rows.reduce((s, raw) => s + parseNumber(rowPicker(raw)('Invoice Qty (Net)', 'Invoice Qty', 'Qty')), 0);
  if (sec12Rows.length && sec3Rows.length && Math.abs(sec12Qty - sec3Qty) > 0.01) {
    flags.push(warning('flipkart_hsn_qty_mismatch', `Flipkart: Section 12 total quantity (${sec12Qty}) differs from Section 3's Invoice Qty (Net) (${sec3Qty}). Both figures surfaced, not auto-resolved.`, { sec12Qty, sec3Qty }));
  }

  // 'Invoice Series From/To', 'Total Number of Invoices' and 'Cancelled if any' confirmed as the
  // real headers by hand-inspecting the live file's rawSampleRow. The source cell for "To" carries
  // an embedded newline ("Invoice Series \nTo"), harmless here since normKey strips it same as
  // any other non-alnum character, so the plain candidate below still matches.
  const docsRows = sec13Rows.map((raw) => {
    const p = rowPicker(raw);
    const from = p('Sr No From', 'From', 'Serial No From', 'Serial Number From', 'From Sr No', 'Invoice From', 'Starting Number', 'From Number', 'Invoice Series From');
    const to = p('Sr No To', 'To', 'Serial No To', 'Serial Number To', 'To Sr No', 'Invoice To', 'Ending Number', 'To Number', 'Invoice Series To');
    let totalNumber = parseNumber(p('Total Number', 'Total No', 'Total Count', 'Total Invoices', 'No. Issued', 'Number of Documents', 'Total Documents', 'Count', 'Total Number of Invoices'));
    // Fallback when no "total number" column matched: derive the count from the from/to range
    // itself, when both end in a plain numeric sequence (e.g. "FK-0001".."FK-0037" -> 37).
    if (!totalNumber) {
      const fromNum = String(from).match(/(\d+)\s*$/);
      const toNum = String(to).match(/(\d+)\s*$/);
      if (fromNum && toNum) totalNumber = Number(toNum[1]) - Number(fromNum[1]) + 1;
    }
    return {
      series: p('Series', 'Nature of Document', 'Nature Of Document', 'Document Series', 'Document Type', 'Type of Document') || 'Flipkart',
      from, to,
      totalNumber,
      cancelled: parseNumber(p('Cancelled', 'No. of Cancelled', 'Cancelled Count', 'No Of Cancelled', 'Cancelled Documents', 'Cancelled if any')),
    };
  });

  // Safety net: Section 13 had rows but every one of them resolved to zero documents, meaning
  // none of the column-name candidates above matched this file's actual headers. Surfacing this
  // as a blocker beats silently reporting a near-empty Documents Issued table on a real filing.
  if (sec13Rows.length && docsRows.every((d) => !d.totalNumber)) {
    flags.push(blocker('flipkart_docs_unparsed', `Flipkart Section 13 has ${sec13Rows.length} row(s) but none of the expected column names ("Total Number", "Sr No From/To", etc.) matched, so 0 documents were counted from it. Check the actual column headers in the source file and update gst-reconciliation.js. See context.rawSampleRow for the actual first row as read from the sheet.`, { rawSampleRow: sec13Rows[0] }));
  }

  return { stateRows, hsnRows, docsRows };
}

/**
 * @param {object} input
 * @param {string} input.gstin seller GSTIN
 * @param {string} input.period 'YYYY-MM'
 * @param {Buffer} [input.amazonB2bBuffer]
 * @param {Buffer} [input.amazonB2cBuffer]
 * @param {Buffer} [input.flipkartBuffer]
 */
export function reconcileGstPeriod({ gstin, period, amazonB2bBuffer, amazonB2cBuffer, flipkartBuffer }) {
  const flags = [];
  const gstinTrim = (gstin || '').trim().toUpperCase();
  if (!/^\d{2}[0-9A-Z]{13}$/.test(gstinTrim)) {
    flags.push(blocker('invalid_gstin', `"${gstin || ''}" is not a valid 15-character GSTIN.`));
  }
  const sellerStateCode = gstinTrim.slice(0, 2);
  const sellerState = STATE_CODES[sellerStateCode];
  if (gstinTrim && !sellerState) {
    flags.push(blocker('unknown_state_code', `GSTIN state code "${sellerStateCode}" is not a recognised GST state/UT code.`));
  }
  if (!/^\d{4}-\d{2}$/.test(period || '')) {
    flags.push(blocker('invalid_period', `Period "${period || ''}" must be in YYYY-MM format.`));
  }

  // None of the 3 source files are individually mandatory (a channel can genuinely have zero
  // activity in a given month), but at least one must be present to calculate anything at all.
  if (!amazonB2bBuffer && !amazonB2cBuffer && !flipkartBuffer) {
    flags.push(blocker('no_files_provided', 'No source files were uploaded. Provide at least one of Amazon MTR B2B, Amazon MTR B2C, or the Flipkart GSTR-1/8 report to calculate anything.'));
  }

  let b2cResult = { stateNet: new Map(), hsnNet: new Map(), b2bFromB2c: [], invoiceNumbers: [], creditNoteNumbers: [] };
  if (amazonB2cBuffer) {
    try {
      const rows = parseCsvBuffer(amazonB2cBuffer);
      b2cResult = processAmazonB2c(rows, period, sellerState, flags);
    } catch (e) {
      flags.push(blocker('amazon_b2c_parse_error', `Could not parse the Amazon B2C CSV: ${e.message}`));
    }
  } else {
    flags.push(warning('missing_amazon_b2c', 'No Amazon B2C file uploaded. B2C Amazon sales for this period will be absent from Table 7.'));
  }

  let amazonB2bRows = [];
  if (amazonB2bBuffer) {
    try {
      amazonB2bRows = processAmazonB2b(parseCsvBuffer(amazonB2bBuffer));
    } catch (e) {
      flags.push(blocker('amazon_b2b_parse_error', `Could not parse the Amazon B2B CSV: ${e.message}`));
    }
  }

  let flipkartResult = { stateRows: [], hsnRows: [], docsRows: [] };
  if (flipkartBuffer) {
    try {
      flipkartResult = processFlipkart(flipkartBuffer, flags);
    } catch (e) {
      flags.push(blocker('flipkart_parse_error', `Could not parse the Flipkart XLSX: ${e.message}`));
    }
  } else {
    flags.push(warning('missing_flipkart', 'No Flipkart file uploaded. Flipkart sales for this period will be absent from Table 7.'));
  }

  // ── Table 4 (B2B): Amazon B2B file rows + B2C rows carrying a customer GSTIN ──
  const b2b = [...amazonB2bRows, ...b2cResult.b2bFromB2c].map((r) => ({
    gstin: r.gstin || r.customerGstin,
    invoiceNumber: r.invoiceNumber,
    invoiceDate: r.invoiceDate,
    state: r.shipToState,
    taxable: round2(r.taxable),
    cgst: round2(r.cgst), sgst: round2(r.sgst), igst: round2(r.igst),
    channel: 'amazon',
  }));

  // ── Table 7 (B2CS): merge Amazon state-net + Flipkart state-net into ONE row per (state,rate,intra/inter) ──
  const merged = new Map();
  for (const [, acc] of b2cResult.stateNet) {
    const key = stateKey(acc.state, acc.rate, acc.inter);
    const row = merged.get(key) || { state: acc.state, rate: acc.rate, inter: acc.inter, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    row.taxable += acc.taxable; row.cgst += acc.cgst; row.sgst += acc.sgst; row.igst += acc.igst;
    merged.set(key, row);
  }
  for (const r of flipkartResult.stateRows) {
    const inter = normKey(r.state) !== normKey(sellerState || r.state);
    const key = stateKey(r.state, r.rate, inter);
    const row = merged.get(key) || { state: r.state, rate: r.rate, inter, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    row.taxable += r.taxable;
    if (inter) row.igst += r.igst; else { row.cgst += r.igst / 2; row.sgst += r.igst / 2; }
    merged.set(key, row);
  }
  const b2cs = [...merged.values()].map((r) => ({
    state: r.state, rate: r.rate, placeOfSupplyType: r.inter ? 'inter' : 'intra',
    taxable: round2(r.taxable), cgst: round2(r.cgst), sgst: round2(r.sgst), igst: round2(r.igst),
  }));

  // ── Table 12 (HSN): merge Amazon B2C HSN-net + Amazon B2B HSN + Flipkart Section 12 by HSN code.
  //    Table 12 is a summary of ALL outward supplies (B2B and B2C alike), not just B2C, so B2B
  //    rows (both the Amazon B2B file and B2C-file rows carrying a customer GSTIN) must count too.
  const hsnMerged = new Map();
  for (const [, h] of b2cResult.hsnNet) {
    hsnMerged.set(h.hsn, { hsn: h.hsn, qty: h.qty, taxable: h.taxable, cgst: h.cgst, sgst: h.sgst, igst: h.igst });
  }
  for (const r of [...amazonB2bRows, ...b2cResult.b2bFromB2c]) {
    if (!r.hsn) continue;
    const row = hsnMerged.get(r.hsn) || { hsn: r.hsn, qty: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    row.qty += r.qty; row.taxable += r.taxable; row.cgst += r.cgst; row.sgst += r.sgst; row.igst += r.igst;
    hsnMerged.set(r.hsn, row);
  }
  for (const h of flipkartResult.hsnRows) {
    const row = hsnMerged.get(h.hsn) || { hsn: h.hsn, qty: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    row.qty += h.qty; row.taxable += h.taxable;
    hsnMerged.set(h.hsn, row);
  }
  const hsn = [...hsnMerged.values()].map((h) => ({
    hsn: h.hsn, qty: round2(h.qty), taxable: round2(h.taxable),
    cgst: round2(h.cgst), sgst: round2(h.sgst), igst: round2(h.igst),
  }));

  // ── Table 13 (Documents Issued): Amazon invoice series + Amazon credit-note series (incl.
  //    cancelled-but-numbered invoices) + Flipkart's own series (invoices and, if the source file
  //    breaks them out, credit notes too, passed through as-is from Section 13). ──
  const amazonNums = b2cResult.invoiceNumbers.filter((n) => n.number);
  const amazonCreditNotes = b2cResult.creditNoteNumbers.filter((n) => n.number);
  const docs = [];
  if (amazonNums.length) {
    const sorted = [...amazonNums].sort((a, b) => (a.number > b.number ? 1 : -1));
    docs.push({
      series: 'Amazon Invoices',
      from: sorted[0].number,
      to: sorted[sorted.length - 1].number,
      totalNumber: sorted.length,
      cancelled: sorted.filter((n) => n.cancelled).length,
      netIssued: sorted.filter((n) => !n.cancelled).length,
    });
  }
  if (amazonCreditNotes.length) {
    const sorted = [...amazonCreditNotes].sort((a, b) => (a.number > b.number ? 1 : -1));
    docs.push({
      series: 'Amazon Credit Notes',
      from: sorted[0].number,
      to: sorted[sorted.length - 1].number,
      totalNumber: sorted.length,
      cancelled: 0,
      netIssued: sorted.length,
    });
  }
  for (const d of flipkartResult.docsRows) {
    docs.push({ series: d.series, from: d.from, to: d.to, totalNumber: d.totalNumber, cancelled: d.cancelled, netIssued: d.totalNumber - d.cancelled });
  }

  const summary = {
    taxable: round2(b2cs.reduce((s, r) => s + r.taxable, 0) + b2b.reduce((s, r) => s + r.taxable, 0)),
    cgst: round2(b2cs.reduce((s, r) => s + r.cgst, 0) + b2b.reduce((s, r) => s + r.cgst, 0)),
    sgst: round2(b2cs.reduce((s, r) => s + r.sgst, 0) + b2b.reduce((s, r) => s + r.sgst, 0)),
    igst: round2(b2cs.reduce((s, r) => s + r.igst, 0) + b2b.reduce((s, r) => s + r.igst, 0)),
    docCount: docs.reduce((s, d) => s + (d.netIssued || 0), 0),
  };
  summary.total = round2(summary.taxable + summary.cgst + summary.sgst + summary.igst);

  return { summary, tables: { b2b, b2cs, hsn, docs }, flags, sellerState };
}
