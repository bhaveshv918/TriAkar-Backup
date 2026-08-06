import supabase from '../db/supabaseClient.js';
import { logActivity } from '../services/activityLog.js';
import { reconcileGstPeriod } from '../services/gst-reconciliation.js';
import { buildExportCsv } from '../services/gst-export-templates.js';
import { parseGstr2bB2b, suggestCategorization } from '../services/gst-purchase-import.js';

const PERIOD_RE = /^\d{4}-\d{2}$/;

// This admin-only, single-user feature deliberately bypasses the app's shared errorHandler
// (server/middleware/errorHandler.js), which masks any 500-status message behind a generic
// "Something went wrong" in production. That policy is correct for customer-facing routes, but
// for a spreadsheet-reconciliation tool the actual error message (a parse failure, an unexpected
// row shape) is exactly what's needed to fix the file or the code, not a security leak.
function respondGstError(res, err) {
  console.error('[GST]', err.message, err.stack);
  res.status(err.status || err.statusCode || 500).json({ error: err.message || 'GST operation failed' });
}

// ── POST /api/admin/gst/calculate, runs the reconciliation, nothing persisted yet ──
export async function calculateGst(req, res, next) {
  try {
    const { period, gstin } = req.body || {};
    if (!PERIOD_RE.test(period || '')) return res.status(400).json({ error: 'period must be YYYY-MM' });
    if (!gstin) return res.status(400).json({ error: 'gstin is required' });

    const files = req.files || {};
    const result = reconcileGstPeriod({
      gstin,
      period,
      amazonB2bBuffer: files.amazonB2b?.[0]?.buffer,
      amazonB2cBuffer: files.amazonB2c?.[0]?.buffer,
      flipkartBuffer: files.flipkart?.[0]?.buffer,
    });

    res.json({
      ...result,
      sourceFiles: {
        amazonB2b: files.amazonB2b?.[0] ? { name: files.amazonB2b[0].originalname, size: files.amazonB2b[0].size } : null,
        amazonB2c: files.amazonB2c?.[0] ? { name: files.amazonB2c[0].originalname, size: files.amazonB2c[0].size } : null,
        flipkart: files.flipkart?.[0] ? { name: files.flipkart[0].originalname, size: files.flipkart[0].size } : null,
      },
    });
  } catch (err) { respondGstError(res, err); }
}

// ── POST /api/admin/gst/save, persists a reviewed calculation, upsert on period ──
export async function saveGstCalc(req, res, next) {
  try {
    const { period, gstin, summary, tables, flags, sourceFiles } = req.body || {};
    if (!PERIOD_RE.test(period || '')) return res.status(400).json({ error: 'period must be YYYY-MM' });
    if (!gstin || !summary || !tables) return res.status(400).json({ error: 'gstin, summary and tables are required' });

    const { data: existing } = await supabase
      .from('biz_gst_calc_periods').select('id').eq('period', period).maybeSingle();

    let periodId = existing?.id;
    if (periodId) {
      const { error } = await supabase.from('biz_gst_calc_periods').update({
        seller_gstin: gstin, status: 'reviewed', totals: summary,
        source_files: sourceFiles || {}, updated_at: new Date().toISOString(),
      }).eq('id', periodId);
      if (error) throw error;
      await supabase.from('biz_gst_calc_line_items').delete().eq('period_id', periodId);
      await supabase.from('biz_gst_calc_flags').delete().eq('period_id', periodId);
    } else {
      const { data, error } = await supabase.from('biz_gst_calc_periods').insert({
        period, seller_gstin: gstin, status: 'reviewed', totals: summary, source_files: sourceFiles || {},
      }).select('id').single();
      if (error) throw error;
      periodId = data.id;
    }

    const lineItems = [];
    for (const r of tables.b2b || []) {
      lineItems.push({ period_id: periodId, table_type: 'b2b', state: r.state, gstin: r.gstin, invoice_no: r.invoiceNumber, invoice_date: r.invoiceDate || null, taxable: r.taxable, cgst: r.cgst, sgst: r.sgst, igst: r.igst, extra: { channel: r.channel } });
    }
    for (const r of tables.b2cs || []) {
      lineItems.push({ period_id: periodId, table_type: 'b2cs', state: r.state, rate: r.rate, taxable: r.taxable, cgst: r.cgst, sgst: r.sgst, igst: r.igst, extra: { placeOfSupplyType: r.placeOfSupplyType } });
    }
    for (const r of tables.hsn || []) {
      lineItems.push({ period_id: periodId, table_type: 'hsn', taxable: r.taxable, cgst: r.cgst, sgst: r.sgst, igst: r.igst, extra: { hsn: r.hsn, qty: r.qty } });
    }
    for (const r of tables.docs || []) {
      lineItems.push({ period_id: periodId, table_type: 'docs', extra: { series: r.series, from: r.from, to: r.to, totalNumber: r.totalNumber, cancelled: r.cancelled, netIssued: r.netIssued } });
    }
    if (lineItems.length) {
      const { error } = await supabase.from('biz_gst_calc_line_items').insert(lineItems);
      if (error) throw error;
    }

    if ((flags || []).length) {
      const flagRows = flags.map((f) => ({ period_id: periodId, severity: f.severity, code: f.code, message: f.message, context: f.context || {} }));
      const { error } = await supabase.from('biz_gst_calc_flags').insert(flagRows);
      if (error) throw error;
    }

    logActivity(req.user?.email, 'gst.calc.save', 'gst_calc_period', periodId, period);
    res.json({ ok: true, periodId });
  } catch (err) { respondGstError(res, err); }
}

