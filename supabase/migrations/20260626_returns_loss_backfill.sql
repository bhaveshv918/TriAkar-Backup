-- Round-2 #10 — backfill loss for returns created BEFORE the lifecycle cost
-- snapshots existed (those rows show ₹0 loss). Self-scoping + idempotent:
-- it only touches rows that never captured a snapshot / show no loss, so
-- correct or manually-set values are never clobbered. Safe to re-run.

-- See the scale first (optional):
SELECT count(*) AS needs_backfill FROM biz_returns WHERE orig_product_cost IS NULL;

-- 1) Capture the cost snapshot from the linked sale where it was never set.
UPDATE biz_returns r
SET orig_product_cost = COALESCE(r.orig_product_cost, s.cogs,             0),
    orig_shipping     = COALESCE(r.orig_shipping,     s.shipping_fee,     0),
    orig_packing      = COALESCE(r.orig_packing,      s.other_deductions, 0)
FROM biz_sales s
WHERE r.sale_id = s.id
  AND r.orig_product_cost IS NULL;

-- 2) Recompute amount_lost with the SAME formula the edit form uses:
--    loss = max(0, shipping + return_ship + packing + (adjusted ?? product_cost) − approved_claim)
--    Only fills entries currently showing no loss, preserving any good values.
UPDATE biz_returns
SET amount_lost = GREATEST(0,
        COALESCE(orig_shipping, 0)
      + COALESCE(return_shipping_cost, 0)
      + COALESCE(orig_packing, 0)
      + COALESCE(product_cost_adjusted, orig_product_cost, 0)
      - COALESCE(claim_approved_amount, 0))
WHERE amount_lost IS NULL OR amount_lost = 0;

-- Report any returns still showing zero loss (e.g. no linked sale to pull from):
SELECT count(*) AS still_zero_loss FROM biz_returns WHERE COALESCE(amount_lost, 0) = 0;
