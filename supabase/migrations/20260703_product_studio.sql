-- TriAkar — Product Studio: dynamic custom fields + AI image-prompt generator.
-- Date: 2026-07-03
--
-- Adds structured dimension + primary color fields (used by the prompt engine's
-- size-shot and hero-shot templates) and a free-form custom_attributes JSONB
-- column on products, so a new per-category field never needs a schema migration.
--
-- custom_field_definitions and product_prompt_history are admin-only internal
-- tool tables — RLS enabled with NO policies, same pattern as admin_activity,
-- read/written only by the service-role Express backend (never the browser client).
-- Idempotent.
-- ════════════════════════════════════════════════════════════════════════════════

ALTER TABLE products ADD COLUMN IF NOT EXISTS primary_color TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS dim_length NUMERIC(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS dim_width  NUMERIC(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS dim_height NUMERIC(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS dim_unit   TEXT DEFAULT 'cm'
  CHECK (dim_unit IN ('cm','mm','inch'));
ALTER TABLE products ADD COLUMN IF NOT EXISTS custom_attributes JSONB DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.custom_field_definitions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category     TEXT NOT NULL,          -- product category, or 'all' for every category
  field_key    TEXT NOT NULL,          -- machine key, stored inside products.custom_attributes
  field_label  TEXT NOT NULL,
  field_type   TEXT NOT NULL CHECK (field_type IN ('text','number','dropdown','multi-select')),
  field_options JSONB,                 -- ["Option A","Option B"] for dropdown / multi-select
  is_active    BOOLEAN NOT NULL DEFAULT true,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category, field_key)
);

ALTER TABLE public.custom_field_definitions ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies → only the service-role backend can read/write it.

CREATE TABLE IF NOT EXISTS public.product_prompt_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  prompts         JSONB NOT NULL,      -- {hero, angle45, feature_callout, lifestyle, scale_line, scale_iphone}
  source_snapshot JSONB,               -- product field values used to generate, for audit/diff
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID
);

CREATE INDEX IF NOT EXISTS idx_product_prompt_history_product
  ON public.product_prompt_history (product_id, created_at DESC);

ALTER TABLE public.product_prompt_history ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies → only the service-role backend can read/write it.
