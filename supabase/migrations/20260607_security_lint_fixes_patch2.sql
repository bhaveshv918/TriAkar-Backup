-- TriAkar — Security Lint Patch 2 (follow-up to _patch.sql)
-- Fixes 2 remaining actionable warnings:
--   1. create_customer_order still callable by authenticated role
--      (REVOKE ALL FROM PUBLIC removed anon access, but Supabase holds
--      explicit per-role grants separately — must revoke authenticated explicitly)
--   2. get_my_orders — switch SECURITY DEFINER → SECURITY INVOKER
--      Safe because orders_select_own RLS already limits authenticated users to
--      their own orders (auth.uid() = user_id). p_email becomes an extra filter,
--      but a user can never see orders that aren't theirs regardless of what email
--      they pass in. No SECURITY DEFINER privilege escalation needed.
--
-- After this migration expected warnings: 13
--   • 5× RLS Always True — intentional public form INSERTs
--   • 3× anon SECURITY DEFINER — get_recent_failures / track_order_public /
--     track_order_by_invoice — intentional (lockout check + customer tracking)
--   • 3× authenticated SECURITY DEFINER — same three functions (byproduct of
--     PUBLIC having EXECUTE; they are safe by design)
--   • 1× Public Bucket Allows Listing — accepted (product images are public)
--   • 1× Leaked Password Protection — enable in Supabase Dashboard:
--     Authentication → Providers → Email → Password Protection
-- ════════════════════════════════════════════════════════════════════════════════

-- ── 1. create_customer_order — fully server-side; revoke authenticated grant ──
REVOKE EXECUTE ON FUNCTION public.create_customer_order(
  TEXT, TEXT, TEXT, TEXT, JSONB, JSONB,
  NUMERIC, NUMERIC, NUMERIC,
  TEXT, TEXT, TEXT, UUID
) FROM authenticated;


-- ── 2. get_my_orders — switch to SECURITY INVOKER ────────────────────────────
--    With SECURITY INVOKER the function runs as the calling user, so
--    orders_select_own RLS (auth.uid() = user_id) applies automatically.
--    The p_email filter is kept for UX but can never return rows that
--    don't belong to the calling user.
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
$$ LANGUAGE SQL SECURITY INVOKER SET search_path = '';
