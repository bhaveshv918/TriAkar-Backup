// ─────────────────────────────────────────────────────────────────────────────
// Admin → User Management  (Module 2)
//
// Why this exists: the admin panel used to read/write `profiles` directly from the
// browser with the anon key + the admin's JWT, so every write was subject to RLS.
// There is only a `profiles_update_own` policy, so the admin updating ANOTHER user's
// row silently changed 0 rows — the "users not updating" bug. Email + account ban
// also live in auth.users, which the browser client cannot touch at all.
//
// Fix: everything here runs on the server with the service-role client (RLS bypass)
// and the Supabase Auth Admin API. requireAuth + requireAdmin gate every route.
// ─────────────────────────────────────────────────────────────────────────────
import supabase from '../db/supabaseClient.js';

// Profile columns the admin may edit. Anything not listed is ignored, so a stray
// body field can never write an unexpected/non-existent column.
const EDITABLE_PROFILE_FIELDS = [
  'full_name', 'phone', 'mobile', 'nickname',
  'gender', 'date_of_birth', 'alternate_mobile', 'anniversary_date',
];

const BAN_FOREVER = '876000h'; // ~100 years — effectively a permanent ban

/* ── Build {user_id → {orders, spent}} from the orders table ──────────────── */
async function orderAggregates(userIds = null) {
  let q = supabase.from('orders').select('user_id,total_amount').is('deleted_at', null);
  if (userIds) q = q.in('user_id', userIds);
  const { data } = await q;
  const map = {};
  (data || []).forEach(o => {
    if (!o.user_id) return;
    if (!map[o.user_id]) map[o.user_id] = { orders: 0, spent: 0 };
    map[o.user_id].orders += 1;
    map[o.user_id].spent  += Number(o.total_amount) || 0;
  });
  return map;
}

/* ═══════════════════════════════════════════════════════════════════════════
   GET /api/admin/users
   Query: ?search= &role= &disabled=true|false &sort=recent|oldest|orders|spend
═══════════════════════════════════════════════════════════════════════════ */
export async function listUsers(req, res, next) {
  try {
    const { search, role, disabled, sort = 'recent' } = req.query;

    let q = supabase.from('profiles').select('*').is('deleted_at', null);
    if (role)             q = q.eq('role', role);
    if (disabled === 'true')  q = q.eq('disabled', true);
    if (disabled === 'false') q = q.eq('disabled', false);
    if (search) {
      // PostgREST .or() uses * (not %) as the ilike wildcard. Strip commas/parens
      // so the filter string can't be broken out of.
      const s = `*${String(search).trim().replace(/[(),]/g, '')}*`;
      q = q.or(
        `full_name.ilike.${s},email.ilike.${s},mobile.ilike.${s},` +
        `nickname.ilike.${s},user_code.ilike.${s}`
      );
    }
    q = q.order('created_at', { ascending: false });

    const { data: profiles, error } = await q;
    if (error) throw error;

    const agg = await orderAggregates();
    let users = (profiles || []).map(p => ({
      ...p,
      orders_count: agg[p.id]?.orders || 0,
      total_spent:  agg[p.id]?.spent  || 0,
    }));

    // Computed sorts (order count / spend) are applied here; recency is from the DB.
    if (sort === 'orders') users.sort((a, b) => b.orders_count - a.orders_count);
    else if (sort === 'spend') users.sort((a, b) => b.total_spent - a.total_spent);
    else if (sort === 'oldest') users.reverse();

    res.json({ users, total: users.length });
  } catch (err) { next(err); }
}

/* ═══════════════════════════════════════════════════════════════════════════
   GET /api/admin/users/:id  — profile + inline order history + addresses
═══════════════════════════════════════════════════════════════════════════ */
export async function getUser(req, res, next) {
  try {
    const { id } = req.params;

    const { data: profile, error: pErr } = await supabase
      .from('profiles').select('*').eq('id', id).single();
    if (pErr || !profile) return res.status(404).json({ error: 'User not found' });

    // Orders linked by user_id OR by the account email (catches pre-auth orders).
    const filters = [`user_id.eq.${id}`];
    if (profile.email) filters.push(`customer_email.eq.${profile.email}`);
    const { data: orders } = await supabase
      .from('orders')
      .select('id, order_id, invoice_number, status, order_status, payment_status, total_amount, created_at')
      .or(filters.join(','))
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    const { data: addresses } = await supabase
      .from('user_addresses').select('*').eq('user_id', id).order('is_default', { ascending: false });

    const total_spent = (orders || []).reduce((s, o) => s + (Number(o.total_amount) || 0), 0);

    res.json({
      user: profile,
      orders: orders || [],
      addresses: addresses || [],
      stats: { orders_count: (orders || []).length, total_spent },
    });
  } catch (err) { next(err); }
}

