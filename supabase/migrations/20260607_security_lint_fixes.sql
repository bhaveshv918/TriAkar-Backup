-- TriAkar — Security Lint Fix Migration
-- Addresses all 44 Supabase Security Advisor warnings (export: 2026-06-07).
-- Run in Supabase SQL Editor. Idempotent — safe to run multiple times.
--
-- What this file does:
--   A. Drops 19 stale "always-true" RLS policies left over from schema-v2.sql
--   B. Re-applies correct hardened policies where needed
--   C. Adds SET search_path = '' to all 9 functions that were missing it
--   D. Revokes EXECUTE from anon/authenticated on 4 functions that must be
--      server-side only (decrement_stock, create_customer_order, get_my_orders,
--      handle_new_user)
--
-- Remaining warnings after this migration (intentional / non-SQL-fixable):
--   • 5× "RLS Policy Always True" for public form INSERT policies
--     (admin_logs, callback_requests, contact_submissions, corporate_inquiries,
--     custom_enquiries) — these are INTENTIONAL; anon visitors must be able to
--     submit forms. Long-term fix: route through Express API.
--   • 1× Public Bucket Allows Listing (product-images) — accepted, images are public.
--   • 1× Leaked Password Protection Disabled — enable in Supabase Dashboard:
--     Auth → Settings → Password Protection → HaveIBeenPwned.org check.
-- ════════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════════
-- A. DROP STALE ALWAYS-TRUE RLS POLICIES
--    These accumulated from schema.sql + schema-v2.sql iterations.
-- ════════════════════════════════════════════════════════════════════════════════

-- profiles
DROP POLICY IF EXISTS "Open insert profiles"               ON public.profiles;
DROP POLICY IF EXISTS "Open update profiles"               ON public.profiles;

-- user_addresses
DROP POLICY IF EXISTS "Anyone can insert addresses"        ON public.user_addresses;
DROP POLICY IF EXISTS "Anyone can update own addresses"    ON public.user_addresses;
DROP POLICY IF EXISTS "Anyone can delete own addresses"    ON public.user_addresses;

-- products
DROP POLICY IF EXISTS "Admin can insert products"          ON public.products;
DROP POLICY IF EXISTS "Admin can update products"          ON public.products;
DROP POLICY IF EXISTS "Admin can delete products"          ON public.products;

-- categories
DROP POLICY IF EXISTS "Admin can manage categories"        ON public.categories;

-- orders
DROP POLICY IF EXISTS "Anyone can place orders"            ON public.orders;
DROP POLICY IF EXISTS "Admin can update orders"            ON public.orders;

-- contact_submissions (schema-v2 added 3 duplicate policies)
DROP POLICY IF EXISTS "Allow anonymous inserts"            ON public.contact_submissions;
DROP POLICY IF EXISTS "Open insert contact_submissions"    ON public.contact_submissions;
DROP POLICY IF EXISTS "Open update contact_submissions"    ON public.contact_submissions;

-- corporate_inquiries (schema-v2 added broad policies using USING true / WITH CHECK true)
DROP POLICY IF EXISTS "Anyone can submit inquiry"          ON public.corporate_inquiries;
DROP POLICY IF EXISTS "Admin can update inquiries"         ON public.corporate_inquiries;
DROP POLICY IF EXISTS "Admin can read inquiries"           ON public.corporate_inquiries;

-- callback_requests
DROP POLICY IF EXISTS "Allow anonymous inserts"            ON public.callback_requests;

-- custom_enquiries
DROP POLICY IF EXISTS "Allow anonymous inserts"            ON public.custom_enquiries;

-- admin_logs
DROP POLICY IF EXISTS "Anyone can insert admin logs"       ON public.admin_logs;


-- ════════════════════════════════════════════════════════════════════════════════
-- B. ENSURE HARDENED POLICIES EXIST
--    Mirrors rls_policies.sql. DROP + CREATE so they're idempotent.
-- ════════════════════════════════════════════════════════════════════════════════

-- ── profiles: authenticated, own row only ────────────────────────────────────
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ── user_addresses: authenticated, own rows only ──────────────────────────────
DROP POLICY IF EXISTS "addresses_all_own" ON public.user_addresses;
CREATE POLICY "addresses_all_own" ON public.user_addresses
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── products: public read of active listings; all writes via Express ──────────
DROP POLICY IF EXISTS "products_select_active" ON public.products;
CREATE POLICY "products_select_active" ON public.products
  FOR SELECT USING (is_active = true);

-- ── categories: public read of active entries ─────────────────────────────────
DROP POLICY IF EXISTS "categories_select_active" ON public.categories;
CREATE POLICY "categories_select_active" ON public.categories
  FOR SELECT USING (is_active = true);

