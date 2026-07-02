-- TriAkar — Round 3 §2.10: product thumbnail in All Sales list.
-- biz_products has no image at all (it's a business cost-tracking record, separate
-- from the storefront products table) — add a simple URL field so the admin can attach
-- one and All Sales can show a small thumbnail per linked product.
-- Idempotent — safe to run multiple times.
ALTER TABLE public.biz_products ADD COLUMN IF NOT EXISTS image_url TEXT;
