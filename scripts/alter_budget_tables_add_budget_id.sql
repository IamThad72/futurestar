-- Attach income, expenses, and account-map artifacts to named budgets.

ALTER TABLE income ADD COLUMN IF NOT EXISTS budget_id INTEGER REFERENCES budgets(budget_id) ON DELETE CASCADE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS budget_id INTEGER REFERENCES budgets(budget_id) ON DELETE CASCADE;
ALTER TABLE account_map_layouts ADD COLUMN IF NOT EXISTS budget_id INTEGER REFERENCES budgets(budget_id) ON DELETE CASCADE;
ALTER TABLE account_map_edges ADD COLUMN IF NOT EXISTS budget_id INTEGER REFERENCES budgets(budget_id) ON DELETE CASCADE;

-- Main budget for each linked-account group
INSERT INTO budgets (user_id, group_id, name, is_active)
SELECT DISTINCT ON (gm.group_id)
  gm.user_id, gm.group_id, 'Main', TRUE
FROM group_members gm
WHERE NOT EXISTS (
  SELECT 1 FROM budgets b WHERE b.group_id = gm.group_id
)
ORDER BY gm.group_id, gm.created_at ASC;

-- Main budget for solo users (not in any group)
INSERT INTO budgets (user_id, group_id, name, is_active)
SELECT u.user_id, NULL::integer, 'Main', TRUE
FROM app_users u
WHERE NOT EXISTS (SELECT 1 FROM group_members gm WHERE gm.user_id = u.user_id)
  AND NOT EXISTS (
    SELECT 1 FROM budgets b WHERE b.user_id = u.user_id AND b.group_id IS NULL
  );

-- Catch any group owners present on budget rows that still lack a Main budget
INSERT INTO budgets (user_id, group_id, name, is_active)
SELECT DISTINCT ON (i.group_id)
  i.user_id, i.group_id, 'Main', TRUE
FROM income i
WHERE i.group_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM budgets b WHERE b.group_id = i.group_id)
ORDER BY i.group_id, i.income_id;

INSERT INTO budgets (user_id, group_id, name, is_active)
SELECT DISTINCT ON (e.group_id)
  e.user_id, e.group_id, 'Main', TRUE
FROM expenses e
WHERE e.group_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM budgets b WHERE b.group_id = e.group_id)
ORDER BY e.group_id, e.expense_id;

-- Catch solo owners
INSERT INTO budgets (user_id, group_id, name, is_active)
SELECT DISTINCT i.user_id, NULL::integer, 'Main', TRUE
FROM income i
WHERE i.group_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM budgets b WHERE b.user_id = i.user_id AND b.group_id IS NULL
  );

INSERT INTO budgets (user_id, group_id, name, is_active)
SELECT DISTINCT e.user_id, NULL::integer, 'Main', TRUE
FROM expenses e
WHERE e.group_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM budgets b WHERE b.user_id = e.user_id AND b.group_id IS NULL
  );

INSERT INTO budgets (user_id, group_id, name, is_active)
SELECT DISTINCT ON (l.group_id)
  l.user_id, l.group_id, 'Main', TRUE
FROM account_map_layouts l
WHERE l.group_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM budgets b WHERE b.group_id = l.group_id)
ORDER BY l.group_id, l.layout_id;

INSERT INTO budgets (user_id, group_id, name, is_active)
SELECT DISTINCT l.user_id, NULL::integer, 'Main', TRUE
FROM account_map_layouts l
WHERE l.group_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM budgets b WHERE b.user_id = l.user_id AND b.group_id IS NULL
  );

INSERT INTO budgets (user_id, group_id, name, is_active)
SELECT DISTINCT ON (e.group_id)
  e.user_id, e.group_id, 'Main', TRUE
FROM account_map_edges e
WHERE e.group_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM budgets b WHERE b.group_id = e.group_id)
ORDER BY e.group_id, e.edge_id;

INSERT INTO budgets (user_id, group_id, name, is_active)
SELECT DISTINCT e.user_id, NULL::integer, 'Main', TRUE
FROM account_map_edges e
WHERE e.group_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM budgets b WHERE b.user_id = e.user_id AND b.group_id IS NULL
  );

