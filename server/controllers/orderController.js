import supabase from '../db/supabaseClient.js';

export async function createOrder(req, res, next) {
  try {
    const { items, shipping_address, address_id } = req.body;
    const user_id = req.user.id;

    if (!items?.length) return res.status(400).json({ error: 'items are required' });

    const productIds = items.map(i => i.product_id);
    // FIX #5: filter inactive/deleted products so they can't be ordered
    const { data: products, error: pErr } = await supabase
      .from('products').select('id, price, stock_qty, name').in('id', productIds).eq('is_active', true);
    if (pErr) throw pErr;

    let total_amount = 0;
    for (const item of items) {
      // SECURITY: reject non-positive / non-integer quantities (price manipulation)
      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty < 1)
        return res.status(400).json({ error: `Invalid quantity for product ${item.product_id}` });
      const p = products.find(x => x.id === item.product_id);
      if (!p) return res.status(400).json({ error: `Product ${item.product_id} not found` });
      if (p.stock_qty < qty)
        return res.status(400).json({ error: `Insufficient stock for "${p.name}"` });
      total_amount += p.price * qty;
    }

    const { data: order, error: oErr } = await supabase
      .from('orders')
      .insert({ user_id, status: 'pending', total_amount, shipping_address: shipping_address || {}, address_id: address_id || null })
      .select().single();
    if (oErr) throw oErr;

    const rows = items.map(item => ({
      order_id: order.id,
      product_id: item.product_id,
      quantity: Number(item.quantity),
      unit_price: products.find(x => x.id === item.product_id).price,
      customization_notes: item.customization_notes || null,
    }));
    const { error: iErr } = await supabase.from('order_items').insert(rows);
    if (iErr) throw iErr;

    res.status(201).json({ order });
  } catch (err) { next(err); }
}

