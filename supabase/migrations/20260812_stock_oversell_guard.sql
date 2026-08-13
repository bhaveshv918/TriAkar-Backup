-- ════════════════════════════════════════════════════════════════════════════════
-- Stock oversell guard.
--
-- decrement_stock previously did `stock_qty = GREATEST(0, stock_qty - p_qty)` with no
-- signal back to the caller when p_qty exceeded stock_qty. Two customers buying the
-- last unit at the same time can both pass the pre-payment stock check in
-- paymentController.createOrder, both complete Razorpay payment, and both land here in
-- verifyPayment — the second decrement just clamps to 0 silently. Since the payment is
-- already captured at this point the order cannot be un-confirmed automatically; the
-- fix is to surface the oversell so an admin can resolve it (refund or backorder),
-- not to pretend it did not happen.
-- ════════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS stock_oversold BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.decrement_stock(p_product_id UUID, p_qty INTEGER)
RETURNS BOOLEAN AS $$
DECLARE v_before INTEGER;
BEGIN
  -- Row-lock the product first so concurrent decrements for the same product serialize
  -- and each sees the other's result, rather than both reading the same stale stock_qty.
  SELECT stock_qty INTO v_before FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF v_before IS NULL THEN
    RETURN false; -- no matching product row; treat as "not enough" so the caller flags it
  END IF;
  UPDATE public.products
  SET stock_qty = GREATEST(0, stock_qty - p_qty)
  WHERE id = p_product_id;
  RETURN v_before >= p_qty;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION public.decrement_stock(UUID, INTEGER) FROM PUBLIC;


-- ════════════════════════════════════════════════════════════════════════════════
-- Stock restoration on cancel/return/refund.
--
-- Nothing anywhere restored products.stock_qty when a paid order was cancelled or
-- returned; decrement_stock only ever subtracted. Every return permanently lost that
-- unit from sellable stock. stock_restored guards against restoring the same order's
-- units twice if it moves through more than one of the restoring statuses.
-- ════════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS stock_restored BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.restock_product(p_product_id UUID, p_qty INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE public.products
  SET stock_qty = stock_qty + p_qty
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION public.restock_product(UUID, INTEGER) FROM PUBLIC;
