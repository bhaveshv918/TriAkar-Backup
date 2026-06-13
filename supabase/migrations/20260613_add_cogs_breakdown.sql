-- Add cogs_breakdown column (was added after initial migration was run)
ALTER TABLE biz_sales ADD COLUMN IF NOT EXISTS cogs_breakdown JSONB;
