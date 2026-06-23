// ─────────────────────────────────────────────────────────────────────────────
// Admin → Recycle Bin  (Module 1)  — products, users, reviews
//
// These three types are served through the server (service-role, RLS-bypass) so the
// admin panel doesn't need new browser-side RLS write policies. The four older bin
// types (contact_submissions, custom_enquiries, callback_requests, orders) keep using
// their existing, working browser path — untouched.
//
// Permanent delete is guarded: a product that appears in any order, or a user that has
// any order, is never hard-deleted (FK + financial/legal history). It stays in the bin.
// ─────────────────────────────────────────────────────────────────────────────
import supabase from '../db/supabaseClient.js';
import { logActivity } from '../services/activityLog.js';

const TYPES = { product: 'products', user: 'profiles', review: 'reviews' };

/* GET /api/admin/recycle-bin — all soft-deleted products, users, reviews */
export async function listRecycleBin(req, res, next) {
  try {
    const sel = (table, cols) =>
      supabase.from(table).select(cols).not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

    const [prods, users, revs] = await Promise.all([
      sel('products', 'id,name,slug,deleted_at,deleted_by'),
      sel('profiles', 'id,full_name,email,user_code,deleted_at,deleted_by'),
      sel('reviews',  'id,reviewer_name,product_slug,rating,deleted_at,deleted_by'),
    ]);

    const items = [];
    (prods.data || []).forEach(p => items.push({
      type: 'product', id: p.id, name: p.name || p.slug || '(product)',
      summary: p.slug || '', deleted_at: p.deleted_at, deleted_by: p.deleted_by,
    }));
    (users.data || []).forEach(u => items.push({
      type: 'user', id: u.id, name: u.full_name || u.email || u.user_code || '(user)',
      summary: u.email || '', deleted_at: u.deleted_at, deleted_by: u.deleted_by,
    }));
    (revs.data || []).forEach(r => items.push({
      type: 'review', id: r.id, name: r.reviewer_name || '(review)',
      summary: `${r.rating || '?'}★ — ${r.product_slug || ''}`,
      deleted_at: r.deleted_at, deleted_by: r.deleted_by,
    }));

    items.sort((a, b) => new Date(b.deleted_at) - new Date(a.deleted_at));
    res.json({ items });
  } catch (err) { next(err); }
}

/* POST /api/admin/recycle-bin/restore  { type, id } */
export async function restoreItem(req, res, next) {
  try {
    const { type, id } = req.body || {};
    const table = TYPES[type];
    if (!table || !id) return res.status(400).json({ error: 'type and id are required' });

    const { error } = await supabase.from(table)
      .update({ deleted_at: null, deleted_by: null }).eq('id', id);
    if (error) throw error;
    logActivity(req.user?.email, 'recycle.restore', type, id, null);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

/* POST /api/admin/recycle-bin/purge  { type, id }  — permanent, guarded */
export async function purgeItem(req, res, next) {
  try {
    const { type, id } = req.body || {};
    if (!TYPES[type] || !id) return res.status(400).json({ error: 'type and id are required' });

    if (type === 'product') {
      const { data: refs } = await supabase
        .from('order_items').select('id').eq('product_id', id).limit(1);
      if (refs && refs.length) {
        return res.status(409).json({ error: 'This product appears in past orders — permanent delete is blocked to keep order history intact. It stays in the bin.' });
      }
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;

    } else if (type === 'review') {
      const { error } = await supabase.from('reviews').delete().eq('id', id);
      if (error) throw error;

    } else if (type === 'user') {
      const { data: prof } = await supabase.from('profiles').select('email').eq('id', id).single();
      const filters = [`user_id.eq.${id}`];
      if (prof?.email) filters.push(`customer_email.eq.${prof.email}`);
      const { data: ord } = await supabase.from('orders').select('id').or(filters.join(',')).limit(1);
      if (ord && ord.length) {
        return res.status(409).json({ error: 'This user has orders — permanent delete is blocked to preserve order history. The account stays in the bin.' });
      }
      // No orders → delete the auth user (cascades the profile row via FK).
      const { error: aErr } = await supabase.auth.admin.deleteUser(id);
      if (aErr) {
        const { error } = await supabase.from('profiles').delete().eq('id', id);
        if (error) throw error;
      }
    }

    logActivity(req.user?.email, 'recycle.purge', type, id, 'permanent delete');
    res.json({ ok: true });
  } catch (err) { next(err); }
}