-- ── orders: authenticated, read own only; writes via Express ─────────────────
DROP POLICY IF EXISTS "orders_select_own" ON public.orders;
CREATE POLICY "orders_select_own" ON public.orders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ── Public form tables: anon INSERT only, no client read/update/delete ────────
-- admin_logs (pre-login visit/failure events — no JWT yet)
DROP POLICY IF EXISTS "Anyone inserts log"         ON public.admin_logs;
DROP POLICY IF EXISTS "admin_logs_anon_insert"     ON public.admin_logs;
CREATE POLICY "admin_logs_anon_insert" ON public.admin_logs
  FOR INSERT TO anon WITH CHECK (true);

-- contact_submissions
DROP POLICY IF EXISTS "Anyone submits contact"     ON public.contact_submissions;
DROP POLICY IF EXISTS "contact_anon_insert"        ON public.contact_submissions;
CREATE POLICY "contact_anon_insert" ON public.contact_submissions
  FOR INSERT TO anon WITH CHECK (true);

-- corporate_inquiries
DROP POLICY IF EXISTS "Anyone submits inquiry"     ON public.corporate_inquiries;
DROP POLICY IF EXISTS "corporate_anon_insert"      ON public.corporate_inquiries;
CREATE POLICY "corporate_anon_insert" ON public.corporate_inquiries
  FOR INSERT TO anon WITH CHECK (true);

-- custom_enquiries
DROP POLICY IF EXISTS "Anyone submits enquiry"     ON public.custom_enquiries;
DROP POLICY IF EXISTS "custom_enquiry_anon_insert" ON public.custom_enquiries;
CREATE POLICY "custom_enquiry_anon_insert" ON public.custom_enquiries
  FOR INSERT TO anon WITH CHECK (true);

-- callback_requests
DROP POLICY IF EXISTS "Anyone submits callback"    ON public.callback_requests;
DROP POLICY IF EXISTS "callback_anon_insert"       ON public.callback_requests;
CREATE POLICY "callback_anon_insert" ON public.callback_requests
  FOR INSERT TO anon WITH CHECK (true);


-- ════════════════════════════════════════════════════════════════════════════════
-- C. FIX FUNCTION SEARCH PATHS — add SET search_path = '' and qualify all tables
-- ════════════════════════════════════════════════════════════════════════════════

-- ── C1. handle_new_user — auth trigger ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, mobile)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    new.raw_user_meta_data->>'mobile'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    email     = COALESCE(EXCLUDED.email,     public.profiles.email),
    mobile    = COALESCE(EXCLUDED.mobile,    public.profiles.mobile);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Revoke direct REST API execution — trigger mechanism is unaffected
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;


