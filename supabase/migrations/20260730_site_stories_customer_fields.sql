-- TriAkar — Stories CMS: customer name, location and photo
--
-- stories.html currently shows an anonymous excerpt with no face and no name, so it reads
-- like marketing copy rather than a real order. Adding a customer name, city and photo per
-- story makes the "real orders, real people" promise on the page verifiable, same trust
-- signal reviews.html already gets from reviewer_name + city.
--
-- image_url already exists on site_stories (added in 20260710_site_stories.sql) and is
-- already wired through the public API select and the admin editor; this migration only
-- adds the two new customer-attribution columns and backfills names/cities that are
-- already mentioned in the existing seed stories' full_text, so the live page reads
-- correctly the moment this is run, no admin re-entry needed.
--
-- Safe, additive. Run once in Supabase SQL Editor.

ALTER TABLE site_stories ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE site_stories ADD COLUMN IF NOT EXISTS customer_location TEXT;

-- Backfill the 12 seed stories with the name/city already named in their full_text.
-- Matched by title so this is safe to run whether or not the row was later edited in
-- admin, and a no-op if the title was changed away from the seeded value.
UPDATE site_stories SET customer_name='Rajesh', customer_location='Pune'
  WHERE title='A 23-year-old Maruti bracket, found nowhere in India' AND customer_name IS NULL;
UPDATE site_stories SET customer_location='Jaipur'
  WHERE title='200 ring holders for a Jaipur wedding, all with custom initials' AND customer_location IS NULL;
UPDATE site_stories SET customer_location='Bengaluru'
  WHERE title='80 nameplates for a Bengaluru tech company office launch' AND customer_location IS NULL;
UPDATE site_stories SET customer_name='Neha'
  WHERE title='Mixer grinder knob, spare not sold separately anywhere' AND customer_name IS NULL;
