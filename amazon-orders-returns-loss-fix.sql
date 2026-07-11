-- Fix-up for amazon-orders-2026-05-16-to-06-07-import.sql / amazon-orders-fixup-link-existing.sql.
-- Those scripts booked amount_lost = 999.00 flat (the full selling price) for the 8 orders
-- returned broken/total-loss. That double-counts the loss: the 999 revenue is already excluded
-- from biz_pnl (status='returned' is a non-revenue status), so booking the same 999 again as
-- "loss" overstates it. The real money the seller is out on a total-loss return is what was
-- spent to make and ship the item and never got back: COGS + packing + forward shipping.
-- Amazon's referral fee (platform_fee) is excluded because Amazon refunds it on returns.
--
-- This matches the formula the Returns & Claims edit form already uses (recalcReturn() in
-- admin-biz.html): loss = orig_shipping + return_shipping_cost + orig_packing + orig_product_cost
-- - claim_approved_amount. None of these 8 have a filed/approved claim, so that term is 0, and
-- none had a separate return-shipping charge captured, so that term is 0 too.
--
-- Correct value per order: cogs 160.00 + shipping_fee 53.10 + other_deductions(packing) 0.00
-- = 213.10 (vs the 999.00 currently stored).
--
-- Safe to re-run: scoped to these 8 order_ids, and only overwrites rows still showing the old
-- flat-999 value, so a manually corrected row is never clobbered.

UPDATE biz_returns r
SET orig_product_cost   = COALESCE(r.orig_product_cost, s.cogs),
    orig_shipping       = COALESCE(r.orig_shipping, s.shipping_fee),
    orig_packing         = COALESCE(r.orig_packing, s.other_deductions),
    amount_lost          = ROUND((
        COALESCE(r.orig_product_cost, s.cogs)
      + COALESCE(r.orig_shipping, s.shipping_fee)
      + COALESCE(r.orig_packing, s.other_deductions)
      + COALESCE(r.return_shipping_cost, 0)
      - COALESCE(r.claim_approved_amount, 0)
    )::numeric, 2)
FROM biz_sales s
WHERE r.sale_id = s.id
  AND r.order_id IN (
    '407-0111393-8366724','406-2616992-6163558','406-2737441-1611538','408-0356054-2945162',
    '408-1222195-9104356','403-1993446-9297901','406-0882719-5525938','408-8316311-5881934'
  )
  AND r.amount_lost = 999.00;

-- Sanity check, run after the UPDATE:
-- SELECT order_id, amount_lost, orig_product_cost, orig_shipping, orig_packing, refund_given
-- FROM biz_returns
-- WHERE order_id IN (
--   '407-0111393-8366724','406-2616992-6163558','406-2737441-1611538','408-0356054-2945162',
--   '408-1222195-9104356','403-1993446-9297901','406-0882719-5525938','408-8316311-5881934'
-- )
-- ORDER BY date;
-- Expect amount_lost = 213.10 for all 8 rows.
