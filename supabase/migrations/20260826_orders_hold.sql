-- Hold state for orders waiting on a customer (Instant Quote queue first, but the
-- columns are on `orders` so any order can use them later).
--
-- Why columns and not another order_status value: an order on hold has not moved
-- anywhere in its lifecycle, it is still exactly where it was (for Instant Quotes,
-- quote_pending_confirmation) and must come back to that same place when the
-- customer replies or pays. Encoding it as a status would have meant inventing a
-- status the customer-facing order pages, the emails, and the biz_sales sync all
-- have to learn, and losing the original one on the way back.
--
--   hold_at          set when it goes on hold, cleared when it comes back
--   hold_released_at last time it was taken off hold, this is what stops the
--                    automatic "unpaid for 7 days" rule from instantly re-holding
--                    an order the admin deliberately pulled back out
--   hold_reason      free text, e.g. 'No payment 7 days after the order was placed'
--
-- Safe, additive. Run once in the Supabase SQL Editor.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS hold_at          TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS hold_released_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS hold_reason      TEXT;

-- The admin queue reads "everything currently on hold" on every load.
CREATE INDEX IF NOT EXISTS orders_hold_at_idx ON orders(hold_at) WHERE hold_at IS NOT NULL;

COMMENT ON COLUMN orders.hold_at IS 'Set while the order is parked waiting on the customer. NULL means not on hold. The order keeps its real order_status throughout.';
COMMENT ON COLUMN orders.hold_released_at IS 'When it was last brought back off hold. Suppresses the automatic unpaid-for-7-days hold so a released order does not bounce straight back.';
COMMENT ON COLUMN orders.hold_reason IS 'Why it went on hold, shown in the admin On Hold list.';
