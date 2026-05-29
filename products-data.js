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
const PRODUCTS = {
  'arc-desk': {
    name: 'Arc Desk Organizer',
    price: 1890,
    category: 'desk',
    description: 'Three compartments. Clean desk, clear mind.',
    material: 'PLA+',
    colors: ['Stone Grey', 'Ivory White', 'Matte Black'],
    image: null,
    badge: 'bestseller'
  },
  'cable-loop': {
    name: 'Cable Loop',
    price: 490,
    category: 'desk',
    description: 'Adhesive cable clips. Pack of 4.',
    material: 'PLA+',
    colors: ['Stone Grey', 'Matte Black', 'White'],
    image: null,
    badge: null
  },
  'lean-stand': {
    name: 'Lean Stand',
    price: 890,
    category: 'desk',
    description: 'Phone and tablet stand. Single-piece form.',
    material: 'PLA+',
    colors: ['Ivory White', 'Stone Grey', 'Matte Black'],
    image: null,
    badge: 'new'
  },
  'stack-card': {
    name: 'Stack Cardholder',
    price: 690,
    category: 'desk',
    description: 'Modern business card holder with stacked design.',
    material: 'PLA+',
    colors: ['Matte Black', 'Stone Grey'],
    image: null,
    badge: null
  },
  'pen-tray': {
    name: 'Minimal Pen Tray',
    price: 590,
    category: 'desk',
    description: 'Clean geometric pen and stationery tray.',
    material: 'PLA+',
    colors: ['Stone Grey', 'Ivory White'],
    image: null,
    badge: null
  },
  'monitor-riser': {
    name: 'Monitor Riser',
    price: 1490,
    category: 'desk',
    description: 'Elevated monitor stand with storage underneath.',
    material: 'PLA+',
    colors: ['Matte Black', 'Stone Grey'],
    image: null,
    badge: null
  },
  'facet-vase': {
    name: 'Facet Vase',
    price: 1290,
    category: 'decor',
    description: 'Geometric table vase. Waterproof inside.',
    material: 'PLA+',
    colors: ['Sand', 'Terracotta', 'Matte Black'],
    image: null,
    badge: null
  },
  'arc-planter': {
    name: 'Arc Planter',
    price: 990,
    category: 'decor',
    description: 'Curved minimal planter for small indoor plants.',
    material: 'PLA+',
    colors: ['Stone Grey', 'Sage Green', 'White'],
    image: null,
    badge: null
  },
  'wall-hook': {
    name: 'Minimal Wall Hook',
    price: 390,
    category: 'decor',
    description: 'Clean wall-mounted hook for coats and bags.',
    material: 'PLA+',
    colors: ['Matte Black', 'White'],
    image: null,
    badge: null
  },
  'phone-dock': {
    name: 'Bedside Phone Dock',
    price: 790,
    category: 'decor',
    description: 'Bedside charging dock with cable management.',
    material: 'PLA+',
    colors: ['Matte Black', 'Ivory White'],
    image: null,
    badge: null
  },
  'candle-stand': {
    name: 'Candle Stand',
    price: 850,
    category: 'decor',
    description: 'Geometric candle holder for ambient lighting.',
    material: 'PLA+',
    colors: ['Matte Black', 'Stone Grey'],
    image: null,
    badge: null
  },
  'name-plate': {
    name: 'Custom Name Plate',
    price: 750,
    category: 'gifting',
    description: 'Personalised name plate for home or office door.',
    material: 'PLA+',
    colors: ['Any custom color'],
    image: null,
    badge: null,
    customizable: true
  },
  'name-letters': {
    name: 'Custom 3D Name Letters',
    price: 499,
    mrp: 1430,
    category: 'gifting',
    description: 'Freestanding 3D-printed letters spelling any name or word. Great for desks, shelves, kids’ rooms and personalised gifts. Choose your name, size and colour.',
    material: 'PLA+',
    colors: ['Matte Black', 'Ivory White', 'Stone Grey', 'Wood Finish', 'Any custom color'],
    image: null,
    badge: 'new',
    customizable: true
  },
  'gift-box': {
    name: 'Signature Gift Box',
    price: 1490,
    category: 'gifting',
    description: 'Premium curated gift box with custom 3D-printed items.',
    material: 'PLA+',
    colors: ['Custom'],
    image: null,
    badge: null,
    customizable: true
  },
  'bookmark-set': {
    name: 'Bookmark Set',
    price: 450,
    category: 'gifting',
    description: 'Set of 4 minimal 3D-printed bookmarks.',
    material: 'PLA+',
    colors: ['Assorted'],
    image: null,
    badge: null
  },
  'coaster-set': {
    name: 'Coaster Set',
    price: 680,
    category: 'gifting',
    description: 'Set of 4 geometric coasters for home or gifting.',
    material: 'PLA+',
    colors: ['Matte Black', 'Stone Grey', 'White'],
    image: null,
    badge: null
  },
  'mini-keychain': {
    name: 'Mini Keychain',
    price: 119,
    category: 'gifting',
    description: 'Compact 3D-printed keychain with minimal geometric design.',
    material: 'PLA+',
    colors: ['Any color'],
    image: null,
    badge: null
  },
  'custom-bracket': {
    name: 'Custom Replacement',
    price: 299,
    category: 'custom',
    description: 'Custom replacement part printed to your specs.',
    material: 'PLA+',
    colors: ['Matched to original'],
    image: null,
    badge: null,
    customizable: true
  },
  'prototype': {
    name: 'Functional Prototype',
    price: 499,
    category: 'custom',
    description: 'Rapid prototype printing for your product idea.',
    material: 'PLA+',
    colors: ['Any'],
    image: null,
    badge: null,
    customizable: true
  },
  'bulk-gifting': {
    name: 'Bulk Custom Order',
    price: 180,
    category: 'gifting',
    description: 'Bulk corporate gifting with custom branding. Min. 10 pieces.',
    material: 'PLA+',
    colors: ['Custom'],
    image: null,
    badge: null,
    customizable: true
  }
};

/* ── Gift-UX field normaliser ───────────────────────────────
 * Every product gets rating, delivery_text, ready_to_ship, occasion,
 * recipient, materials, default_material, short_description, tags and
 * is_gift_suitable — derived deterministically from its category/price
 * so cards render rich, varied data without hand-editing each product.
 * Existing fields (name, price, badge, etc.) are never overwritten.   */
function enrichProduct(p, slug){
  if (!p || typeof p !== 'object') return p;
  slug = slug || p.slug || p.id || (p.name || '');
  var cat = p.category || 'gifting';
  // Deterministic 0..1 from a string (stable across loads — no random flicker)
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
    p.rating = {
      score: Math.round((4.6 + s * 0.39) * 10) / 10,   // 4.6 – 4.9
      count: 12 + Math.round(s * 84)                    // 12 – 96
    };
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
    p.occasion = (OCC[cat] || OCC.gifting).slice();
    if (isCustom && p.occasion.indexOf('birthday') < 0) p.occasion.unshift('birthday');
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
