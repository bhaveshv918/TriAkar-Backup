-- TriAkar — Performance Lint Fix Migration
-- Resolves all 51 Performance Advisor warnings (2026-06-07 export).
--
-- Issue types fixed:
--   • 24× auth_rls_initplan  — wrap auth.uid()/auth.email() in (SELECT ...) so
--     Postgres evaluates them once per query, not once per row
--   • 26× multiple_permissive_policies — consolidate duplicate per-role SELECT
--     policies into a single policy per table/role/action
--   •  1× duplicate_index — drop idx_products_active (identical to idx_products_is_active)
--
-- Safe to run: all DROPs use IF EXISTS; policy names are dropped before being recreated.
-- ════════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════════
-- PROFILES
--   initplan : profiles_select_own, profiles_insert_own, profiles_update_own,
--              "Users can insert own profile"
--   multi    : authenticated INSERT (2→1), authenticated SELECT (3→1)
-- ════════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Users can insert own profile"    ON public.profiles;
DROP POLICY IF EXISTS "Admin can read all profiles"     ON public.profiles;
DROP POLICY IF EXISTS "Open read profiles"              ON public.profiles;
DROP POLICY IF EXISTS profiles_select_own               ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_own               ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own               ON public.profiles;

-- Single SELECT: own row or admin
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) OR (SELECT auth.email()) = 'bhaveshv918@gmail.com');

CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING     (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));


-- ════════════════════════════════════════════════════════════════════════════════
-- USER_ADDRESSES
--   initplan : addresses_all_own
--   multi    : authenticated SELECT (3→1)
-- ════════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Admin can read all addresses"    ON public.user_addresses;
DROP POLICY IF EXISTS "Anyone can read addresses"       ON public.user_addresses;
DROP POLICY IF EXISTS addresses_all_own                 ON public.user_addresses;

-- Single SELECT: own rows or admin; separate write policies scoped to own rows
CREATE POLICY addresses_select ON public.user_addresses
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT auth.email()) = 'bhaveshv918@gmail.com');

CREATE POLICY addresses_insert_own ON public.user_addresses
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY addresses_update_own ON public.user_addresses
  FOR UPDATE TO authenticated
  USING     (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY addresses_delete_own ON public.user_addresses
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));


-- ════════════════════════════════════════════════════════════════════════════════
-- ORDERS
--   initplan : orders_select_own
--   multi    : authenticated SELECT (2→1)
-- ════════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Admin can read all orders"       ON public.orders;
DROP POLICY IF EXISTS orders_select_own                 ON public.orders;

-- Single SELECT: own order or admin
CREATE POLICY orders_select_own ON public.orders
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT auth.email()) = 'bhaveshv918@gmail.com');


-- ════════════════════════════════════════════════════════════════════════════════
-- ORDER_ITEMS
--   initplan : order_items_select_own
--   multi    : authenticated SELECT (2→1)
-- ════════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Admin can read all order items"  ON public.order_items;
DROP POLICY IF EXISTS order_items_select_own            ON public.order_items;

-- Single SELECT: admin or items belonging to the caller's own orders
CREATE POLICY order_items_select_own ON public.order_items
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.email()) = 'bhaveshv918@gmail.com'
    OR order_id IN (SELECT id FROM public.orders WHERE user_id = (SELECT auth.uid()))
  );


-- ════════════════════════════════════════════════════════════════════════════════
-- PRODUCTS
--   multi : anon SELECT (2→1), authenticated SELECT (3→1)
--   (no initplan flagged for products policies in this export)
-- ════════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Admin can read all products"      ON public.products;
DROP POLICY IF EXISTS "Anyone can read active products"  ON public.products;
DROP POLICY IF EXISTS products_select_active             ON public.products;

-- Single SELECT: active products for everyone; admin sees all
CREATE POLICY products_select_active ON public.products
  FOR SELECT
  USING (is_active = true OR (SELECT auth.email()) = 'bhaveshv918@gmail.com');


