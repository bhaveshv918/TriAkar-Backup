-- TriAkar — restore admin UPDATE on orders so the Recycle Bin works
-- 2026-06-14
-- The 2026-06-07 security migration dropped "Admin can update orders" and only
-- re-added orders_select_own. Without an admin UPDATE policy, moving an order
-- to the Recycle Bin (setting deleted_at) or restoring it is silently blocked
-- by RLS (0 rows changed, no error). This restores admin update access,
-- scoped to the admin account only. Backend keeps using service_role.

DROP POLICY IF EXISTS orders_update_admin ON public.orders;
CREATE POLICY orders_update_admin ON public.orders
  FOR UPDATE TO authenticated
  USING     ((SELECT auth.email()) = 'bhaveshv918@gmail.com')
  WITH CHECK ((SELECT auth.email()) = 'bhaveshv918@gmail.com');
