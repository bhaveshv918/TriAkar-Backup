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
      const p = products.find(x => x.id === item.product_id);
      if (!p) return res.status(400).json({ error: `Product ${item.product_id} not found` });
      if (p.stock_qty < item.quantity)
        return res.status(400).json({ error: `Insufficient stock for "${p.name}"` });
      total_amount += p.price * item.quantity;
    }

    const { data: order, error: oErr } = await supabase
      .from('orders')
      .insert({ user_id, status: 'pending', total_amount, shipping_address: shipping_address || {}, address_id: address_id || null })
      .select().single();
    if (oErr) throw oErr;

    const rows = items.map(item => ({
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
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
    const { order_id, items, shipping_address, subtotal, shipping_charge, total_amount,
            customer_name, customer_phone, customer_email, special_instructions,
            promo_code, discount_amount, is_gift, gift_message } = req.body;

    if (!items?.length) return res.status(400).json({ error: 'items are required' });
    if (!total_amount)  return res.status(400).json({ error: 'total_amount is required' });

    const insert = {
      order_id:            order_id || null,
      invoice_number:      order_id || null,   // prevent TAINV trigger
      user_id,
      customer_name:       customer_name  || null,
      customer_phone:      customer_phone || null,
      customer_email:      customer_email || null,
      shipping_address:    shipping_address || {},
      items:               items,
      subtotal:            subtotal || total_amount,
      shipping_charge:     shipping_charge || 0,
      total_amount:        Number(total_amount),
      payment_method:      'whatsapp',
      payment_status:      'pending',
      order_status:        'whatsapp_pending',
      status:              'pending',
      special_instructions: special_instructions || null,
    };
    if (promo_code)      insert.promo_code      = String(promo_code).toUpperCase().trim();
    if (discount_amount) insert.discount_amount = Number(discount_amount);
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
        items:           Array.isArray(items) ? items.map(it => ({
          name: it.name || 'Item', quantity: it.quantity, unit_price: it.price || it.unit_price || 0,
        })) : [],
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
    const param = req.params.id;
    // Support both UUID id and TRK-YYYYMMDD-XXXX order_id
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*, products(name, slug, images))')
      .or(`id.eq.${param},order_id.eq.${param}`)
      .eq('user_id', req.user.id)
      .maybeSingle();
    if (error || !data) return res.status(404).json({ error: 'Order not found' });
    res.json({ order: data });
  } catch (err) { next(err); }
}
