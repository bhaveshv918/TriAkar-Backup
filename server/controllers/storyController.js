import supabase from '../db/supabaseClient.js';
import { logActivity } from '../services/activityLog.js';

/* ─────────────────────────────────────────────────────────────────────────
   PUBLIC — GET /api/stories/public/all
   Every published story, ordered for the storefront (stories.html). Single
   source of truth, same pattern as reviews' getPublicApprovedReviews.
───────────────────────────────────────────────────────────────────────── */
export async function getPublicStories(req, res) {
  try {
    const { data, error } = await supabase
      .from('site_stories')
      .select('id,year,month,sort_order,tag,title,excerpt,full_text,image_url')
      .eq('published', true)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .order('sort_order', { ascending: true })
      .limit(2000);
    if (error) throw error;
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    res.json({ stories: data || [] });
  } catch (e) {
    console.error('getPublicStories:', e);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   ADMIN — GET /api/stories/
   All stories (published + unpublished) for the admin editor.
───────────────────────────────────────────────────────────────────────── */
export async function getAllStories(req, res) {
  try {
    const { data, error } = await supabase
      .from('site_stories')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .order('sort_order', { ascending: true });
    if (error) throw error;
    res.json({ stories: data || [] });
  } catch (e) {
    console.error('getAllStories:', e);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}

const ALLOWED_FIELDS = ['year', 'month', 'sort_order', 'tag', 'title', 'excerpt', 'full_text', 'image_url', 'published'];

/* ─────────────────────────────────────────────────────────────────────────
   ADMIN — POST /api/stories/
───────────────────────────────────────────────────────────────────────── */
export async function createStory(req, res) {
  try {
    const b = req.body || {};
    if (!b.year || !b.month || !b.title || !b.excerpt || !b.full_text) {
      return res.status(400).json({ error: 'year, month, title, excerpt and full_text are required' });
    }
    const row = {};
    ALLOWED_FIELDS.forEach(k => { if (b[k] !== undefined) row[k] = b[k]; });
    const { data, error } = await supabase.from('site_stories').insert(row).select().single();
    if (error) throw error;
    logActivity(req.user?.email, 'story.create', 'story', data.id, b.title);
    res.status(201).json({ story: data });
  } catch (e) {
    console.error('createStory:', e);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   ADMIN — PUT /api/stories/:id
───────────────────────────────────────────────────────────────────────── */
export async function updateStory(req, res) {
  try {
    const { id } = req.params;
    const updates = {};
    ALLOWED_FIELDS.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    updates.updated_at = new Date().toISOString();
    const { data, error } = await supabase.from('site_stories').update(updates).eq('id', id).select().single();
    if (error) throw error;
    logActivity(req.user?.email, 'story.edit', 'story', id, updates.title || '');
    res.json({ story: data });
  } catch (e) {
    console.error('updateStory:', e);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   ADMIN — DELETE /api/stories/:id
   Hard delete — stories are marketing content, not order/financial records,
   so there's no recycle-bin requirement here (unlike orders/reviews).
───────────────────────────────────────────────────────────────────────── */
export async function deleteStory(req, res) {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('site_stories').delete().eq('id', id);
    if (error) throw error;
    logActivity(req.user?.email, 'story.delete', 'story', id, '');
    res.json({ message: 'Story deleted' });
  } catch (e) {
    console.error('deleteStory:', e);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
