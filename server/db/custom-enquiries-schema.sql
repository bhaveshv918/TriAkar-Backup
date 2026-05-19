-- custom_enquiries table for TriAkar custom order form
-- Stores enquiries submitted via the Custom 3D Printing page

CREATE TABLE IF NOT EXISTS custom_enquiries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reference_id TEXT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  what_needed TEXT NOT NULL,
  material_preference TEXT,
  budget_range TEXT,
  source TEXT DEFAULT 'custom_order',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── MIGRATION (run this if the table already exists without the new columns) ──
ALTER TABLE custom_enquiries ADD COLUMN IF NOT EXISTS reference_id TEXT;
ALTER TABLE custom_enquiries ADD COLUMN IF NOT EXISTS material_preference TEXT;
ALTER TABLE custom_enquiries ADD COLUMN IF NOT EXISTS budget_range TEXT;
ALTER TABLE custom_enquiries ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'custom_order';
ALTER TABLE custom_enquiries ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- Enable RLS
ALTER TABLE custom_enquiries ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (from the custom order form)
CREATE POLICY "Allow anonymous inserts" ON custom_enquiries
  FOR INSERT WITH CHECK (true);

-- Only authenticated admin users can read enquiries
CREATE POLICY "Admin can read enquiries" ON custom_enquiries
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only authenticated admin users can update (mark as read)
CREATE POLICY "Admin can update enquiries" ON custom_enquiries
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Index for faster admin queries
CREATE INDEX IF NOT EXISTS idx_custom_enquiries_created_at
  ON custom_enquiries (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_custom_enquiries_is_read
  ON custom_enquiries (is_read);

CREATE INDEX IF NOT EXISTS idx_custom_enquiries_reference_id
  ON custom_enquiries (reference_id);
