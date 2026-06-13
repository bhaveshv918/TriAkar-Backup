-- Soft delete for biz_sales
ALTER TABLE biz_sales ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE biz_sales ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS biz_sales_deleted_idx ON biz_sales (is_deleted);