export async function createWhatsAppOrder(req, res, next) {
  try {
    const user_id = req.user.id;
    const { order_id, items, shipping_address, customer_name, customer_phone,
            customer_email, special_instructions, promo_code, is_gift, gift_message } = req.body;

    if (!items?.length) return res.status(400).json({ error: 'items are required' });

    /* SECURITY: never trust client-supplied prices/totals. Re-price every line
       from the products table using validated quantities, then recompute subtotal,
       shipping and discount server-side. (Previously subtotal / total_amount /
       discount were taken verbatim from the request, so a forged ₹1 "order" with
       real-looking confirmation emails could be created.) */
    const productItemsIn      = items.filter(i => i.type !== 'instant_quote');
    const instantQuoteItemsIn = items.filter(i => i.type === 'instant_quote');
    const slugs = [...new Set(productItemsIn.map(i => i.slug).filter(Boolean))];
    if (!slugs.length && !instantQuoteItemsIn.length)
      return res.status(400).json({ error: 'items must reference product slugs or an Instant Quote' });

    const { data: products, error: pErr } = await supabase
      .from('products').select('slug, name, price').in('slug', slugs.length ? slugs : ['__none__']).eq('is_active', true);
    if (pErr) throw pErr;

    let subtotal = 0;
    const pricedItems = productItemsIn.map(i => {
      const qty = Number(i.quantity);
      if (!Number.isInteger(qty) || qty < 1) throw Object.assign(new Error(`Invalid quantity for "${i.slug}"`), { status: 400 });
      const p = products.find(x => x.slug === i.slug);
      if (!p) throw Object.assign(new Error(`Product "${i.slug}" not found`), { status: 400 });
      subtotal += p.price * qty;
      return { slug: i.slug, name: p.name, quantity: qty, unit_price: p.price,
               customization_notes: i.customization_notes || null };
    });

    if (instantQuoteItemsIn.length) {
      const quoteIds = instantQuoteItemsIn.map(i => i.instant_quote_id);
      const { data: quoteRows, error: qErr } = await supabase
        .from('instant_quote_requests').select('*').in('id', quoteIds).eq('user_id', user_id);
      if (qErr) throw qErr;
      for (const i of instantQuoteItemsIn) {
        const qty = Number(i.quantity) || 1;
        const q = (quoteRows || []).find(x => x.id === i.instant_quote_id);
        if (!q) throw Object.assign(new Error('One of your Instant Quote items was not found'), { status: 400 });
        if (q.status !== 'quoted') throw Object.assign(new Error('One of your Instant Quote items has already been ordered or expired'), { status: 400 });
        if (new Date(q.expires_at) < new Date()) throw Object.assign(new Error('Your Instant Quote has expired — please re-upload the model'), { status: 400 });
        subtotal += q.final_price * qty;
        pricedItems.push({
          type: 'instant_quote', instant_quote_id: q.id,
          name: `Instant Quote — ${q.file_name || 'model'}`, quantity: qty, unit_price: q.final_price,
          customization_notes: i.customization_notes || null,
        });
      }
      await supabase.from('instant_quote_requests').update({ status: 'ordered' }).in('id', quoteIds);
    }

    const shipping_charge = subtotal >= 999 ? 0 : 99;

    /* Validate promo server-side (same rules as the paid checkout path) */
    let discount_amount = 0;
    let appliedPromoCode = null;
    if (promo_code) {
      const { data: promo } = await supabase
        .from('promo_codes').select('*').eq('code', String(promo_code).toUpperCase().trim()).single();
      if (promo && promo.is_active &&
          (!promo.expires_at || new Date(promo.expires_at) > new Date()) &&
          (!promo.max_uses   || promo.current_uses < promo.max_uses) &&
          (!promo.min_order_amount || subtotal >= promo.min_order_amount) &&
          (!promo.product_slug || items.some(i => i.slug === promo.product_slug))) {
        appliedPromoCode = promo.code;
        if (promo.discount_type === 'free_shipping')   discount_amount = shipping_charge;
        else if (promo.discount_type === 'percent') {
          discount_amount = Math.round(subtotal * promo.discount_value / 100);
          if (promo.max_discount_amount && discount_amount > promo.max_discount_amount)
            discount_amount = promo.max_discount_amount;
        } else if (promo.discount_type === 'fixed')    discount_amount = Math.min(promo.discount_value, subtotal);
      }
    }

    const total_amount = Math.max(0, subtotal + shipping_charge - discount_amount);

    const insert = {
      order_id:            order_id || null,
      invoice_number:      order_id || null,   // prevent TAINV trigger
      user_id,
      customer_name:       customer_name  || null,
      customer_phone:      customer_phone || null,
      customer_email:      customer_email || null,
      shipping_address:    shipping_address || {},
      items:               pricedItems,
      subtotal,
      shipping_charge,
      total_amount,
      payment_method:      'whatsapp',
      payment_status:      'pending',
      order_status:        'whatsapp_pending',
      status:              'pending',
      special_instructions: special_instructions || null,
    };
    if (appliedPromoCode) { insert.promo_code = appliedPromoCode; insert.discount_amount = discount_amount; }
    if (is_gift)         insert.is_gift         = true;
    if (gift_message)    insert.gift_message    = String(gift_message).slice(0, 150);

    const { data: order, error } = await supabase
      .from('orders')
      .insert(insert)
      .select().single();

    if (error) throw error;

    /* Best-effort confirmation emails for WhatsApp orders */
    try {
      const orderData = {
        order_id:        order.invoice_number || order.order_id || order.id,
        customer_name:   customer_name || shipping_address?.full_name || 'Customer',
        customer_email:  customer_email || null,
        customer_phone:  customer_phone || shipping_address?.mobile || shipping_address?.phone || '',
        total_amount:    order.total_amount,
        subtotal:        order.subtotal,
        shipping_charge: order.shipping_charge,
        discount_amount: order.discount_amount || 0,
        promo_code:      order.promo_code || null,
        payment_method:  'whatsapp',
        is_gift:         order.is_gift || false,
        gift_message:    order.gift_message || null,
        items:           pricedItems.map(it => ({
          name: it.name || 'Item', quantity: it.quantity, unit_price: it.unit_price,
        })),
        shipping_address: shipping_address || {},
      };
      const { sendOrderConfirmation, sendAdminOrderAlert } = await import('../services/emailService.js');
      if (orderData.customer_email) { try { await sendOrderConfirmation(orderData); } catch (e) { console.error('WA email error:', e.message); } }
      try { await sendAdminOrderAlert(orderData); } catch (e) { console.error('WA admin email error:', e.message); }
    } catch (e) { console.error('WA order email failed:', e.message); }

    res.status(201).json({ order });
  } catch (err) { next(err); }
}

