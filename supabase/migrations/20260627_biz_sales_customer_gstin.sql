-- Round-2 #7 — store the customer's GSTIN on a sale (entered/autofilled in Add Sale).
-- Until this runs, the app strips the column on insert and retries, so sales still
-- save (the GSTIN just isn't persisted yet).
ALTER TABLE biz_sales ADD COLUMN IF NOT EXISTS customer_gstin TEXT;
