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
            customer_name, customer_phone, customer_email, special_instructions } = req.body;

    if (!items?.length) return res.status(400).json({ error: 'items are required' });
    if (!total_amount)  return res.status(400).json({ error: 'total_amount is required' });

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
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
      })
      .select().single();

    if (error) throw error;
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

    // Fallback: orders linked by customer_email but missing user_id
    // Catches orders placed before user_id was properly wired, or via admin entry
    let byEmail = [];
    if (userEmail) {
      const { data: emailRows } = await supabase
        .from('orders')
        .select(SELECT)
        .eq('customer_email', userEmail)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      // Only keep rows not already covered by the user_id query
      const seen = new Set((byId || []).map(o => o.id));
      byEmail = (emailRows || []).filter(o => !seen.has(o.id));

      // Back-fill user_id on these orphaned rows so future queries find them by id
      if (byEmail.length) {
        const ids = byEmail.map(o => o.id);
        await supabase.from('orders').update({ user_id: userId }).in('id', ids).is('user_id', null);
      }
    }

    const allOrders = [...(byId || []), ...byEmail]
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
