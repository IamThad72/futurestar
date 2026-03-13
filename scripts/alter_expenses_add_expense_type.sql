-- Add expense_type to distinguish expenses, savings, and investments
-- expense = regular spending
-- savings = savings goals (e.g. emergency fund)
-- investment = investment contributions (e.g. brokerage, IRA)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_type TEXT DEFAULT 'expense';
