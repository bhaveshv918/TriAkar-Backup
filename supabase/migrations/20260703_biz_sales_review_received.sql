-- TriAkar — Open Orders "Dispatched — Tracking" lane: a dispatched order stays tracked
-- until the return window closes AND the customer's review is in. There's no automated
-- link between biz_sales and the public reviews table (different systems — reviews are
-- keyed to product_slug/reviewer_name, and most sale channels — Amazon/Flipkart/Studio —
-- don't leave a review on triakar.com at all), so this is a manual admin-set flag.
-- Idempotent — safe to run multiple times.
ALTER TABLE public.biz_sales ADD COLUMN IF NOT EXISTS review_received BOOLEAN DEFAULT false;
