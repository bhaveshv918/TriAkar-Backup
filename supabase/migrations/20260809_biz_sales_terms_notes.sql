-- Invoice's own Terms & Conditions field, same column name and purpose as
-- biz_quotations.terms_notes but for orders (biz_sales), so Invoice can print its
-- own Terms & Conditions independent of the internal Order Notes field. Safe,
-- additive. Run once in Supabase SQL Editor.

ALTER TABLE biz_sales ADD COLUMN IF NOT EXISTS terms_notes TEXT;
