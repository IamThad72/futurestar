import { groupAccessClause, soloUserClause } from "./group";

/**
 * Budget lists name a cash account only when that account is still visible:
 * it belongs to the signed-in person or to their household. A row held for
 * 90 days has a null user_id and a null group_id, so it matches neither.
 */
export function cashAccountJoin(grouped: boolean) {
  const access = grouped ? groupAccessClause("ci") : soloUserClause("ci");
  return `LEFT JOIN cash_and_investments ci ON t.cash_investment_id = ci.ci_id AND ${access}`;
}
