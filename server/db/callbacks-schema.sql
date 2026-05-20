-- callback_requests table for TriAkar callback requests
-- Stores callback requests from customers who want to be called back

CREATE TABLE IF NOT EXISTS callback_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reference_id TEXT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  topic TEXT,
  preferred_time TEXT,
  is_called BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── MIGRATION (run this if the table already exists without the new columns) ──
ALTER TABLE callback_requests ADD COLUMN IF NOT EXISTS reference_id TEXT;
ALTER TABLE callback_requests ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE callback_requests ADD COLUMN IF NOT EXISTS preferred_time TEXT;
ALTER TABLE callback_requests ADD COLUMN IF NOT EXISTS is_called BOOLEAN DEFAULT false;

-- Enable RLS
ALTER TABLE callback_requests ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (from the public callback request form)
CREATE POLICY "Allow anonymous inserts" ON callback_requests
  FOR INSERT WITH CHECK (true);

-- Only authenticated admin users can read callback requests
CREATE POLICY "Admin can read callbacks" ON callback_requests
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only authenticated admin users can update (mark as called)
CREATE POLICY "Admin can update callbacks" ON callback_requests
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Indexes for faster admin queries
CREATE INDEX IF NOT EXISTS idx_callback_requests_created_at
  ON callback_requests (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_callback_requests_is_called
  ON callback_requests (is_called);

CREATE INDEX IF NOT EXISTS idx_callback_requests_reference_id
  ON callback_requests (reference_id);
