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

/* ── Order status pipeline ──────────────────────────────────────────────
   One vocabulary, shared by this controller, the admin panel and both customer-facing
   pages. These are the studio's real stages: a website order can now say Packed, which
   is where the SLA clock stops, instead of hiding behind a vague "processing".

   On-hold is not in this list on purpose. It is the hold_at flag alongside a status
   (see setOrderHold), so an order comes back off hold to the stage it was already at. */
export const ORDER_STATUSES = [
  'whatsapp_pending', 'pending', 'quote_pending_confirmation', 'confirmed', 'printing', 'quality_check',
  'packed', 'dispatched', 'in_transit', 'delivered',
  'cancelled', 'returned', 'refunded',
];

/* Anything still sending the pre-20260827 wording keeps working, and is stored as the
   new value so the two never coexist in the table. */
const LEGACY_STATUS_MAP = { placed: 'confirmed', processing: 'printing', shipped: 'dispatched' };
export function normalizeOrderStatus(s) {
  return LEGACY_STATUS_MAP[s] || s;
}

/* Which email template, if any, speaks for each stage. Stages that map to nothing simply
   do not email: inventing a template for "returned" silently would be worse than silence. */
const STATUS_EMAIL_TYPE = {
  // quote_pending_confirmation deliberately sends nothing: that stage is a conversation
  // the studio has with the customer, and an automated "confirmed" email in the middle of
  // it would say the opposite of what is true.
  confirmed: 'confirmation', printing: 'processing', quality_check: 'processing',
  packed: 'processing', dispatched: 'dispatched', in_transit: 'dispatched',
  delivered: 'delivered',
};

/* Records one transition. Never throws into the caller: a history row failing to write
   must not fail the status change the operator just made, it is a record of the fact,
   not the fact itself. */
async function logOrderEvent({ orderId, from, to, note, by, customerVisible = true, notifiedAt = null }) {
  try {
    await supabase.from('order_status_events').insert({
      order_id: orderId, from_status: from || null, to_status: to,
      note: note || null, changed_by: by || 'system',
      customer_visible: customerVisible, notified_at: notifiedAt,
    });
  } catch (err) {
    console.error('[order-events] could not record transition', orderId, to, err?.message);
  }
}

/* Reads the per-stage toggles saved by the admin panel. A missing/invalid setting falls
   back to the three stages a customer actually wants to hear about, rather than to
   "email on everything", which is the annoying failure direction. */
const DEFAULT_NOTIFY = { confirmed: true, dispatched: true, delivered: true };
async function shouldNotify(status) {
  try {
    const { data } = await supabase
      .from('site_settings').select('value').eq('key', 'order_status_notify').single();
    const cfg = data?.value ? JSON.parse(data.value) : null;
    if (cfg && typeof cfg === 'object') return cfg[status] === true;
  } catch (_) { /* fall through to the default */ }
  return DEFAULT_NOTIFY[status] === true;
}

/* Shapes a raw orders row into what emailService templates expect. Extracted so the
   manual "resend" button and the automatic status email cannot drift apart. */