-- ════════════════════════════════════════════════════════════════════════════════
-- CATEGORIES
--   initplan : categories_admin_all (FOR ALL policy used auth.email() per row)
--   multi    : anon/auth/etc. SELECT (4→1)
--   Note     : replaces the old FOR ALL admin policy with separate write policies
--              so the single SELECT policy is the only permissive SELECT path
-- ════════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Anyone can read active categories" ON public.categories;
DROP POLICY IF EXISTS categories_admin_all                ON public.categories;
DROP POLICY IF EXISTS categories_public_read              ON public.categories;
DROP POLICY IF EXISTS categories_select_active            ON public.categories;

-- Single SELECT: active categories for public; admin sees all
CREATE POLICY categories_select_active ON public.categories
  FOR SELECT
  USING (is_active = true OR (SELECT auth.email()) = 'bhaveshv918@gmail.com');

-- Admin write — individual operation policies (no SELECT here to avoid overlap)
CREATE POLICY categories_admin_insert ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.email()) = 'bhaveshv918@gmail.com');

CREATE POLICY categories_admin_update ON public.categories
  FOR UPDATE TO authenticated
  USING     ((SELECT auth.email()) = 'bhaveshv918@gmail.com')
  WITH CHECK ((SELECT auth.email()) = 'bhaveshv918@gmail.com');

CREATE POLICY categories_admin_delete ON public.categories
  FOR DELETE TO authenticated
  USING ((SELECT auth.email()) = 'bhaveshv918@gmail.com');


-- ════════════════════════════════════════════════════════════════════════════════
-- CONTACT_SUBMISSIONS
--   initplan : "Admin can read messages", "Admin can update messages",
--              "Admin can delete messages"
--   multi    : anon/auth/etc. SELECT (3→1)
-- ════════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Admin can read messages"          ON public.contact_submissions;
DROP POLICY IF EXISTS "Open read contact_submissions"    ON public.contact_submissions;
DROP POLICY IF EXISTS "Open select contact_submissions"  ON public.contact_submissions;
DROP POLICY IF EXISTS "Admin can update messages"        ON public.contact_submissions;
DROP POLICY IF EXISTS "Admin can delete messages"        ON public.contact_submissions;

CREATE POLICY contact_select_admin ON public.contact_submissions
  FOR SELECT TO authenticated
  USING ((SELECT auth.email()) = 'bhaveshv918@gmail.com');

CREATE POLICY contact_update_admin ON public.contact_submissions
  FOR UPDATE TO authenticated
  USING     ((SELECT auth.email()) = 'bhaveshv918@gmail.com')
  WITH CHECK ((SELECT auth.email()) = 'bhaveshv918@gmail.com');

CREATE POLICY contact_delete_admin ON public.contact_submissions
  FOR DELETE TO authenticated
  USING ((SELECT auth.email()) = 'bhaveshv918@gmail.com');


-- ════════════════════════════════════════════════════════════════════════════════
-- CALLBACK_REQUESTS
--   initplan : "Admin can read callbacks", "Admin can update callbacks",
--              "Admin can delete callbacks"
-- ════════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Admin can read callbacks"         ON public.callback_requests;
DROP POLICY IF EXISTS "Admin can update callbacks"       ON public.callback_requests;
DROP POLICY IF EXISTS "Admin can delete callbacks"       ON public.callback_requests;

CREATE POLICY callback_select_admin ON public.callback_requests
  FOR SELECT TO authenticated
  USING ((SELECT auth.email()) = 'bhaveshv918@gmail.com');

CREATE POLICY callback_update_admin ON public.callback_requests
  FOR UPDATE TO authenticated
  USING     ((SELECT auth.email()) = 'bhaveshv918@gmail.com')
  WITH CHECK ((SELECT auth.email()) = 'bhaveshv918@gmail.com');

CREATE POLICY callback_delete_admin ON public.callback_requests
  FOR DELETE TO authenticated
  USING ((SELECT auth.email()) = 'bhaveshv918@gmail.com');


-- ════════════════════════════════════════════════════════════════════════════════
-- CUSTOM_ENQUIRIES
--   initplan : "Admin can read enquiries", "Admin can update enquiries",
--              "Admin can delete enquiries"
-- ════════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Admin can read enquiries"         ON public.custom_enquiries;
DROP POLICY IF EXISTS "Admin can update enquiries"       ON public.custom_enquiries;
DROP POLICY IF EXISTS "Admin can delete enquiries"       ON public.custom_enquiries;

