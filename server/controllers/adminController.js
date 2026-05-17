import supabase from '../db/supabaseClient.js';

// ── PRODUCTS ──────────────────────────────────────────────────────────────

export async function getAdminProducts(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ products: data });
  } catch (err) {
    next(err);
  }
}

export async function createProduct(req, res, next) {
  try {
    const { name, slug, description, price, category, stock_qty, images, is_customizable, is_active } = req.body;

    if (!name || !slug || !price || !category) {
      return res.status(400).json({ error: 'name, slug, price, and category are required' });
    }

    const { data, error } = await supabase
      .from('products')
      .insert({
        name, slug, description: description || null,
        price: Number(price),
        category,
        stock_qty: Number(stock_qty) || 0,
        images: images ? [images] : [],
        is_customizable: Boolean(is_customizable),
        is_active: is_active !== false,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ product: data });
  } catch (err) {
    next(err);
  }
}

export async function updateProduct(req, res, next) {
  try {
    const { id } = req.params;
    const { name, slug, description, price, category, stock_qty, images, is_customizable, is_active } = req.body;

    const updates = {};
    if (name         !== undefined) updates.name            = name;
    if (slug         !== undefined) updates.slug            = slug;
    if (description  !== undefined) updates.description     = description;
    if (price        !== undefined) updates.price           = Number(price);
    if (category     !== undefined) updates.category        = category;
    if (stock_qty    !== undefined) updates.stock_qty       = Number(stock_qty);
    if (images       !== undefined) updates.images          = images ? [images] : [];
    if (is_customizable !== undefined) updates.is_customizable = Boolean(is_customizable);
    if (is_active    !== undefined) updates.is_active       = Boolean(is_active);

    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ product: data });
  } catch (err) {
    next(err);
  }
}

export async function deleteProduct(req, res, next) {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ── ORDERS ────────────────────────────────────────────────────────────────

export async function getAdminOrders(req, res, next) {
  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*, order_items(id, quantity, unit_price, products(name))')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Batch-fetch profiles — no direct FK from orders→profiles in PostgREST,
    // so we resolve manually with a second query.
    const userIds = [...new Set(orders.map(o => o.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', userIds);

    const profileMap = {};
    (profiles || []).forEach(p => { profileMap[p.id] = p; });

    res.json({
      orders: orders.map(o => ({ ...o, profiles: profileMap[o.user_id] || null })),
    });
  } catch (err) {
    next(err);
  }
}

export async function updateOrderStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const valid = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!valid.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const { data, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ order: data });
  } catch (err) {
    next(err);
  }
}
