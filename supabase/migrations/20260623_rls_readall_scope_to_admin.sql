-- TriAkar — CRITICAL RLS fix: scope "read all" policies to the admin only
-- Run in Supabase SQL Editor. Idempotent — safe to run multiple times.
-- Date: 2026-06-23
--
-- THE BUG
-- ───────
-- admin-setup.sql and schema-v2.sql created policies NAMED "Admin can read all X"
-- but written as:  FOR SELECT TO authenticated USING (true)
-- "TO authenticated USING (true)" means EVERY logged-in user — not just the admin.
-- The 2026-06-07 migration dropped the always-true product WRITE and order UPDATE
-- policies, but never dropped these always-true READ policies. Because the admin
-- panel reads orders/profiles directly with the public anon key + the admin's JWT,
-- at least the orders/profiles read-all policies are live in production.
--
-- IMPACT (before this fix): any visitor can sign up (open signup), get a normal
-- user JWT, and read EVERY row of orders, order_items, profiles and user_addresses
-- straight from the public REST API — full customer PII (names, emails, phones,
-- home addresses, order totals). This is a complete customer-data breach.
--
-- THE FIX
-- ───────
-- Drop each always-true read policy and replace it with one scoped to the admin
-- email (same pattern already used for biz_* and site_settings). Normal users keep
-- their existing own-row policies (orders_select_own, profiles_select_own,
-- order_items_select_own, addresses_all_own), so nothing breaks for customers, and
-- the admin panel keeps working because the admin's JWT still matches.
-- ════════════════════════════════════════════════════════════════════════════════

-- ── ORDERS ──────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin can read all orders" ON public.orders;
DROP POLICY IF EXISTS orders_select_admin          ON public.orders;
CREATE POLICY orders_select_admin ON public.orders
  FOR SELECT TO authenticated
  USING ((SELECT auth.email()) = 'bhaveshv918@gmail.com');

-- ── ORDER ITEMS ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin can read all order items" ON public.order_items;
DROP POLICY IF EXISTS order_items_select_admin         ON public.order_items;
CREATE POLICY order_items_select_admin ON public.order_items
  FOR SELECT TO authenticated
  USING ((SELECT auth.email()) = 'bhaveshv918@gmail.com');

-- ── PROFILES ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS profiles_select_admin          ON public.profiles;
CREATE POLICY profiles_select_admin ON public.profiles
  FOR SELECT TO authenticated
  USING ((SELECT auth.email()) = 'bhaveshv918@gmail.com');

-- ── USER ADDRESSES ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin can read all addresses" ON public.user_addresses;
DROP POLICY IF EXISTS user_addresses_select_admin     ON public.user_addresses;
CREATE POLICY user_addresses_select_admin ON public.user_addresses
  FOR SELECT TO authenticated
  USING ((SELECT auth.email()) = 'bhaveshv918@gmail.com');

-- ── ADMIN LOGS (login attempts / IPs) ───────────────────────────────────────────
DROP POLICY IF EXISTS "Admin can read admin logs" ON public.admin_logs;
DROP POLICY IF EXISTS admin_logs_select_admin      ON public.admin_logs;
CREATE POLICY admin_logs_select_admin ON public.admin_logs
  FOR SELECT TO authenticated
  USING ((SELECT auth.email()) = 'bhaveshv918@gmail.com');

-- ── PRODUCTS — admin may also read inactive/hidden products ──────────────────────
-- Public still reads active products via the existing products_select_active policy.
DROP POLICY IF EXISTS "Admin can read all products" ON public.products;
DROP POLICY IF EXISTS products_select_admin          ON public.products;
CREATE POLICY products_select_admin ON public.products
  FOR SELECT TO authenticated
  USING ((SELECT auth.email()) = 'bhaveshv918@gmail.com');

-- ── get_my_orders RPC — close cross-user enumeration ─────────────────────────────
-- This SECURITY DEFINER function takes ANY email and returns that account's orders.
-- It was revoked from anon but NOT authenticated, so any logged-in user could call
-- get_my_orders('victim@example.com'). The frontend does not use it (order history
-- goes through the Express API), so revoke it from authenticated too.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_my_orders') THEN
    REVOKE EXECUTE ON FUNCTION public.get_my_orders(TEXT) FROM authenticated;
  END IF;
END $$;

-- ── STORAGE: product-images bucket — scope writes to the admin ───────────────────
-- The "Admin upload/manage product images" policies were FOR ... TO authenticated,
-- i.e. ANY logged-in user could upload, overwrite or DELETE files in the bucket
-- (vandalism + free file hosting on your account). Scope writes to the admin email.
-- Public SELECT stays open (the bucket is public product imagery).
DROP POLICY IF EXISTS "Admin upload product images" ON storage.objects;
CREATE POLICY "Admin upload product images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND (SELECT auth.email()) = 'bhaveshv918@gmail.com');

DROP POLICY IF EXISTS "Admin manage product images" ON storage.objects;
CREATE POLICY "Admin manage product images" ON storage.objects
  FOR ALL TO authenticated
  USING     (bucket_id = 'product-images' AND (SELECT auth.email()) = 'bhaveshv918@gmail.com')
  WITH CHECK (bucket_id = 'product-images' AND (SELECT auth.email()) = 'bhaveshv918@gmail.com');

-- ════════════════════════════════════════════════════════════════════════════════
-- VERIFY (run these after applying):
--
-- 1. List policies — no SELECT policy should have qual = 'true' for these tables:
--    SELECT tablename, policyname, cmd, qual
--    FROM pg_policies
--    WHERE schemaname='public'
--      AND tablename IN ('orders','order_items','profiles','user_addresses','admin_logs','products')
--    ORDER BY tablename, cmd, policyname;
--
-- 2. As a NON-admin logged-in user, this must now return only that user's own rows
--    (previously it returned everything):
--    select * from orders;
-- ════════════════════════════════════════════════════════════════════════════════
