-- Remap account map edge kinds to the new vocabulary.
-- Old: related, deposits_to, pays, funds, secures, flows_to
-- New: flow, deposit, transfer, secures, purchase, refund

ALTER TABLE account_map_edges DROP CONSTRAINT IF EXISTS account_map_edges_kind_check;

UPDATE account_map_edges
SET edge_kind = CASE edge_kind
  WHEN 'flows_to' THEN 'flow'
  WHEN 'deposits_to' THEN 'deposit'
  WHEN 'pays' THEN 'transfer'
  WHEN 'funds' THEN 'purchase'
  WHEN 'related' THEN 'transfer'
  WHEN 'secures' THEN 'secures'
  WHEN 'flow' THEN 'flow'
  WHEN 'deposit' THEN 'deposit'
  WHEN 'transfer' THEN 'transfer'
  WHEN 'purchase' THEN 'purchase'
  WHEN 'refund' THEN 'refund'
  WHEN 'debt_payment' THEN 'debt_payment'
  ELSE 'transfer'
END;

ALTER TABLE account_map_edges
  ALTER COLUMN edge_kind SET DEFAULT 'transfer';

ALTER TABLE account_map_edges
  ADD CONSTRAINT account_map_edges_kind_check CHECK (
    edge_kind IN (
      'flow', 'deposit', 'transfer', 'secures', 'purchase', 'refund', 'debt_payment'
    )
  );
