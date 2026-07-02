import supabase from '../db/supabaseClient.js';

/* ── POST /api/promo/validate ─────────────────────────────── */
export async function validatePromo(req, res, next) {
  try {
    const { code, subtotal, items } = req.body;
    if (!code) return res.status(400).json({ valid: false, error: 'No code provided' });

    const { data: promo, error } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('code', code.toUpperCase().trim())
      .single();

    if (error || !promo)
      return res.json({ valid: false, error: 'Invalid promo code' });
    if (!promo.is_active)
      return res.json({ valid: false, error: 'This promo code is inactive' });
    if (promo.expires_at && new Date(promo.expires_at) < new Date())
      return res.json({ valid: false, error: 'This promo code has expired' });
    if (promo.max_uses && promo.current_uses >= promo.max_uses)
      return res.json({ valid: false, error: 'This promo code has reached its usage limit' });
    if (promo.min_order_amount && Number(subtotal) < Number(promo.min_order_amount))
      return res.json({ valid: false, error: `Minimum order of ₹${promo.min_order_amount} required for this code` });

    // Product-specific check
    if (promo.product_slug) {
      const has = (items || []).some(i => i.slug === promo.product_slug);
      if (!has)
        return res.json({ valid: false, error: 'This code applies to a specific product not in your cart' });
    }

    // Calculate discount — shipping must match paymentController/checkout (₹99 below ₹999)
    const sub = Number(subtotal) || 0;
    const shipping = sub >= 999 ? 0 : 99;
    let discount_amount = 0;

    if (promo.discount_type === 'free_shipping') {
      discount_amount = shipping;
    } else if (promo.discount_type === 'percent') {
      discount_amount = Math.round(sub * Number(promo.discount_value) / 100);
    } else if (promo.discount_type === 'fixed') {
      discount_amount = Math.min(Number(promo.discount_value), sub);
    }

    res.json({
      valid: true,
      promo_id: promo.id,
      code: promo.code,
      description: promo.description,
      discount_type: promo.discount_type,
      discount_value: promo.discount_value,
      discount_amount,
    });
  } catch (err) { next(err); }
}

/* ── GET /api/promo (admin) ───────────────────────────────── */
export async function getPromoCodes(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ promo_codes: data || [] });
  } catch (err) { next(err); }
}

/* ── POST /api/promo (admin) ──────────────────────────────── */
export async function createPromoCode(req, res, next) {
  try {
    const {
      code, description, discount_type, discount_value,
      min_order_amount, max_uses, product_slug, is_active, expires_at,
    } = req.body;
    if (!code || !discount_type)
      return res.status(400).json({ error: 'code and discount_type are required' });

    const { data, error } = await supabase
      .from('promo_codes')
      .insert({
        code:              code.toUpperCase().trim(),
        description:       description || null,
        discount_type,
        discount_value:    discount_value   || 0,
        min_order_amount:  min_order_amount || 0,
        max_uses:          max_uses         || null,
        product_slug:      product_slug     || null,
        is_active:         is_active !== false,
        expires_at:        expires_at       || null,
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ promo_code: data });
  } catch (err) { next(err); }
}

/* ── PUT /api/promo/:id (admin) ───────────────────────────── */
export async function updatePromoCode(req, res, next) {
  try {
    const { id } = req.params;
    const {
      code, description, discount_type, discount_value,
      min_order_amount, max_uses, product_slug, is_active, expires_at,
    } = req.body;

    const update = {};
    if (code          !== undefined) update.code             = code.toUpperCase().trim();
    if (description   !== undefined) update.description      = description || null;
    if (discount_type !== undefined) update.discount_type    = discount_type;
    if (discount_value!== undefined) update.discount_value   = discount_value;
    if (min_order_amount !== undefined) update.min_order_amount = min_order_amount;
    if (max_uses      !== undefined) update.max_uses         = max_uses || null;
    if (product_slug  !== undefined) update.product_slug     = product_slug || null;
    if (is_active     !== undefined) update.is_active        = is_active;
    if (expires_at    !== undefined) update.expires_at       = expires_at || null;

    const { data, error } = await supabase
      .from('promo_codes')
      .update(update)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    res.json({ promo_code: data });
  } catch (err) { next(err); }
}

/* ── DELETE /api/promo/:id (admin) ────────────────────────── */
export async function deletePromoCode(req, res, next) {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('promo_codes').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { next(err); }
}
