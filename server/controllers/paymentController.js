import Razorpay from 'razorpay';
import crypto   from 'crypto';
import supabase from '../db/supabaseClient.js';

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/* ── POST /api/payments/create-order ──────────────────────── */
export async function createOrder(req, res, next) {
  try {
    // FIX #13/#18: accept trk_id + customer fields upfront so no post-payment enrichment needed
    const { items, address_id, trk_id, customer_name, customer_email, customer_phone, special_instructions } = req.body;
    const user_id = req.user.id;

    if (!items?.length) return res.status(400).json({ error: 'Cart is empty' });
    if (!address_id)    return res.status(400).json({ error: 'Shipping address is required' });

    /* 1. Ensure profile exists (safety-net for FK) */
    await supabase.from('profiles').upsert(
      { id: user_id, full_name: req.user.user_metadata?.full_name || '' },
      { onConflict: 'id' },
    );

    /* 2. Fetch & validate products by slug */
    const slugs = items.map(i => i.slug);
    const { data: products, error: pErr } = await supabase
      .from('products')
      .select('id, name, slug, price, stock_qty')
      .in('slug', slugs)
      .eq('is_active', true);
    if (pErr) throw pErr;

    let subtotal = 0;
    for (const item of items) {
      const p = products.find(x => x.slug === item.slug);
      if (!p) return res.status(400).json({ error: `Product "${item.slug}" not found` });
      if (p.stock_qty < item.quantity)
        return res.status(400).json({ error: `Insufficient stock for "${p.name}"` });
      subtotal += p.price * item.quantity;
    }
    const shipping_charge = subtotal >= 999 ? 0 : 49;
    const total_amount    = subtotal + shipping_charge;

    /* 3. Fetch shipping address */
    const { data: addr, error: aErr } = await supabase
      .from('user_addresses')
      .select('*')
      .eq('id', address_id)
      .eq('user_id', user_id)
      .single();
    if (aErr || !addr) return res.status(400).json({ error: 'Address not found' });

    const shipping_address = {
      full_name: addr.full_name, phone: addr.phone,
      address_line1: addr.address_line1, address_line2: addr.address_line2,
      city: addr.city, state: addr.state, pincode: addr.pincode, country: addr.country,
    };

    /* 4. Create DB order — include TRK ID + customer fields now so tracking always works */
    const orderInsert = {
      user_id, address_id, status: 'pending', total_amount, subtotal, shipping_charge, shipping_address,
    };
    if (trk_id)             orderInsert.order_id            = trk_id;
    if (customer_name)      orderInsert.customer_name       = customer_name;
    if (customer_email)     orderInsert.customer_email      = customer_email;
    if (customer_phone)     orderInsert.customer_phone      = customer_phone;
    if (special_instructions) orderInsert.special_instructions = special_instructions;

    const { data: order, error: oErr } = await supabase
      .from('orders')
      .insert(orderInsert)
      .select()
      .single();
    if (oErr) throw oErr;

    /* 5. Create order items */
    const rows = items.map(item => {
      const p = products.find(x => x.slug === item.slug);
      return {
        order_id: order.id, product_id: p.id,
        quantity: item.quantity, unit_price: p.price,
        customization_notes: item.customization_notes || null,
      };
    });
    const { error: iErr } = await supabase.from('order_items').insert(rows);
    if (iErr) throw iErr;

    /* 6. Create Razorpay order (amount in paise) */
    const rzpOrder = await razorpay.orders.create({
      amount:   Math.round(total_amount * 100),
      currency: 'INR',
      receipt:  order.id,
      notes:    { order_id: order.id },
    });

    await supabase.from('orders')
      .update({ razorpay_order_id: rzpOrder.id })
      .eq('id', order.id);

    /* 7. Return data for frontend Razorpay modal */
    res.json({
      razorpay_order_id: rzpOrder.id,
      amount:            rzpOrder.amount,
      currency:          rzpOrder.currency,
      order_id:          order.id,
      key_id:            process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) { next(err); }
}

/* ── POST /api/payments/verify ────────────────────────────── */
export async function verifyPayment(req, res, next) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !order_id) {
      return res.status(400).json({ error: 'Missing payment verification fields' });
    }

    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expected !== razorpay_signature) {
      return res.status(400).json({ error: 'Signature mismatch — payment verification failed' });
    }

    // FIX #1: verify this order belongs to the authenticated user
    const { data: existingOrder, error: fetchErr } = await supabase
      .from('orders')
      .select('id, user_id, status')
      .eq('id', order_id)
      .single();
    if (fetchErr || !existingOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (existingOrder.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden — order does not belong to you' });
    }
    // Idempotency: if already confirmed, return success without re-processing
    if (existingOrder.status === 'confirmed') {
      return res.json({ ok: true, order_id });
    }

    // FIX #7: check that the DB update actually succeeds before decrementing stock
    const { data: updatedOrder, error: oErr } = await supabase.from('orders')
      .update({
        status:             'confirmed',
        order_status:       'confirmed',
        razorpay_payment_id,
        payment_received:   true,
        payment_status:     'paid',
        paid_at:            new Date().toISOString(),
        advance_received:   false,
        advance_amount:     0,
      })
      .eq('id', order_id)
      .eq('user_id', req.user.id)   // extra safety: ownership enforced at DB level too
      .select()
      .single();
    // FIX #7: throw if update failed — stock must NOT be touched
    if (oErr || !updatedOrder) throw oErr || new Error('Order update failed');

    // FIX #8: decrement stock ONLY after confirmed order update
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('product_id, quantity')
      .eq('order_id', order_id);

    for (const item of orderItems ?? []) {
      await supabase.rpc('decrement_stock', {
        p_product_id: item.product_id,
        p_qty:        item.quantity,
      });
    }

    /* Best-effort confirmation emails — must never break the response */
    try {
      const { data: ord } = await supabase
        .from('orders')
        .select('*, order_items(quantity, unit_price, products(name))')
        .eq('id', order_id).single();
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
          payment_method:  ord.payment_method || 'online',
          items,
          shipping_address: ord.shipping_address || {},
        };
        const { sendOrderConfirmation, sendAdminOrderAlert } = await import('../services/emailService.js');
        if (orderData.customer_email) { try { await sendOrderConfirmation(orderData); } catch (e) { console.error('Email error:', e.message); } }
        try { await sendAdminOrderAlert(orderData); } catch (e) { console.error('Email error:', e.message); }
      }
    } catch (e) { console.error('Order email lookup failed:', e.message); }

    res.json({ ok: true, order_id });
  } catch (err) { next(err); }
}
