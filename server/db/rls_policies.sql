-- ════════════════════════════════════════════════════════════════════════
-- TriAkar — Row-Level Security Policies
-- Run this in Supabase SQL Editor (safe to re-run — all drops use IF EXISTS).
--
-- Design rules
-- ────────────
-- • The Express backend always uses the service_role key, which bypasses
--   RLS entirely. No admin-email policies are needed here.
-- • anon   = unauthenticated visitor (public website)
-- • authenticated = signed-in user (Supabase JWT)
-- • Default with RLS enabled and no policy = DENY ALL for anon/authenticated.
-- ════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════
-- 0. ENABLE RLS on every table
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_addresses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders               ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE products             ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories           ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews              ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_otps           ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_submissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE corporate_inquiries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_enquiries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE callback_requests    ENABLE ROW LEVEL SECURITY;


-- ════════════════════════════════════════════════════════════════════════
-- 1. DROP ALL EXISTING POLICIES (clean slate)
-- ════════════════════════════════════════════════════════════════════════

-- profiles
DROP POLICY IF EXISTS "Users read own profile"          ON profiles;
DROP POLICY IF EXISTS "Users insert own profile"        ON profiles;
DROP POLICY IF EXISTS "Users update own profile"        ON profiles;
DROP POLICY IF EXISTS "Admin manages profiles"          ON profiles;
DROP POLICY IF EXISTS "profiles_select_own"             ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own"             ON profiles;
DROP POLICY IF EXISTS "profiles_update_own"             ON profiles;

-- user_addresses
DROP POLICY IF EXISTS "Users manage own addresses"      ON user_addresses;
DROP POLICY IF EXISTS "Admin manages addresses"         ON user_addresses;
DROP POLICY IF EXISTS "addresses_all_own"               ON user_addresses;

-- carts
DROP POLICY IF EXISTS "Users manage own cart"           ON carts;
DROP POLICY IF EXISTS "Admin manages carts"             ON carts;
DROP POLICY IF EXISTS "carts_all_own"                   ON carts;

-- orders
DROP POLICY IF EXISTS "Users read own orders"           ON orders;
DROP POLICY IF EXISTS "Users insert own orders"         ON orders;
DROP POLICY IF EXISTS "Users update own orders"         ON orders;
DROP POLICY IF EXISTS "Admin manages orders"            ON orders;
DROP POLICY IF EXISTS "orders_select_own"               ON orders;

-- order_items
DROP POLICY IF EXISTS "Users read own order items"      ON order_items;
DROP POLICY IF EXISTS "Users insert own order items"    ON order_items;
DROP POLICY IF EXISTS "Admin manages order items"       ON order_items;
DROP POLICY IF EXISTS "order_items_select_own"          ON order_items;

-- products
DROP POLICY IF EXISTS "Anyone reads active products"    ON products;
DROP POLICY IF EXISTS "Admin manages products"          ON products;
DROP POLICY IF EXISTS "products_select_active"          ON products;

-- categories
DROP POLICY IF EXISTS "Anyone reads active categories"  ON categories;
DROP POLICY IF EXISTS "Admin manages categories"        ON categories;
DROP POLICY IF EXISTS "categories_select_active"        ON categories;

-- promo_codes
DROP POLICY IF EXISTS "Auth users read promos"          ON promo_codes;
DROP POLICY IF EXISTS "Admin write promos"              ON promo_codes;
DROP POLICY IF EXISTS "promo_codes_select_active"       ON promo_codes;

-- reviews
DROP POLICY IF EXISTS "Anyone reads approved reviews"   ON reviews;
DROP POLICY IF EXISTS "Auth users insert reviews"       ON reviews;
DROP POLICY IF EXISTS "Admin manages reviews"           ON reviews;
DROP POLICY IF EXISTS "reviews_select_approved"         ON reviews;
DROP POLICY IF EXISTS "reviews_select_own"              ON reviews;
DROP POLICY IF EXISTS "reviews_insert_own"              ON reviews;
DROP POLICY IF EXISTS "reviews_update_own"              ON reviews;

-- phone_otps  (no old policies — fully service_role)
DROP POLICY IF EXISTS "phone_otps_select_own"           ON phone_otps;
DROP POLICY IF EXISTS "phone_otps_insert_own"           ON phone_otps;
DROP POLICY IF EXISTS "phone_otps_delete_own"           ON phone_otps;

-- admin_logs
DROP POLICY IF EXISTS "Anyone inserts log"              ON admin_logs;
DROP POLICY IF EXISTS "Admin reads logs"                ON admin_logs;
DROP POLICY IF EXISTS "Admin manages logs"              ON admin_logs;

