-- Create groups table for linked accounts
CREATE TABLE IF NOT EXISTS groups (
    group_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    group_name TEXT NOT NULL,
    created_by INTEGER NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
