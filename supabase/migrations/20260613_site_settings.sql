-- TriAkar — site_settings: small key/value store for site-wide, admin-tunable
-- presentation flags (first use: mobile menu style). 2026-06-13
--
-- Read: public (anon) — the storefront reads the chosen style on every page.
-- Write: admin only (auth.email() = the admin), matching the rest of the app.

CREATE TABLE IF NOT EXISTS site_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Anyone may read settings (they are non-sensitive presentation flags).
DROP POLICY IF EXISTS site_settings_public_read ON site_settings;
CREATE POLICY site_settings_public_read
  ON site_settings FOR SELECT
  USING (true);

-- Only the admin may create/update/delete settings.
DROP POLICY IF EXISTS site_settings_admin_write ON site_settings;
CREATE POLICY site_settings_admin_write
  ON site_settings FOR ALL
  USING     ((SELECT auth.email()) = 'bhaveshv918@gmail.com')
  WITH CHECK ((SELECT auth.email()) = 'bhaveshv918@gmail.com');

-- Seed the mobile menu style with the current default (7 = top tile grid).
INSERT INTO site_settings (key, value)
VALUES ('mobile_menu_style', '7')
ON CONFLICT (key) DO NOTHING;
