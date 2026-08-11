-- Saved node positions for the Account Map canvas (per user/group)
CREATE TABLE IF NOT EXISTS account_map_layouts (
    layout_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    group_id INTEGER REFERENCES groups(group_id) ON DELETE SET NULL,
    layout_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Legacy owner unique index (dropped once budgets exist; see alter_budget_tables_add_budget_id.sql).
-- Do not dedupe by user/group here — multi-budget layouts share owner and are unique on budget_id.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'account_map_layouts' AND column_name = 'budget_id'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_account_map_layouts_owner
      ON account_map_layouts (user_id, COALESCE(group_id, 0));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_account_map_layouts_user
  ON account_map_layouts(user_id);
CREATE INDEX IF NOT EXISTS idx_account_map_layouts_group
  ON account_map_layouts(group_id) WHERE group_id IS NOT NULL;
