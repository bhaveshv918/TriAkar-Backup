import supabase from '../db/supabaseClient.js';
import { logActivity } from '../services/activityLog.js';

// ── ACTIVITY LOG (Module 7) ────────────────────────────────────────────────
export async function getActivity(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('admin_activity').select('*')
      .order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    res.json({ activity: data || [] });
  } catch (err) { next(err); }
}

// ── PRODUCTS ──────────────────────────────────────────────────────────────

export async function getAdminProducts(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .is('deleted_at', null)            // hide soft-deleted (in Recycle Bin)
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
        images: Array.isArray(images) ? images : (images ? [images] : []), // FIX #10
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

// Soft-delete → moves the product to the Recycle Bin (recoverable for 30 days).
// NOTE: this is now distinct from hiding a product. `is_active` stays the
// show/hide visibility toggle; deleting sets deleted_at so it can be restored.
export async function deleteProduct(req, res, next) {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('products')
      .update({ deleted_at: new Date().toISOString(), deleted_by: req.user?.email || 'admin' })
      .eq('id', id);

    if (error) throw error;
    logActivity(req.user?.email, 'product.delete', 'product', id, 'moved to Recycle Bin');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// Bulk operations on products (Module 8). action: activate | deactivate |
// delete (→ bin) | price_set (value=₹) | price_pct (value=percent, +/-).
export async function bulkUpdateProducts(req, res, next) {
  try {
    const { ids, action, value } = req.body || {};
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids are required' });
    if (ids.length > 500) return res.status(400).json({ error: 'Too many items (max 500)' });

    if (action === 'activate' || action === 'deactivate') {
      const { error } = await supabase.from('products')
        .update({ is_active: action === 'activate' }).in('id', ids);
      if (error) throw error;

    } else if (action === 'delete') {
      const { error } = await supabase.from('products')
        .update({ deleted_at: new Date().toISOString(), deleted_by: req.user?.email || 'admin' })
        .in('id', ids);
      if (error) throw error;

    } else if (action === 'price_set') {
      const price = Number(value);
      if (!(price >= 0)) return res.status(400).json({ error: 'Invalid price' });
      const { error } = await supabase.from('products').update({ price }).in('id', ids);
      if (error) throw error;

    } else if (action === 'price_pct') {
      const pct = Number(value);
      if (!pct) return res.status(400).json({ error: 'Invalid percent' });
      // Percentage is per-row, so fetch then update each.
      const { data: rows, error: e1 } = await supabase.from('products').select('id, price').in('id', ids);
      if (e1) throw e1;
      for (const r of (rows || [])) {
        const np = Math.max(0, Math.round(Number(r.price) * (1 + pct / 100) * 100) / 100);
        const { error } = await supabase.from('products').update({ price: np }).eq('id', r.id);
        if (error) throw error;
      }

    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    logActivity(req.user?.email, 'product.bulk', 'product', null,
      action + ' ×' + ids.length + (value != null && value !== '' ? ' (' + value + ')' : ''));
    res.json({ ok: true, count: ids.length });
  } catch (err) { next(err); }
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
    // FIX #22: filter out nulls (WhatsApp/guest orders have no user_id)
    const userIds = [...new Set(orders.map(o => o.user_id).filter(Boolean))];
    const { data: profiles } = userIds.length
      ? await supabase.from('profiles').select('id, email, full_name').in('id', userIds)
      : { data: [] };

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

    const valid = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded'];
    if (!valid.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const { data, error } = await supabase
      .from('orders')
      .update({ status, order_status: status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    logActivity(req.user?.email, 'order.status', 'order', id, '→ ' + status);
    res.json({ order: data });
  } catch (err) {
    next(err);
  }
}

/* ── POST /api/admin/orders/:id/send-email — manual email trigger ── */
export async function sendOrderEmail(req, res, next) {
  try {
    const { id } = req.params;
    const { type } = req.body; // 'confirmation' | 'processing' | 'dispatched' | 'delivered'
    const VALID = ['confirmation', 'processing', 'dispatched', 'delivered'];
    if (!VALID.includes(type)) return res.status(400).json({ error: 'Invalid email type' });

    const { data: ord, error } = await supabase
      .from('orders')
      .select('*, order_items(quantity, unit_price, products(name))')
      .eq('id', id)
      .single();
    if (error || !ord) return res.status(404).json({ error: 'Order not found' });
    if (!ord.customer_email) return res.status(400).json({ error: 'No customer email on this order' });

    const emailItems = ord.order_items?.length
      ? ord.order_items.map(it => ({ name: it.products?.name || 'Item', quantity: it.quantity, unit_price: it.unit_price }))
      : (ord.items || []).map(it => ({ name: it.name || 'Item', quantity: it.quantity, unit_price: it.price || it.unit_price || 0 }));

    const orderData = {
      order_id:        ord.invoice_number || ord.order_id || ord.id,
      customer_name:   ord.customer_name  || ord.shipping_address?.full_name || 'Customer',
      customer_email:  ord.customer_email,
      customer_phone:  ord.customer_phone || ord.shipping_address?.mobile || ord.shipping_address?.phone || '',
      total_amount:    ord.total_amount,
      subtotal:        ord.subtotal,
      shipping_charge: ord.shipping_charge,
      discount_amount: ord.discount_amount || 0,
      promo_code:      ord.promo_code     || null,
      payment_method:  ord.payment_method || 'online',
      is_gift:         ord.is_gift        || false,
      gift_message:    ord.gift_message   || null,
      tracking_number: ord.tracking_number || null,
      tracking_vendor: ord.tracking_vendor || null,
      items:           emailItems,
      shipping_address: ord.shipping_address || {},
    };

    const {
      sendOrderConfirmation,
      sendOrderProcessingUpdate,
      sendOrderDispatchedUpdate,
      sendOrderDeliveredUpdate,
    } = await import('../services/emailService.js');

    if (type === 'confirmation') await sendOrderConfirmation(orderData);
    if (type === 'processing')   await sendOrderProcessingUpdate(orderData);
    if (type === 'dispatched')   await sendOrderDispatchedUpdate(orderData);
    if (type === 'delivered')    await sendOrderDeliveredUpdate(orderData);

    res.json({ ok: true, sent_to: ord.customer_email, type });
  } catch (err) { next(err); }
}

/* ── PUT /api/admin/orders/:id/payment — update payment status ── */
export async function updateOrderPayment(req, res, next) {
  try {
    const { id } = req.params;
    const { payment_received, advance_amount, advance_received, payment_notes } = req.body;

    const updates = {};
    if (payment_received  !== undefined) updates.payment_received  = Boolean(payment_received);
    if (advance_amount    !== undefined) updates.advance_amount    = Number(advance_amount) || 0;
    if (advance_received  !== undefined) updates.advance_received  = Boolean(advance_received);
    if (payment_notes     !== undefined) updates.payment_notes     = payment_notes || null;

    const { data, error } = await supabase
      .from('orders').update(updates).eq('id', id).select().single();
    if (error) throw error;
    res.json({ order: data });
  } catch (err) { next(err); }
}
