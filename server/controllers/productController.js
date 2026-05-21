import supabase from '../db/supabaseClient.js';

export async function getAllProducts(req, res, next) {
  try {
    const { category, customizable } = req.query;

    let query = supabase
      .from('products')
      .select('id, name, slug, description, price, category, stock_qty, images, is_customizable')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (category) query = query.eq('category', category);
    if (customizable === 'true') query = query.eq('is_customizable', true);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ products: data });
  } catch (err) {
    next(err);
  }
}

export async function getProductBySlug(req, res, next) {
  try {
    const { slug } = req.params;

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ product: data });
  } catch (err) {
    next(err);
  }
}

export async function upsertProduct(req, res, next) {
  try {
    // Email-allowlist admin check (admins are whitelisted by email, not role)
    const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'bhaveshv918@gmail.com')
      .split(',').map(e => e.trim().toLowerCase());
    const email = (req.user?.email || '').toLowerCase();
    if (!ADMIN_EMAILS.includes(email)) {
      return res.status(403).json({ error: 'Forbidden — admin access required' });
    }
    const b = req.body || {};
    if (!b.slug || !b.name) return res.status(400).json({ error: 'slug and name are required' });
    const row = {
      slug: String(b.slug),
      name: String(b.name),
      description: b.description || '',
      price: Number(b.price) || 0,
      category: b.category || 'gifting',
      stock_qty: (b.stock_qty === undefined || b.stock_qty === null) ? 99 : Number(b.stock_qty),
      images: Array.isArray(b.images) ? b.images : [],
      is_customizable: !!b.is_customizable,
      is_active: b.is_active === undefined ? true : !!b.is_active,
    };
    const { data, error } = await supabase
      .from('products')
      .upsert(row, { onConflict: 'slug' })
      .select()
      .single();
    if (error) throw error;
    res.json({ ok: true, product: data });
  } catch (err) { next(err); }
}

export async function getProductsByCategory(req, res, next) {
  try {
    const { category } = req.params;

    const { data, error } = await supabase
      .from('products')
      .select('id, name, slug, price, category, images, stock_qty, is_customizable')
      .eq('category', category)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ products: data });
  } catch (err) {
    next(err);
  }
}