/* ═══════════════════════════════════════════════════════════════════════════
   PUT /api/admin/users/:id  — edit profile fields (+ email via Auth Admin API,
   + optional default-address update when an `address` object is supplied)
═══════════════════════════════════════════════════════════════════════════ */
export async function updateUser(req, res, next) {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const { data: existing, error: exErr } = await supabase
      .from('profiles').select('id, email').eq('id', id).single();
    if (exErr || !existing) return res.status(404).json({ error: 'User not found' });

    // 1. Profile columns (whitelisted)
    const updates = {};
    EDITABLE_PROFILE_FIELDS.forEach(k => {
      if (body[k] !== undefined) updates[k] = body[k] === '' ? null : body[k];
    });

    // 2. Email — authoritative copy is in auth.users; mirror it onto profiles.
    if (body.email !== undefined && body.email !== null) {
      const email = String(body.email).trim().toLowerCase();
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return res.status(400).json({ error: 'Invalid email address' });
      }
      if (email && email !== (existing.email || '').toLowerCase()) {
        const { error: aErr } = await supabase.auth.admin.updateUserById(id, {
          email, email_confirm: true,
        });
        if (aErr) return res.status(400).json({ error: 'Email update failed: ' + aErr.message });
        updates.email = email;
      }
    }

    if (Object.keys(updates).length) {
      updates.updated_at = new Date().toISOString();
      const { error } = await supabase.from('profiles').update(updates).eq('id', id);
      if (error) throw error;
    }

    // 3. Optional: update the user's default shipping address inline
    if (body.address && typeof body.address === 'object') {
      const a = body.address;
      const addrUpdates = {};
      ['full_name', 'phone', 'address_line1', 'address_line2', 'landmark',
       'district', 'city', 'state', 'pincode'].forEach(k => {
        if (a[k] !== undefined) addrUpdates[k] = a[k] || null;
      });
      if (Object.keys(addrUpdates).length) {
        // Update the default address; if none exists this updates nothing (no-op).
        await supabase.from('user_addresses')
          .update(addrUpdates).eq('user_id', id).eq('is_default', true);
      }
    }

    const { data: fresh } = await supabase.from('profiles').select('*').eq('id', id).single();
    res.json({ user: fresh });
  } catch (err) { next(err); }
}

/* ═══════════════════════════════════════════════════════════════════════════
   POST /api/admin/users/:id/disable  &  /enable
   Disabling bans the account in Supabase Auth (blocks login) and mirrors the
   `disabled` flag onto profiles. Data is kept — never deleted.
═══════════════════════════════════════════════════════════════════════════ */
export function setUserDisabled(disabled) {
  return async function (req, res, next) {
    try {
      const { id } = req.params;
      const { error: aErr } = await supabase.auth.admin.updateUserById(id, {
        ban_duration: disabled ? BAN_FOREVER : 'none',
      });
      if (aErr) return res.status(400).json({ error: 'Auth update failed: ' + aErr.message });

      await supabase.from('profiles')
        .update({ disabled, updated_at: new Date().toISOString() }).eq('id', id);

      res.json({ ok: true, disabled });
    } catch (err) { next(err); }
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   PUT /api/admin/users/:id/role  — set the display/filter role tag
   (does NOT grant admin access — that stays the email allowlist in requireAdmin)
═══════════════════════════════════════════════════════════════════════════ */
export async function setUserRole(req, res, next) {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!['customer', 'staff', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'role must be customer, staff, or admin' });
    }
    const { error } = await supabase.from('profiles')
      .update({ role, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    res.json({ ok: true, role });
  } catch (err) { next(err); }
}

/* ═══════════════════════════════════════════════════════════════════════════
   DELETE /api/admin/users/:id  — SOFT delete (moves to Recycle Bin). Never hard.
═══════════════════════════════════════════════════════════════════════════ */
export async function softDeleteUser(req, res, next) {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('profiles')
      .update({ deleted_at: new Date().toISOString(), deleted_by: req.user?.email || 'admin' })
      .eq('id', id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) { next(err); }
}

/* ═══════════════════════════════════════════════════════════════════════════
   GET /api/admin/users/export.csv  — CSV of the (filtered) user list
═══════════════════════════════════════════════════════════════════════════ */
export async function exportUsersCsv(req, res, next) {
  try {
    const { data: profiles, error } = await supabase
      .from('profiles').select('*').is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const agg = await orderAggregates();
    const cols = ['user_code', 'full_name', 'email', 'mobile', 'role', 'disabled',
                  'orders_count', 'total_spent', 'created_at'];
    const escape = v => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = (profiles || []).map(p => cols.map(c => {
      if (c === 'orders_count') return agg[p.id]?.orders || 0;
      if (c === 'total_spent')  return agg[p.id]?.spent  || 0;
      return escape(p[c]);
    }).join(','));
    const csv = [cols.join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="triakar-users-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
}
