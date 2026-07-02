-- ═══════════════════════════════════════════════════════════════════
-- admin_logs INSERT policy only granted the `anon` role (20260607_security_lint_fixes.sql),
-- but admin.html logs page visits after login too (role `authenticated`) — that path was
-- getting a 403. Allow both roles to insert; read/update/delete remain admin-only.
-- ═══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS admin_logs_anon_insert ON public.admin_logs;
CREATE POLICY admin_logs_anon_insert ON public.admin_logs
  FOR INSERT TO anon, authenticated WITH CHECK (true);
