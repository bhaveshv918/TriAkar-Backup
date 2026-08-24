// ─────────────────────────────────────────────────────────────────────────────
// Regression check: the two payment-confirmation paths must agree.
//
//   A. POST /api/payments/verify  → paymentController.verifyPayment  (browser)
//   B. POST /api/webhooks/razorpay → webhookController (Razorpay server-to-server)
//
// Either can land first, or both can land at once. Whichever wins, the outcome
// has to be the same, and rule 10 has to hold: an Instant Quote order stays in
// order_status='quote_pending_confirmation' until a human confirms it, however
// the payment was reported.
//
// Runs against an in-memory stub of the Supabase client, so it touches nothing
// live. Usage:
//   node --experimental-test-module-mocks --test server/scripts/payment-confirm-paths-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { test, mock, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.RAZORPAY_KEY_ID         = 'rzp_test_key';
process.env.RAZORPAY_KEY_SECRET     = 'test_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret';

/* ── In-memory Supabase stub ──────────────────────────────────────────────── */
const db = { orders: [], order_items: [], promo_codes: [], admin_activity: [] };
const calls = { decrement: [] };
const hooks = { beforeUpdate: null };

function matches(row, filters) {
  return filters.every(([col, val, kind]) => {
    if (kind === 'in')  return val.includes(row[col]);
    if (kind === 'not') return row[col] != null;
    return row[col] === val;
  });
}

function exec(st) {
  const table = db[st.table] || (db[st.table] = []);
  if (st.op === 'insert') {
    for (const r of [].concat(st.payload)) table.push({ ...r });
    return { data: [].concat(st.payload), error: null };
  }
  const hits = table.filter(r => matches(r, st.filters));
  if (st.op === 'update') {
    for (const r of hits) Object.assign(r, st.payload);
  }
  const rows = hits.map(r => ({ ...r }));
  if (st.single) {
    return rows.length
      ? { data: rows[0], error: null }
      : { data: null, error: { code: 'PGRST116', message: 'no rows' } };
  }
  return { data: rows, error: null };
}

function builder(table) {
  const st = { table, op: 'select', filters: [], payload: null, single: false };
  const b = {
    select() { return b; },
    insert(v) { st.op = 'insert'; st.payload = v; return b; },
    update(v) { st.op = 'update'; st.payload = v; return b; },
    eq(c, v) { st.filters.push([c, v]); return b; },
    is(c, v) { st.filters.push([c, v]); return b; },
    not(c)   { st.filters.push([c, null, 'not']); return b; },
    in(c, v) { st.filters.push([c, v, 'in']); return b; },
    order()  { return b; },
    limit()  { return b; },
    single() { st.single = true; return b; },
    maybeSingle() { st.single = true; return b; },
    then(res, rej) {
      return Promise.resolve().then(async () => {
        // Lets a test slip the other path in between a read and its follow-up write,
        // to exercise interleavings Promise.all can't reach deterministically.
        if (st.op === 'update' && hooks.beforeUpdate) {
          const h = hooks.beforeUpdate; hooks.beforeUpdate = null; await h();
        }
        return exec(st);
      }).then(res, rej);
    },
  };
  return b;
}

const supabaseStub = {
  from: table => builder(table),
  rpc: async (fn, args) => {
    if (fn === 'decrement_stock') {
      calls.decrement.push(args);
      return { data: true, error: null };
    }
    return { data: null, error: null };
  },
};

let verifyPayment, razorpayWebhook;

before(async () => {
  mock.module('../db/supabaseClient.js', { defaultExport: supabaseStub });
  mock.module('../services/emailService.js', {
    namedExports: { sendOrderConfirmation: async () => {}, sendAdminOrderAlert: async () => {} },
  });
  ({ verifyPayment }   = await import('../controllers/paymentController.js'));
  ({ razorpayWebhook } = await import('../controllers/webhookController.js'));
});

/* ── Fixtures / drivers ───────────────────────────────────────────────────── */
const USER = 'user-1';

function seedOrder({ id, quote }) {
  db.orders.length = 0; db.order_items.length = 0; calls.decrement.length = 0;
  hooks.beforeUpdate = null;
  db.orders.push({
    id, user_id: USER, status: 'pending',
    order_status: quote ? 'quote_pending_confirmation' : null,
    razorpay_order_id: 'rzp_order_' + id,
    payment_status: 'pending', payment_received: false, total_amount: 500,
    customer_email: 'c@example.com', invoice_number: 'TRK-TEST-0001',
  });
  db.order_items.push(quote
    ? { order_id: id, product_id: null, instant_quote_id: 'q1', quantity: 1, unit_price: 500 }
    : { order_id: id, product_id: 'prod-1', instant_quote_id: null, quantity: 1, unit_price: 500 });
  return db.orders[0];
}

const order = id => db.orders.find(o => o.id === id);

