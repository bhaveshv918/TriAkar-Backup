-- Multi-image gallery support for site_stories. image_url stays as the single
-- cover image (cards on stories.html, OG/twitter tags, JSON-LD) so nothing
-- that already reads image_url breaks. images holds any *additional* gallery
-- photos (0-3 more, so a story can carry 2-4 images total including the
-- cover) shown as a swipeable carousel on the story.html detail page.
ALTER TABLE site_stories
  ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN site_stories.images IS 'Extra gallery images beyond the image_url cover, ordered array of Cloudinary URLs (strings). Mixed orientations expected.';