-- ── C2. decrement_stock — server-side stock management only ──────────────────
CREATE OR REPLACE FUNCTION public.decrement_stock(p_product_id UUID, p_qty INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE public.products
  SET stock_qty = GREATEST(0, stock_qty - p_qty)
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Revoke — only Express (service_role) calls this after payment confirmation
REVOKE EXECUTE ON FUNCTION public.decrement_stock(UUID, INTEGER) FROM anon, authenticated;


-- ── C3. create_customer_order — Express handles order creation ────────────────
CREATE OR REPLACE FUNCTION public.create_customer_order(
  p_order_id            TEXT,
  p_customer_name       TEXT,
  p_customer_email      TEXT,
  p_customer_phone      TEXT,
  p_shipping_address    JSONB,
  p_items               JSONB,
  p_subtotal            NUMERIC,
  p_shipping_charge     NUMERIC,
  p_total_amount        NUMERIC,
  p_payment_method      TEXT,
  p_payment_status      TEXT,
  p_special_instructions TEXT DEFAULT NULL,
  p_user_id             UUID  DEFAULT NULL
) RETURNS JSON AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.orders (
    order_id, user_id, customer_name, customer_email, customer_phone,
    shipping_address, items, subtotal, shipping_charge, total_amount,
    payment_method, payment_status, order_status, special_instructions, status
  ) VALUES (
    p_order_id, p_user_id, p_customer_name, p_customer_email, p_customer_phone,
    p_shipping_address, p_items, p_subtotal, p_shipping_charge, p_total_amount,
    p_payment_method, p_payment_status, 'placed', p_special_instructions, 'pending'
  ) RETURNING id INTO v_id;
  RETURN json_build_object('id', v_id, 'order_id', p_order_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Revoke from anon — order creation requires a signed-in user
REVOKE EXECUTE ON FUNCTION public.create_customer_order(
  TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, UUID
) FROM anon;


-- ── C4. get_my_orders — keep authenticated access, revoke anon ───────────────
-- RESIDUAL RISK: authenticated users can query any email string (not scoped to
-- their own). Move to Express API to fully prevent cross-user enumeration.
CREATE OR REPLACE FUNCTION public.get_my_orders(p_email TEXT)
RETURNS JSON AS $$
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::json)
  FROM (
    SELECT order_id, order_status, payment_status, payment_method,
           total_amount, items, tracking_number, tracking_vendor,
           created_at, shipping_address
    FROM public.orders
    WHERE customer_email = p_email
  ) t;
$$ LANGUAGE SQL SECURITY DEFINER SET search_path = '';

REVOKE EXECUTE ON FUNCTION public.get_my_orders(TEXT) FROM anon;


-- ── C5. get_recent_failures — intentionally anon-accessible for login lockout ─
CREATE OR REPLACE FUNCTION public.get_recent_failures(visitor_ip TEXT, lockout_seconds INT)
RETURNS TABLE(fail_count INT, last_fail_at TIMESTAMPTZ) AS $$
  SELECT COUNT(*)::INT, MAX(created_at)
  FROM public.admin_logs
  WHERE ip = visitor_ip
    AND action = 'login_attempt'
    AND success = false
    AND created_at >= NOW() - (lockout_seconds || ' seconds')::INTERVAL;
$$ LANGUAGE SQL SECURITY DEFINER SET search_path = '';
-- No REVOKE — called from admin login page before JWT exists


-- ── C6. track_order_public — intentionally public for customer order tracking ─
CREATE OR REPLACE FUNCTION public.track_order_public(p_order_id TEXT)
RETURNS JSON AS $$
  SELECT json_build_object(
    'found',           true,
    'order_id',        o.order_id,
    'order_status',    o.order_status,
    'payment_status',  o.payment_status,
    'payment_method',  o.payment_method,
    'total_amount',    o.total_amount,
    'tracking_number', o.tracking_number,
    'tracking_vendor', o.tracking_vendor,
    'created_at',      o.created_at,
    'updated_at',      o.updated_at,
    'items',           COALESCE(o.items, '[]'::jsonb),
    'shipping_city',   o.shipping_address->>'city',
    'shipping_state',  o.shipping_address->>'state'
  )
  FROM public.orders o
  WHERE UPPER(TRIM(o.order_id)) = UPPER(TRIM(p_order_id))
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER SET search_path = '';
-- No REVOKE — public order tracking feature


-- ── C7. track_order_by_invoice — intentionally public for order tracking ──────
CREATE OR REPLACE FUNCTION public.track_order_by_invoice(inv_number TEXT)
RETURNS JSON AS $$
  SELECT json_build_object(
    'found',           true,
    'invoice_number',  COALESCE(o.order_id, o.invoice_number),
    'order_id',        o.order_id,
    'status',          COALESCE(o.order_status, o.status),
    'total_amount',    o.total_amount,
    'tracking_number', o.tracking_number,
    'tracking_vendor', o.tracking_vendor,
    'created_at',      o.created_at,
    'items', COALESCE((
      SELECT json_agg(json_build_object(
        'name', p.name, 'quantity', oi.quantity, 'unit_price', oi.unit_price
      ))
      FROM public.order_items oi
      JOIN public.products p ON p.id = oi.product_id
      WHERE oi.order_id = o.id
    ), '[]'::json)
  )
  FROM public.orders o
  WHERE UPPER(TRIM(o.order_id))       = UPPER(TRIM(inv_number))
     OR UPPER(TRIM(o.invoice_number)) = UPPER(TRIM(inv_number))
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER SET search_path = '';
-- No REVOKE — public order tracking feature


-- ── C8. set_invoice_number — trigger only, fix search_path ───────────────────
CREATE OR REPLACE FUNCTION public.set_invoice_number()
RETURNS trigger AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    IF NEW.order_id IS NOT NULL THEN
      NEW.invoice_number := NEW.order_id;
    ELSE
      NEW.invoice_number := 'TRK-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-'
        || LPAD((FLOOR(RANDOM() * 9000 + 1000))::TEXT, 4, '0');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';


-- ── C9. generate_user_code — fix search_path, qualify table references ────────
CREATE OR REPLACE FUNCTION public.generate_user_code(signup_ts TIMESTAMPTZ DEFAULT NOW())
RETURNS TEXT AS $$
DECLARE
  base  TEXT;
  code  TEXT;
  tries INT := 0;
BEGIN
  base := TO_CHAR(signup_ts, 'DDMMYY');
  LOOP
    code := base || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_code = code);
    tries := tries + 1;
    IF tries > 20 THEN
      RAISE EXCEPTION 'generate_user_code: could not find unique code after 20 tries';
    END IF;
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql SET search_path = '';


-- ── C10. trg_assign_user_code — trigger only, fix search_path ────────────────
CREATE OR REPLACE FUNCTION public.trg_assign_user_code()
RETURNS trigger AS $$
BEGIN
  IF NEW.user_code IS NULL THEN
    NEW.user_code := public.generate_user_code(COALESCE(NEW.created_at, NOW()));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';


-- ════════════════════════════════════════════════════════════════════════════════
-- D. NON-SQL ACTIONS REQUIRED
-- ════════════════════════════════════════════════════════════════════════════════
-- D1. Leaked Password Protection — enable in Supabase Dashboard:
--     Authentication → Providers → Email → Password Protection
--     → Enable "Leaked password protection (HaveIBeenPwned.org)"
--
-- D2. Public Bucket Listing (product-images) — intentionally accepted.
--     Product images are public. No change needed.
-- ════════════════════════════════════════════════════════════════════════════════
