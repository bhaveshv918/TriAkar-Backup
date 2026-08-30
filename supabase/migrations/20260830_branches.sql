-- TriAkar, multi-branch Business OS (Noida + Sohna/Gurugram).
-- 2026-08-30. Run in the Supabase SQL Editor. Idempotent, safe to run twice.
--
-- WHY THIS EXISTS
-- ───────────────
-- 20260703_biz_staff_access.sql deliberately made staff access TABLE level, not row
-- level: its own header says any role='staff' account gets "the SAME broad access as
-- the owner on biz_* tables". That was fine for one trusted helper in one location.
-- With a second branch run by a different person it is not: he would see the entire
-- Noida sales history, ledger and balance sheet.
--
-- So this migration adds the missing axis. Every Business OS row now belongs to a
-- branch, staff are pinned to exactly one branch, and the pin is enforced in three
-- independent places:
--   1. RLS USING       , a staff session cannot READ another branch's rows
--   2. RLS WITH CHECK  , a staff session cannot WRITE another branch's rows
--   3. a BEFORE trigger, which OVERWRITES branch_id on staff writes, so even a
--      tampered browser sending branch_id:'noida' lands in their own branch
--
-- It also fixes two real audit bugs, see the AUDIT section at the bottom.
--
-- GST NOTE: this migration is tagging only. Invoices, GSTIN, place of supply and
-- GSTR-1 are untouched, everything still bills from the UP registration. The
-- branch_id columns are what will make a future Haryana-GSTIN split cheap.
-- ════════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════════
-- 1. BRANCHES
-- ════════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.biz_branches (
  id            TEXT PRIMARY KEY,             -- 'noida', 'gurugram'
  name          TEXT NOT NULL,                -- full public label
  short_name    TEXT NOT NULL,                -- chip label in the panel
  kind          TEXT NOT NULL DEFAULT 'branch'
                CHECK (kind IN ('studio','branch')),
  color         TEXT DEFAULT '#C4622A',
  address_line  TEXT,
  locality      TEXT,
  city          TEXT,
  state         TEXT,
  pincode       TEXT,
  geo_lat       NUMERIC(10,7),
  geo_lng       NUMERIC(10,7),
  maps_url      TEXT,
  phone         TEXT,
  whatsapp      TEXT,
  walk_ins      BOOLEAN DEFAULT false,        -- Noida true, Sohna false (no visits)
  pickup        BOOLEAN DEFAULT true,
  hours_note    TEXT,
  is_public     BOOLEAN DEFAULT true,         -- shown on the storefront
  is_active     BOOLEAN DEFAULT true,         -- selectable in the panel
  sort_order    INTEGER DEFAULT 100,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Sohna's pin is the one off the live Google Business Profile
-- (https://maps.app.goo.gl/29p3kMqwkbJomNk58), not a guess from the address, because
-- a wrong pin on a live LocalBusiness hurts local ranking more than no pin at all.
INSERT INTO public.biz_branches
  (id, name, short_name, kind, color, address_line, locality, city, state, pincode,
   geo_lat, geo_lng, maps_url, phone, whatsapp, walk_ins, pickup, hours_note, sort_order)
VALUES
  ('noida', 'Greater Noida West Studio', 'Noida', 'studio', '#C4622A',
   'Shop No. 25, Karan Singh Market', 'Chhoti Milak', 'Greater Noida West',
   'Uttar Pradesh', '201307', 28.6139, 77.4960,
   'https://maps.app.goo.gl/Ki2GXFgi6JUZMb7z6', '+919217555833', '+919217555833',
   true, true, 'Monday to Saturday, 11 AM to 8 PM', 10),
  ('gurugram', 'Sohna Branch, Gurugram', 'Gurugram', 'branch', '#2A7DC4',
   'Flora Avenue 33 by Breez, Sector 33', 'Dhunela, Sohna', 'Gurugram',
   'Haryana', '122103', 28.2837480, 77.0751219,
   'https://maps.app.goo.gl/29p3kMqwkbJomNk58', '+919217555833', '+919217555833',
   false, true, 'Monday to Saturday, 11 AM to 8 PM', 20)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.biz_branches ENABLE ROW LEVEL SECURITY;

-- ════════════════════════════════════════════════════════════════════════════════
-- 2. WHO IS WHO, helper functions
--    SECURITY DEFINER for the same reason public.is_biz_staff() is: they get called
--    from inside other tables' RLS policies and must not re-trigger profiles' own RLS.
-- ════════════════════════════════════════════════════════════════════════════════

-- Replaces the hardcoded email that was copy-pasted into ~25 policies. Reads the
-- same allowlist idea as server/middleware/requireAdmin.js, kept in one place.
CREATE OR REPLACE FUNCTION public.is_biz_owner()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT COALESCE((SELECT auth.email()), '') = 'bhaveshv918@gmail.com';
$$;

-- The column has to exist BEFORE staff_branch() is created. Postgres validates the
-- body of a LANGUAGE sql function at CREATE time (check_function_bodies is on by
-- default), so declaring the function first fails with
-- `column "branch_id" does not exist`. Do not reorder these two.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS branch_id TEXT REFERENCES public.biz_branches(id);

-- The branch a staff account is pinned to. NULL for the owner, for the service role
-- (backend writes, where auth.uid() is null) and for anyone who is not staff.
-- A staff row with a NULL branch_id therefore sees NOTHING rather than everything,
-- which is the correct way for a misconfiguration to fail.
CREATE OR REPLACE FUNCTION public.staff_branch()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT branch_id FROM public.profiles
   WHERE id = (SELECT auth.uid()) AND role = 'staff';
$$;

-- biz_branches visibility: the storefront reads the public ones anonymously (so an
-- address fix needs no redeploy), staff read their own, the owner reads and writes all.
DROP POLICY IF EXISTS biz_branches_public_read ON public.biz_branches;
CREATE POLICY biz_branches_public_read ON public.biz_branches
  FOR SELECT TO anon, authenticated
  USING (is_public AND is_active);

DROP POLICY IF EXISTS biz_branches_owner_all ON public.biz_branches;
CREATE POLICY biz_branches_owner_all ON public.biz_branches
  FOR ALL TO authenticated
  USING ((SELECT public.is_biz_owner())) WITH CHECK ((SELECT public.is_biz_owner()));

-- ════════════════════════════════════════════════════════════════════════════════
-- 3. PINCODE, BRANCH ROUTING
--    Auto-suggest which branch an order belongs to from the delivery pincode. Always
--    overridable by hand in the panel, this only picks the default.
-- ════════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.biz_branch_pincodes (
  pincode_prefix TEXT PRIMARY KEY,   -- '122' matches 122001, 122103, ...
  branch_id      TEXT NOT NULL REFERENCES public.biz_branches(id) ON DELETE CASCADE,
  note           TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.biz_branch_pincodes (pincode_prefix, branch_id, note) VALUES
  ('122',  'gurugram', 'Gurugram district: Gurgaon city, Sohna, Dhunela, Badshahpur, Bhondsi, Manesar, Nuh'),
  ('1234', 'gurugram', 'Rewari belt, closer to Sohna than to Noida'),
  ('201',  'noida',    'Noida, Greater Noida, Ghaziabad'),
  ('110',  'noida',    'Delhi'),
  ('203',  'noida',    'Bulandshahr / GB Nagar rural')
ON CONFLICT (pincode_prefix) DO NOTHING;

ALTER TABLE public.biz_branch_pincodes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS biz_branch_pincodes_read ON public.biz_branch_pincodes;
CREATE POLICY biz_branch_pincodes_read ON public.biz_branch_pincodes
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS biz_branch_pincodes_owner_write ON public.biz_branch_pincodes;
CREATE POLICY biz_branch_pincodes_owner_write ON public.biz_branch_pincodes
  FOR ALL TO authenticated
  USING ((SELECT public.is_biz_owner())) WITH CHECK ((SELECT public.is_biz_owner()));

-- Longest prefix wins, so a specific 122103 rule would beat the broad 122 one.
CREATE OR REPLACE FUNCTION public.branch_for_pincode(p TEXT)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT bp.branch_id
       FROM public.biz_branch_pincodes bp
      WHERE COALESCE(p,'') LIKE bp.pincode_prefix || '%'
      ORDER BY length(bp.pincode_prefix) DESC
      LIMIT 1),
    'noida');
$$;
GRANT EXECUTE ON FUNCTION public.branch_for_pincode(TEXT) TO anon, authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════════════════
-- 4. branch_id ON EVERY BUSINESS OS TABLE
--    Denormalised onto child tables (payments, invoices) on purpose: it keeps every
--    RLS policy and every branch-wise report a single-table predicate instead of a
--    join back to the parent sale.
--    ADD COLUMN ... DEFAULT backfills existing rows to 'noida' in one pass.
-- ════════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  t TEXT;
  branch_tables TEXT[] := ARRAY[
    'biz_sales','biz_returns','biz_expenses','biz_income','biz_purchases',
    'biz_stock_movements','biz_rack_items','biz_printers','biz_print_attempts',
    'biz_invoices','biz_quotations','biz_sale_payments','biz_shop_log',
    'biz_customers','biz_filament_rolls','biz_filament_resales','filament_inventory',
    'biz_activity_log','orders'
  ];
BEGIN
  FOREACH t IN ARRAY branch_tables LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS branch_id TEXT NOT NULL DEFAULT ''noida''', t);
      -- FK added separately so a re-run does not fail on an existing constraint
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = t||'_branch_id_fkey' AND conrelid = to_regclass('public.'||t)
      ) THEN
        EXECUTE format(
          'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (branch_id)
             REFERENCES public.biz_branches(id) ON UPDATE CASCADE', t, t||'_branch_id_fkey');
      END IF;
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (branch_id)', t||'_branch_idx', t);
    END IF;
  END LOOP;
END $$;

-- ════════════════════════════════════════════════════════════════════════════════
-- 5. THE STAMP TRIGGER
--    Third line of defence, and the reason the ~30 existing
--    sb.from('biz_*').insert(...) call sites in admin-biz.html need no change:
--    a staff write gets its branch forced server side no matter what the client sent.
-- ════════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.biz_stamp_branch()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  sb        TEXT;
  inherited TEXT;
  j         JSONB;
BEGIN
  sb := public.staff_branch();
  IF sb IS NOT NULL THEN
    NEW.branch_id := sb;   -- staff, no choice, whatever the client sent is discarded
    RETURN NEW;
  END IF;

  -- Owner or backend. Invoices and payments belong to whichever branch their parent
  -- sale belongs to, never to whatever the panel happened to be scoped to when the
  -- document was raised, otherwise a Gurugram order's invoice can end up filed under
  -- Noida and invisible to the person who actually took the order.
  -- Read through to_jsonb rather than NEW.sale_id: this one function is attached to
  -- ~19 tables and biz_sale_payments has no sale_id column at all, so a direct field
  -- reference would be a runtime error there.
  IF TG_TABLE_NAME IN ('biz_invoices','biz_sale_payments') THEN
    j := to_jsonb(NEW);
    IF j ? 'sale_id' AND j->>'sale_id' IS NOT NULL THEN
      SELECT s.branch_id INTO inherited FROM public.biz_sales s
       WHERE s.id::text = j->>'sale_id' LIMIT 1;
    END IF;
    IF inherited IS NULL AND j ? 'order_id' AND j->>'order_id' IS NOT NULL THEN
      SELECT s.branch_id INTO inherited FROM public.biz_sales s
       WHERE s.order_id = j->>'order_id' LIMIT 1;
    END IF;
    NEW.branch_id := COALESCE(inherited, NEW.branch_id, 'noida');
    RETURN NEW;
  END IF;

  NEW.branch_id := COALESCE(NEW.branch_id, 'noida');
  RETURN NEW;
END $$;

DO $$
DECLARE
  t TEXT;
  branch_tables TEXT[] := ARRAY[
    'biz_sales','biz_returns','biz_expenses','biz_income','biz_purchases',
    'biz_stock_movements','biz_rack_items','biz_printers','biz_print_attempts',
    'biz_invoices','biz_quotations','biz_sale_payments','biz_shop_log',
    'biz_customers','biz_filament_rolls','biz_filament_resales','filament_inventory',
    'biz_activity_log','orders'
  ];
BEGIN
  FOREACH t IN ARRAY branch_tables LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_stamp_branch ON public.%I', t);
      EXECUTE format(
        'CREATE TRIGGER trg_stamp_branch BEFORE INSERT OR UPDATE ON public.%I
           FOR EACH ROW EXECUTE FUNCTION public.biz_stamp_branch()', t);
    END IF;
  END LOOP;
END $$;

-- ════════════════════════════════════════════════════════════════════════════════
-- 6. BRANCH-SCOPED RLS
--    Replaces the biz_staff_or_admin policy from 20260703 / 20260805, which granted
--    every staff account the owner's full table access.
--    NULL staff_branch() makes `branch_id = NULL` evaluate to NULL, so a staff row
--    without a branch is denied rather than allowed.
-- ════════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  t TEXT;
  branch_tables TEXT[] := ARRAY[
    'biz_sales','biz_returns','biz_expenses','biz_income','biz_purchases',
    'biz_stock_movements','biz_rack_items','biz_printers','biz_print_attempts',
    'biz_invoices','biz_quotations','biz_sale_payments','biz_shop_log',
    'biz_customers','biz_filament_rolls','biz_filament_resales','filament_inventory'
  ];
BEGIN
  FOREACH t IN ARRAY branch_tables LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS "biz_staff_or_admin" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "biz_branch_scoped" ON public.%I', t);
      -- any leftover single-admin-email policy, names vary across old migrations
      EXECUTE (
        SELECT COALESCE(string_agg(
          format('DROP POLICY IF EXISTS %I ON public.%I;', policyname, t), ' '
        ), '')
        FROM pg_policies WHERE schemaname='public' AND tablename=t
          AND qual ILIKE '%bhaveshv918@gmail.com%'
      );
      EXECUTE format(
        'CREATE POLICY "biz_branch_scoped" ON public.%I FOR ALL TO authenticated
           USING      ((SELECT public.is_biz_owner())
                       OR ((SELECT public.is_biz_staff()) AND branch_id = (SELECT public.staff_branch())))
           WITH CHECK ((SELECT public.is_biz_owner())
                       OR ((SELECT public.is_biz_staff()) AND branch_id = (SELECT public.staff_branch())))',
        t
      );
    END IF;
  END LOOP;
END $$;

-- biz_products / biz_channels stay shared across branches (one catalogue, one set of
-- channels), so they keep the wider staff-or-owner policy rather than a branch one.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['biz_products','biz_channels'] LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS "biz_staff_or_admin" ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY "biz_staff_or_admin" ON public.%I FOR ALL TO authenticated
           USING      ((SELECT public.is_biz_owner()) OR (SELECT public.is_biz_staff()))
           WITH CHECK ((SELECT public.is_biz_owner()) OR (SELECT public.is_biz_staff()))', t);
    END IF;
  END LOOP;
END $$;

-- orders / order_items: customers keep their own policies untouched. Staff get an
-- ADDITIONAL permissive policy for their branch only (policies are OR'd).
DROP POLICY IF EXISTS "orders_branch_staff" ON public.orders;
CREATE POLICY "orders_branch_staff" ON public.orders FOR ALL TO authenticated
  USING      ((SELECT public.is_biz_staff()) AND branch_id = (SELECT public.staff_branch()))
  WITH CHECK ((SELECT public.is_biz_staff()) AND branch_id = (SELECT public.staff_branch()));

-- order_items.order_id is written out in full on purpose. Unqualified, it resolves to
-- the INNER table first, and orders has its own order_id (the TEXT TRK- number, added
-- in schema-v2.sql), so `o.id = order_id` silently became uuid = text and the whole
-- migration failed. The older customer policy on this table gets away with the same
-- shorthand only because it was created before orders.order_id existed, which is luck,
-- not correctness. Never leave a column unqualified inside an EXISTS here.
DROP POLICY IF EXISTS "order_items_branch_staff" ON public.order_items;
CREATE POLICY "order_items_branch_staff" ON public.order_items FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
     WHERE o.id = public.order_items.order_id
       AND (SELECT public.is_biz_staff()) AND o.branch_id = (SELECT public.staff_branch())))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders o
     WHERE o.id = public.order_items.order_id
       AND (SELECT public.is_biz_staff()) AND o.branch_id = (SELECT public.staff_branch())));

-- Storage: invoice uploads stay open to owner and any staff. Bucket objects have no
-- branch column to scope on, and the filenames are not sensitive on their own.
DROP POLICY IF EXISTS "biz_invoices_staff_or_admin" ON storage.objects;
CREATE POLICY "biz_invoices_staff_or_admin" ON storage.objects
  FOR ALL TO authenticated
  USING      (bucket_id = 'biz-invoices' AND ((SELECT public.is_biz_owner()) OR (SELECT public.is_biz_staff())))
  WITH CHECK (bucket_id = 'biz-invoices' AND ((SELECT public.is_biz_owner()) OR (SELECT public.is_biz_staff())));

-- ════════════════════════════════════════════════════════════════════════════════
-- 7. AUDIT
--
--    Bug 1: biz_activity_log's INSERT policy (20260626_biz_activity_log.sql:20) is
--    auth.email()='bhaveshv918@gmail.com' only, and logBizActivity() in
--    admin-biz.html:6085 swallows every error. So a staff account's actions have
--    always logged NOTHING, silently. Widened below.
--
--    Bug 2: the 38 logBizActivity() call sites are best effort and record a free-text
--    string, not what actually changed. The trigger below records full before/after
--    JSON at the database, so it cannot be bypassed by the UI, by a direct Supabase
--    call, or by a code path that simply forgot to log.
-- ════════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.biz_audit_trail (
  id             BIGSERIAL PRIMARY KEY,
  table_name     TEXT NOT NULL,
  row_id         TEXT,
  action         TEXT NOT NULL,          -- insert | update | delete
  branch_id      TEXT,
  actor_email    TEXT,
  actor_role     TEXT,                   -- owner | staff | api | unknown
  changed_fields TEXT[],
  before         JSONB,
  after          JSONB,
  created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS biz_audit_trail_created_idx ON public.biz_audit_trail (created_at DESC);
CREATE INDEX IF NOT EXISTS biz_audit_trail_branch_idx  ON public.biz_audit_trail (branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS biz_audit_trail_actor_idx   ON public.biz_audit_trail (actor_email, created_at DESC);
CREATE INDEX IF NOT EXISTS biz_audit_trail_row_idx     ON public.biz_audit_trail (table_name, row_id);

CREATE OR REPLACE FUNCTION public.biz_audit()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_before JSONB; v_after JSONB; v_changed TEXT[];
  v_email TEXT; v_role TEXT;
BEGIN
  v_email := (SELECT auth.email());
  IF    v_email IS NULL           THEN v_role := 'api';     -- service role / backend
  ELSIF public.is_biz_owner()     THEN v_role := 'owner';
  ELSIF public.is_biz_staff()     THEN v_role := 'staff';
  ELSE                                 v_role := 'unknown';
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_before := to_jsonb(OLD);
  ELSIF TG_OP = 'INSERT' THEN
    v_after  := to_jsonb(NEW);
  ELSE
    v_before := to_jsonb(OLD);
    v_after  := to_jsonb(NEW);
    SELECT array_agg(n.key ORDER BY n.key) INTO v_changed
      FROM jsonb_each(v_after) AS n(key, value)
     WHERE n.value IS DISTINCT FROM (v_before -> n.key);
    -- a save that changed nothing is noise, not history
    IF v_changed IS NULL THEN RETURN NULL; END IF;
  END IF;

  INSERT INTO public.biz_audit_trail
    (table_name, row_id, action, branch_id, actor_email, actor_role, changed_fields, before, after)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(v_after ->> 'id', v_before ->> 'id'),
    lower(TG_OP),
    COALESCE(v_after ->> 'branch_id', v_before ->> 'branch_id'),
    v_email, v_role, v_changed, v_before, v_after
  );
  RETURN NULL;
END $$;

DO $$
DECLARE
  t TEXT;
  audited TEXT[] := ARRAY[
    'biz_sales','biz_expenses','biz_income','biz_purchases','biz_returns',
    'biz_stock_movements','biz_sale_payments','biz_invoices','biz_quotations',
    'biz_customers','biz_rack_items','filament_inventory'
  ];
BEGIN
  FOREACH t IN ARRAY audited LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_biz_audit ON public.%I', t);
      EXECUTE format(
        'CREATE TRIGGER trg_biz_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I
           FOR EACH ROW EXECUTE FUNCTION public.biz_audit()', t);
    END IF;
  END LOOP;
END $$;

-- Owner reads it, nobody writes it by hand, nobody can edit or erase it: the trigger
-- is SECURITY DEFINER and owned by the table owner, so it inserts without a policy,
-- and the absence of UPDATE/DELETE policies keeps the trail immutable.
ALTER TABLE public.biz_audit_trail ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS biz_audit_trail_owner_read ON public.biz_audit_trail;
CREATE POLICY biz_audit_trail_owner_read ON public.biz_audit_trail
  FOR SELECT TO authenticated USING ((SELECT public.is_biz_owner()));

-- Bug 1 fix: let staff actions actually reach the activity log. SELECT stays owner
-- only, and there is still no UPDATE or DELETE policy, so it remains append only.
DROP POLICY IF EXISTS biz_activity_insert ON public.biz_activity_log;
CREATE POLICY biz_activity_insert ON public.biz_activity_log
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_biz_owner()) OR (SELECT public.is_biz_staff()));
DROP POLICY IF EXISTS biz_activity_select ON public.biz_activity_log;
CREATE POLICY biz_activity_select ON public.biz_activity_log
  FOR SELECT TO authenticated USING ((SELECT public.is_biz_owner()));

-- Self-register, guarded in case schema_migrations does not exist yet (it comes from
-- 20260723_record_id_extension_and_hardening.sql). This is what makes
-- "have I already run this one?" answerable with a query instead of from memory.
DO $$
BEGIN
  IF to_regclass('public.schema_migrations') IS NOT NULL THEN
    INSERT INTO schema_migrations (filename) VALUES ('20260830_branches.sql')
    ON CONFLICT (filename) DO NOTHING;
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════════
-- VERIFY (run these after the migration)
-- ════════════════════════════════════════════════════════════════════════════════
-- 1. Both branches present:
--    SELECT id, name, kind, city, state FROM biz_branches ORDER BY sort_order;
-- 2. Pincode routing:
--    SELECT branch_for_pincode('122103'), branch_for_pincode('201307'),
--           branch_for_pincode('400001');   -- gurugram, noida, noida
-- 3. Every table carries a branch and is backfilled:
--    SELECT table_name FROM information_schema.columns
--     WHERE column_name='branch_id' AND table_schema='public' ORDER BY 1;
--    SELECT branch_id, count(*) FROM biz_sales GROUP BY 1;
-- 4. Policies are branch scoped, not email scoped:
--    SELECT tablename, policyname, qual FROM pg_policies
--     WHERE schemaname='public' AND tablename LIKE 'biz_%' ORDER BY 1;
-- 5. Triggers attached:
--    SELECT event_object_table, trigger_name FROM information_schema.triggers
--     WHERE trigger_name IN ('trg_stamp_branch','trg_biz_audit') ORDER BY 1;
-- 6. As a staff account pinned to gurugram, all three must hold:
--    SELECT count(*) FROM biz_sales;                       -- gurugram rows only
--    INSERT INTO biz_sales (branch_id, ...) VALUES ('noida', ...);  -- lands as gurugram
--    SELECT * FROM biz_audit_trail;                        -- denied, owner only
-- ════════════════════════════════════════════════════════════════════════════════
