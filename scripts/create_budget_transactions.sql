-- Create budget_transactions table for tracking actual transactions against budget items
CREATE TABLE IF NOT EXISTS budget_transactions (
    transaction_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    income_id INTEGER REFERENCES income(income_id) ON DELETE CASCADE,
    expense_id INTEGER REFERENCES expenses(expense_id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT budget_transaction_source_check CHECK (
        (income_id IS NOT NULL AND expense_id IS NULL) OR
        (income_id IS NULL AND expense_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_budget_transactions_user_date
    ON budget_transactions(user_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_budget_transactions_income
    ON budget_transactions(income_id) WHERE income_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_budget_transactions_expense
    ON budget_transactions(expense_id) WHERE expense_id IS NOT NULL;
