import supabase from '../db/supabaseClient.js';
import { compressImage } from '../middleware/uploadMiddleware.js';
import { uploadBufferToCloudinary } from '../services/cloudinaryService.js';

/* ─────────────────────────────────────────────────────────────────────────
   PUBLIC — POST /api/prototyping-gallery/upload-reference
   Lets a shopper attach reference photos to their prototyping cart item
   before checkout (e.g. a sketch or a photo of the part). Rate-limited in
   index.js. Returns only the hosted URL, never touches the gallery table
   (that stays admin-only) or any DB row — the frontend puts the URL into
   the cart item's customization notes, same as any other text field.
───────────────────────────────────────────────────────────────────────── */
export async function uploadReferenceImage(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image file provided' });
    const compressed = await compressImage(req.file.buffer);
    const result = await uploadBufferToCloudinary(compressed, {
      folder: 'triakar/prototyping-references',
      fetch_format: 'auto',
      quality:      'auto',
    });
    res.json({ url: result.secure_url });
  } catch (err) { next(err); }
}

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
