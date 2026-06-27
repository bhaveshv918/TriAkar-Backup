-- Store the order time (e.g. "08:10 AM") parsed from the Flipkart/Amazon label's
-- tax-invoice block. order_date stays a DATE; this holds just the clock time as text.
-- Until this runs, insertSalesResilient strips the column and retries, so label
-- imports still save (the time just isn't persisted yet).
ALTER TABLE biz_sales ADD COLUMN IF NOT EXISTS order_time TEXT;
