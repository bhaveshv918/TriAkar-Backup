-- Instant Quote upload/pricing no longer requires login (only checkout
-- does), so a quote row can now be created with no owning user until a
-- logged-in customer adds it to an order and "claims" it.
ALTER TABLE instant_quote_requests ALTER COLUMN user_id DROP NOT NULL;
