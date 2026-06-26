-- TriAkar Business OS — private Storage bucket for expense invoices (B17)
-- 2026-06-26. Run once in Supabase SQL Editor.
-- (You can also create the bucket in Dashboard → Storage; this does it via SQL.)

INSERT INTO storage.buckets (id, name, public)
VALUES ('biz-invoices', 'biz-invoices', false)
ON CONFLICT (id) DO NOTHING;

-- Admin-only access to objects in this bucket (upload + read + delete).
DROP POLICY IF EXISTS "biz_invoices_admin_all" ON storage.objects;
CREATE POLICY "biz_invoices_admin_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'biz-invoices' AND auth.email() = 'bhaveshv918@gmail.com')
  WITH CHECK (bucket_id = 'biz-invoices' AND auth.email() = 'bhaveshv918@gmail.com');
