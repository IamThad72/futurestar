-- Create expenses table for cash flow budget tracking
CREATE TABLE IF NOT EXISTS expenses (
    expense_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    expense_category TEXT NOT NULL,
    expense_category_desc TEXT,
    monthly_budget_amt NUMERIC(12, 2),
    annual_budget_amt NUMERIC(12, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
