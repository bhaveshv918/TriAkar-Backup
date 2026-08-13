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

// Every column the admin product editor may write. Anything outside this list is
// ignored; anything inside it that the DB doesn't have yet is stripped on the fly
// by saveProductRow's retry loop (resilient to pending migrations / schema drift).
const PRODUCT_COLS = [
  'name', 'slug', 'price', 'category', 'compare_at_price', 'material', 'sku', 'designer',
  'stock_status', 'stock_qty', 'discount_type', 'discount_value', 'badge', 'urgency_type',
  'urgency_text', 'is_bestseller', 'is_active', 'homepage_order', 'is_customizable',
  'description', 'short_description', 'long_description', 'bullet_points',
  'description_display_mode', 'key_features', 'customization_options', 'dimensions',
  'target_audience', 'use_case', 'tags', 'occasions', 'size_class', 'est_grams',
  'est_print_hours', 'source_url', 'license', 'commercial_ok', 'notes', 'images',
  'square_crop', 'variants', 'product_options', 'specifications', 'min_order_qty',
  'qty_step', 'key_features_label', 'customization_fields', 'product_dropdowns', 'colors',
  // Product Studio (dynamic fields + prompt engine)
  'primary_color', 'dim_length', 'dim_width', 'dim_height', 'dim_unit', 'custom_attributes',
];

function buildProductPayload(body) {
  const out = {};
  for (const k of PRODUCT_COLS) {
    if (body[k] !== undefined) out[k] = body[k];
  }
  // Normalise images to a flat string array (the old updateProduct double-wrapped arrays).
  if (out.images !== undefined) {
    out.images = Array.isArray(out.images) ? out.images : (out.images ? [out.images] : []);
  }
  // tags is a text[] column — the admin form sends a comma-separated string.
  if (out.tags !== undefined) {
    out.tags = Array.isArray(out.tags)
      ? out.tags
      : (out.tags ? out.tags.split(',').map(t => t.trim()).filter(Boolean) : []);
  }
  if (out.price !== undefined) out.price = Number(out.price);
  return out;
}

// Insert/update a product row, stripping any column Postgres reports as non-existent
// and retrying — so a not-yet-migrated column never blocks an otherwise valid save.
async function saveProductRow(payload, id) {
  const run = (data) => id
    ? supabase.from('products').update(data).eq('id', id).select().single()
    : supabase.from('products').insert(data).select().single();

  let data = { ...payload };
  for (let attempt = 0; attempt < 15; attempt++) {
    const r = await run(data);
    if (!r.error) return r.data;
    const m = (r.error.message || '').match(/column "([^"]+)" of relation/);
    if (m && data[m[1]] !== undefined) { delete data[m[1]]; continue; }   // unknown column → drop & retry
    throw r.error;
  }
  throw new Error('product save failed: too many unknown columns');
}

export async function createProduct(req, res, next) {
  try {
    const b = req.body || {};
    if (!b.name || !b.slug || !b.price || !b.category) {
      return res.status(400).json({ error: 'name, slug, price, and category are required' });
    }
    const payload = buildProductPayload(b);
    if (payload.is_active === undefined) payload.is_active = true;
    const product = await saveProductRow(payload, null);
    logActivity(req.user?.email, 'product.create', 'product', product.id, b.name);
    res.status(201).json({ product });
  } catch (err) {
    next(err);
  }
}

export async function updateProduct(req, res, next) {
  try {
    const { id } = req.params;
    const payload = buildProductPayload(req.body || {});
    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    const product = await saveProductRow(payload, id);
    logActivity(req.user?.email, 'product.update', 'product', id, product?.name || '');
    res.json({ product });
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

const STOCK_RESTORING_STATUSES = ['cancelled', 'returned', 'refunded'];

export async function updateOrderStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const valid = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded'];
    if (!valid.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    // Fetch first: whether stock was ever decremented (payment_received) and whether it
    // was already restored, both decide if this transition should restock.
    const { data: existing } = await supabase
      .from('orders').select('payment_received, stock_restored').eq('id', id).single();

    const { data, error } = await supabase
      .from('orders')
      .update({ status, order_status: status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    logActivity(req.user?.email, 'order.status', 'order', id, '→ ' + status);

    // Stock is only ever decremented once, in paymentController.verifyPayment, after
    // payment is confirmed. Restoring it here on cancel/return/refund closes the gap
    // where a returned order permanently lost that unit from sellable stock. Guarded by
    // payment_received (an unpaid order was never decremented, restoring it would add
    // phantom stock) and stock_restored (so flipping between these statuses more than
    // once, e.g. returned -> refunded, doesn't restore the same units twice).
    if (STOCK_RESTORING_STATUSES.includes(status) && existing?.payment_received && !existing?.stock_restored) {
      const { data: items } = await supabase
        .from('order_items').select('product_id, quantity').eq('order_id', id);
      for (const item of items ?? []) {
        await supabase.rpc('restock_product', { p_product_id: item.product_id, p_qty: item.quantity });
      }
      await supabase.from('orders').update({ stock_restored: true }).eq('id', id);
      logActivity(req.user?.email, 'order.stock_restored', 'order', id, `${(items ?? []).length} line item(s) restocked on → ${status}`);
    }

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

/* ── PUT /api/admin/orders/:id — tracking + admin notes ── */
export async function updateOrderFields(req, res, next) {
  try {
    const { id } = req.params;
    const { tracking_number, tracking_vendor, admin_notes } = req.body;

    const updates = { updated_at: new Date().toISOString() };
    if (tracking_number !== undefined) updates.tracking_number = tracking_number || null;
    if (tracking_vendor !== undefined) updates.tracking_vendor = tracking_vendor || null;
    if (admin_notes     !== undefined) updates.admin_notes     = admin_notes || null;
    if (Object.keys(updates).length === 1) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const { data, error } = await supabase
      .from('orders').update(updates).eq('id', id).select().single();
    if (error) throw error;
    res.json({ order: data });
  } catch (err) { next(err); }
}
