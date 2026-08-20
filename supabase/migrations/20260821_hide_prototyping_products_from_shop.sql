-- Hide the 6 prototyping plan SKUs from the general Shop grid (products.html)
-- while keeping them fully purchasable via /prototyping.html's Add to Cart,
-- and without touching is_active (which the checkout/payment price-lookup
-- relies on, so it must stay true for these rows).

ALTER TABLE products ADD COLUMN IF NOT EXISTS hidden_from_shop BOOLEAN NOT NULL DEFAULT false;

UPDATE products SET hidden_from_shop = true
WHERE slug IN (
  'prototyping-starter-pla', 'prototyping-starter-abs',
  'prototyping-enclosed-pla', 'prototyping-enclosed-abs',
  'prototyping-multipart', 'prototyping-fulldev'
);
