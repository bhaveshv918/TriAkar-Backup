import supabase from '../db/supabaseClient.js';

export async function createOrder(req, res, next) {
  try {
    const { items, shipping_address, address_id } = req.body;
    const user_id = req.user.id;

    if (!items?.length) return res.status(400).json({ error: 'items are required' });

    const productIds = items.map(i => i.product_id);
    const { data: products, error: pErr } = await supabase
      .from('products').select('id, price, stock_qty, name').in('id', productIds);
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

export async function getOrdersByUser(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*, products(name, images))')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ orders: data });
  } catch (err) { next(err); }
}

export async function getOrderById(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*, products(name, slug, images))')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();
    if (error || !data) return res.status(404).json({ error: 'Order not found' });
    res.json({ order: data });
  } catch (err) { next(err); }
}
