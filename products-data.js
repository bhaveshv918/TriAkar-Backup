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

/* ── Cloudinary image resolver ──────────────────────────── */
var CLOUDINARY_BASE = 'https://res.cloudinary.com/dtpibsruo/image/upload';
function getProductImage(product){
  if (product && product.cloudinaryId) {
    return CLOUDINARY_BASE + '/q_auto,f_auto,w_600,h_600,c_fill/' + product.cloudinaryId;
  }
  return null; // null => caller shows the existing SVG placeholder
}
if (typeof window !== 'undefined') { window.getProductImage = getProductImage; }
