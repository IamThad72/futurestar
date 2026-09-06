/** Financial section destinations (header Financial + in-section tabs). */

export const FINANCIAL_NAV_TABS = [
  {
    name: "Financial Home",
    href: "/financial",
    description: "Overview of your financial health and tools.",
    match: (path) => path === "/financial" || path.startsWith("/financial/"),
  },
  {
    name: "Estate Management",
    href: "/estate_mgmt",
    description: "Assets, debts, insurance, and net worth.",
    match: (path) => path.startsWith("/estate_mgmt"),
  },
  {
    name: "Garage",
    href: "/garage",
    description: "Vehicles and maintenance records.",
    match: (path) => path.startsWith("/garage"),
  },
  {
    name: "Account Map",
    href: "/account_map",
    description: "How income, accounts, and budgets connect.",
    hideOnMobile: true,
    match: (path) => path.startsWith("/account_map"),
  },
  {
    name: "Budget Setup",
    href: "/cash_flow_mgmt",
    description: "Create and edit budget lines.",
    match: (path) => path.startsWith("/cash_flow_mgmt"),
  },
  {
    name: "Budget Tracker",
    href: "/cash_flow_tracker",
    description: "Record and review monthly transactions.",
    match: (path) => path.startsWith("/cash_flow_tracker"),
  },
  {
    name: "Tax",
    href: "/tax",
    description: "Annual totals and estimated taxes owed.",
    match: (path) => path === "/tax" || path.startsWith("/tax/"),
  },
];

export function isEstateDocumentsView(query, hash) {
  const v = query?.docs;
  if (v === "1" || v === "true" || v === true) return true;
  return String(hash || "") === "#documents";
}

export function isFinancialPath(path) {
  const p = String(path || "");
  return FINANCIAL_NAV_TABS.some((tab) => tab.match(p));
}

export function financialTabsForPath(path, query = {}, hash = "") {
  const p = String(path || "");
  const docsView = isEstateDocumentsView(query, hash);
  return FINANCIAL_NAV_TABS.map((tab) => ({
    ...tab,
    current: tab.match(p, { docsView }),
  }));
}

export const FINANCIAL_HOME_LINKS = FINANCIAL_NAV_TABS.filter((tab) => tab.href !== "/financial");