-- contact_submissions
DROP POLICY IF EXISTS "Anyone submits contact"          ON contact_submissions;
DROP POLICY IF EXISTS "Admin manages contact submissions" ON contact_submissions;

-- corporate_inquiries
DROP POLICY IF EXISTS "Anyone submits inquiry"          ON corporate_inquiries;
DROP POLICY IF EXISTS "Admin manages inquiries"         ON corporate_inquiries;

-- custom_enquiries
DROP POLICY IF EXISTS "Anyone submits enquiry"          ON custom_enquiries;
DROP POLICY IF EXISTS "Admin manages enquiries"         ON custom_enquiries;

-- callback_requests
DROP POLICY IF EXISTS "Anyone submits callback"         ON callback_requests;
DROP POLICY IF EXISTS "Admin manages callbacks"         ON callback_requests;


-- ════════════════════════════════════════════════════════════════════════
-- 2. PROFILES  — authenticated users, own row only
-- Note: the handle_new_user trigger runs as SECURITY DEFINER, so
-- auto-insert on signup bypasses RLS without needing a policy.
-- ════════════════════════════════════════════════════════════════════════
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated
  USING  (auth.uid() = id)
  WITH CHECK (auth.uid() = id);


-- ════════════════════════════════════════════════════════════════════════
-- 3. USER ADDRESSES  — authenticated users, own rows only
-- ════════════════════════════════════════════════════════════════════════
CREATE POLICY "addresses_all_own" ON user_addresses
  FOR ALL TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════
-- 4. CARTS  — authenticated users, own row only
-- ════════════════════════════════════════════════════════════════════════
CREATE POLICY "carts_all_own" ON carts
  FOR ALL TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════
-- 5. ORDERS  — authenticated users, read own rows only
-- Creation and status updates go through Express (service_role).
-- ════════════════════════════════════════════════════════════════════════
CREATE POLICY "orders_select_own" ON orders
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════
-- 6. ORDER ITEMS  — authenticated users, read own items only
-- Scoped via parent order; INSERT handled server-side.
-- ════════════════════════════════════════════════════════════════════════
CREATE POLICY "order_items_select_own" ON order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE  orders.id      = order_items.order_id
        AND  orders.user_id = auth.uid()
    )
  );


-- ════════════════════════════════════════════════════════════════════════
-- 7. PRODUCTS  — public read, active listings only
-- All writes (insert / update / delete) go through Express (service_role).
-- ════════════════════════════════════════════════════════════════════════
CREATE POLICY "products_select_active" ON products
  FOR SELECT
  USING (is_active = true);


-- ════════════════════════════════════════════════════════════════════════
-- 8. CATEGORIES  — public read, active only
-- ════════════════════════════════════════════════════════════════════════
CREATE POLICY "categories_select_active" ON categories
  FOR SELECT
  USING (is_active = true);


-- ════════════════════════════════════════════════════════════════════════
-- 9. PROMO CODES  — public read, active codes only
-- Validation and redemption logic lives in Express (service_role).
-- ════════════════════════════════════════════════════════════════════════
CREATE POLICY "promo_codes_select_active" ON promo_codes
  FOR SELECT
  USING (is_active = true);


-- ════════════════════════════════════════════════════════════════════════
-- 10. REVIEWS
--   • Anyone (incl. anon) can read approved reviews.
--   • Authenticated users can read their own reviews (any status).
--   • Authenticated users can submit a review attributed to themselves.
--   • Authenticated users can edit their own reviews.
-- ════════════════════════════════════════════════════════════════════════
CREATE POLICY "reviews_select_approved" ON reviews
  FOR SELECT
  USING (status = 'approved');

CREATE POLICY "reviews_select_own" ON reviews
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "reviews_insert_own" ON reviews
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reviews_update_own" ON reviews
  FOR UPDATE TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════
-- 11. PHONE OTPS  — no client-facing policies
-- All OTP operations (send / verify / expire) run server-side via
-- Express with the service_role key. RLS enabled → default DENY for
-- any anon or authenticated JWT that reaches Supabase directly.
-- ════════════════════════════════════════════════════════════════════════
-- (intentionally no policies)


-- ════════════════════════════════════════════════════════════════════════
-- 12. NO PUBLIC ACCESS TABLES
--   admin_logs · contact_submissions · corporate_inquiries
--   custom_enquiries · callback_requests
--
-- RLS enabled with ZERO policies = default DENY for every non-service_role
-- request. All reads and writes go through the Express API.
-- ════════════════════════════════════════════════════════════════════════
-- (intentionally no policies — deny-all is the default)
