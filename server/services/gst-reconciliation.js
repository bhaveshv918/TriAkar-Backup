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

function normKey(s) {
  return String(s ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
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

function parseNumber(v) {
  if (v === '' || v === null || v === undefined) return 0;
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
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

function parseXlsxSheet(buffer, sheetNameCandidates) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const normSheetNames = new Map(wb.SheetNames.map((n) => [normKey(n), n]));
  for (const cand of sheetNameCandidates) {
    const real = normSheetNames.get(normKey(cand));
    if (real) return XLSX.utils.sheet_to_json(wb.Sheets[real], { defval: '' });
  }
  return null;
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

// ── Amazon B2C: Cancel / Shipment / Refund ──────────────────────────────────
function processAmazonB2c(rows, period, sellerState, flags) {
  const shipmentsByItemId = new Map(); // Shipment Item Id -> shipment row (standardized)
  const b2bFromB2c = [];               // Table 4 entries (has Customer Bill To Gstid)
  const stateNet = new Map();          // stateKey -> {taxable,cgst,sgst,igst}
  const hsnNet = new Map();            // hsn -> {qty,taxable,cgst,sgst,igst}
  const invoiceNumbers = [];           // {number,date,cancelled}
  const orderIdsWithShipment = new Set();

  const standardized = rows.map((raw) => {
    const p = rowPicker(raw);
    return {
      raw,
      transactionType: p('Transaction Type'),
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
      rate: parseNumber(p('Igst Rate', 'Cgst Rate', 'Gst Rate')) || null,
      hsn: p('Hsn/Sac', 'HSN/SAC', 'Hsn Code', 'HSN'),
      qty: parseNumber(p('Quantity')) || 1,
      shipFromState: p('Ship From State'),
      shipToState: p('Ship To State'),
      customerGstin: p('Customer Bill To Gstid', 'Customer Bill To GSTID', 'Bill To Gstin'),
    };
  });

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
      if (row.shipmentItemId) shipmentsByItemId.set(row.shipmentItemId, row);
      if (row.invoiceNumber) {
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
      const rate = row.rate ?? impliedRate(row);
      const key = stateKey(row.shipToState, round2(rate), inter);
      const acc = stateNet.get(key) || { state: row.shipToState, rate: round2(rate), inter, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
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

      if (row.customerGstin) {
        // B2B credit note: net against the B2B totals downstream via b2bFromB2c using negative amounts.
        b2bFromB2c.push({ ...row, taxable: -row.taxable, cgst: -row.cgst, sgst: -row.sgst, igst: -row.igst, isCreditNote: true });
        continue;
      }

      const shipFromState = row.shipFromState || (original && original.shipFromState) || sellerState;
      const shipToState = row.shipToState || (original && original.shipToState);
      const inter = normKey(shipFromState) !== normKey(shipToState);
      const rate = row.rate ?? (original && original.rate) ?? impliedRate(row);
      const key = stateKey(shipToState, round2(rate), inter);
      const acc = stateNet.get(key) || { state: shipToState, rate: round2(rate), inter, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
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

  return { stateNet, hsnNet, b2bFromB2c, invoiceNumbers };
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
  const sec7b2 = parseXlsxSheet(buffer, ['Section 7(B)(2)', 'Section 7B2', '7(B)(2)']) || [];
  const sec12 = parseXlsxSheet(buffer, ['Section 12']) || [];
  const sec13 = parseXlsxSheet(buffer, ['Section 13']) || [];
  const sec3 = parseXlsxSheet(buffer, ['Section 3']) || [];

  const stateRows = sec7b2.map((raw) => {
    const p = rowPicker(raw);
    const gross = parseNumber(p('Gross Taxable Value', 'Gross Taxable'));
    const ret = parseNumber(p('Taxable Sales Return', 'Sales Return'));
    const net = parseNumber(p('Net (Aggregate) Taxable Value', 'Net Aggregate Taxable Value', 'Net Taxable Value'));
    const state = p('Place of Supply', 'State', 'Ship To State');
    const rate = parseNumber(p('Rate', 'GST Rate', 'IGST Rate'));
    const igst = parseNumber(p('IGST', 'IGST Amount'));
    if (state && Math.abs((gross - ret) - net) > 1) {
      flags.push(blocker('flipkart_state_net_mismatch', `Flipkart Section 7(B)(2), ${state}: Gross (₹${gross}) − Return (₹${ret}) ≠ reported Net (₹${net}). Bad data, stop and check the source file before filing.`, { state, gross, ret, net }));
    }
    return { state, rate, taxable: net, igst };
  }).filter((r) => r.state);

  const netTotalFromStates = round2(stateRows.reduce((s, r) => s + r.taxable, 0));
  const sec12Total = sec12.reduce((s, raw) => s + parseNumber(rowPicker(raw)('Total Taxable Value', 'Taxable Value')), 0);
  const sec3NetTaxable = sec3.reduce((s, raw) => s + parseNumber(rowPicker(raw)('Net Taxable Value', 'Taxable Value')), 0);
  if (sec12.length && Math.abs(netTotalFromStates - round2(sec12Total)) > 1) {
    flags.push(blocker('flipkart_hsn_total_mismatch', `Flipkart: sum of Section 7(B)(2) net taxable (₹${netTotalFromStates}) does not tie to Section 12's Total Taxable Value (₹${round2(sec12Total)}).`));
  }
  if (sec3.length && Math.abs(netTotalFromStates - round2(sec3NetTaxable)) > 1) {
    flags.push(blocker('flipkart_tcs_total_mismatch', `Flipkart: sum of Section 7(B)(2) net taxable (₹${netTotalFromStates}) does not tie to Section 3's Net Taxable Value (₹${round2(sec3NetTaxable)}).`));
  }

  const hsnRows = sec12.map((raw) => {
    const p = rowPicker(raw);
    return {
      hsn: p('HSN', 'HSN Code', 'Hsn'),
      qty: parseNumber(p('Total Quantity', 'Qty', 'Quantity')),
      taxable: parseNumber(p('Total Taxable Value', 'Taxable Value')),
    };
  }).filter((r) => r.hsn);

  const sec12Qty = hsnRows.reduce((s, r) => s + r.qty, 0);
  const sec3Qty = sec3.reduce((s, raw) => s + parseNumber(rowPicker(raw)('Invoice Qty (Net)', 'Invoice Qty', 'Qty')), 0);
  if (sec12.length && sec3.length && Math.abs(sec12Qty - sec3Qty) > 0.01) {
    flags.push(warning('flipkart_hsn_qty_mismatch', `Flipkart: Section 12 total quantity (${sec12Qty}) differs from Section 3's Invoice Qty (Net) (${sec3Qty}). Both figures surfaced, not auto-resolved.`, { sec12Qty, sec3Qty }));
  }

  const docsRows = sec13.map((raw) => {
    const p = rowPicker(raw);
    return {
      series: p('Series', 'Nature of Document', 'Document Series') || 'Flipkart',
      from: p('Sr No From', 'From', 'Serial No From'),
      to: p('Sr No To', 'To', 'Serial No To'),
      totalNumber: parseNumber(p('Total Number', 'Total No')),
      cancelled: parseNumber(p('Cancelled', 'No. of Cancelled')),
    };
  });

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

  let b2cResult = { stateNet: new Map(), hsnNet: new Map(), b2bFromB2c: [], invoiceNumbers: [] };
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

  // ── Table 12 (HSN): merge Amazon HSN-net + Flipkart Section 12 by HSN code ──
  const hsnMerged = new Map();
  for (const [, h] of b2cResult.hsnNet) {
    hsnMerged.set(h.hsn, { hsn: h.hsn, qty: h.qty, taxable: h.taxable, cgst: h.cgst, sgst: h.sgst, igst: h.igst });
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

  // ── Table 13 (Documents Issued): Amazon invoice-number range (incl. cancelled-but-numbered) + Flipkart's own series ──
  const amazonNums = b2cResult.invoiceNumbers.filter((n) => n.number);
  const docs = [];
  if (amazonNums.length) {
    const sorted = [...amazonNums].sort((a, b) => (a.number > b.number ? 1 : -1));
    docs.push({
      series: 'Amazon',
      from: sorted[0].number,
      to: sorted[sorted.length - 1].number,
      totalNumber: sorted.length,
      cancelled: sorted.filter((n) => n.cancelled).length,
      netIssued: sorted.filter((n) => !n.cancelled).length,
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
