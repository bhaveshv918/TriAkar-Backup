-- Add is_paid flag to biz_sales for payment lock feature
ALTER TABLE biz_sales ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false;
