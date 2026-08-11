-- Freeform account-map edges not covered by FK columns on debt/expenses/income
CREATE TABLE IF NOT EXISTS account_map_edges (
    edge_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    group_id INTEGER REFERENCES groups(group_id) ON DELETE SET NULL,
    from_type TEXT NOT NULL,
    from_id INTEGER NOT NULL,
    to_type TEXT NOT NULL,
    to_id INTEGER NOT NULL,
    edge_kind TEXT NOT NULL DEFAULT 'transfer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT account_map_edges_types_check CHECK (
      from_type IN (
        'asset_inventory', 'asset_vehicles', 'cash_and_investments',
        'debt', 'real_estate', 'insurance', 'income', 'expense'
      )
      AND to_type IN (
        'asset_inventory', 'asset_vehicles', 'cash_and_investments',
        'debt', 'real_estate', 'insurance', 'income', 'expense'
      )
    ),
    CONSTRAINT account_map_edges_kind_check CHECK (
      edge_kind IN (
        'flow', 'deposit', 'transfer', 'secures', 'purchase', 'refund', 'debt_payment'
      )
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_account_map_edges_unique
  ON account_map_edges (
    COALESCE(group_id, 0), from_type, from_id, to_type, to_id, edge_kind
  );

CREATE INDEX IF NOT EXISTS idx_account_map_edges_user
  ON account_map_edges(user_id);
CREATE INDEX IF NOT EXISTS idx_account_map_edges_group
  ON account_map_edges(group_id) WHERE group_id IS NOT NULL;
