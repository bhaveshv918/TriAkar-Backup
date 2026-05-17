import supabase from '../db/supabaseClient.js';

export async function createOrder(req, res, next) {
  try {
    const { items, shipping_address } = req.body;
    const user_id = req.user.id;

    if (!items?.length || !shipping_address) {
      return res.status(400).json({ error: 'items and shipping_address are required' });
    }

    const productIds = items.map(i => i.product_id);
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('id, price, stock_qty, name')
      .in('id', productIds);

    if (productError) throw productError;

    let total_amount = 0;
    for (const item of items) {
      const product = products.find(p => p.id === item.product_id);
      if (!product) {
        return res.status(400).json({ error: `Product ${item.product_id} not found` });
      }
      if (product.stock_qty < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for "${product.name}"` });
      }
      total_amount += product.price * item.quantity;
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({ user_id, status: 'pending', total_amount, shipping_address })
      .select()
      .single();

    if (orderError) throw orderError;

    const orderItems = items.map(item => ({
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: products.find(p => p.id === item.product_id).price,
      customization_notes: item.customization_notes || null,
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
    if (itemsError) throw itemsError;

    res.status(201).json({ order });
  } catch (err) {
    next(err);
  }
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
  } catch (err) {
    next(err);
  }
}

export async function getOrderById(req, res, next) {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*, products(name, slug, images))')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ order: data });
  } catch (err) {
    next(err);
  }
}
