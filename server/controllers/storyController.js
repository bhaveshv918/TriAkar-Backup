import supabase from '../db/supabaseClient.js';
import { logActivity } from '../services/activityLog.js';

/* ─────────────────────────────────────────────────────────────────────────
   Slug helpers — each story gets its own indexable URL (/stories/:slug),
   turning stories.html from a single card+modal page into real individual
   blog posts. Slug is derived from the title unless the admin sets one
   explicitly, and uniqueness is enforced here (not just in the DB) so a
   collision gets a clean "-2" suffix instead of a raw constraint error.
───────────────────────────────────────────────────────────────────────── */
function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '') // strip accents (combining marks left by NFKD)
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

async function uniqueSlug(base, excludeId) {
  let slug = base || 'story';
  let n = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let q = supabase.from('site_stories').select('id').eq('slug', slug).limit(1);
    if (excludeId) q = q.neq('id', excludeId);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || !data.length) return slug;
    slug = `${base}-${n}`;
    n += 1;
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   PUBLIC — GET /api/stories/public/all
   Every published story, ordered for the storefront (stories.html). Single
   source of truth, same pattern as reviews' getPublicApprovedReviews.
───────────────────────────────────────────────────────────────────────── */
export async function getPublicStories(req, res) {
  try {
    const { data, error } = await supabase
      .from('site_stories')
      .select('id,slug,year,month,sort_order,tag,title,excerpt,full_text,image_url,customer_name,customer_location')
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
   PUBLIC — GET /api/stories/public/by-slug/:slug
   Single published story, full detail, for the individual blog-post page
   (story.html?slug=...). Also returns up to 15 "related stories" for the
   carousel, most recent first, excluding itself, so the post page can link
   onward instead of dead-ending, same internal-linking goal as
   product-detail's related products. Same-tag stories are prioritized, but
   if a tag has too few other entries to fill the carousel (e.g. only one
   other Corporate story exists), the remainder backfills with the most
   recent stories of any tag rather than leaving the carousel mostly empty.
───────────────────────────────────────────────────────────────────────── */
const RELATED_LIMIT = 15;

export async function getStoryBySlug(req, res) {
  try {
    const { slug } = req.params;
    const { data: story, error } = await supabase
      .from('site_stories')
      .select('id,slug,year,month,sort_order,tag,title,excerpt,full_text,image_url,customer_name,customer_location')
      .eq('slug', slug)
      .eq('published', true)
      .maybeSingle();
    if (error) throw error;
    if (!story) return res.status(404).json({ error: 'Story not found' });

    const { data: sameTag } = await supabase
      .from('site_stories')
      .select('id,slug,year,month,tag,title,excerpt,image_url')
      .eq('published', true)
      .eq('tag', story.tag)
      .neq('id', story.id)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(RELATED_LIMIT);

    let related = sameTag || [];
    if (related.length < RELATED_LIMIT) {
      const excludeIds = [story.id, ...related.map(r => r.id)];
      const { data: fillers } = await supabase
        .from('site_stories')
        .select('id,slug,year,month,tag,title,excerpt,image_url')
        .eq('published', true)
        .not('id', 'in', `(${excludeIds.join(',')})`)
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(RELATED_LIMIT - related.length);
      related = related.concat(fillers || []);
    }

    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    res.json({ story, related });
  } catch (e) {
    console.error('getStoryBySlug:', e);
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

const ALLOWED_FIELDS = ['year', 'month', 'sort_order', 'tag', 'title', 'excerpt', 'full_text', 'image_url', 'customer_name', 'customer_location', 'slug', 'published'];

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
    row.slug = await uniqueSlug(slugify(row.slug || b.title));
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
    if (updates.slug !== undefined) {
      const base = slugify(updates.slug) || slugify(updates.title || '');
      updates.slug = await uniqueSlug(base, id);
    }
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
