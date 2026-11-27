import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cashAccountJoin } from "../server/utils/cashAccountJoin";

describe("cash account names on budget lists", () => {
  it("hides a held account from a person with no household", () => {
    const join = cashAccountJoin(false);
    expect(join).toContain("LEFT JOIN cash_and_investments ci ON t.cash_investment_id = ci.ci_id AND");
    expect(join).toContain("ci.user_id = $1");
    expect(join).not.toContain("ci.group_id");
  });

  it("hides a held account from a household member", () => {
    const join = cashAccountJoin(true);
    expect(join).toContain("ci.user_id = $1");
    expect(join).toContain("ci.group_id = $2");
    expect(join).toContain("ci.user_id IN (SELECT user_id FROM group_members WHERE group_id = $2)");
  });

  it("is the join used by the tracker and the transaction list", () => {
    const tracker = readFileSync(new URL("../server/api/budget/tracker.get.ts", import.meta.url), "utf8");
    const list = readFileSync(new URL("../server/api/budget/transactions/list.get.ts", import.meta.url), "utf8");
    expect(tracker).toContain("${cashAccountJoin(groupId != null)}");
    expect(list).toContain("${cashAccountJoin(groupId != null)}");
    expect(tracker).not.toContain("LEFT JOIN cash_and_investments ci ON t.cash_investment_id = ci.ci_id\n");
    expect(list).not.toContain("LEFT JOIN cash_and_investments ci ON t.cash_investment_id = ci.ci_id\n");
  });
});
