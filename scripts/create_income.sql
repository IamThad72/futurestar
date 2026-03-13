-- Create income table for cash flow budget tracking
CREATE TABLE IF NOT EXISTS income (
    income_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    income_category TEXT NOT NULL,
    income_category_desc TEXT,
    income_category_monthly_amt NUMERIC(12, 2),
    income_category_annual_amt NUMERIC(12, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