// ── GET /api/admin/gst/history, saved periods + totals, for history list + trend chart ──
export async function getGstHistory(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('biz_gst_calc_periods').select('*').order('period', { ascending: false });
    if (error) throw error;
    res.json({ periods: data || [] });
  } catch (err) { respondGstError(res, err); }
}

// ── GET /api/admin/gst/:periodId, full detail of one saved period ──
export async function getGstPeriodDetail(req, res, next) {
  try {
    const { periodId } = req.params;
    const [{ data: period, error: e1 }, { data: lineItems, error: e2 }, { data: flags, error: e3 }] = await Promise.all([
      supabase.from('biz_gst_calc_periods').select('*').eq('id', periodId).single(),
      supabase.from('biz_gst_calc_line_items').select('*').eq('period_id', periodId),
      supabase.from('biz_gst_calc_flags').select('*').eq('period_id', periodId),
    ]);
    if (e1) throw e1; if (e2) throw e2; if (e3) throw e3;

    const tables = { b2b: [], b2cs: [], hsn: [], docs: [] };
    for (const r of lineItems || []) {
      if (r.table_type === 'b2b') tables.b2b.push({ state: r.state, gstin: r.gstin, invoiceNumber: r.invoice_no, invoiceDate: r.invoice_date, taxable: Number(r.taxable), cgst: Number(r.cgst), sgst: Number(r.sgst), igst: Number(r.igst), channel: r.extra?.channel });
      else if (r.table_type === 'b2cs') tables.b2cs.push({ state: r.state, rate: Number(r.rate), taxable: Number(r.taxable), cgst: Number(r.cgst), sgst: Number(r.sgst), igst: Number(r.igst), placeOfSupplyType: r.extra?.placeOfSupplyType });
      else if (r.table_type === 'hsn') tables.hsn.push({ hsn: r.extra?.hsn, qty: r.extra?.qty, taxable: Number(r.taxable), cgst: Number(r.cgst), sgst: Number(r.sgst), igst: Number(r.igst) });
      else if (r.table_type === 'docs') tables.docs.push({ series: r.extra?.series, from: r.extra?.from, to: r.extra?.to, totalNumber: r.extra?.totalNumber, cancelled: r.extra?.cancelled, netIssued: r.extra?.netIssued });
    }

    res.json({ period, tables, flags: flags || [] });
  } catch (err) { respondGstError(res, err); }
}

// ── GET /api/admin/gst/:periodId/export/:table, streams one Offline-Tool-shaped CSV ──
export async function exportGstCsv(req, res, next) {
  try {
    const { periodId, table } = req.params;
    if (!['b2b', 'b2cs', 'hsn', 'docs'].includes(table)) return res.status(400).json({ error: 'Unknown table' });

    const { data: period, error: e1 } = await supabase.from('biz_gst_calc_periods').select('period').eq('id', periodId).single();
    if (e1) throw e1;
    const { data: lineItems, error: e2 } = await supabase.from('biz_gst_calc_line_items').select('*').eq('period_id', periodId).eq('table_type', table);
    if (e2) throw e2;

    const tables = { b2b: [], b2cs: [], hsn: [], docs: [] };
    for (const r of lineItems || []) {
      if (table === 'b2b') tables.b2b.push({ state: r.state, gstin: r.gstin, invoiceNumber: r.invoice_no, invoiceDate: r.invoice_date, taxable: Number(r.taxable), cgst: Number(r.cgst), sgst: Number(r.sgst), igst: Number(r.igst) });
      if (table === 'b2cs') tables.b2cs.push({ state: r.state, rate: Number(r.rate), taxable: Number(r.taxable), cgst: Number(r.cgst), sgst: Number(r.sgst), igst: Number(r.igst) });
      if (table === 'hsn') tables.hsn.push({ hsn: r.extra?.hsn, qty: r.extra?.qty, taxable: Number(r.taxable), cgst: Number(r.cgst), sgst: Number(r.sgst), igst: Number(r.igst) });
      if (table === 'docs') tables.docs.push({ series: r.extra?.series, from: r.extra?.from, to: r.extra?.to, totalNumber: r.extra?.totalNumber, cancelled: r.extra?.cancelled });
    }

    const csv = buildExportCsv(table, tables);
    await supabase.from('biz_gst_calc_periods').update({ status: 'exported' }).eq('id', periodId).eq('status', 'reviewed');
    // Table 4 covers B2B, SEZ and Deemed Export together, the GST Offline Tool's own
    // Section_wise_CSV_files template names it "b2b, sez, de" rather than a bare "b2b".
    const exportFilename = table === 'b2b' ? 'b2b,sez,de' : table;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${exportFilename}_${period.period}.csv"`);
    res.send(csv);
  } catch (err) { respondGstError(res, err); }
}

