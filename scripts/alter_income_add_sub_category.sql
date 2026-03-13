-- Add sub_category to income table for budget hierarchy
ALTER TABLE income ADD COLUMN IF NOT EXISTS sub_category TEXT;
