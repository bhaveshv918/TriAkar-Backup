-- TriAkar — Security audit finding (2026-08-20, Medium severity).
--
-- track_order_public(p_order_id) and track_order_by_invoice(inv_number) were kept
-- intentionally anon-accessible (see 20260607_security_lint_fixes.sql / patch2) for
-- "customer order tracking". That flow has since moved to the hardened Express
-- endpoint GET /api/track/:id (server/index.js), which strips all PII and sits behind
-- the app's rate limiter. Neither function is called from anywhere in the current
-- codebase (verified: no server route, no client-side .rpc() call references them —
-- only get_recent_failures is still used, from admin.html's login lockout check).
--
-- Left anon-accessible, these two are a live enumeration path that completely bypasses
-- Express's rate limiting and CORS allow-list: anyone with the public anon key (shipped
-- in every page's JS) can POST directly to
-- https://<project>.supabase.co/rest/v1/rpc/track_order_public at unlimited speed and
-- brute-force TRK ids to harvest order items, totals, and tracking numbers. The Express
-- route's own code comments call TRK ids "short and guessable" — exactly the profile an
-- unrate-limited RPC path turns into a real scraping risk.
--
-- Fix: revoke anon/authenticated EXECUTE on both dead functions. Not dropping them
-- (idempotent CREATE OR REPLACE definitions still exist in migration history) in case
-- a future admin-only use case wants them — re-grant explicitly if that happens.
--
-- Safe, additive, idempotent. Run once in Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════════════════════

REVOKE EXECUTE ON FUNCTION public.track_order_public(TEXT)     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.track_order_by_invoice(TEXT) FROM PUBLIC, anon, authenticated;

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
-- SELECT proname, proacl FROM pg_proc
--   WHERE proname IN ('track_order_public','track_order_by_invoice');
--   (proacl should show no grant to anon/authenticated after this runs)
-- A subsequent anon-key RPC call to either function should now fail with a
-- permission-denied error instead of returning order data.
-- ════════════════════════════════════════════════════════════════════════════════