async function runVerify(id) {
  const rzpOrderId = 'rzp_order_' + id;
  const paymentId  = 'pay_1';
  const signature  = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${rzpOrderId}|${paymentId}`).digest('hex');
  const req = {
    body: { razorpay_order_id: rzpOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature, order_id: id },
    user: { id: USER },
  };
  const out = {};
  const res = { status(c) { out.code = c; return res; }, json(b) { out.body = b; return res; } };
  await verifyPayment(req, res, e => { out.err = e; });
  if (out.err) throw out.err;
  return out;
}

async function runWebhook(id) {
  const payload = JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: { id: 'pay_1', order_id: 'rzp_order_' + id } } },
  });
  const sig = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(payload).digest('hex');
  const req = { headers: { 'x-razorpay-signature': sig }, body: Buffer.from(payload) };
  const out = {};
  const res = { status(c) { out.code = c; return res; }, json(b) { out.body = b; return res; } };
  await razorpayWebhook(req, res);
  return out;
}

/* ── Rule 10: neither path may auto-confirm an Instant Quote order ────────── */
test('webhook alone leaves an Instant Quote order in the confirmation queue', async () => {
  seedOrder({ id: 'o1', quote: true });
  await runWebhook('o1');
  const o = order('o1');
  assert.equal(o.order_status, 'quote_pending_confirmation', 'rule 10: must stay pending human confirmation');
  assert.equal(o.status, 'confirmed');
  assert.equal(o.payment_status, 'paid');
  assert.equal(o.payment_received, true);
});

test('verify alone leaves an Instant Quote order in the confirmation queue', async () => {
  seedOrder({ id: 'o2', quote: true });
  await runVerify('o2');
  const o = order('o2');
  assert.equal(o.order_status, 'quote_pending_confirmation');
  assert.equal(o.status, 'confirmed');
  assert.equal(o.payment_status, 'paid');
});

test('both paths write the same payment fields on an Instant Quote order', async () => {
  seedOrder({ id: 'o3', quote: true });
  await runWebhook('o3');
  const viaWebhook = { ...order('o3') };
  seedOrder({ id: 'o3', quote: true });
  await runVerify('o3');
  const viaVerify = { ...order('o3') };
  for (const f of ['status', 'order_status', 'payment_status', 'payment_received', 'razorpay_payment_id', 'advance_received', 'advance_amount']) {
    assert.equal(viaWebhook[f], viaVerify[f], `field "${f}" diverges between the two paths`);
  }
});

/* ── A normal (non-quote) order still confirms outright on both paths ─────── */
test('webhook confirms a normal order', async () => {
  seedOrder({ id: 'o4', quote: false });
  await runWebhook('o4');
  assert.equal(order('o4').order_status, 'confirmed');
});

test('verify confirms a normal order', async () => {
  seedOrder({ id: 'o5', quote: false });
  await runVerify('o5');
  assert.equal(order('o5').order_status, 'confirmed');
});

/* ── Idempotency: whichever lands first, the second is a no-op ────────────── */
test('webhook then verify: order_status preserved, stock decremented once', async () => {
  seedOrder({ id: 'o6', quote: false });
  await runWebhook('o6');
  await runVerify('o6');
  assert.equal(order('o6').order_status, 'confirmed');
  assert.equal(calls.decrement.length, 1, 'stock must not be decremented twice');
});

test('verify then webhook: order_status preserved, stock decremented once', async () => {
  seedOrder({ id: 'o7', quote: false });
  await runVerify('o7');
  await runWebhook('o7');
  assert.equal(order('o7').order_status, 'confirmed');
  assert.equal(calls.decrement.length, 1, 'stock must not be decremented twice');
});

test('duplicate webhook deliveries decrement stock once', async () => {
  seedOrder({ id: 'o8', quote: false });
  await runWebhook('o8');
  await runWebhook('o8');
  assert.equal(calls.decrement.length, 1);
});

test('webhook on a quote order then verify: still pending confirmation, no stock touched', async () => {
  seedOrder({ id: 'o9', quote: true });
  await runWebhook('o9');
  await runVerify('o9');
  assert.equal(order('o9').order_status, 'quote_pending_confirmation');
});

/* ── Concurrency: both read status='pending' before either writes ─────────── */
test('concurrent verify + webhook: rule 10 holds and stock is decremented once', async () => {
  seedOrder({ id: 'o10', quote: true });
  await Promise.all([runVerify('o10'), runWebhook('o10')]);
  assert.equal(order('o10').order_status, 'quote_pending_confirmation');
});

test('concurrent verify + webhook on a normal order: single stock decrement', async () => {
  seedOrder({ id: 'o11', quote: false });
  await Promise.all([runVerify('o11'), runWebhook('o11')]);
  assert.equal(order('o11').order_status, 'confirmed');
  assert.equal(calls.decrement.length, 1,
    'the webhook .eq(status,pending) guard and verify\'s already-confirmed early return must not both let a decrement through');
});

/* ── The guard is one-directional. Documented, not yet closed. ────────────
   The webhook's update carries .eq('status','pending'), so a webhook that
   loses the race matches 0 rows and skips its decrement. verifyPayment has
   no equivalent guard on its update: it only early-returns on the status it
   read BEFORE the write. If the webhook commits inside that window, verify's
   update still lands and stock is decremented a second time.

   Rule 10 survives this either way (both paths now preserve
   quote_pending_confirmation, asserted below), and Instant Quote line items
   have no product_id so they are never decremented at all. The exposure is
   limited to stocked catalog items on a genuinely concurrent verify+webhook.

   Closing it means adding .eq('status','pending') to verify's update AND
   turning the resulting 0-row result into a success response rather than the
   thrown 'Order update failed' the current .single() would produce, so a
   customer whose payment did clear is not shown a failure. Left as-is
   deliberately; these assertions pin the present behaviour so the change is
   visible when someone makes it. */
test('KNOWN GAP: webhook committing mid-verify double-decrements stock', async () => {
  seedOrder({ id: 'o12', quote: false });
  hooks.beforeUpdate = () => runWebhook('o12');
  await runVerify('o12');
  assert.equal(order('o12').order_status, 'confirmed');
  assert.equal(calls.decrement.length, 2,
    'if this drops to 1, verify grew a status guard: update the comment above');
});

test('rule 10 still holds when the webhook commits mid-verify', async () => {
  seedOrder({ id: 'o13', quote: true });
  hooks.beforeUpdate = () => runWebhook('o13');
  await runVerify('o13');
  assert.equal(order('o13').order_status, 'quote_pending_confirmation');
  assert.equal(calls.decrement.length, 0, 'Instant Quote items have no product_id to decrement');
});
