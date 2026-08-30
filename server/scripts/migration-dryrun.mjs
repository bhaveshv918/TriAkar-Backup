// ─────────────────────────────────────────────────────────────────────────────
// Dry-run a Supabase migration against a real, throwaway Postgres before it ever
// touches production.
//
// Why this exists: 20260830_branches.sql failed twice on the live database for
// mistakes that only a real parser catches. A SQL function body is validated at
// CREATE time, so declaring one before the column it reads fails. And an
// unqualified column inside an EXISTS binds to the INNER table first, which
// turned `o.id = order_id` into uuid = text. Neither is visible by reading.
//
// PGlite is Postgres compiled to WASM, so the planner, the binder and the type
// system are the real ones. What it is NOT is a copy of production: this file
// stubs a minimal shape of the schema (auth helpers, profiles, orders, the biz_*
// tables) with only the columns the migration touches. A pass here means the SQL
// parses, binds and its constraints hold. It does not mean the migration is right
// for the real data.
//
//   node --experimental-wasm-jspi server/scripts/migration-dryrun.mjs <file.sql>
//   node server/scripts/migration-dryrun.mjs supabase/migrations/20260830_branches.sql
// ─────────────────────────────────────────────────────────────────────────────
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';

const target = process.argv[2];
if (!target) {
  console.error('usage: node server/scripts/migration-dryrun.mjs <path-to.sql>');
  process.exit(2);
}

// Minimal stand-in for the parts of the live schema the migration binds against.
// Column types match production where the migration compares or constrains them,
// which is the whole point: order_items.order_id must be uuid and orders.order_id
// must be text, or the bug this file exists to catch would not reproduce.
const SETUP = `
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
DO $$ BEGIN CREATE ROLE anon;          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated;  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role;   EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION auth.uid()   RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
CREATE OR REPLACE FUNCTION auth.email() RETURNS text LANGUAGE sql STABLE AS $$ SELECT NULL::text $$;

CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY, email text, role text DEFAULT 'customer',
  biz_tabs jsonb DEFAULT '[]'::jsonb, deleted_at timestamptz, updated_at timestamptz
);

-- orders carries BOTH a uuid id and a text order_id. That pair is what made the
-- unqualified reference inside the order_items policy resolve to the wrong column.
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid, order_id text UNIQUE, invoice_number text,
  status text, total_amount numeric, shipping_address jsonb, deleted_at timestamptz
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin manages orders" ON public.orders FOR ALL TO authenticated
  USING (auth.email() = 'bhaveshv918@gmail.com') WITH CHECK (auth.email() = 'bhaveshv918@gmail.com');

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid, quantity integer, unit_price numeric
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own order items" ON public.order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()));

CREATE TABLE public.biz_channels (id text PRIMARY KEY, name text);
CREATE TABLE public.biz_products  (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sku text, name text);
CREATE TABLE public.biz_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text, order_date date, product_name text, selling_price numeric,
  status text, is_deleted boolean DEFAULT false, is_paid boolean DEFAULT false
);
CREATE TABLE public.biz_returns         (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id text, amount_lost numeric);
CREATE TABLE public.biz_expenses        (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), amount numeric, date date, category text, vendor text);
CREATE TABLE public.biz_income          (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), amount numeric, date date);
CREATE TABLE public.biz_purchases       (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), total_amount numeric, date date);
CREATE TABLE public.biz_stock_movements (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), qty integer, date date);
CREATE TABLE public.biz_rack_items      (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), qty integer, cost_price numeric);
CREATE TABLE public.biz_printers        (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), purchase_value numeric, active boolean);
CREATE TABLE public.biz_print_attempts  (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), printer_id uuid);
CREATE TABLE public.biz_invoices        (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_number text, sale_id uuid, order_id text, doc_kind text);
CREATE TABLE public.biz_quotations      (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), quotation_number text, total numeric);
CREATE TABLE public.biz_sale_payments   (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id text, amount numeric, payment_date date);
CREATE TABLE public.biz_shop_log        (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), date date UNIQUE);
CREATE TABLE public.biz_customers       (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, phone text);
CREATE TABLE public.biz_filament_resales(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), spool_id integer);
CREATE TABLE public.filament_inventory  (id serial PRIMARY KEY, s_no integer UNIQUE, brand text, status text, price numeric);
CREATE TABLE public.biz_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email text, action text, entity text, entity_id text, detail text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.biz_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY biz_activity_insert ON public.biz_activity_log FOR INSERT TO authenticated
  WITH CHECK (auth.email() = 'bhaveshv918@gmail.com');
CREATE POLICY biz_activity_select ON public.biz_activity_log FOR SELECT TO authenticated
  USING (auth.email() = 'bhaveshv918@gmail.com');

CREATE TABLE public.schema_migrations (filename text PRIMARY KEY, applied_at timestamptz DEFAULT now());

-- From 20260703_biz_staff_access.sql, already live.
CREATE OR REPLACE FUNCTION public.is_biz_staff() RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'staff');
$$;

-- The existing broad staff policy the migration is meant to replace.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'biz_channels','biz_products','biz_sales','biz_returns','biz_stock_movements',
    'biz_customers','biz_expenses','filament_inventory','biz_income','biz_purchases',
    'biz_shop_log','biz_sale_payments','biz_rack_items','biz_printers',
    'biz_print_attempts','biz_invoices','biz_quotations','biz_filament_resales'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY "biz_staff_or_admin" ON public.%I FOR ALL TO authenticated
         USING ((SELECT auth.email())=''bhaveshv918@gmail.com'' OR public.is_biz_staff())
         WITH CHECK ((SELECT auth.email())=''bhaveshv918@gmail.com'' OR public.is_biz_staff())', t);
  END LOOP;
END $$;

-- A little real data, so NOT NULL defaults and the FK backfill are actually exercised.
INSERT INTO public.profiles (id, email, role) VALUES (gen_random_uuid(), 'owner@x.com', 'admin');
INSERT INTO public.orders (user_id, order_id, total_amount) VALUES (gen_random_uuid(), 'TRK-1', 100);
INSERT INTO public.order_items (order_id, quantity, unit_price)
  SELECT id, 1, 100 FROM public.orders LIMIT 1;
INSERT INTO public.biz_sales (order_id, product_name, selling_price) VALUES ('TRK-1', 'Test', 100);
INSERT INTO public.biz_expenses (amount, date) VALUES (50, CURRENT_DATE);
INSERT INTO public.filament_inventory (s_no, brand) VALUES (1, 'WOL3D');
`;

