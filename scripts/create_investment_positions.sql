-- Positions inside an Estate cash or investment account.
-- market_value is the statement or edited balance. A later share or price edit
-- replaces it with shares times price. Cost basis is independent of price.
CREATE TABLE IF NOT EXISTS investment_positions (
  position_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ci_id INTEGER NOT NULL REFERENCES cash_and_investments(ci_id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
  group_id INTEGER REFERENCES groups(group_id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  description TEXT NOT NULL,
  shares NUMERIC(18, 6),
  price NUMERIC(18, 6),
  price_as_of DATE,
  cost_basis NUMERIC(18, 2),
  market_value NUMERIC(18, 2),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS investment_positions_account_symbol
  ON investment_positions (ci_id, symbol);
CREATE INDEX IF NOT EXISTS investment_positions_symbol
  ON investment_positions (symbol);
CREATE INDEX IF NOT EXISTS investment_positions_user
  ON investment_positions (user_id);
CREATE INDEX IF NOT EXISTS investment_positions_group
  ON investment_positions (group_id) WHERE group_id IS NOT NULL;

INSERT INTO investment_positions (
  ci_id, user_id, group_id, symbol, description, shares, price, price_as_of, cost_basis, market_value, sort_order
)
SELECT
  ci.ci_id,
  ci.user_id,
  ci.group_id,
  v.symbol,
  v.description,
  v.shares,
  v.price,
  v.price_as_of,
  v.cost_basis,
  v.market_value,
  v.sort_order
FROM (
  VALUES
    ('Investment-LTCG-Only', 'FCASH', 'Held in FCASH', NULL::numeric, NULL::numeric, NULL::date, 97035.32::numeric, 97035.32::numeric, 0),
    ('Investment-LTCG-Only', 'FXAIX', 'Fidelity 500 Index Fund', 130.597, 263.5, DATE '2026-10-31', 30449.86, 34412.30, 1),
    ('Investment-LTCG-Only', 'LVHI', 'Legg Mason ETF Invt Franklin Intl Lw', 867, 43.18, DATE '2026-10-31', 29998.11, 37437.06, 2),
    ('IRA', 'CORE', 'FDIC-insured deposit sweep', NULL, NULL, NULL, 1093.19, 1093.19, 3),
    ('IRA', 'BND', 'Vanguard Bd Index Fds Total Bnd Mrkt', 942, 71.56, DATE '2026-10-31', 69984.95, 67409.52, 4),
    ('IRA', 'BNDW', 'Vanguard Scottsdale Fds Total Wld Bd ETF', 862, 66.87, DATE '2026-10-31', 59964.60, 57644.52, 5),
    ('IRA', 'FXAIX', 'Fidelity 500 Index Fund', 368.365, 263.5, DATE '2026-10-31', 100000, 97064.17, 6),
    ('IRA', 'SCHF', 'Schwab International Equity ETF', 5410, 26.98, DATE '2026-10-31', 125024.56, 145961.80, 7),
    ('IRA', 'SPAXX', 'Fidelity Government Money Market', 49094.82, 1, DATE '2026-10-31', 49094.82, 49094.82, 8),
    ('IRA', 'T', 'AT&T Inc Com USD1', 345, 21.41, DATE '2026-10-31', 9679.20, 7386.45, 9),
    ('IRA', 'VO', 'Vanguard Index Funds Vanguard Morningstar Mid-Cap ETF', 2608, 81.46, DATE '2026-10-31', 192991.93, 212447.68, 10),
    ('IRA', 'VOO', 'Vanguard Index Fds S&P 500 ETF USD', 294, 694.81, DATE '2026-10-31', 179385.02, 204274.14, 11),
    ('USF 401(K)', '84679P306', 'SP 500 Index PL CL C', 225.256, 363.04, DATE '2026-10-31', 63250.62, 81776.94, 12),
    ('USF 401(K)', '87281G309', 'TRP Retire 2035 C', 579.252, 43.17, DATE '2026-10-31', 20366.86, 25006.31, 13),
    ('HSA - Cash', 'FDRXX', 'Held in money market', NULL, NULL, NULL, NULL, 1920.68, 14),
    ('HSA - Investments', 'FLGXX', 'Held in money market', NULL, NULL, NULL, NULL, 339.81, 15),
    ('HSA - Investments', 'FDFIX', 'Fidelity Flex 500 Index Fund', 106.784, 32.2, DATE '2026-10-31', 3071.68, 3438.44, 16),
    ('HSA - Investments', 'FIBUX', 'Fidelity Flex U.S. Bond Index Fd', 226.888, 8.89, DATE '2026-10-31', 2072.97, 2017.03, 17),
    ('HSA - Investments', 'FITFX', 'Fidelity Flex International Index', 86.648, 18.67, DATE '2026-10-31', 1465.12, 1617.71, 18),
    ('HSA - Investments', 'FJTDX', 'Fidelity Flex Cons Income Bond Fund', 35.593, 10.02, DATE '2026-10-31', 357.24, 356.64, 19),
    ('HSA - Investments', 'FLAPX', 'Fidelity Flex Mid Cap Index Fund', 9.402, 25.19, DATE '2026-10-31', 204.10, 236.83, 20),
    ('HSA - Investments', 'FLXSX', 'Fidelity Flex Small Cap Index Fund', 7.568, 20.24, DATE '2026-10-31', 135.32, 153.17, 21)
) AS v(institution, symbol, description, shares, price, price_as_of, cost_basis, market_value, sort_order)
JOIN cash_and_investments ci ON ci.institution = v.institution
WHERE NOT EXISTS (
  SELECT 1 FROM investment_positions p WHERE p.ci_id = ci.ci_id AND p.symbol = v.symbol
);

UPDATE cash_and_investments ci
SET value = s.total::numeric::money
FROM (
  SELECT ci_id, ROUND(SUM(market_value), 2) AS total
  FROM investment_positions
  GROUP BY ci_id
) s
WHERE ci.ci_id = s.ci_id
  AND s.total IS NOT NULL;
