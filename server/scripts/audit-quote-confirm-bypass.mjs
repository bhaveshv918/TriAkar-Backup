// ─────────────────────────────────────────────────────────────────────────────
// READ-ONLY audit: Instant Quote orders that left quote_pending_confirmation
// without a human confirming them (rule 10 bypass).
//
// webhookController.confirmOrderByRazorpayId used to write order_status:'confirmed'
// unconditionally, so any Instant Quote order whose payment was reported by the
// Razorpay webhook before (or instead of) the browser's /api/payments/verify call
// skipped the confirmation queue in admin-biz.html.
//
// An order is flagged when ALL of these hold:
//   - it has at least one order_items row with instant_quote_id set (so it was
//     created with order_status='quote_pending_confirmation', see
//     paymentController.createOrder step 4)
//   - its order_status is no longer 'quote_pending_confirmation'
//   - there is no admin_activity 'order.status' row for it, i.e. no admin ever
//     moved it via PUT /api/admin/orders/:id/status (the only path a human
//     confirm/cancel takes, adminController.updateOrderStatus)
//
// This script writes nothing. Usage:
//   node --env-file=server/.env server/scripts/audit-quote-confirm-bypass.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: quoteItems, error: iErr } = await supabase
  .from('order_items')
  .select('order_id, instant_quote_id')
  .not('instant_quote_id', 'is', null);
if (iErr) { console.error('order_items query failed:', iErr.message); process.exit(1); }

const orderIds = [...new Set((quoteItems || []).map(r => r.order_id).filter(Boolean))];
console.log(`Instant Quote orders found: ${orderIds.length}`);
if (!orderIds.length) process.exit(0);

const { data: orders, error: oErr } = await supabase
  .from('orders')
  .select('id, invoice_number, order_id, created_at, status, order_status, payment_status, payment_received, paid_at, total_amount, customer_email, razorpay_payment_id, deleted_at')
  .in('id', orderIds)
  .order('created_at', { ascending: true });
if (oErr) { console.error('orders query failed:', oErr.message); process.exit(1); }

const { data: acts, error: aErr } = await supabase
  .from('admin_activity')
  .select('entity_id, action, detail, actor_email, created_at')
  .eq('entity_type', 'order')
  .eq('action', 'order.status')
  .in('entity_id', orderIds);
if (aErr) { console.error('admin_activity query failed:', aErr.message); process.exit(1); }

const touchedByAdmin = new Map();
for (const a of acts || []) {
  if (!touchedByAdmin.has(a.entity_id)) touchedByAdmin.set(a.entity_id, []);
  touchedByAdmin.get(a.entity_id).push(a);
}

const stillPending = [];
const humanMoved   = [];
const bypassed     = [];

for (const o of orders || []) {
  if (o.order_status === 'quote_pending_confirmation') { stillPending.push(o); continue; }
  if (touchedByAdmin.has(o.id)) { humanMoved.push(o); continue; }
  bypassed.push(o);
}

const line = o => [
  (o.invoice_number || o.order_id || o.id).padEnd(22),
  String(o.order_status || 'null').padEnd(28),
  String(o.status || 'null').padEnd(12),
  String(o.payment_status || 'null').padEnd(10),
  ('Rs ' + Number(o.total_amount || 0).toLocaleString('en-IN')).padEnd(14),
  (o.created_at || '').slice(0, 16),
  o.deleted_at ? ' [DELETED]' : '',
].join(' ');

console.log(`\nStill in the confirmation queue (correct): ${stillPending.length}`);
for (const o of stillPending) console.log('  ' + line(o));

console.log(`\nMoved by an admin via the status endpoint (correct): ${humanMoved.length}`);
for (const o of humanMoved) {
  console.log('  ' + line(o));
  for (const a of touchedByAdmin.get(o.id)) {
    console.log(`      ${(a.created_at || '').slice(0, 16)}  ${a.actor_email || 'unknown'}  ${a.detail || ''}`);
  }
}

console.log(`\n*** LEFT THE QUEUE WITH NO HUMAN CONFIRMATION (rule 10 bypass): ${bypassed.length}`);
for (const o of bypassed) {
  console.log('  ' + line(o));
  console.log(`      id=${o.id}  paid_at=${o.paid_at || 'null'}  rzp_payment=${o.razorpay_payment_id || 'null'}  ${o.customer_email || ''}`);
}

if (bypassed.length) {
  console.log('\nTo put these back in the queue, run in the Supabase SQL editor:');
  console.log("UPDATE public.orders SET order_status = 'quote_pending_confirmation'");
  console.log('WHERE id IN (' + bypassed.map(o => `'${o.id}'`).join(', ') + ');');
  console.log('\nReview each one first: any that already shipped or was delivered should NOT');
  console.log('be reset, and any already cancelled/refunded should be left alone.');
}
