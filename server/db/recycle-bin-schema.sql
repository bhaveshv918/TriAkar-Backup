-- TriAkar: Recycle Bin (soft delete) for the admin panel
-- Run this in the Supabase SQL Editor.
-- Adds deleted_at + deleted_by to the request/order tables so the admin can
-- move items to a Recycle Bin (recoverable) and permanently delete from there.

-- ── 1. Soft-delete columns ──────────────────────────────────────────
ALTER TABLE public.contact_submissions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.contact_submissions ADD COLUMN IF NOT EXISTS deleted_by TEXT;

ALTER TABLE public.custom_enquiries    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.custom_enquiries    ADD COLUMN IF NOT EXISTS deleted_by TEXT;

ALTER TABLE public.callback_requests   ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.callback_requests   ADD COLUMN IF NOT EXISTS deleted_by TEXT;

ALTER TABLE public.orders              ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.orders              ADD COLUMN IF NOT EXISTS deleted_by TEXT;

-- ── 2. Indexes for fast filtering (active vs binned) ────────────────
CREATE INDEX IF NOT EXISTS idx_contact_deleted_at  ON public.contact_submissions (deleted_at);
CREATE INDEX IF NOT EXISTS idx_enquiry_deleted_at  ON public.custom_enquiries (deleted_at);
CREATE INDEX IF NOT EXISTS idx_callback_deleted_at ON public.callback_requests (deleted_at);
CREATE INDEX IF NOT EXISTS idx_orders_deleted_at   ON public.orders (deleted_at);

-- ── 3. Allow the authenticated admin to permanently DELETE rows ─────
-- (UPDATE for soft-delete/restore is already covered by existing policies.)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contact_submissions' AND policyname='Admin can delete messages') THEN
    CREATE POLICY "Admin can delete messages" ON public.contact_submissions FOR DELETE USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='custom_enquiries' AND policyname='Admin can delete enquiries') THEN
    CREATE POLICY "Admin can delete enquiries" ON public.custom_enquiries FOR DELETE USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='callback_requests' AND policyname='Admin can delete callbacks') THEN
    CREATE POLICY "Admin can delete callbacks" ON public.callback_requests FOR DELETE USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- Note: orders are kept (soft-deleted only) — no hard DELETE policy added,
-- so financial records are never truly destroyed, only hidden in the bin.