-- Backfill budget_id on plan lines and map tables
UPDATE income i
SET budget_id = b.budget_id
FROM budgets b
WHERE i.budget_id IS NULL
  AND i.group_id IS NOT NULL
  AND b.group_id = i.group_id;

UPDATE income i
SET budget_id = b.budget_id
FROM budgets b
WHERE i.budget_id IS NULL
  AND i.group_id IS NULL
  AND b.group_id IS NULL
  AND b.user_id = i.user_id;

UPDATE expenses e
SET budget_id = b.budget_id
FROM budgets b
WHERE e.budget_id IS NULL
  AND e.group_id IS NOT NULL
  AND b.group_id = e.group_id;

UPDATE expenses e
SET budget_id = b.budget_id
FROM budgets b
WHERE e.budget_id IS NULL
  AND e.group_id IS NULL
  AND b.group_id IS NULL
  AND b.user_id = e.user_id;

UPDATE account_map_layouts l
SET budget_id = b.budget_id
FROM budgets b
WHERE l.budget_id IS NULL
  AND l.group_id IS NOT NULL
  AND b.group_id = l.group_id;

UPDATE account_map_layouts l
SET budget_id = b.budget_id
FROM budgets b
WHERE l.budget_id IS NULL
  AND l.group_id IS NULL
  AND b.group_id IS NULL
  AND b.user_id = l.user_id;

UPDATE account_map_edges e
SET budget_id = b.budget_id
FROM budgets b
WHERE e.budget_id IS NULL
  AND e.group_id IS NOT NULL
  AND b.group_id = e.group_id;

UPDATE account_map_edges e
SET budget_id = b.budget_id
FROM budgets b
WHERE e.budget_id IS NULL
  AND e.group_id IS NULL
  AND b.group_id IS NULL
  AND b.user_id = e.user_id;

-- Keep one layout per budget (most recently updated)
DELETE FROM account_map_layouts l
WHERE l.budget_id IS NOT NULL
  AND l.layout_id NOT IN (
    SELECT DISTINCT ON (budget_id) layout_id
    FROM account_map_layouts
    WHERE budget_id IS NOT NULL
    ORDER BY budget_id, updated_at DESC NULLS LAST, layout_id DESC
  );

-- Drop duplicate freeform edges within a budget
DELETE FROM account_map_edges e
WHERE e.budget_id IS NOT NULL
  AND e.edge_id NOT IN (
    SELECT DISTINCT ON (budget_id, from_type, from_id, to_type, to_id, edge_kind) edge_id
    FROM account_map_edges
    WHERE budget_id IS NOT NULL
    ORDER BY budget_id, from_type, from_id, to_type, to_id, edge_kind, edge_id
  );

-- Ensure NOT NULL after backfill (fail loudly if orphans remain)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM income WHERE budget_id IS NULL)
     OR EXISTS (SELECT 1 FROM expenses WHERE budget_id IS NULL)
     OR EXISTS (SELECT 1 FROM account_map_layouts WHERE budget_id IS NULL)
     OR EXISTS (SELECT 1 FROM account_map_edges WHERE budget_id IS NULL) THEN
    RAISE EXCEPTION 'budget_id backfill left orphan rows';
  END IF;
END $$;

ALTER TABLE income ALTER COLUMN budget_id SET NOT NULL;
ALTER TABLE expenses ALTER COLUMN budget_id SET NOT NULL;
ALTER TABLE account_map_layouts ALTER COLUMN budget_id SET NOT NULL;
ALTER TABLE account_map_edges ALTER COLUMN budget_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_income_budget_id ON income(budget_id);
CREATE INDEX IF NOT EXISTS idx_expenses_budget_id ON expenses(budget_id);
CREATE INDEX IF NOT EXISTS idx_account_map_layouts_budget_id ON account_map_layouts(budget_id);
CREATE INDEX IF NOT EXISTS idx_account_map_edges_budget_id ON account_map_edges(budget_id);

DROP INDEX IF EXISTS idx_account_map_layouts_owner;
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_map_layouts_budget
  ON account_map_layouts (budget_id);

DROP INDEX IF EXISTS idx_account_map_edges_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_map_edges_unique
  ON account_map_edges (
    budget_id, from_type, from_id, to_type, to_id, edge_kind
  );
