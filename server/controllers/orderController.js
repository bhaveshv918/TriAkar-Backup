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
    const slugs = [...new Set(items.map(i => i.slug).filter(Boolean))];
    if (!slugs.length) return res.status(400).json({ error: 'items must reference product slugs' });

    const { data: products, error: pErr } = await supabase
      .from('products').select('slug, name, price').in('slug', slugs).eq('is_active', true);
    if (pErr) throw pErr;

    let subtotal = 0;
    const pricedItems = items.map(i => {
      const qty = Number(i.quantity);
      if (!Number.isInteger(qty) || qty < 1) throw Object.assign(new Error(`Invalid quantity for "${i.slug}"`), { status: 400 });
      const p = products.find(x => x.slug === i.slug);
      if (!p) throw Object.assign(new Error(`Product "${i.slug}" not found`), { status: 400 });
      subtotal += p.price * qty;
      return { slug: i.slug, name: p.name, quantity: qty, unit_price: p.price,
               customization_notes: i.customization_notes || null };
    });

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
    const SELECT = '*, order_items(*, products(name, images))';
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

    // Fetch user's phone from profile for phone-based lookup
    const { data: profile } = await supabase.from('profiles').select('mobile, phone').eq('id', userId).maybeSingle();
    const userPhone = (profile?.mobile || profile?.phone || '').replace(/\D/g, '').slice(-10);

    // Query by email
    if (userEmail) {
      const { data: rows } = await supabase.from('orders').select(SELECT)
        .eq('customer_email', userEmail).is('deleted_at', null).order('created_at', { ascending: false });
      (rows || []).forEach(o => { if (!seen.has(o.id)) { seen.add(o.id); extra.push(o); } });
    }

    // Query by phone (last 10 digits match)
    if (userPhone) {
      const { data: rows } = await supabase.from('orders').select(SELECT)
        .ilike('customer_phone', '%' + userPhone).is('deleted_at', null).order('created_at', { ascending: false });
      (rows || []).forEach(o => { if (!seen.has(o.id)) { seen.add(o.id); extra.push(o); } });
    }

    // Back-fill user_id on recovered rows so future queries find them by id
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

    const SELECT = '*, order_items(*, products(name, slug, images))';
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
