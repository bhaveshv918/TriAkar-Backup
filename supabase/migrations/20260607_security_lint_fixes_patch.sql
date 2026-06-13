-- TriAkar — Security Lint Patch (follow-up to 20260607_security_lint_fixes.sql)
-- The first migration's REVOKE statements targeted anon/authenticated directly, but
-- PUBLIC still had EXECUTE — roles inherit from PUBLIC so the revoke had no effect.
-- This patch revokes from PUBLIC first, then re-grants where needed.
--
-- After this migration the remaining warnings will be:
--   • 5× RLS Always True — intentional public form INSERTs (unavoidable without Express routing)
--   • 7× SECURITY DEFINER callable — get_recent_failures/track_order_public/track_order_by_invoice
--     are intentionally public (order tracking + admin lockout); get_my_orders stays for
--     authenticated account page; all accepted
--   • 1× Public Bucket Allows Listing — accepted
--   • 1× Leaked Password Protection — enable in Supabase Dashboard (Auth → Settings)
-- ════════════════════════════════════════════════════════════════════════════════

-- ── handle_new_user — trigger only; no REST access needed ────────────────────
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- ── decrement_stock — server-side only (called by Express after payment) ─────
REVOKE ALL ON FUNCTION public.decrement_stock(UUID, INTEGER) FROM PUBLIC;

-- ── create_customer_order — server-side only (Express order creation flow) ───
REVOKE ALL ON FUNCTION public.create_customer_order(
  TEXT, TEXT, TEXT, TEXT, JSONB, JSONB,
  NUMERIC, NUMERIC, NUMERIC,
  TEXT, TEXT, TEXT, UUID
) FROM PUBLIC;

-- ── get_my_orders — revoke anon, keep authenticated for account page ──────────
REVOKE ALL ON FUNCTION public.get_my_orders(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_orders(TEXT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- Functions that remain intentionally callable by anon (no change):
--   • get_recent_failures  — admin login page lockout check (pre-JWT)
--   • track_order_public   — customer order tracking by TRK ID
--   • track_order_by_invoice — customer order tracking by invoice number
-- These will still show as WARN in the linter. That is expected and intentional.
-- ════════════════════════════════════════════════════════════════════════════════
