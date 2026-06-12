-- TriAkar Business OS — Full schema
-- Run in Supabase SQL Editor
-- 2026-06-13

-- ── Channels ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biz_channels (
  id          TEXT PRIMARY KEY,   -- 'shop','amazon','flipkart','website'
  name        TEXT NOT NULL,
  color       TEXT DEFAULT '#888',
  platform_fee_pct  NUMERIC(5,2) DEFAULT 0,  -- % commission the platform takes
  created_at  TIMESTAMPTZ DEFAULT now()
);

INSERT INTO biz_channels (id, name, color, platform_fee_pct) VALUES
  ('shop',     'Shop / Offline', '#a78bfa', 0),
  ('amazon',   'Amazon',         '#f59e0b', 15),
  ('flipkart', 'Flipkart',       '#3b82f6', 13),
  ('website',  'Website',        '#10b981', 2)
ON CONFLICT (id) DO NOTHING;

-- ── Products with cost tracking ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biz_products (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku          TEXT UNIQUE,
  name         TEXT NOT NULL,
  category     TEXT,
  product_type TEXT NOT NULL DEFAULT 'own'
                CHECK (product_type IN ('job_work','readymade','own')),
  -- job_work: someone makes it, you pay per piece rate
  -- readymade: you buy finished goods
  -- own: you 3D print it yourself
  base_cost    NUMERIC(10,2) DEFAULT 0,   -- what you pay/spend to get 1 unit
  gst_rate     NUMERIC(5,2)  DEFAULT 18,  -- GST % on this product
  hsn_code     TEXT,
  is_active    BOOLEAN DEFAULT true,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ── Sales entries (all channels unified) ────────────────────────────────
CREATE TABLE IF NOT EXISTS biz_sales (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id      TEXT REFERENCES biz_channels(id),
  order_id        TEXT,                -- platform order ID
  order_date      DATE NOT NULL,
  -- Customer
  customer_name   TEXT,
  customer_city   TEXT,
  customer_state  TEXT,
  customer_pincode TEXT,
  -- Product (either linked or free-text for imports)
  product_id      UUID REFERENCES biz_products(id),
  product_name    TEXT NOT NULL,       -- denormalized so imports always work
  sku             TEXT,
  qty             INTEGER NOT NULL DEFAULT 1,
  -- Money (all in INR, GST-inclusive selling price)
  selling_price   NUMERIC(10,2) NOT NULL,   -- what customer paid incl. GST
  platform_fee    NUMERIC(10,2) DEFAULT 0,  -- commission/TCS deducted
  shipping_fee    NUMERIC(10,2) DEFAULT 0,  -- outward shipping cost you paid
  other_deductions NUMERIC(10,2) DEFAULT 0,
  cogs            NUMERIC(10,2) DEFAULT 0,  -- cost of goods for this line
  -- GST
  gst_rate        NUMERIC(5,2)  DEFAULT 18,
  -- Status
  status          TEXT DEFAULT 'completed'
                  CHECK (status IN ('completed','returned','cancelled','claimed')),
  payment_mode    TEXT,               -- cash/upi/card/online (for shop sales)
  notes           TEXT,
  -- Import tracking
  import_source   TEXT DEFAULT 'manual',  -- manual/amazon_csv/flipkart_csv/label
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── Returns, cancellations, SPF/A-to-Z claims ──────────────────────────
CREATE TABLE IF NOT EXISTS biz_returns (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id      UUID REFERENCES biz_sales(id) ON DELETE SET NULL,
  channel_id   TEXT REFERENCES biz_channels(id),
  order_id     TEXT,
  type         TEXT NOT NULL
               CHECK (type IN ('return','cancellation','spf_claim','az_claim','chargeback','other')),
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  amount_lost  NUMERIC(10,2) DEFAULT 0,   -- revenue lost
  refund_given NUMERIC(10,2) DEFAULT 0,   -- what you refunded
  status       TEXT DEFAULT 'pending'
               CHECK (status IN ('pending','won','lost','partial')),
  reason       TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ── Stock movements ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biz_stock_movements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID REFERENCES biz_products(id),
  movement_type TEXT NOT NULL
                CHECK (movement_type IN ('purchase','production','sale','return','adjustment','damage')),
  qty           INTEGER NOT NULL,         -- positive = in, negative = out
  unit_cost     NUMERIC(10,2),
  reference_id  TEXT,                     -- order ID, PO number, etc.
  notes         TEXT,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── Indexes ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS biz_sales_order_date_idx   ON biz_sales (order_date DESC);
CREATE INDEX IF NOT EXISTS biz_sales_channel_idx      ON biz_sales (channel_id);
CREATE INDEX IF NOT EXISTS biz_sales_status_idx       ON biz_sales (status);
CREATE INDEX IF NOT EXISTS biz_returns_channel_idx    ON biz_returns (channel_id);
CREATE INDEX IF NOT EXISTS biz_stock_product_idx      ON biz_stock_movements (product_id);

-- ── RLS — admin-only access ────────────────────────────────────────────
ALTER TABLE biz_channels         ENABLE ROW LEVEL SECURITY;
ALTER TABLE biz_products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE biz_sales            ENABLE ROW LEVEL SECURITY;
ALTER TABLE biz_returns          ENABLE ROW LEVEL SECURITY;
ALTER TABLE biz_stock_movements  ENABLE ROW LEVEL SECURITY;

-- Only the admin email can read/write business data
CREATE POLICY "biz_admin_only_channels"  ON biz_channels        FOR ALL TO authenticated USING (auth.email()='bhaveshv918@gmail.com') WITH CHECK (auth.email()='bhaveshv918@gmail.com');
CREATE POLICY "biz_admin_only_products"  ON biz_products        FOR ALL TO authenticated USING (auth.email()='bhaveshv918@gmail.com') WITH CHECK (auth.email()='bhaveshv918@gmail.com');
CREATE POLICY "biz_admin_only_sales"     ON biz_sales           FOR ALL TO authenticated USING (auth.email()='bhaveshv918@gmail.com') WITH CHECK (auth.email()='bhaveshv918@gmail.com');
CREATE POLICY "biz_admin_only_returns"   ON biz_returns         FOR ALL TO authenticated USING (auth.email()='bhaveshv918@gmail.com') WITH CHECK (auth.email()='bhaveshv918@gmail.com');
CREATE POLICY "biz_admin_only_stock"     ON biz_stock_movements FOR ALL TO authenticated USING (auth.email()='bhaveshv918@gmail.com') WITH CHECK (auth.email()='bhaveshv918@gmail.com');

-- ── Computed view: current stock per product ───────────────────────────
CREATE OR REPLACE VIEW biz_stock_current AS
SELECT
  p.id, p.sku, p.name, p.category, p.product_type, p.base_cost,
  COALESCE(SUM(m.qty), 0) AS stock_qty
FROM biz_products p
LEFT JOIN biz_stock_movements m ON m.product_id = p.id
WHERE p.is_active = true
GROUP BY p.id, p.sku, p.name, p.category, p.product_type, p.base_cost;

-- ── Computed view: P&L per sale ────────────────────────────────────────
CREATE OR REPLACE VIEW biz_pnl AS
SELECT
  s.id, s.order_date, s.channel_id, s.product_name, s.sku, s.qty,
  s.status, s.customer_state,
  s.selling_price,
  -- GST component backed out from selling price (GST-inclusive)
  ROUND(s.selling_price - (s.selling_price / (1 + s.gst_rate/100)), 2) AS gst_amount,
  ROUND(s.selling_price / (1 + s.gst_rate/100), 2) AS base_price,
  s.platform_fee,
  s.shipping_fee,
  s.other_deductions,
  s.cogs,
  -- Net revenue = selling price - platform fee - shipping - other
  ROUND(s.selling_price - s.platform_fee - s.shipping_fee - s.other_deductions, 2) AS net_revenue,
  -- Gross profit = net revenue - COGS - GST portion
  ROUND(
    s.selling_price - s.platform_fee - s.shipping_fee - s.other_deductions
    - s.cogs
    - (s.selling_price - (s.selling_price / (1 + s.gst_rate/100))),
    2
  ) AS gross_profit
FROM biz_sales s
WHERE s.status = 'completed';
