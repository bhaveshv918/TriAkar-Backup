import supabase from '../db/supabaseClient.js';

/* ── GET /api/categories — public, returns active ─────── */
export async function getCategories(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order');
    if (error) throw error;
    res.json({ categories: data });
  } catch (err) { next(err); }
}

/* ── POST /api/categories — admin only ──────────────────── */
export async function createCategory(req, res, next) {
  try {
    const { name, slug, description, display_order, is_active } = req.body;
    if (!name || !slug) return res.status(400).json({ error: 'name and slug are required' });
    const { data, error } = await supabase
      .from('categories')
      .insert({ name, slug, description: description || null, display_order: display_order || 0, is_active: is_active !== false })
      .select().single();
    if (error) throw error;
    res.status(201).json({ category: data });
  } catch (err) { next(err); }
}

/* ── PUT /api/categories/:id — admin only ───────────────── */
export async function updateCategory(req, res, next) {
  try {
    const { id } = req.params;
    const { name, slug, description, display_order, is_active } = req.body;
    const updates = {};
    if (name          !== undefined) updates.name          = name;
    if (slug          !== undefined) updates.slug          = slug;
    if (description   !== undefined) updates.description   = description;
    if (display_order !== undefined) updates.display_order = Number(display_order);
    if (is_active     !== undefined) updates.is_active     = Boolean(is_active);
    const { data, error } = await supabase
      .from('categories').update(updates).eq('id', id).select().single();
    if (error) throw error;
    res.json({ category: data });
  } catch (err) { next(err); }
}

/* ── DELETE /api/categories/:id — admin only ────────────── */
export async function deleteCategory(req, res, next) {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) { next(err); }
}
