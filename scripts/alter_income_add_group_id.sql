ALTER TABLE income
  ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES groups(group_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_income_group_id ON income(group_id) WHERE group_id IS NOT NULL;
