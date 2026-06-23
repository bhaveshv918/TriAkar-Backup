import supabase from '../db/supabaseClient.js';

// Columns needed for product listing cards — avoids fetching heavy fields
// (long_description, bullet_points, specifications, variants, product_options, etc.)
const LISTING_COLS = [
  'id', 'slug', 'name', 'price', 'compare_at_price',
  'discount_type', 'discount_value', 'badge',
  'images', 'category', 'stock_qty', 'stock_status',
  'is_customizable', 'is_bestseller', 'is_featured',
  'material', 'square_crop', 'tags', 'occasions',
].join(', ');

// In-memory TTL cache for product list responses (2-minute TTL)
// Reduces Supabase round-trips on burst traffic and repeated page loads
const productCache = new Map();
const CACHE_TTL_MS = 2 * 60 * 1000;

function getCacheKey(query) {
  return JSON.stringify(query);
}

function cacheGet(key) {
  const entry = productCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { productCache.delete(key); return null; }
  return entry.data;
}

function cacheSet(key, data) {
  productCache.set(key, { data, ts: Date.now() });
}

export async function getAllProducts(req, res, next) {
  try {
    const { category, customizable } = req.query;
    const cacheKey = getCacheKey({ category, customizable });
    const cached = cacheGet(cacheKey);
    if (cached) {
      res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=60');
      res.setHeader('X-Cache', 'HIT');
      return res.json({ products: cached });
    }

    let query = supabase
      .from('products')
      .select(LISTING_COLS)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (category) query = query.eq('category', category);
    if (customizable === 'true') query = query.eq('is_customizable', true);

    const { data, error } = await query;
    if (error) throw error;

    cacheSet(cacheKey, data);
    res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=60');
    res.setHeader('X-Cache', 'MISS');
    res.json({ products: data });
  } catch (err) {
    next(err);
  }
}

export async function getProductBySlug(req, res, next) {
  try {
    const { slug } = req.params;
    const cacheKey = `slug:${slug}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
      res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=60');
      res.setHeader('X-Cache', 'HIT');
      return res.json({ product: cached });
    }

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Product not found' });
    }

    cacheSet(cacheKey, data);
    res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=60');
    res.setHeader('X-Cache', 'MISS');
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
      slug:                    String(b.slug),
      name:                    String(b.name),
      description:             b.description || '',
      short_description:       b.short_description || null,
      long_description:        b.long_description  || null,
      bullet_points:           Array.isArray(b.bullet_points) ? b.bullet_points : [],
      description_display_mode:b.description_display_mode || 'all',
      price:                   Number(b.price) || 0,
      compare_at_price:        b.compare_at_price ? Number(b.compare_at_price) : null,
      discount_type:           b.discount_type || null,
      discount_value:          b.discount_value ? Number(b.discount_value) : null,
      badge:                   b.badge || null,
      urgency_type:            b.urgency_type || null,
      urgency_text:            b.urgency_text || null,
      is_bestseller:           !!b.is_bestseller,
      is_featured:             !!b.is_featured,
      category:                b.category || 'gifting',
      stock_qty:               (b.stock_qty === undefined || b.stock_qty === null) ? 99 : Number(b.stock_qty),
      images:                  Array.isArray(b.images) ? b.images : [],
      is_customizable:         !!b.is_customizable,
      is_active:               b.is_active === undefined ? true : !!b.is_active,
      material:                b.material || 'PLA+',
      customization_prompt:    b.customization_prompt || null,
      available_colors:        Array.isArray(b.available_colors) ? b.available_colors : [],
      available_materials:     Array.isArray(b.available_materials) ? b.available_materials : [],
      production_days:         b.production_days ? Number(b.production_days) : 3,
      notes:                   b.notes || null,
      // tags — accept string (comma-sep) or array
      tags:                    Array.isArray(b.tags) ? b.tags.join(', ') : (b.tags || null),
      sku:                     b.sku || null,
      meta_title:              b.meta_title || null,
      meta_description:        b.meta_description || null,
      // Excel / product listing fields
      designer:                b.designer || null,
      // Listing v2 — occasions, licence record, pricing inputs (migration 004)
      occasions:               Array.isArray(b.occasions) ? b.occasions : [],
      source_url:              b.source_url || null,
      license:                 b.license || null,
      commercial_ok:           !!b.commercial_ok,
      est_grams:               (b.est_grams === undefined || b.est_grams === null || b.est_grams === '') ? null : Number(b.est_grams),
      est_print_hours:         (b.est_print_hours === undefined || b.est_print_hours === null || b.est_print_hours === '') ? null : Number(b.est_print_hours),
      size_class:              b.size_class || null,
      stock_status:            b.stock_status || 'Made to Order',
      key_features:            b.key_features || null,
      customization_options:   b.customization_options || null,
      dimensions:              b.dimensions || null,
      target_audience:         b.target_audience || null,
      use_case:                b.use_case || null,
      variants:                Array.isArray(b.variants) ? b.variants : [],
      customization_fields:    Array.isArray(b.customization_fields) ? b.customization_fields : [],
      product_dropdowns:       Array.isArray(b.product_dropdowns) ? b.product_dropdowns : [],
      // Image display
      square_crop:             !!b.square_crop,
      // Unified customer options (new schema — supersedes the two above)
      product_options:         Array.isArray(b.product_options) ? b.product_options : [],
      // Structured specifications table [[key, value], ...]
      specifications:          Array.isArray(b.specifications) ? b.specifications : [],
      // Quantity rules
      min_order_qty:           b.min_order_qty ? Number(b.min_order_qty) : null,
      qty_step:                b.qty_step ? Number(b.qty_step) : null,
      // Key features section label
      key_features_label:      b.key_features_label || null,
      colors:                  Array.isArray(b.colors) ? b.colors : [],
    };
    const { data, error } = await supabase
      .from('products')
      .upsert(row, { onConflict: 'slug' })
      .select()
      .single();
    if (error) throw error;

    // Invalidate all cached product listings so the new/updated product is visible immediately
    productCache.clear();

    res.json({ ok: true, product: data });
  } catch (err) { next(err); }
}

export async function getProductsByCategory(req, res, next) {
  try {
    const { category } = req.params;
    const cacheKey = `cat:${category}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
      res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=60');
      res.setHeader('X-Cache', 'HIT');
      return res.json({ products: cached });
    }

    const { data, error } = await supabase
      .from('products')
      .select(LISTING_COLS)
      .eq('category', category)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    cacheSet(cacheKey, data);
    res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=60');
    res.setHeader('X-Cache', 'MISS');
    res.json({ products: data });
  } catch (err) {
    next(err);
  }
}
