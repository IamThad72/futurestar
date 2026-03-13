-- Create record_shares table for sharing records between users
CREATE TABLE IF NOT EXISTS record_shares (
    share_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    record_type TEXT NOT NULL,
    record_id INTEGER NOT NULL,
    owner_user_id INTEGER NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    shared_user_id INTEGER NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('viewer', 'editor')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (record_type, record_id, shared_user_id)
);
