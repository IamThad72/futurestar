-- Household-level estate / financial documents (shared with linked-account groups).
CREATE TABLE IF NOT EXISTS estate_documents (
    doc_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    group_id INTEGER REFERENCES groups(group_id) ON DELETE SET NULL,
    original_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    storage_backend TEXT NOT NULL DEFAULT 'disk',
    title TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT estate_documents_backend_check CHECK (storage_backend IN ('disk', 'supabase')),
    CONSTRAINT estate_documents_size_check CHECK (size_bytes > 0)
);

CREATE INDEX IF NOT EXISTS idx_estate_documents_user
  ON estate_documents (user_id);
CREATE INDEX IF NOT EXISTS idx_estate_documents_group
  ON estate_documents (group_id) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_estate_documents_created
  ON estate_documents (created_at DESC);
