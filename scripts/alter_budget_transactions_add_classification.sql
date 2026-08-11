-- Decouple transactions from a specific budget plan line:
-- store classification on the tx; income_id/expense_id become optional links.

ALTER TABLE budget_transactions
  ADD COLUMN IF NOT EXISTS item_kind TEXT,
  ADD COLUMN IF NOT EXISTS item_type TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS sub_category TEXT;

-- Backfill from linked plan lines
UPDATE budget_transactions t
SET
  item_kind = 'income',
  item_type = COALESCE(i.income_type, 'gross'),
  category = COALESCE(i.income_category, 'Uncategorized'),
  sub_category = i.sub_category
FROM income i
WHERE t.income_id = i.income_id
  AND (t.category IS NULL OR t.item_kind IS NULL);

UPDATE budget_transactions t
SET
  item_kind = 'expense',
  item_type = COALESCE(e.expense_type, 'expense'),
  category = COALESCE(e.expense_category, 'Uncategorized'),
  sub_category = e.sub_category
FROM expenses e
WHERE t.expense_id = e.expense_id
  AND (t.category IS NULL OR t.item_kind IS NULL);

-- Any remaining rows without classification (should be rare)
UPDATE budget_transactions
SET
  item_kind = COALESCE(item_kind, CASE WHEN income_id IS NOT NULL THEN 'income' ELSE 'expense' END),
  item_type = COALESCE(item_type, CASE WHEN income_id IS NOT NULL THEN 'gross' ELSE 'expense' END),
  category = COALESCE(NULLIF(trim(category), ''), 'Uncategorized')
WHERE category IS NULL OR item_kind IS NULL;

ALTER TABLE budget_transactions
  ALTER COLUMN item_kind SET NOT NULL,
  ALTER COLUMN category SET NOT NULL;

ALTER TABLE budget_transactions
  DROP CONSTRAINT IF EXISTS budget_transaction_source_check;

ALTER TABLE budget_transactions
  ADD CONSTRAINT budget_transaction_source_check CHECK (
    (income_id IS NOT NULL AND expense_id IS NULL)
    OR (income_id IS NULL AND expense_id IS NOT NULL)
    OR (income_id IS NULL AND expense_id IS NULL)
  );

ALTER TABLE budget_transactions
  DROP CONSTRAINT IF EXISTS budget_transaction_item_kind_check;

ALTER TABLE budget_transactions
  ADD CONSTRAINT budget_transaction_item_kind_check CHECK (
    item_kind IN ('income', 'expense')
  );

-- Prefer orphaning txs when a plan line is deleted
ALTER TABLE budget_transactions DROP CONSTRAINT IF EXISTS budget_transactions_income_id_fkey;
ALTER TABLE budget_transactions DROP CONSTRAINT IF EXISTS budget_transactions_expense_id_fkey;

ALTER TABLE budget_transactions
  ADD CONSTRAINT budget_transactions_income_id_fkey
    FOREIGN KEY (income_id) REFERENCES income(income_id) ON DELETE SET NULL;

ALTER TABLE budget_transactions
  ADD CONSTRAINT budget_transactions_expense_id_fkey
    FOREIGN KEY (expense_id) REFERENCES expenses(expense_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_budget_transactions_classification
  ON budget_transactions (item_kind, lower(category), lower(COALESCE(sub_category, '')));

CREATE INDEX IF NOT EXISTS idx_budget_transactions_group_date
  ON budget_transactions (group_id, transaction_date)
  WHERE group_id IS NOT NULL;