const db = await PGlite.create();
const sql = fs.readFileSync(path.resolve(target), 'utf8');

try {
  await db.exec(SETUP);
} catch (err) {
  console.error('SETUP FAILED (the harness, not your migration):\n', err.message);
  process.exit(2);
}

console.log(`Running ${path.basename(target)} against PostgreSQL (PGlite)…\n`);
try {
  await db.exec(sql);
} catch (err) {
  console.error('MIGRATION FAILED\n');
  console.error(err.message);
  if (err.hint)   console.error('HINT:  ' + err.hint);
  if (err.detail) console.error('DETAIL:' + err.detail);
  if (err.position) {
    // Turn the byte offset into something you can actually find in the file.
    const upto = sql.slice(0, Number(err.position));
    const line = upto.split('\n').length;
    console.error(`\nAt roughly ${target}:${line}`);
    console.error('  ' + (sql.split('\n')[line - 1] || '').trim());
  }
  process.exit(1);
}

// Re-run, because every one of these migrations claims to be idempotent and that
// claim is worth checking rather than trusting.
try {
  await db.exec(sql);
} catch (err) {
  console.error('NOT IDEMPOTENT, the second run failed:\n', err.message);
  process.exit(1);
}

const q = async (label, text) => {
  const r = await db.query(text);
  console.log(label + ':', JSON.stringify(r.rows));
};

console.log('PASSED, and it is idempotent (ran twice cleanly).\n');
await q('branches', `SELECT id, kind, geo_lat, geo_lng FROM biz_branches ORDER BY sort_order`);
await q('pincode routing', `SELECT branch_for_pincode('122103') sohna, branch_for_pincode('201307') noida,
                                   branch_for_pincode('400001') fallback, branch_for_pincode('123401') rewari`);
await q('sales backfilled', `SELECT branch_id, count(*)::int FROM biz_sales GROUP BY 1`);
await q('orders backfilled', `SELECT branch_id, count(*)::int FROM orders GROUP BY 1`);
await q('branch_id columns', `SELECT count(*)::int FROM information_schema.columns
                               WHERE column_name='branch_id' AND table_schema='public'`);
await q('branch-scoped policies', `SELECT count(*)::int FROM pg_policies
                                    WHERE schemaname='public' AND policyname='biz_branch_scoped'`);
await q('stamp trigger tables', `SELECT count(DISTINCT event_object_table)::int FROM information_schema.triggers
                                  WHERE trigger_name='trg_stamp_branch'`);
await q('audit trigger tables', `SELECT count(DISTINCT event_object_table)::int FROM information_schema.triggers
                                  WHERE trigger_name='trg_biz_audit'`);
await q('registered', `SELECT filename FROM schema_migrations WHERE filename LIKE '%branches%'`);

// The audit trigger only proves itself by firing.
await db.exec(`UPDATE biz_sales SET selling_price = 222 WHERE order_id = 'TRK-1';
               DELETE FROM biz_expenses;`);
await q('audit rows', `SELECT table_name, action, changed_fields FROM biz_audit_trail ORDER BY id`);
