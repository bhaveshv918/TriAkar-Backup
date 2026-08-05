-- printInvoice()/saveQuotation() write quotation_date and promised_date on every
-- save, but biz_quotations never had these columns, so every quotation save/update
-- has been failing with "Could not find the 'quotation_date' column ... schema cache".
ALTER TABLE biz_quotations ADD COLUMN IF NOT EXISTS quotation_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE biz_quotations ADD COLUMN IF NOT EXISTS promised_date DATE;