// ── POST /api/admin/gst/:periodId/mark-filed ──
export async function markGstFiled(req, res, next) {
  try {
    const { periodId } = req.params;
    // IST date, not server-UTC — the Render backend runs in UTC, so a plain
    // toISOString().slice(0,10) records the previous calendar day for any filing
    // done between midnight and ~5:30 AM IST.
    const filed_date = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const { error } = await supabase.from('biz_gst_calc_periods')
      .update({ status: 'filed', filed_date })
      .eq('id', periodId);
    if (error) throw error;
    logActivity(req.user?.email, 'gst.calc.mark_filed', 'gst_calc_period', periodId, '');
    res.json({ ok: true });
  } catch (err) { respondGstError(res, err); }
}

// ── POST /api/admin/gst/:periodId/unmark-filed, reverts an accidental "Mark as Filed" ──
export async function unmarkGstFiled(req, res, next) {
  try {
    const { periodId } = req.params;
    const { data: period, error: e1 } = await supabase.from('biz_gst_calc_periods').select('status').eq('id', periodId).single();
    if (e1) throw e1;
    if (period.status !== 'filed') return res.status(400).json({ error: 'This period is not marked as filed' });
    const { error } = await supabase.from('biz_gst_calc_periods')
      .update({ status: 'exported', filed_date: null })
      .eq('id', periodId);
    if (error) throw error;
    logActivity(req.user?.email, 'gst.calc.unmark_filed', 'gst_calc_period', periodId, '');
    res.json({ ok: true });
  } catch (err) { respondGstError(res, err); }
}

// ── DELETE /api/admin/gst/:periodId, removes a calculated period (cascades line items/flags) ──
export async function deleteGstPeriod(req, res, next) {
  try {
    const { periodId } = req.params;
    const { data: period, error: e1 } = await supabase.from('biz_gst_calc_periods').select('period').eq('id', periodId).maybeSingle();
    if (e1) throw e1;
    if (!period) return res.status(404).json({ error: 'Period not found' });
    const { error } = await supabase.from('biz_gst_calc_periods').delete().eq('id', periodId);
    if (error) throw error;
    logActivity(req.user?.email, 'gst.calc.delete', 'gst_calc_period', periodId, period.period);
    res.json({ ok: true });
  } catch (err) { respondGstError(res, err); }
}

// ─────────────────────────────────────────────────────────────────────────────
// GST-sourced bulk import into Business OS accounting (Purchases/Expenses), per
// GST-AUTOMATION-SPEC.md's "Downstream" section. Review-first workflow, same shape as the
// GSTR-1 calculate/save flow above: /parse never writes to the DB, only /commit does.
// ─────────────────────────────────────────────────────────────────────────────

// ── POST /api/admin/gst/import/parse, parses a GSTR-2B B2B xlsx, nothing persisted yet ──
export async function parseGstImport(req, res, next) {
  try {
    const { period } = req.body || {};
    if (!PERIOD_RE.test(period || '')) return res.status(400).json({ error: 'period must be YYYY-MM' });
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No GSTR-2B B2B file uploaded' });

    const { rows, error } = parseGstr2bB2b(file.buffer);
    if (error) return res.status(400).json({ error });
    if (!rows.length) return res.status(400).json({ error: 'No B2B rows found in this file' });

    // Duplicate check is invoice-level (gstin + invoice number), not period-level, per the
    // migration's own reasoning: a supplier's credit note can shift which period an invoice
    // resurfaces in on a later GSTR-2B pull, so the same real invoice must only ever be
    // committed once regardless of which month's file it's read from this time.
    const pairs = rows.map((r) => `and(supplier_gstin.eq.${r.gstin},invoice_number.eq.${r.invoiceNumber})`);
    const { data: existing, error: dupErr } = await supabase
      .from('biz_gst_import_lines').select('supplier_gstin,invoice_number,action,category,target_table')
      .or(pairs.join(','));
    if (dupErr) throw dupErr;
    const existingMap = new Map((existing || []).map((e) => [`${e.supplier_gstin}|${e.invoice_number}`, e]));

    const reviewed = rows.map((r) => {
      const dup = existingMap.get(`${r.gstin}|${r.invoiceNumber}`);
      const suggestion = suggestCategorization(r);
      return {
        ...r,
        taxTotal: Math.round((r.igst + r.cgst + r.sgst + r.cess) * 100) / 100,
        suggestedTarget: suggestion.target,
        suggestedCategory: suggestion.category,
        reason: suggestion.reason,
        alreadyProcessed: dup ? { action: dup.action, category: dup.category, targetTable: dup.target_table } : null,
      };
    });

    res.json({ period, rows: reviewed });
  } catch (err) { respondGstError(res, err); }
}

