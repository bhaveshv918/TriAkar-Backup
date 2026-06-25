-- TriAkar Business OS — Filament / Material inventory + waste (5.5)
-- 2026-06-25. Safe, additive. Run once in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS biz_filament_rolls (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  color         TEXT NOT NULL,
  material      TEXT NOT NULL DEFAULT 'PLA+',
  supplier      TEXT,
  total_grams   NUMERIC(10,2) NOT NULL DEFAULT 1000,  -- rated grams of the roll
  grams_used    NUMERIC(10,2) NOT NULL DEFAULT 0,     -- consumed so far
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','empty','archived')),
  is_running    BOOLEAN DEFAULT false,  -- "running colour" (black/white...) for min-stock alerts
  packed        BOOLEAN DEFAULT false,
  waste_grams   NUMERIC(10,2) DEFAULT 0,  -- set on Mark Empty = total - used
  opened_date   DATE DEFAULT CURRENT_DATE,
  finished_date DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS biz_filament_color_idx ON biz_filament_rolls(color, material);

ALTER TABLE biz_filament_rolls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "biz_admin_only_filament" ON biz_filament_rolls
  FOR ALL TO authenticated
  USING (auth.email()='bhaveshv918@gmail.com')
  WITH CHECK (auth.email()='bhaveshv918@gmail.com');

-- Settings keys used by 5.5 (stored in site_settings, no schema needed):
--   biz_filament_min_rolls   = min active rolls per running colour before a reorder alert
--   biz_color_suggestions    = JSON { "<filament colour>": "<suggested print colour>" }
