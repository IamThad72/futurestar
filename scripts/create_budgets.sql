-- Named budgets: one active plan per solo user or linked-account group.
CREATE TABLE IF NOT EXISTS budgets (
    budget_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    group_id INTEGER REFERENCES groups(group_id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT budgets_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_name_solo
  ON budgets (user_id, lower(trim(name)))
  WHERE group_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_name_group
  ON budgets (group_id, lower(trim(name)))
  WHERE group_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_one_active_solo
  ON budgets (user_id)
  WHERE is_active AND group_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_one_active_group
  ON budgets (group_id)
  WHERE is_active AND group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_budgets_user ON budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_group ON budgets(group_id) WHERE group_id IS NOT NULL;
