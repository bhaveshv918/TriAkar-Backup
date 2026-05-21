import supabase from '../db/supabaseClient.js';

export async function getCart(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('carts')
      .select('items')
      .eq('user_id', req.user.id)
      .single();

    // PGRST116 = no rows found — not an error, just an empty cart
    if (error && error.code !== 'PGRST116') throw error;
    res.json({ items: data?.items || [] });
  } catch (err) {
    next(err);
  }
}

export async function saveCart(req, res, next) {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' });

    // FIX #14: specify onConflict so upsert updates the existing row instead of inserting a duplicate
    const { error } = await supabase
      .from('carts')
      .upsert({ user_id: req.user.id, items, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
