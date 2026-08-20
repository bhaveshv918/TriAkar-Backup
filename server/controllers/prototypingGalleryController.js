import supabase from '../db/supabaseClient.js';

/* ─────────────────────────────────────────────────────────────────────────
   PUBLIC — GET /api/prototyping-gallery
   Active images only, ordered for display on /prototyping.html.
───────────────────────────────────────────────────────────────────────── */
export async function getPublicGallery(req, res) {
  try {
    const { data, error } = await supabase
      .from('prototyping_gallery')
      .select('id,image_url,caption,sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    res.json({ images: data || [] });
  } catch (e) {
    console.error('getPublicGallery:', e);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   ADMIN — mounted under /api/admin, guarded by requireAuth + requireAdmin
   in server/routes/admin.js.
───────────────────────────────────────────────────────────────────────── */
export async function getAdminGallery(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('prototyping_gallery')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    res.json({ images: data || [] });
  } catch (err) { next(err); }
}

export async function createGalleryImage(req, res, next) {
  try {
    const { image_url, caption, sort_order } = req.body || {};
    if (!image_url || typeof image_url !== 'string') {
      return res.status(400).json({ error: 'image_url is required' });
    }
    const { data, error } = await supabase
      .from('prototyping_gallery')
      .insert({ image_url, caption: caption || null, sort_order: Number(sort_order) || 0 })
      .select().single();
    if (error) throw error;
    res.status(201).json({ image: data });
  } catch (err) { next(err); }
}

export async function updateGalleryImage(req, res, next) {
  try {
    const { id } = req.params;
    const { caption, sort_order, is_active } = req.body || {};
    const patch = {};
    if (caption !== undefined) patch.caption = caption;
    if (sort_order !== undefined) patch.sort_order = Number(sort_order) || 0;
    if (is_active !== undefined) patch.is_active = !!is_active;
    const { data, error } = await supabase
      .from('prototyping_gallery').update(patch).eq('id', id).select().single();
    if (error) throw error;
    res.json({ image: data });
  } catch (err) { next(err); }
}

export async function deleteGalleryImage(req, res, next) {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('prototyping_gallery').delete().eq('id', id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) { next(err); }
}