function buildOrderEmailData(ord) {
  const emailItems = ord.order_items?.length
    ? ord.order_items.map(it => ({ name: it.products?.name || 'Item', quantity: it.quantity, unit_price: it.unit_price }))
    : (ord.items || []).map(it => ({ name: it.name || 'Item', quantity: it.quantity, unit_price: it.price || it.unit_price || 0 }));

  return {
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
}

/* Sends the status email if this stage is configured to send one. Returns the timestamp
   it went out, or null. Swallows its own errors on purpose, for the same reason as
   logOrderEvent: the status change already happened and is correct either way. */
/* Stages whose whole message is the courier details. "Your order is on its way" with no
   courier and no tracking number tells the customer nothing they can act on, and it is the
   one email they will go looking for. */
const NEEDS_TRACKING = ['dispatched', 'in_transit'];

async function notifyOrderStatus(orderId, status) {
  try {
    const type = STATUS_EMAIL_TYPE[status];
    if (!type) return null;
    if (!await shouldNotify(status)) return null;

    const { data: ord } = await supabase
      .from('orders').select('*, order_items(quantity, unit_price, products(name))')
      .eq('id', orderId).single();
    if (!ord?.customer_email) return null;

    // Status is very often set to Dispatched before the AWB has been pasted in. Rather than
    // send a tracking email with nothing to track, it is held here and sent the moment the
    // tracking number is saved (see updateOrderFields). The status change itself still
    // happens immediately, so nothing about the order is waiting on this.
    if (NEEDS_TRACKING.includes(status) && !ord.tracking_number) return 'pending_tracking';

    const mod = await import('../services/emailService.js');
    const send = { confirmation: mod.sendOrderConfirmation, processing: mod.sendOrderProcessingUpdate,
                   dispatched: mod.sendOrderDispatchedUpdate, delivered: mod.sendOrderDeliveredUpdate }[type];
    if (!send) return null;

    await send(buildOrderEmailData(ord));
    return new Date().toISOString();
  } catch (err) {
    console.error('[order-status] notify failed', orderId, status, err?.message);
    return null;
  }
}

/* ── GET /api/admin/orders/:id/events — the order's history ── */
export async function getOrderEvents(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('order_status_events').select('*')
      .eq('order_id', req.params.id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json({ events: data || [] });
  } catch (err) { next(err); }
}

/* ── PUT /api/admin/orders/:id/hold — park an order, or bring it back ──
   Hold is deliberately NOT a status: an order waiting on the customer has not
   moved anywhere in its lifecycle, and it has to return to exactly the status it
   already had (for an Instant Quote, quote_pending_confirmation, which this
   endpoint's sibling updateOrderStatus does not even accept as a target). So it
   is a flag alongside the status, never a replacement for it, and nothing about
   payment, stock or production is touched here. Requires the
   20260826_orders_hold.sql migration. */
export async function setOrderHold(req, res, next) {
  try {
    const { id } = req.params;
    const { hold, reason } = req.body;
    if (typeof hold !== 'boolean') return res.status(400).json({ error: '`hold` must be true or false' });

    const patch = hold
      ? { hold_at: new Date().toISOString(), hold_reason: (reason ? String(reason).slice(0, 300) : null) }
      // hold_released_at is what keeps the automatic "unpaid for 7 days" rule from
      // putting a deliberately released order straight back on hold.
      : { hold_at: null, hold_released_at: new Date().toISOString(), hold_reason: null };

    const { data, error } = await supabase
      .from('orders').update(patch).eq('id', id).select().single();
    if (error) throw error;

    logActivity(req.user?.email, hold ? 'order.hold' : 'order.hold_released', 'order', id, reason || '');
    res.json({ order: data });
  } catch (err) {
    next(err);
  }
}

export async function updateOrderStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { note, silent } = req.body;
    const status = normalizeOrderStatus(req.body.status);

    if (!ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    // Fetch first: whether stock was ever decremented (payment_received) and whether it
    // was already restored, both decide if this transition should restock. The current
    // status comes along too, so the history records what it moved from.
    const { data: existing } = await supabase
      .from('orders')
      .select('payment_received, stock_restored, status, order_status, hold_at')
      .eq('id', id).single();
    const previous = existing?.order_status || existing?.status || null;

    // Nothing to do, and re-firing the customer email for a status it is already on is
    // exactly the kind of duplicate nobody can un-send.
    if (previous === status) {
      return res.json({ order: existing, unchanged: true });
    }

    const { data, error } = await supabase
      .from('orders')
      .update({ status, order_status: status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    logActivity(req.user?.email, 'order.status', 'order', id, (previous || 'new') + ' → ' + status);

    // Moving an order on means it is no longer parked, so hold is cleared rather than
    // left to contradict the stage the customer is now being shown.
    if (existing?.hold_at && !STOCK_RESTORING_STATUSES.includes(status)) {
      await supabase.from('orders')
        .update({ hold_at: null, hold_released_at: new Date().toISOString(), hold_reason: null })
        .eq('id', id);
      logActivity(req.user?.email, 'order.hold_released', 'order', id, 'auto, status moved to ' + status);
    }

    // `silent` is the escape hatch for a correction: fix a mis-click without emailing the
    // customer about a stage they were never really at, and keep it out of their timeline.
    const notifyResult = silent ? null : await notifyOrderStatus(id, status);
    const heldForTracking = notifyResult === 'pending_tracking';
    const notifiedAt = heldForTracking ? null : notifyResult;
    await logOrderEvent({
      orderId: id, from: previous, to: status,
      note: note || (heldForTracking ? 'Customer email held until a tracking number is added' : null),
      by: req.user?.email || 'admin', customerVisible: !silent, notifiedAt,
    });

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

    // notified tells the panel whether to say "customer emailed", so the operator is never
    // guessing whether the customer already knows.
    // held_for_tracking is what lets the panel say "add the AWB and the customer gets told"
    // instead of silently looking like the email simply did not go.
    res.json({ order: data, notified: Boolean(notifiedAt), held_for_tracking: heldForTracking, previous_status: previous });
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
    const { tracking_number, tracking_vendor, admin_notes, eta_date } = req.body;

    const updates = { updated_at: new Date().toISOString() };
    if (tracking_number !== undefined) updates.tracking_number = tracking_number || null;
    if (tracking_vendor !== undefined) updates.tracking_vendor = tracking_vendor || null;
    if (admin_notes     !== undefined) updates.admin_notes     = admin_notes || null;
    // The date the customer was promised, shown on track-order.html. Blank clears it
    // rather than storing '', which would render as an invalid date on the tracking page.
    if (eta_date        !== undefined) updates.eta_date        = eta_date || null;
    if (Object.keys(updates).length === 1) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Was the order already dispatched with its email held back for want of an AWB?
    const { data: before } = await supabase
      .from('orders').select('tracking_number, status, order_status').eq('id', id).single();

    const { data, error } = await supabase
      .from('orders').update(updates).eq('id', id).select().single();
    if (error) throw error;

    /* The other half of the held dispatch email. Status is very often set to Dispatched
       before the AWB is pasted in, so notifyOrderStatus holds that email back; adding the
       tracking number is what completes it, and the customer gets one email that actually
       has a courier and a number in it. Only fires on the transition from no tracking to
       tracking, so correcting a typo in an AWB does not email them a second time. */
    let notified = false;
    const nowStatus = normalizeOrderStatus(data.order_status || data.status);
    if (!before?.tracking_number && data.tracking_number && NEEDS_TRACKING.includes(nowStatus)) {
      const sentAt = await notifyOrderStatus(id, nowStatus);
      notified = Boolean(sentAt) && sentAt !== 'pending_tracking';
      if (notified) {
        await logOrderEvent({
          orderId: id, from: nowStatus, to: nowStatus,
          note: 'Tracking added, dispatch email sent to the customer',
          by: req.user?.email || 'admin', customerVisible: false, notifiedAt: sentAt,
        });
        logActivity(req.user?.email, 'order.tracking_email', 'order', id, data.tracking_number);
      }
    }

    res.json({ order: data, notified });
  } catch (err) { next(err); }
}
