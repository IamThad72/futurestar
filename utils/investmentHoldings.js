/**
 * Holdings snapshot for the Investments tab.
 * Replace `loadInvestmentSnapshot()` with a brokerage or database read later.
 * Every holding is USD. Do not append positions in another currency to this list.
 *
 * costBasis is null when the snapshot did not include a usable cost basis.
 * Those rows stay visible and are left out of performance totals.
 *
 * A missing cost basis or value is not treated as zero.
 * FCASH, CORE, and SPAXX are cash at the updated value, so cost basis equals current value.
 * FDRXX and FLGXX still have no cost basis on the statement.
 */
import { isFiniteNumber } from "./investmentPerformance.js";

export const investmentCurrency = "USD";

export const investmentHoldings = [
  { id: "ltcg-fcash", name: "Held in FCASH", ticker: "FCASH", account: "Investment-LTCG-Only", shares: null, price: null, costBasis: 97035.32, currentValue: 97035.32 },
  { id: "ltcg-fxaix", name: "Fidelity 500 Index Fund", ticker: "FXAIX", account: "Investment-LTCG-Only", shares: 130.597, price: 263.5, costBasis: 30449.86, currentValue: 34412.3 },
  { id: "ltcg-lvhi", name: "Legg Mason ETF Invt Franklin Intl Lw", ticker: "LVHI", account: "Investment-LTCG-Only", shares: 867, price: 43.18, costBasis: 29998.11, currentValue: 37437.06 },
  { id: "ira-core", name: "FDIC-insured deposit sweep", ticker: "CORE", account: "IRA", shares: null, price: null, costBasis: 1093.19, currentValue: 1093.19 },
  { id: "ira-bnd", name: "Vanguard Bd Index Fds Total Bnd Mrkt", ticker: "BND", account: "IRA", shares: 942, price: 71.56, costBasis: 69984.95, currentValue: 67409.52 },
  { id: "ira-bndw", name: "Vanguard Scottsdale Fds Total Wld Bd ETF", ticker: "BNDW", account: "IRA", shares: 862, price: 66.87, costBasis: 59964.6, currentValue: 57644.52 },
  { id: "ira-fxaix", name: "Fidelity 500 Index Fund", ticker: "FXAIX", account: "IRA", shares: 368.365, price: 263.5, costBasis: 100000, currentValue: 97064.17 },
  { id: "ira-schf", name: "Schwab International Equity ETF", ticker: "SCHF", account: "IRA", shares: 5410, price: 26.98, costBasis: 125024.56, currentValue: 145961.8 },
  { id: "ira-spaxx", name: "Fidelity Government Money Market", ticker: "SPAXX", account: "IRA", shares: 49094.82, price: 1, costBasis: 49094.82, currentValue: 49094.82 },
  { id: "ira-t", name: "AT&T Inc Com USD1", ticker: "T", account: "IRA", shares: 345, price: 21.41, costBasis: 9679.2, currentValue: 7386.45 },
  { id: "ira-vo", name: "Vanguard Index Funds Vanguard Morningstar Mid-Cap ETF", ticker: "VO", account: "IRA", shares: 2608, price: 81.46, costBasis: 192991.93, currentValue: 212447.68 },
  { id: "ira-voo", name: "Vanguard Index Fds S&P 500 ETF USD", ticker: "VOO", account: "IRA", shares: 294, price: 694.81, costBasis: 179385.02, currentValue: 204274.14 },
  { id: "usf-sp500", name: "SP 500 Index PL CL C", ticker: "84679P306", account: "USF 401(K)", shares: 225.256, price: 363.04, costBasis: 63250.62, currentValue: 81776.94 },
  { id: "usf-trp-2035", name: "TRP Retire 2035 C", ticker: "87281G309", account: "USF 401(K)", shares: 579.252, price: 43.17, costBasis: 20366.86, currentValue: 25006.31 },
  { id: "hsa-cash-fdrxx", name: "Held in money market", ticker: "FDRXX", account: "HSA Cash", shares: null, price: null, costBasis: null, currentValue: 1920.68 },
  { id: "hsa-flgxx", name: "Held in money market", ticker: "FLGXX", account: "HSA Investments", shares: null, price: null, costBasis: null, currentValue: 339.81 },
  { id: "hsa-fdfix", name: "Fidelity Flex 500 Index Fund", ticker: "FDFIX", account: "HSA Investments", shares: 106.784, price: 32.2, costBasis: 3071.68, currentValue: 3438.44 },
  { id: "hsa-fibux", name: "Fidelity Flex U.S. Bond Index Fd", ticker: "FIBUX", account: "HSA Investments", shares: 226.888, price: 8.89, costBasis: 2072.97, currentValue: 2017.03 },
  { id: "hsa-fitfx", name: "Fidelity Flex International Index", ticker: "FITFX", account: "HSA Investments", shares: 86.648, price: 18.67, costBasis: 1465.12, currentValue: 1617.71 },
  { id: "hsa-fjtdx", name: "Fidelity Flex Cons Income Bond Fund", ticker: "FJTDX", account: "HSA Investments", shares: 35.593, price: 10.02, costBasis: 357.24, currentValue: 356.64 },
  { id: "hsa-flapx", name: "Fidelity Flex Mid Cap Index Fund", ticker: "FLAPX", account: "HSA Investments", shares: 9.402, price: 25.19, costBasis: 204.1, currentValue: 236.83 },
  { id: "hsa-flxsx", name: "Fidelity Flex Small Cap Index Fund", ticker: "FLXSX", account: "HSA Investments", shares: 7.568, price: 20.24, costBasis: 135.32, currentValue: 153.17 },
];

function accountId(account) {
  const slug = String(account || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "account";
}

/**
 * Replace every holding in `account` with one summed category of that name.
 * Cost basis or current value is null when any member amount is missing or invalid.
 */
export function rollupAccountHoldings(holdings, account) {
  const members = [];
  const rest = [];
  let insertAt = -1;
  for (const holding of holdings ?? []) {
    if (holding?.account === account) {
      if (insertAt < 0) insertAt = rest.length;
      members.push(holding);
    } else {
      rest.push(holding);
    }
  }
  if (members.length <= 1) return [...(holdings ?? [])];

  const costOk = members.every((holding) => isFiniteNumber(holding.costBasis));
  const valueOk = members.every((holding) => isFiniteNumber(holding.currentValue));
  const rolled = {
    id: accountId(account),
    name: account,
    account,
    costBasis: costOk ? members.reduce((sum, holding) => sum + holding.costBasis, 0) : null,
    currentValue: valueOk ? members.reduce((sum, holding) => sum + holding.currentValue, 0) : null,
  };
  rest.splice(insertAt, 0, rolled);
  return rest;
}

export function presentInvestmentHoldings(holdings) {
  return [...(holdings ?? [])];
}

/** Integration boundary. Swap this for a real holdings query without changing the dashboard. */
export function loadInvestmentSnapshot() {
  return Promise.resolve({
    currency: investmentCurrency,
    holdings: presentInvestmentHoldings(investmentHoldings),
  });
}
