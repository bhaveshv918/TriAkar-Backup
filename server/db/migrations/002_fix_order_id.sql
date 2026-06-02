-- ══════════════════════════════════════════════════════════════
-- Migration 002: Replace TAINV invoice format with TRK format
-- Run in Supabase SQL Editor (safe to run multiple times).
-- ══════════════════════════════════════════════════════════════

-- 1. Replace trigger function: use order_id (TRK) if set, else generate TRK format
CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS trigger AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    IF NEW.order_id IS NOT NULL THEN
      NEW.invoice_number := NEW.order_id;
    ELSE
      NEW.invoice_number := 'TRK-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-'
        || LPAD((FLOOR(RANDOM() * 9000 + 1000))::TEXT, 4, '0');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Backfill existing TAINV rows: set invoice_number = order_id where order_id is TRK format
UPDATE orders
SET invoice_number = order_id
WHERE order_id LIKE 'TRK-%'
  AND (invoice_number LIKE 'TAINV%' OR invoice_number IS NULL);

-- 3. Update track_order_by_invoice to also search by order_id
CREATE OR REPLACE FUNCTION track_order_by_invoice(inv_number TEXT)
RETURNS JSON AS $$
  SELECT json_build_object(
    'found', true,
    'invoice_number', COALESCE(o.order_id, o.invoice_number),
    'order_id',       o.order_id,
    'status',         COALESCE(o.order_status, o.status),
    'total_amount',   o.total_amount,
    'tracking_number', o.tracking_number,
    'tracking_vendor', o.tracking_vendor,
    'created_at',     o.created_at,
    'items', COALESCE((
      SELECT json_agg(json_build_object('name', p.name, 'quantity', oi.quantity, 'unit_price', oi.unit_price))
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = o.id
    ), '[]'::json)
  )
  FROM orders o
  WHERE UPPER(TRIM(o.order_id))       = UPPER(TRIM(inv_number))
     OR UPPER(TRIM(o.invoice_number)) = UPPER(TRIM(inv_number))
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Add max_discount_amount to promo_codes (for percentage caps like "10% off, max ₹500")
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS max_discount_amount NUMERIC(10,2);
