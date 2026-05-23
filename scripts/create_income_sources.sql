-- Stores user-defined income sources for the Budget Tracker "From" field
CREATE TABLE IF NOT EXISTS income_sources (
  source_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
  group_id INTEGER REFERENCES groups(group_id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_income_sources_owner_name
  ON income_sources(user_id, COALESCE(group_id, 0), LOWER(name));

