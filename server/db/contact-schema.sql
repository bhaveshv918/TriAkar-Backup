-- TriAkar: contact_submissions table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS contact_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (frontend contact form)
CREATE POLICY "Allow anonymous inserts"
  ON contact_submissions
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anonymous reads (for admin panel — uses anon key)
CREATE POLICY "Allow anonymous reads"
  ON contact_submissions
  FOR SELECT
  TO anon
  USING (true);

-- Index for admin listing (newest first)
CREATE INDEX IF NOT EXISTS idx_contact_submissions_created
  ON contact_submissions (created_at DESC);
