-- biz_sales: safety-net defaults so a row can never be rejected for a missing
-- product name or price. The Flipkart/Amazon/generic CSV importers already
-- send 'Unknown' / 0 when a source column is blank; this makes the same rule
-- hold at the database level for any direct insert (manual entry, historical
-- SQL imports) that omits these columns.

ALTER TABLE biz_sales ALTER COLUMN product_name SET DEFAULT 'Unknown';
ALTER TABLE biz_sales ALTER COLUMN selling_price SET DEFAULT 0;

-- One-time cleanup: normalize any existing rows that were stored with the
-- old placeholder dash or a blank name before this fix.
UPDATE biz_sales
SET product_name = 'Unknown'
WHERE product_name IS NULL OR trim(product_name) IN ('', '-', '—');
