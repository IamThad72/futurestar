import { financialTabsForPath } from "~/utils/financialNav";
import { physicalTabsForPath } from "~/utils/physicalNav";
import { spiritualTabsForPath } from "~/utils/spiritualNav";

/** Header label for the screen the person is on. */
export function screenTitleForRoute(path, query = {}, hash = "") {
  const p = String(path || "");
  if (!p || p === "/") return "Future Star";
  if (p === "/today") return "Today";
  if (p.startsWith("/login")) return "Login";
  if (p.startsWith("/reset-password")) return "Reset password";
  if (p === "/account") return "You";
  if (p.startsWith("/garage/") && p !== "/garage") return "Vehicle";

  const financial = financialTabsForPath(p, query, hash).find((tab) => tab.current);
  if (financial) return financial.href === "/financial" ? "Money" : financial.name;

  const spiritual = spiritualTabsForPath(p).find((tab) => tab.current);
  if (spiritual) return spiritual.href === "/spiritual" ? "Faith" : spiritual.name;

  const physical = physicalTabsForPath(p).find((tab) => tab.current);
  if (physical) return physical.href === "/physical" ? "Body" : physical.name;

  return "Future Star";
}
