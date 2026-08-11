-- Add debt_payment edge kind for credit card / loan payments.

ALTER TABLE account_map_edges DROP CONSTRAINT IF EXISTS account_map_edges_kind_check;

ALTER TABLE account_map_edges
  ADD CONSTRAINT account_map_edges_kind_check CHECK (
    edge_kind IN (
      'flow', 'deposit', 'transfer', 'secures', 'purchase', 'refund', 'debt_payment'
    )
  );
