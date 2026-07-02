-- TriAkar — Round 3 §2.7: Delivery Rejection + In-Transit Cancellation as distinct
-- return scenarios, plus explicit unit condition capture (reusable/damaged/lost).
--
-- Delivery Rejection (customer refuses at the door — comes back without ever being
-- delivered) and In-Transit Cancellation (cancelled after dispatch, before delivery
-- attempt — courier brings it back) both skip return-shipping-cost (the courier already
-- returns it as part of the failed delivery, at no extra cost to us) but still need the
-- unit's condition captured on return. 'cancellation' already existed for in-transit
-- cancel; this adds the missing 'delivery_rejection' type.
--
-- Idempotent — safe to run multiple times.
-- ════════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.biz_returns'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%type%IN%'
  LOOP
    EXECUTE 'ALTER TABLE public.biz_returns DROP CONSTRAINT ' || quote_ident(c.conname);
  END LOOP;
END $$;

ALTER TABLE public.biz_returns ADD CONSTRAINT biz_returns_type_check
  CHECK (type IN ('return','cancellation','delivery_rejection','spf_claim','az_claim','chargeback','other'));

ALTER TABLE public.biz_returns ADD COLUMN IF NOT EXISTS unit_condition TEXT
  CHECK (unit_condition IN ('reusable','damaged','lost'));

-- Optional distinct pickup-done date, separate from the 'returning' stage's own timestamp
-- (§2.7 stage 2: Pickup Scheduled / Pickup Done — Yes/No/Pending).
ALTER TABLE public.biz_returns ADD COLUMN IF NOT EXISTS pickup_date DATE;

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
-- INSERT INTO biz_returns(channel_id,type,unit_condition) VALUES('shop','delivery_rejection','reusable'); -- should succeed
-- ════════════════════════════════════════════════════════════════════════════════
