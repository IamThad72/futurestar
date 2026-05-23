-- Create group_members table to link users to groups
CREATE TABLE IF NOT EXISTS group_members (
    group_member_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (group_id, user_id)
);
