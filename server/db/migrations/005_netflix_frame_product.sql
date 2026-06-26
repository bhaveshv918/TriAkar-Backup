-- ═══════════════════════════════════════════════════════════════════
-- TriAkar — Migration 005: Netflix-Style Customizable Photo Frame
-- Run in Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO products (
  slug,
  name,
  short_description,
  description,
  price,
  compare_at_price,
  category,
  badge,
  is_active,
  is_customizable,
  is_bestseller,
  occasions,
  images,
  variants,
  customization_fields,
  specifications,
  key_features,
  tags
)
VALUES (
  'netflix-style-photo-frame',
  'Netflix-Style Customizable Photo Frame',
  'A premium 3D-printed photo frame styled like a streaming app — holds 1 large + 4 small photos. Perfect for couples, birthdays, and anniversaries.',
  'Turn your favourite memories into a premium Netflix-style display. This 3D-printed frame features a bold streaming-app aesthetic with space for one large hero photo and four smaller "best moments" thumbnails. Fully personalised with names and a special date — making it an unforgettable gift for anniversaries, weddings, birthdays, and desk décor.',
  1249,
  1699,
  'gifting',
  'Bestseller',
  true,
  true,
  true,
  ARRAY['birthday','anniversary','housewarming'],
  ARRAY[
    'https://res.cloudinary.com/triakar/image/upload/v1/triakar/netflix-frame-front',
    'https://res.cloudinary.com/triakar/image/upload/v1/triakar/netflix-frame-back',
    'https://res.cloudinary.com/triakar/image/upload/v1/triakar/netflix-frame-lifestyle'
  ],
  '[
    {"name": "Wall Mount", "price": 1249},
    {"name": "With Stand",  "price": 1599}
  ]'::jsonb,
  '[
    {"label": "Name 1 (e.g. Sagar)", "type": "text", "required": true, "placeholder": "Enter first name", "is_name_field": true},
    {"label": "Name 2 (e.g. Ruchi)",  "type": "text", "required": true, "placeholder": "Enter second name", "is_name_field": true},
    {"label": "Special Date (e.g. 21 June 2026)", "type": "text", "required": true, "placeholder": "Enter date or year"},
    {"label": "Main Photo (WhatsApp us after ordering)", "type": "text", "required": false, "placeholder": "Describe or share photo link", "hint": "You can also WhatsApp your photo after placing the order."},
    {"label": "4 Thumbnail Photos (describe or share links)", "type": "textarea", "required": false, "placeholder": "List 4 small photo descriptions or share links"}
  ]'::jsonb,
  '[
    {"label": "Size",      "value": "Approx. 18 × 13 cm"},
    {"label": "Material",  "value": "PLA+ (eco-friendly bioplastic)"},
    {"label": "Photos",    "value": "1 large + 4 small thumbnails"},
    {"label": "Finish",    "value": "Matte black textured"},
    {"label": "Mount",     "value": "Wall Mount or With Stand (your choice)"},
    {"label": "Print Time","value": "Made fresh — ships in 5–7 days"}
  ]'::jsonb,
  ARRAY[
    'Fully personalised with names and date',
    'Holds 1 large hero photo + 4 thumbnail memories',
    'Premium matte black 3D-printed frame',
    'Netflix-style streaming app aesthetic',
    'Available as Wall Mount or With Stand',
    'Eco-friendly PLA+ material — made responsibly in India',
    'Perfect for couples, weddings, birthdays, and desk décor'
  ],
  ARRAY['photo-frame','netflix','personalized','couple','anniversary','birthday','gift','desk-decor','wall-art']
)
ON CONFLICT (slug) DO UPDATE SET
  name              = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  description       = EXCLUDED.description,
  price             = EXCLUDED.price,
  compare_at_price  = EXCLUDED.compare_at_price,
  category          = EXCLUDED.category,
  badge             = EXCLUDED.badge,
  is_active         = EXCLUDED.is_active,
  is_customizable   = EXCLUDED.is_customizable,
  is_bestseller     = EXCLUDED.is_bestseller,
  occasions         = EXCLUDED.occasions,
  variants          = EXCLUDED.variants,
  customization_fields = EXCLUDED.customization_fields,
  specifications    = EXCLUDED.specifications,
  key_features      = EXCLUDED.key_features,
  tags              = EXCLUDED.tags;
