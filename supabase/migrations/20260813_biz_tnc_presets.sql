-- Terms & Notes Presets (Business OS). Was localStorage-only ('biz_tnc_presets' key
-- in admin-biz.html), meaning presets lived in a single browser and vanished the
-- moment that browser's site data got cleared, no server-side record at all. Moving
-- to a real table so presets persist and sync across devices.
--
-- Safe, additive. Run once in Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS biz_tnc_presets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Presets feed the Quotation/Invoice/Order forms staff already use day to day
-- (Quick Add), so staff get write access too, same is_biz_staff() OR admin
-- pattern as 20260805_biz_staff_access_extend.sql, not single-admin-only.
ALTER TABLE biz_tnc_presets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_staff_or_admin" ON biz_tnc_presets;
CREATE POLICY "biz_staff_or_admin" ON biz_tnc_presets
  FOR ALL TO authenticated
  USING ((SELECT auth.email())='bhaveshv918@gmail.com' OR public.is_biz_staff())
  WITH CHECK ((SELECT auth.email())='bhaveshv918@gmail.com' OR public.is_biz_staff());

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
-- INSERT INTO biz_tnc_presets(name,body) VALUES ('Test Preset','Sample terms text');
-- SELECT * FROM biz_tnc_presets;
-- ════════════════════════════════════════════════════════════════════════════════
