-- The 20260607 security-lint-fixes migration tightened public form INSERT
-- policies to `TO anon` only, to satisfy the Supabase linter's "RLS Policy
-- Always True" warning. That silently broke every public form (contact,
-- custom order enquiry, corporate quote, callback request) for logged-in
-- customers: TriAkar has no guest checkout, so a real customer submitting
-- any of these forms holds an `authenticated` session, not `anon`, and the
-- INSERT was rejected by RLS with no useful error surfaced to the UI beyond
-- "Something went wrong".
--
-- Re-open these INSERT policies to both anon and authenticated. The
-- "Always True" lint warning returns, and that is the correct tradeoff:
-- these are public lead-capture forms, not authenticated-only resources.

DROP POLICY IF EXISTS "contact_anon_insert" ON public.contact_submissions;
CREATE POLICY "contact_public_insert" ON public.contact_submissions
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "corporate_anon_insert" ON public.corporate_inquiries;
CREATE POLICY "corporate_public_insert" ON public.corporate_inquiries
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "custom_enquiry_anon_insert" ON public.custom_enquiries;
CREATE POLICY "custom_enquiry_public_insert" ON public.custom_enquiries
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "callback_anon_insert" ON public.callback_requests;
CREATE POLICY "callback_public_insert" ON public.callback_requests
  FOR INSERT TO anon, authenticated WITH CHECK (true);
