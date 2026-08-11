-- Per-month budget overrides: months without a row use the active budget.
CREATE TABLE IF NOT EXISTS budget_month_assignments (
    assignment_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    group_id INTEGER REFERENCES groups(group_id) ON DELETE SET NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    budget_id INTEGER NOT NULL REFERENCES budgets(budget_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT budget_month_assignments_year_check CHECK (year >= 2000 AND year <= 2100),
    CONSTRAINT budget_month_assignments_month_check CHECK (month >= 1 AND month <= 12)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_month_assignments_solo
  ON budget_month_assignments (user_id, year, month)
  WHERE group_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_month_assignments_group
  ON budget_month_assignments (group_id, year, month)
  WHERE group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_budget_month_assignments_budget
  ON budget_month_assignments(budget_id);

CREATE INDEX IF NOT EXISTS idx_budget_month_assignments_user
  ON budget_month_assignments(user_id);

CREATE INDEX IF NOT EXISTS idx_budget_month_assignments_group
  ON budget_month_assignments(group_id) WHERE group_id IS NOT NULL;
