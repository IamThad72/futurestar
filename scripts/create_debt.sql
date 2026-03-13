-- Create debt table
CREATE TABLE IF NOT EXISTS debt (
    dbt_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    institution TEXT,
    loan_number TEXT,
    loan_type TEXT,
    customer_support_no TEXT,
    address_url TEXT,
    borrower TEXT
);
