import Razorpay from 'razorpay';
import crypto   from 'crypto';
import supabase from '../db/supabaseClient.js';

/* Generate invoice number: TRK-YYYYMMDD-XXXX */
function generateInvoiceNumber() {
  const now  = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const rand = Math.floor(1000 + Math.random() * 9000);           // 4-digit
  return `TRK-${date}-${rand}`;
}

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/* ── POST /api/payments/create-order ──────────────────────── */
export async function createOrder(req, res, next) {
  try {
    // FIX #13/#18: accept trk_id + customer fields upfront so no post-payment enrichment needed
    const { items, address_id, trk_id, customer_name, customer_email, customer_phone, special_instructions, promo_code, is_gift, gift_message } = req.body;
    const user_id = req.user.id;

    if (!items?.length) return res.status(400).json({ error: 'Cart is empty' });
    if (!address_id && !req.body.shipping_address)
      return res.status(400).json({ error: 'Shipping address is required' });

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
      // SECURITY: quantity must be a positive integer. Without this a negative or
      // zero quantity drives the subtotal down (pay ₹1 for a ₹5000 item) and the
      // decrement_stock RPC — stock_qty = GREATEST(0, stock_qty - qty) — would even
      // ADD phantom stock back for a negative qty.
      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty < 1)
        return res.status(400).json({ error: `Invalid quantity for "${item.slug}"` });
      const p = products.find(x => x.slug === item.slug);
      if (!p) return res.status(400).json({ error: `Product "${item.slug}" not found` });
      if (p.stock_qty < qty)
        return res.status(400).json({ error: `Insufficient stock for "${p.name}"` });
      subtotal += p.price * qty;
    }
    const shipping_charge = subtotal >= 999 ? 0 : 99;

    /* Validate promo code server-side (never trust client discount) */
    let discount_amount = 0;
    let applied_promo   = null;
    if (promo_code) {
      const { data: promo } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', promo_code.toUpperCase().trim())
        .single();
      if (promo && promo.is_active &&
          (!promo.expires_at || new Date(promo.expires_at) > new Date()) &&
          (!promo.max_uses   || promo.current_uses < promo.max_uses) &&
          (!promo.min_order_amount || subtotal >= promo.min_order_amount) &&
          (!promo.product_slug || items.some(i => i.slug === promo.product_slug))) {
        applied_promo = promo;
        if (promo.discount_type === 'free_shipping') {
          discount_amount = shipping_charge;
        } else if (promo.discount_type === 'percent') {
          discount_amount = Math.round(subtotal * promo.discount_value / 100);
          // Apply max discount cap (e.g. 10% off but max ₹500)
          if (promo.max_discount_amount && discount_amount > promo.max_discount_amount)
            discount_amount = promo.max_discount_amount;
        } else if (promo.discount_type === 'fixed') {
          discount_amount = Math.min(promo.discount_value, subtotal);
        }
      }
    }

    const total_amount = Math.max(0, subtotal + shipping_charge - discount_amount);

    /* 3. Resolve shipping address — from saved address or inline fields */
    let shipping_address;
    if (address_id) {
      const { data: addr, error: aErr } = await supabase
        .from('user_addresses')
        .select('*')
        .eq('id', address_id)
        .eq('user_id', user_id)
        .single();
      if (aErr || !addr) return res.status(400).json({ error: 'Address not found' });
      shipping_address = {
        full_name: addr.full_name, phone: addr.phone,
        address_line1: addr.address_line1, address_line2: addr.address_line2,
        city: addr.city, state: addr.state, pincode: addr.pincode, country: addr.country,
      };
    } else {
      const sa = req.body.shipping_address;
      if (!sa.full_name || !sa.phone || !sa.address_line1 || !sa.city || !sa.state || !sa.pincode)
        return res.status(400).json({ error: 'Incomplete shipping address' });
      shipping_address = {
        full_name: sa.full_name, phone: sa.phone,
        address_line1: sa.address_line1, address_line2: sa.address_line2 || null,
        city: sa.city, state: sa.state, pincode: sa.pincode, country: sa.country || 'India',
      };
    }

    /* 4. Create DB order — generate invoice number server-side, always TRK-YYYYMMDD-XXXX */
    const invoiceNumber = generateInvoiceNumber();
    const orderInsert = {
      user_id, ...(address_id ? { address_id } : {}), status: 'pending', total_amount, subtotal, shipping_charge, shipping_address,
      invoice_number: invoiceNumber,
      order_id:       invoiceNumber,   // keep order_id in sync for legacy compatibility
    };
    if (customer_name)      orderInsert.customer_name       = customer_name;
    if (customer_email)     orderInsert.customer_email      = customer_email;
    if (customer_phone)     orderInsert.customer_phone      = customer_phone;
    if (special_instructions) orderInsert.special_instructions = special_instructions;
    if (is_gift) {
      orderInsert.is_gift = true;
      if (gift_message) orderInsert.gift_message = String(gift_message).slice(0, 150);
    }
    if (applied_promo) {
      orderInsert.promo_code      = applied_promo.code;
      orderInsert.discount_amount = discount_amount;
    }

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
        quantity: Number(item.quantity), unit_price: p.price,
        customization_notes: item.customization_notes || null,
      };
    });
    const { error: iErr } = await supabase.from('order_items').insert(rows);
    if (iErr) throw iErr;

    /* 6. Create Razorpay order (amount in paise) */
    let rzpOrder;
    try {
      rzpOrder = await razorpay.orders.create({
        amount:   Math.round(total_amount * 100),
        currency: 'INR',
        receipt:  invoiceNumber,
        notes:    { order_id: invoiceNumber },
      });
    } catch (rzpErr) {
      // Razorpay API error — surface the actual reason so it isn't masked as a generic 500
      const reason = rzpErr?.error?.description || rzpErr?.message || 'Unknown Razorpay error';
      console.error('[Razorpay] orders.create failed:', reason, rzpErr);
      const e = new Error('Payment gateway error: ' + reason);
      e.status = 502;
      throw e;
    }

    await supabase.from('orders')
      .update({ razorpay_order_id: rzpOrder.id })
      .eq('id', order.id);

    /* 7. Return data for frontend Razorpay modal */
    res.json({
      razorpay_order_id: rzpOrder.id,
      amount:            rzpOrder.amount,
      currency:          rzpOrder.currency,
      order_id:          order.id,
      invoice_number:    invoiceNumber,
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

    // Constant-time comparison — avoids a signature timing side-channel
    const sigBuf = Buffer.from(String(razorpay_signature), 'utf8');
    const expBuf = Buffer.from(expected, 'utf8');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return res.status(400).json({ error: 'Signature mismatch — payment verification failed' });
    }

    // FIX #1: verify this order belongs to the authenticated user
    const { data: existingOrder, error: fetchErr } = await supabase
      .from('orders')
      .select('id, user_id, status, razorpay_order_id')
      .eq('id', order_id)
      .single();
    if (fetchErr || !existingOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (existingOrder.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden — order does not belong to you' });
    }
    // SECURITY: the signature only proves (razorpay_order_id, payment_id) is a valid
    // Razorpay-signed pair — it does NOT prove that pair belongs to THIS order. Bind it
    // to the order's own razorpay_order_id so a cheap order's real payment can't be
    // replayed to confirm a different, expensive order.
    if (!existingOrder.razorpay_order_id || existingOrder.razorpay_order_id !== razorpay_order_id) {
      return res.status(400).json({ error: 'Payment does not match this order' });
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

    // Increment promo usage counter ONLY now that payment is verified — doing this at
    // order-creation time (before) meant an abandoned/failed checkout still burned the
    // customer's use of the code against max_uses.
    if (updatedOrder.promo_code) {
      const { data: promo } = await supabase
        .from('promo_codes')
        .select('id, current_uses')
        .eq('code', updatedOrder.promo_code)
        .single();
      if (promo) {
        await supabase.from('promo_codes')
          .update({ current_uses: (promo.current_uses || 0) + 1 })
          .eq('id', promo.id);
      }
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
    } catch (e) { console.error('Order email lookup failed:', e.message); }

    res.json({ ok: true, order_id });
  } catch (err) { next(err); }
}
