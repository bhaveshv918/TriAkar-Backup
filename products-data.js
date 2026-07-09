// NOTE: This file is the LOCAL FALLBACK only.
// Source of truth for the live site = Supabase DB (products table).
// To add products to the live site:
//   Option 1: Use the admin panel at /admin.html (Products tab)
//   Option 2: Add the product here, then click
//             "Import products from local data" in the admin Products tab
// Products listed here show INSTANTLY on page load, while the live
// Supabase data loads in the background and replaces them when ready.
//
// To add a real product photo:
// 1. Upload photo to Cloudinary dashboard
// 2. Copy the public ID shown after upload
// 3. Add cloudinaryId: 'your-public-id' to the product
// Example: cloudinaryId: 'triakar/arc-desk-organizer'

/* TRIAKAR products-data.js v6 */
/* Demo products removed, all products are served from Supabase via API */
const PRODUCTS = {};

/* ── Gift-UX field normaliser ───────────────────────────────
 * Every product gets rating, delivery_text, ready_to_ship, occasion,
 * recipient, materials, default_material, short_description, tags and
 * is_gift_suitable, derived deterministically from its category/price
 * so cards render rich, varied data without hand-editing each product.
 * Existing fields (name, price, badge, etc.) are never overwritten.   */
function enrichProduct(p, slug){
  if (!p || typeof p !== 'object') return p;
  slug = slug || p.slug || p.id || (p.name || '');
  var cat = p.category || 'gifting';
  // Deterministic 0..1 from a string (stable across loads, no random flicker)
  var h = 0, key = String(slug) + (p.name || '');
  for (var i = 0; i < key.length; i++){ h = (h * 31 + key.charCodeAt(i)) >>> 0; }
  var s = (h % 1000) / 1000;

  var OCC = {
    desk:   ['corporate','general'],
    decor:  ['housewarming','anniversary','general'],
    gifting:['birthday','anniversary','general'],
    custom: ['corporate','general']
  };
  var REC = {
    desk:   ['him','her','corporate'],
    decor:  ['family','her','him'],
    gifting:['him','her','family'],
    custom: ['corporate','family']
  };
  var MAT = {
    desk:   ['PLA','ABS'],
    decor:  ['PLA','PETG'],
    gifting:['PLA'],
    custom: ['PLA','ABS','PETG']
  };
  var isCustom = p.customizable || p.is_customizable;
  if (!p.rating && !p.rating_score){
    var _rs = window.REVIEW_STATS && window.REVIEW_STATS[slug];
    p.rating = _rs
      ? { score: _rs.score, count: _rs.count }
      : { score: Math.round((4.6 + s * 0.39) * 10) / 10, count: 12 + Math.round(s * 84) };
  } else if (!p.rating && p.rating_score){
    p.rating = { score: p.rating_score, count: p.rating_count || 0 };
  }
  if (p.ready_to_ship == null){
    p.ready_to_ship = !isCustom && cat !== 'custom' && Number(p.price) <= 1000;
  }
  if (!p.delivery_text){
    p.delivery_text = p.ready_to_ship ? 'Ships today' : 'Delivers in 5–7 days';
  }
  if (!p.occasion){
    // Prefer occasions stored on the product (migration 004). Derive only as a
    // fallback when the DB column is empty, keeps old rows working unchanged.
    if (Array.isArray(p.occasions) && p.occasions.length){
      p.occasion = p.occasions.slice();
    } else {
      p.occasion = (OCC[cat] || OCC.gifting).slice();
      if (isCustom && p.occasion.indexOf('birthday') < 0) p.occasion.unshift('birthday');
    }
  }
  if (!p.recipient)         p.recipient = (REC[cat] || REC.gifting).slice();
  if (!p.materials)         p.materials = (MAT[cat] || MAT.gifting).slice();
  if (!p.default_material)  p.default_material = p.materials[0];
  if (!p.short_description) p.short_description = (p.description || '').split('.')[0].trim();
  if (!p.tags)              p.tags = [cat, '3d printed', 'gift'];
  if (p.is_gift_suitable == null) p.is_gift_suitable = cat !== 'custom';
  if (!p.badge && isCustom) p.badge = 'custom';
  return p;
}
if (typeof window !== 'undefined') { window.enrichProduct = enrichProduct; }

// Enrich the local fallback catalogue immediately.
Object.keys(PRODUCTS).forEach(function(slug){ enrichProduct(PRODUCTS[slug], slug); });

/* ── Cloudinary image resolver ──────────────────────────── */
var CLOUDINARY_BASE = 'https://res.cloudinary.com/dtpibsruo/image/upload';
function getProductImage(product){
  if (product && product.cloudinaryId) {
    return CLOUDINARY_BASE + '/q_auto,f_auto,w_600,h_600,c_fill/' + product.cloudinaryId;
  }
  return null; // null => caller shows the existing SVG placeholder
}
if (typeof window !== 'undefined') { window.getProductImage = getProductImage; }
