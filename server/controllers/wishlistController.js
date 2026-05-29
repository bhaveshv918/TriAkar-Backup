import supabase from '../db/supabaseClient.js';

/* ── GET /api/wishlist ─────────────────────────────────────────
   Return the authenticated user's saved items (newest first). */
export async function getWishlist(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('wishlists')
      .select('product_slug, product_name, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ items: data || [] });
  } catch (err) {
    next(err);
  }
}

/* ── POST /api/wishlist ────────────────────────────────────────
   Add a product to the wishlist. Idempotent: a duplicate
   (user_id, product_slug) is ignored rather than erroring. */
export async function addWishlist(req, res, next) {
  try {
    const { product_slug, product_name } = req.body;
    if (!product_slug || typeof product_slug !== 'string') {
      return res.status(400).json({ error: 'product_slug is required' });
    }

    const { error } = await supabase
      .from('wishlists')
      .upsert(
        {
          user_id:      req.user.id,
          product_slug: product_slug.trim(),
          product_name: typeof product_name === 'string' ? product_name.trim() : null,
        },
        { onConflict: 'user_id,product_slug', ignoreDuplicates: true },
      );

    if (error) throw error;
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
}

/* ── DELETE /api/wishlist/:slug ────────────────────────────────
   Remove a product from the wishlist. */
export async function removeWishlist(req, res, next) {
  try {
    const slug = req.params.slug;
    if (!slug) return res.status(400).json({ error: 'slug is required' });

    const { error } = await supabase
      .from('wishlists')
      .delete()
      .eq('user_id', req.user.id)
      .eq('product_slug', slug);

    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
