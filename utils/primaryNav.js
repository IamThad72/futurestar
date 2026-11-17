import { isFinancialPath } from "~/utils/financialNav";
import { isPhysicalPath } from "~/utils/physicalNav";
import { isSpiritualPath } from "~/utils/spiritualNav";

/** Primary destinations: Today, Money, Faith, Body, You. */
export function primaryNavForPath(path) {
  const p = String(path || "");
  return [
    {
      name: "Today",
      path: "/today",
      icon: "sparkles",
      pillar: "",
      current: p === "/today",
    },
    {
      name: "Money",
      path: "/financial",
      icon: "landmark",
      pillar: "financial",
      current: isFinancialPath(p),
    },
    {
      name: "Faith",
      path: "/spiritual",
      icon: "church",
      pillar: "spiritual",
      current: isSpiritualPath(p),
    },
    {
      name: "Body",
      path: "/physical",
      icon: "activity",
      pillar: "physical",
      current: isPhysicalPath(p),
    },
    {
      name: "You",
      path: "/account",
      icon: "circle-user",
      pillar: "",
      current: p === "/account",
    },
  ];
}

export function homePathForUser(user) {
  return user ? "/today" : "/";
}
