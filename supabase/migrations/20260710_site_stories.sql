-- TriAkar — Round 3 (pending items): Stories CMS
--
-- stories.html was fully static hardcoded HTML with no admin editing at all. This adds a
-- real table so stories can be added/edited from Admin → Site Content, with a Year field
-- (TriAkar is currently ~1 year old but should support future years) and support for more
-- than one story per month (sort_order breaks ties within the same year+month).
--
-- All reads (public storefront AND admin) go through the Express backend using the
-- service-role client, same as `reviews` — so RLS here only needs to gate direct browser
-- access, mirroring the biz_* admin-only policy pattern.
-- Safe, additive. Run once in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS site_stories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year        INT NOT NULL,
  month       INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  sort_order  INT NOT NULL DEFAULT 0,     -- breaks ties when more than one story shares a month
  tag         TEXT NOT NULL DEFAULT 'Other',   -- Replacement Part / Gifting / Corporate / Prototype / Other
  title       TEXT NOT NULL,
  excerpt     TEXT NOT NULL,               -- short line shown on the card
  full_text   TEXT NOT NULL,               -- full story shown in the modal
  image_url   TEXT,
  published   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS site_stories_year_month_idx ON site_stories(year, month, sort_order);

ALTER TABLE site_stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "site_stories_admin_only" ON site_stories;
CREATE POLICY "site_stories_admin_only" ON site_stories
  FOR ALL TO authenticated
  USING (auth.email()='bhaveshv918@gmail.com')
  WITH CHECK (auth.email()='bhaveshv918@gmail.com');

-- Seed the 12 stories currently hardcoded in stories.html, as Year 2026, so the page looks
-- identical on day one and every one of them is immediately editable. Idempotent guard: only
-- inserts if the table is still empty (won't duplicate on repeat runs or after edits).
INSERT INTO site_stories (year, month, sort_order, tag, title, excerpt, full_text)
SELECT * FROM (VALUES
  (2026, 1,  1, 'Replacement Part', 'A 23-year-old Maruti bracket, found nowhere in India', 'Rajesh from Pune had searched every spare parts shop for 8 months.', 'Rajesh from Pune had searched every spare parts shop for 8 months. One photo sent on WhatsApp. We reverse-engineered it and delivered in 4 days.'),
  (2026, 2,  1, 'Gifting', '200 ring holders for a Jaipur wedding, all with custom initials', 'The bride wanted something personal for every guest.', 'The bride wanted something personal for every guest. Custom monogram on every piece. Delivered 10 days before the ceremony.'),
  (2026, 3,  1, 'Corporate', '80 nameplates for a Bengaluru tech company office launch', 'Exact font match. Exact color. Delivered in 10-15 business days.', 'Exact font match. Exact color. Delivered in 10-15 business days. Better than anything they found on Amazon.'),
  (2026, 4,  1, 'Replacement Part', 'Mixer grinder knob, spare not sold separately anywhere', 'Neha''s mixer stopped working because one knob snapped.', 'Neha''s mixer stopped working because one knob snapped. Matched it in 48-72 hours.'),
  (2026, 5,  1, 'Gifting', '40 personalised keychains for a 40th birthday, every message different', 'She wanted every one of the 40 people to receive something written just for them.', 'She was turning 40 and wanted to thank the 40 most important people in her life, not with the same gift, but with a message written just for each person. We made 40 personalised letter keychains. Every single one carried a completely different message. No two were the same.'),
  (2026, 6,  1, 'Gifting', 'A custom nameplate with Devanagari script for a teacher''s farewell', 'Students wanted something no shop could make.', 'Students wanted something no shop could make. Their teacher''s name in Hindi, with the school emblem. Done in 2 days.'),
  (2026, 7,  1, 'Replacement Part', 'Geometric vase set designed from a Pinterest screenshot', 'No measurements. Just a photo.', 'No measurements. Just a photo. We modelled it, printed it in 3 colors.'),
  (2026, 8,  1, 'Gifting', '150 Diwali gift boxes with custom Shubh Diwali engravings', 'A housing society ordered for all their residents.', 'A housing society ordered for all their residents. Ready 3 days before Diwali.'),
  (2026, 9,  1, 'Gifting', 'Custom alphabet blocks for a child with a rare name', 'No shop stocked blocks with her name.', 'No shop stocked blocks with her name. Printed every letter in her favorite color within 48-72 hours.'),
  (2026, 10, 1, 'Corporate', 'Branded cable clips for a coworking space, 300 pieces', 'Every desk had their logo.', 'Every desk had their logo. Delivered in 7 days.'),
  (2026, 11, 1, 'Replacement Part', 'Refrigerator shelf bracket for a 9-year-old appliance, no spare sold', 'Measured from photos, matched the plastic color.', 'Measured from photos, matched the plastic color, delivered in 3 days.'),
  (2026, 12, 1, 'Gifting', '50 personalized Christmas ornaments for a school', 'Each child''s name on their own ornament.', 'Each child''s name on their own ornament. Made and delivered in 4 days.')
) AS seed(year, month, sort_order, tag, title, excerpt, full_text)
WHERE NOT EXISTS (SELECT 1 FROM site_stories);
