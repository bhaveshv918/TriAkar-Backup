import crypto   from 'crypto';
import supabase from '../db/supabaseClient.js';

/* ── Confirm an order from a verified Razorpay webhook ─────────
   Mirrors the confirm path in paymentController.verifyPayment but is
   keyed on razorpay_order_id (no user JWT) and fully idempotent:
   stock is only decremented on the pending → confirmed transition, so
   duplicate webhook deliveries (or a race with /api/payments/verify)
   never double-decrement. */
async function confirmOrderByRazorpayId(razorpay_order_id, razorpay_payment_id) {
  const { data: order, error: fErr } = await supabase
    .from('orders')
    .select('id, status, order_status')
    .eq('razorpay_order_id', razorpay_order_id)
    .single();

  // PGRST116 = no matching order — nothing to do (not an error)
  if (fErr && fErr.code !== 'PGRST116') throw fErr;
  if (!order) return;
  if (order.status === 'confirmed') return; // already processed

  // Rule 10: an Instant Quote order stays in quote_pending_confirmation until a
  // human confirms the customization, even once payment clears. Only the payment
  // side (status/payment_status) flips here. Mirrors verifyPayment. The webhook
  // routinely lands before (or instead of) the browser's /api/payments/verify call,
  // so confirming order_status here would silently skip the confirmation queue.
  const isPendingQuoteConfirmation = order.order_status === 'quote_pending_confirmation';

  const update = {
    status:           'confirmed',
    order_status:     isPendingQuoteConfirmation ? 'quote_pending_confirmation' : 'confirmed',
    payment_received: true,
    payment_status:   'paid',
    paid_at:          new Date().toISOString(),
    advance_received: false,
    advance_amount:   0,
  };
  if (razorpay_payment_id) update.razorpay_payment_id = razorpay_payment_id;

  // Concurrency guard: only transition from 'pending'. If another path
  // (e.g. /api/payments/verify) already confirmed it, 0 rows update and
  // we skip stock decrement entirely.
  const { data: updatedRows, error: uErr } = await supabase
    .from('orders')
    .update(update)
    .eq('id', order.id)
    .eq('status', 'pending')
    .select();
  if (uErr) throw uErr;
  if (!updatedRows || !updatedRows.length) return; // already confirmed elsewhere

  // Decrement stock only after a successful confirm transition
  const { data: orderItems } = await supabase
    .from('order_items')
    .select('product_id, quantity')
    .eq('order_id', order.id);

  // Instant Quote line items have no catalog product_id (made-to-order, not
  // stocked), the same filter verifyPayment applies. Without it this fires a
  // decrement_stock(null, qty) per quote item, which the RPC answers with
  // `false` (no such product) and this path silently discards.
  for (const item of (orderItems ?? []).filter(i => i.product_id)) {
    await supabase.rpc('decrement_stock', {
      p_product_id: item.product_id,
      p_qty:        item.quantity,
    });
  }

  // Best-effort confirmation emails — must never throw out of here
  try {
    const { data: ord } = await supabase
      .from('orders')
      .select('*, order_items(quantity, unit_price, products(name))')
      .eq('id', order.id).single();
    if (ord) {
      const items = (ord.order_items || []).map(it => ({
        name: it.products?.name || 'Item', quantity: it.quantity, unit_price: it.unit_price,
      }));
      const orderData = {
        order_id:        ord.invoice_number || ord.order_id || ord.id,
        customer_name:   ord.customer_name || ord.shipping_address?.full_name || 'Customer',
        customer_email:  ord.customer_email,
        customer_phone:  ord.customer_phone || ord.shipping_address?.mobile || ord.shipping_address?.phone || '',
        total_amount:    ord.total_amount,
        subtotal:        ord.subtotal,
        shipping_charge: ord.shipping_charge,
        discount_amount: ord.discount_amount || 0,
        promo_code:      ord.promo_code || null,
        payment_method:  ord.payment_method || 'online',
        is_gift:         ord.is_gift || false,
        gift_message:    ord.gift_message || null,
        items,
        shipping_address: ord.shipping_address || {},
      };
      const { sendOrderConfirmation, sendAdminOrderAlert } = await import('../services/emailService.js');
      if (orderData.customer_email) { try { await sendOrderConfirmation(orderData); } catch (e) { console.error('Email error:', e.message); } }
      try { await sendAdminOrderAlert(orderData); } catch (e) { console.error('Email error:', e.message); }
    }
  } catch (e) { console.error('Webhook order email lookup failed:', e.message); }
}

/* ── POST /api/webhooks/razorpay ──────────────────────────────
   Mounted with express.raw() BEFORE the global express.json() so the
   raw request body is available for HMAC signature verification.
   Razorpay signs the raw payload with the dashboard webhook secret. */
export async function razorpayWebhook(req, res) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('RAZORPAY_WEBHOOK_SECRET is not configured');
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  const signature = req.headers['x-razorpay-signature'];
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const sigBuf = Buffer.from(String(signature || ''), 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch (_) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  try {
    const event = payload.event;
    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = payload.payload?.payment?.entity || {};
      const orderEntity   = payload.payload?.order?.entity || {};
      const razorpay_order_id   = paymentEntity.order_id || orderEntity.id;
      const razorpay_payment_id = paymentEntity.id || null;
      if (razorpay_order_id) {
        await confirmOrderByRazorpayId(razorpay_order_id, razorpay_payment_id);
      }
    }
    // Acknowledge every verified event so Razorpay stops retrying
    return res.json({ ok: true });
  } catch (err) {
    // Transient processing failure — 500 so Razorpay retries later.
    // Idempotency guarantees the retry is safe.
    console.error('Webhook processing error:', err.message);
    return res.status(500).json({ error: 'Processing failed' });
  }
}
