-- TriAkar — Stories CMS: individual blog-post pages
--
-- stories.html showed every story as a card that opened a popup on the same page, no
-- unique URL, nothing for Google to index per story. This adds a slug so each story gets
-- its own real page (story.html?slug=..., rewritten to /stories/:slug), which is the SEO
-- upgrade real customer stories deserve: their own indexable, shareable URL and their own
-- meta/schema, same as product-detail.html already does per product.
--
-- Backend generates and uniques the slug on create/edit (see storyController.js), this
-- migration only adds the column/index and backfills the 12 seed stories with the exact
-- slugs the same slugify() function would produce, so existing links match immediately.
--
-- Safe, additive. Run once in Supabase SQL Editor, after 20260730_site_stories_customer_fields.sql.

ALTER TABLE site_stories ADD COLUMN IF NOT EXISTS slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS site_stories_slug_uidx ON site_stories(slug);

UPDATE site_stories SET slug='a-23-year-old-maruti-bracket-found-nowhere-in-india'
  WHERE title='A 23-year-old Maruti bracket, found nowhere in India' AND slug IS NULL;
UPDATE site_stories SET slug='200-ring-holders-for-a-jaipur-wedding-all-with-custom-initials'
  WHERE title='200 ring holders for a Jaipur wedding, all with custom initials' AND slug IS NULL;
UPDATE site_stories SET slug='80-nameplates-for-a-bengaluru-tech-company-office-launch'
  WHERE title='80 nameplates for a Bengaluru tech company office launch' AND slug IS NULL;
UPDATE site_stories SET slug='mixer-grinder-knob-spare-not-sold-separately-anywhere'
  WHERE title='Mixer grinder knob, spare not sold separately anywhere' AND slug IS NULL;
UPDATE site_stories SET slug='40-personalised-keychains-for-a-40th-birthday-every-message-different'
  WHERE title='40 personalised keychains for a 40th birthday, every message different' AND slug IS NULL;
UPDATE site_stories SET slug='a-custom-nameplate-with-devanagari-script-for-a-teachers-farewell'
  WHERE title='A custom nameplate with Devanagari script for a teacher''s farewell' AND slug IS NULL;
UPDATE site_stories SET slug='geometric-vase-set-designed-from-a-pinterest-screenshot'
  WHERE title='Geometric vase set designed from a Pinterest screenshot' AND slug IS NULL;
UPDATE site_stories SET slug='150-diwali-gift-boxes-with-custom-shubh-diwali-engravings'
  WHERE title='150 Diwali gift boxes with custom Shubh Diwali engravings' AND slug IS NULL;
UPDATE site_stories SET slug='custom-alphabet-blocks-for-a-child-with-a-rare-name'
  WHERE title='Custom alphabet blocks for a child with a rare name' AND slug IS NULL;
UPDATE site_stories SET slug='branded-cable-clips-for-a-coworking-space-300-pieces'
  WHERE title='Branded cable clips for a coworking space, 300 pieces' AND slug IS NULL;
UPDATE site_stories SET slug='refrigerator-shelf-bracket-for-a-9-year-old-appliance-no-spare-sold'
  WHERE title='Refrigerator shelf bracket for a 9-year-old appliance, no spare sold' AND slug IS NULL;
UPDATE site_stories SET slug='50-personalized-christmas-ornaments-for-a-school'
  WHERE title='50 personalized Christmas ornaments for a school' AND slug IS NULL;

-- Any other rows (added via admin before this migration ran) fall back to an id-based
-- slug so the unique index above can be created without failing on NULLs.
UPDATE site_stories SET slug='story-'||substr(id::text,1,8) WHERE slug IS NULL;