export async function getOrdersByUser(req, res, next) {
  try {
    const SELECT = '*, order_items(*, products(name, images), instant_quote_requests(file_name, model_file_url, printer_id, material_id, infill_percent, estimated_print_time_hours, estimated_weight_g, price_breakdown))';
    const userId = req.user.id;
    const userEmail = req.user.email || '';

    // Primary: orders directly linked to this user_id
    const { data: byId, error: e1 } = await supabase
      .from('orders')
      .select(SELECT)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (e1) throw e1;

    // Fallback: find orphaned orders by email OR phone — catches pre-auth orders and admin entries
    const seen = new Set((byId || []).map(o => o.id));
    let extra = [];

    // Fallback: link orphaned orders by the user's VERIFIED auth email only.
    // SECURITY: phone-based matching was removed. profiles.phone is user-editable
    // (PUT /profile) with no real verification, so matching orders on it let any
    // user read AND claim another customer's orders simply by setting their own
    // profile phone to the victim's number (IDOR + PII disclosure). The auth email
    // (req.user.email) is not freely editable, so email matching is safe.
    if (userEmail) {
      const { data: rows } = await supabase.from('orders').select(SELECT)
        .eq('customer_email', userEmail).is('deleted_at', null).order('created_at', { ascending: false });
      (rows || []).forEach(o => { if (!seen.has(o.id)) { seen.add(o.id); extra.push(o); } });
    }

    // Back-fill user_id on recovered (email-matched) rows so future queries find them by id
    if (extra.length) {
      const orphanIds = extra.filter(o => !o.user_id).map(o => o.id);
      if (orphanIds.length) await supabase.from('orders').update({ user_id: userId }).in('id', orphanIds);
    }

    const allOrders = [...(byId || []), ...extra]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({ orders: allOrders });
  } catch (err) { next(err); }
}

export async function getOrderById(req, res, next) {
  try {
    const param = (req.params.id || '').trim();
    if (!param) return res.status(400).json({ error: 'Order ID required' });

    const SELECT = '*, order_items(*, products(name, slug, images), instant_quote_requests(file_name, model_file_url, printer_id, material_id, infill_percent, estimated_print_time_hours, estimated_weight_g, price_breakdown))';
    const userId = req.user.id;
    let data = null;

    // Try UUID match first (strict format check prevents PostgREST injection)
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (UUID_RE.test(param)) {
      const r = await supabase.from('orders').select(SELECT)
        .eq('id', param).eq('user_id', userId).maybeSingle();
      if (r.error) throw r.error;
      data = r.data;
    }

    // Fall back to TRK-style order_id (alphanumeric + hyphens only)
    if (!data && /^[A-Z0-9\-]+$/i.test(param)) {
      const r = await supabase.from('orders').select(SELECT)
        .eq('order_id', param).eq('user_id', userId).maybeSingle();
      if (r.error) throw r.error;
      data = r.data;
    }

    if (!data) return res.status(404).json({ error: 'Order not found' });
    res.json({ order: data });
  } catch (err) { next(err); }
}
