import supabase from '../db/supabaseClient.js';
import { logActivity } from '../services/activityLog.js';
import { reconcileGstPeriod } from '../services/gst-reconciliation.js';
import { buildExportCsv } from '../services/gst-export-templates.js';

const PERIOD_RE = /^\d{4}-\d{2}$/;

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
  } catch (err) { next(err); }
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
  } catch (err) { next(err); }
}

// ── GET /api/admin/gst/history, saved periods + totals, for history list + trend chart ──
export async function getGstHistory(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('biz_gst_calc_periods').select('*').order('period', { ascending: false });
    if (error) throw error;
    res.json({ periods: data || [] });
  } catch (err) { next(err); }
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
  } catch (err) { next(err); }
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
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${table}_${period.period}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
}

// ── POST /api/admin/gst/:periodId/mark-filed ──
export async function markGstFiled(req, res, next) {
  try {
    const { periodId } = req.params;
    const { error } = await supabase.from('biz_gst_calc_periods')
      .update({ status: 'filed', filed_date: new Date().toISOString().slice(0, 10) })
      .eq('id', periodId);
    if (error) throw error;
    logActivity(req.user?.email, 'gst.calc.mark_filed', 'gst_calc_period', periodId, '');
    res.json({ ok: true });
  } catch (err) { next(err); }
}
