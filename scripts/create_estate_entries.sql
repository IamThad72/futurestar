-- Create estate_entries table
CREATE TABLE IF NOT EXISTS estate_entries (
    entry_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    asset_category TEXT NOT NULL,
    classification_type TEXT NOT NULL,
    title TEXT,
    description TEXT,
    value NUMERIC(12, 2),
    location TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
