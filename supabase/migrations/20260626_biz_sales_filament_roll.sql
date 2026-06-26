-- Round-2 #9 — link an Add-Sale line to the filament roll it consumed.
-- Logging grams on a line then deducts from that roll's stock, and binning the
-- sale restores it. Without this column, sales still save (the app strips it and
-- retries) but the roll link/deduction won't persist — so run this to enable it.

ALTER TABLE biz_sales
  ADD COLUMN IF NOT EXISTS filament_roll_id UUID
  REFERENCES biz_filament_rolls(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_biz_sales_filament_roll
  ON biz_sales(filament_roll_id);
