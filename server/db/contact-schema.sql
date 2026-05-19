-- contact_submissions table for TriAkar contact form
-- Stores messages submitted via the Contact Us page

CREATE TABLE IF NOT EXISTS contact_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT,
  message TEXT NOT NULL,
  reference_id TEXT,
  is_existing_customer BOOLEAN DEFAULT false,
  order_id TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── MIGRATION (run this if the table already exists without the new columns) ──
ALTER TABLE contact_submissions ADD COLUMN IF NOT EXISTS reference_id TEXT;
ALTER TABLE contact_submissions ADD COLUMN IF NOT EXISTS is_existing_customer BOOLEAN DEFAULT false;
ALTER TABLE contact_submissions ADD COLUMN IF NOT EXISTS order_id TEXT;

-- Enable RLS
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (from the contact form)
CREATE POLICY "Allow anonymous inserts" ON contact_submissions
  FOR INSERT WITH CHECK (true);

-- Only authenticated admin users can read messages
CREATE POLICY "Admin can read messages" ON contact_submissions
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only authenticated admin users can update (mark as read)
CREATE POLICY "Admin can update messages" ON contact_submissions
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Index for faster admin queries
CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at
  ON contact_submissions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_is_read
  ON contact_submissions (is_read);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_reference_id
  ON contact_submissions (reference_id);