CREATE POLICY enquiry_select_admin ON public.custom_enquiries
  FOR SELECT TO authenticated
  USING ((SELECT auth.email()) = 'bhaveshv918@gmail.com');

CREATE POLICY enquiry_update_admin ON public.custom_enquiries
  FOR UPDATE TO authenticated
  USING     ((SELECT auth.email()) = 'bhaveshv918@gmail.com')
  WITH CHECK ((SELECT auth.email()) = 'bhaveshv918@gmail.com');

CREATE POLICY enquiry_delete_admin ON public.custom_enquiries
  FOR DELETE TO authenticated
  USING ((SELECT auth.email()) = 'bhaveshv918@gmail.com');


-- ════════════════════════════════════════════════════════════════════════════════
-- PROMO_CODES
--   initplan : "Auth users read active promos", promo_codes_admin_only
--   multi    : anon/auth SELECT (2-3→1)
--   Note     : replaces the 20260604 FOR ALL admin policy with split write policies
-- ════════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Auth users read active promos"    ON public.promo_codes;
DROP POLICY IF EXISTS promo_codes_admin_only             ON public.promo_codes;
DROP POLICY IF EXISTS promo_codes_select_active          ON public.promo_codes;

-- Single SELECT: authenticated users see active promos; admin sees all
CREATE POLICY promo_codes_select ON public.promo_codes
  FOR SELECT TO authenticated
  USING (is_active = true OR (SELECT auth.email()) = 'bhaveshv918@gmail.com');

-- Admin write — individual operation policies to avoid SELECT overlap
CREATE POLICY promo_codes_admin_insert ON public.promo_codes
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.email()) = 'bhaveshv918@gmail.com');

CREATE POLICY promo_codes_admin_update ON public.promo_codes
  FOR UPDATE TO authenticated
  USING     ((SELECT auth.email()) = 'bhaveshv918@gmail.com')
  WITH CHECK ((SELECT auth.email()) = 'bhaveshv918@gmail.com');

CREATE POLICY promo_codes_admin_delete ON public.promo_codes
  FOR DELETE TO authenticated
  USING ((SELECT auth.email()) = 'bhaveshv918@gmail.com');


-- ════════════════════════════════════════════════════════════════════════════════
-- CARTS
--   initplan : carts_all_own
-- ════════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS carts_all_own ON public.carts;

CREATE POLICY carts_all_own ON public.carts
  FOR ALL TO authenticated
  USING     (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));


-- ════════════════════════════════════════════════════════════════════════════════
-- WISHLISTS
--   initplan : "Users manage own wishlist"
-- ════════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Users manage own wishlist" ON public.wishlists;

CREATE POLICY wishlists_all_own ON public.wishlists
  FOR ALL TO authenticated
  USING     (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));


-- ════════════════════════════════════════════════════════════════════════════════
-- REVIEWS
--   initplan : reviews_select_own, reviews_insert_own, reviews_update_own
--   multi    : authenticated SELECT (reviews_select_approved + reviews_select_own → 1)
-- ════════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS reviews_select_approved ON public.reviews;
DROP POLICY IF EXISTS reviews_select_own      ON public.reviews;
DROP POLICY IF EXISTS reviews_insert_own      ON public.reviews;
DROP POLICY IF EXISTS reviews_update_own      ON public.reviews;

-- Single SELECT: approved reviews visible to all; own reviews visible to owner
-- (anon: auth.uid() is NULL so user_id = NULL is always false — only approved shown)
CREATE POLICY reviews_select ON public.reviews
  FOR SELECT
  USING (status = 'approved' OR user_id = (SELECT auth.uid()));

CREATE POLICY reviews_insert_own ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY reviews_update_own ON public.reviews
  FOR UPDATE TO authenticated
  USING     (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));


-- ════════════════════════════════════════════════════════════════════════════════
-- DUPLICATE INDEX — products
--   idx_products_active and idx_products_is_active are identical.
--   Keep idx_products_is_active (more descriptive name), drop the shorter alias.
-- ════════════════════════════════════════════════════════════════════════════════
DROP INDEX IF EXISTS public.idx_products_active;