const EXPENSE_CATEGORIES = ['materials', 'equipment', 'packaging', 'marketing', 'rent', 'utilities', 'shipping', 'staff_salary', 'other'];
const PURCHASE_CATEGORIES = ['raw_material', 'packaging', 'equipment', 'other'];

// ── POST /api/admin/gst/import/commit, inserts reviewed rows into Purchases/Expenses ──
export async function commitGstImport(req, res, next) {
  try {
    const { period, rows } = req.body || {};
    if (!PERIOD_RE.test(period || '')) return res.status(400).json({ error: 'period must be YYYY-MM' });
    if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ error: 'rows is required' });

    const results = { purchases: 0, expenses: 0, excluded: 0, skippedDuplicate: 0, errors: [] };

    for (const r of rows) {
      const gstin = String(r.gstin || '').trim().toUpperCase();
      const invoiceNumber = String(r.invoiceNumber || '').trim();
      if (!gstin || !invoiceNumber) { results.errors.push(`Row missing GSTIN/invoice number, skipped: ${JSON.stringify(r).slice(0, 100)}`); continue; }

      // Re-check at commit time (not just at /parse) so two review sessions started around the
      // same time can't both commit the same invoice.
      const { data: dup } = await supabase.from('biz_gst_import_lines')
        .select('id').eq('supplier_gstin', gstin).eq('invoice_number', invoiceNumber).maybeSingle();
      if (dup) { results.skippedDuplicate++; continue; }

      const target = r.target;
      const taxable = Number(r.taxable) || 0;
      const taxTotal = Number(r.taxTotal) || (Number(r.igst) || 0) + (Number(r.cgst) || 0) + (Number(r.sgst) || 0) + (Number(r.cess) || 0);
      const total = Math.round((taxable + taxTotal) * 100) / 100;
      const notes = `Imported from GSTR-2B ${period} (invoice ${invoiceNumber})`;

      let targetTable = null, targetId = null, category = null;

      if (target === 'purchase') {
        category = PURCHASE_CATEGORIES.includes(r.category) ? r.category : 'raw_material';
        const { data, error } = await supabase.from('biz_purchases').insert({
          date: r.invoiceDate || `${period}-01`, vendor: r.vendorName || null, category,
          item: r.vendorName ? `GST import: ${r.vendorName}` : 'GST import', qty: 1,
          unit_amount: total, total_amount: total, notes,
        }).select('id').single();
        if (error) { results.errors.push(`${gstin}/${invoiceNumber}: ${error.message}`); continue; }
        targetTable = 'biz_purchases'; targetId = data.id; results.purchases++;
      } else if (target === 'expense') {
        category = EXPENSE_CATEGORIES.includes(r.category) ? r.category : 'other';
        const { data, error } = await supabase.from('biz_expenses').insert({
          date: r.invoiceDate || `${period}-01`, category, vendor: r.vendorName || null,
          amount: total, gst_amount: taxTotal, source: 'GST Import', notes,
        }).select('id').single();
        if (error) { results.errors.push(`${gstin}/${invoiceNumber}: ${error.message}`); continue; }
        targetTable = 'biz_expenses'; targetId = data.id; results.expenses++;
      } else {
        results.excluded++;
      }

      const { error: dedupErr } = await supabase.from('biz_gst_import_lines').insert({
        period, supplier_gstin: gstin, invoice_number: invoiceNumber, vendor_name: r.vendorName || null,
        invoice_date: r.invoiceDate || null, taxable, tax_total: taxTotal,
        action: target === 'exclude' ? 'excluded' : 'imported',
        target_table: targetTable, target_id: targetId, category, notes: r.reason || null,
      });
      if (dedupErr) results.errors.push(`${gstin}/${invoiceNumber}: dedup record failed (${dedupErr.message}), the row above may re-appear on the next import`);
    }

    logActivity(req.user?.email, 'gst.import.commit', 'gst_import', null, `${period}: ${results.purchases} purchases, ${results.expenses} expenses, ${results.excluded} excluded`);
    res.json({ ok: true, ...results });
  } catch (err) { respondGstError(res, err); }
}
