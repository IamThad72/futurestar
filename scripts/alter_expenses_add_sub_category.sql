-- Add sub_category to expenses table for budget hierarchy
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS sub_category TEXT;
