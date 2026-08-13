import supabase from '../db/supabaseClient.js';
import { logActivity } from '../services/activityLog.js';

// ─────────────────────────────────────────────────────────────────────────────
// Business OS money-write proxy. admin-biz.html historically wrote biz_sales,
// biz_returns and biz_sale_payments directly from the browser with the anon
// Supabase key, relying on RLS alone rather than the service-role backend that
// every other admin write in this project goes through. These are the
// highest-risk of those call sites (order status, payment lock, and payment
// installments) migrated onto the same requireAuth+requireAdmin gate the rest
// of /api/admin/* uses. Field lists are whitelisted so this can't become a
// generic "write anything to biz_sales" endpoint.
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_PAYLOAD_KEYS = ['status', 'completed_at', 'delivered_at'];

// ── PATCH /api/admin/biz/sales/status — bulk status update for one order's line items ──
export async function updateBizSalesStatus(req, res, next) {
  try {
    const { ids, payload } = req.body || {};
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids array is required' });
    if (!payload || typeof payload !== 'object') return res.status(400).json({ error: 'payload is required' });

    const clean = {};
    for (const k of STATUS_PAYLOAD_KEYS) if (payload[k] !== undefined) clean[k] = payload[k];
    if (!Object.keys(clean).length) return res.status(400).json({ error: 'No recognized fields in payload' });

    const { error } = await supabase.from('biz_sales').update(clean).in('id', ids);
    if (error) throw error;
    logActivity(req.user?.email, 'biz_sales.status', 'biz_sales', ids.join(','), JSON.stringify(clean));
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// ── PATCH /api/admin/biz/sales/paid — lock/unlock an order ──
export async function toggleBizSalesPaid(req, res, next) {
  try {
    const { ids, is_paid } = req.body || {};
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids array is required' });
    if (typeof is_paid !== 'boolean') return res.status(400).json({ error: 'is_paid must be boolean' });

    const { error } = await supabase.from('biz_sales').update({ is_paid }).in('id', ids);
    if (error) throw error;
    logActivity(req.user?.email, 'biz_sales.paid', 'biz_sales', ids.join(','), '→ ' + is_paid);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// ── PATCH /api/admin/biz/sales/payment-mode — sync composite payment_mode string ──
export async function updateBizSalesPaymentMode(req, res, next) {
  try {
    const { order_id, payment_mode } = req.body || {};
    if (!order_id) return res.status(400).json({ error: 'order_id is required' });
    const { error } = await supabase.from('biz_sales').update({ payment_mode: payment_mode || null }).eq('order_id', order_id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// ── POST /api/admin/biz/returns — auto-created or manual return log entry ──
const RETURN_FIELDS = [
  'sale_id', 'channel_id', 'order_id', 'type', 'stage', 'date',
  'orig_product_cost', 'orig_shipping', 'orig_packing', 'amount_lost',
  'refund_given', 'status', 'reason',
];
export async function insertBizReturn(req, res, next) {
  try {
    const body = req.body || {};
    if (!body.sale_id && !body.order_id) return res.status(400).json({ error: 'sale_id or order_id is required' });
    const clean = {};
    for (const k of RETURN_FIELDS) if (body[k] !== undefined) clean[k] = body[k];

    const { data, error } = await supabase.from('biz_returns').insert(clean).select('id').single();
    if (error) throw error;
    logActivity(req.user?.email, 'biz_returns.create', 'biz_returns', data.id, clean.reason || '');
    res.json({ ok: true, id: data.id });
  } catch (err) { next(err); }
}

// ── POST /api/admin/biz/sales/:orderId/payments — log an installment ──
export async function addBizSalePayment(req, res, next) {
  try {
    const { orderId } = req.params;
    const { amount, payment_date, source } = req.body || {};
    if (!(Number(amount) > 0)) return res.status(400).json({ error: 'amount must be greater than 0' });

    const { error } = await supabase.from('biz_sale_payments')
      .insert({ order_id: orderId, amount: Number(amount), payment_date: payment_date || null, source: source || null });
    if (error) throw error;
    logActivity(req.user?.email, 'biz_sale_payments.create', 'biz_sale_payments', orderId, '₹' + amount);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// ── DELETE /api/admin/biz/sales/payments/:id — remove an installment ──
export async function deleteBizSalePayment(req, res, next) {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('biz_sale_payments').delete().eq('id', id);
    if (error) throw error;
    logActivity(req.user?.email, 'biz_sale_payments.delete', 'biz_sale_payments', id, '');
    res.json({ ok: true });
  } catch (err) { next(err); }
}
