-- Every priced Instant Quote gets a customer-facing reference number
-- (e.g. IQ-20260816-4821), shown on the quote itself and carried into the
-- cart, so a buyer has something concrete to reference/screenshot before
-- an order even exists yet.
ALTER TABLE instant_quote_requests ADD COLUMN IF NOT EXISTS quote_number TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS instant_quote_requests_quote_number_idx ON instant_quote_requests(quote_number);
