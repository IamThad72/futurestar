/** Financial section destinations (header Financial + in-section tabs). */

export const FINANCIAL_NAV_TABS = [
  {
    name: "Financial Home",
    href: "/financial",
    description: "Overview of your financial health and tools.",
    match: (path) => path === "/financial" || path.startsWith("/financial/"),
  },
  {
    name: "Investments",
    href: "/investments",
    description: "Cost basis, current value, and unrealized gain or loss.",
    match: (path) => path === "/investments" || path.startsWith("/investments/"),
  },
  {
    name: "Estate Management",
    href: "/estate_mgmt",
    description: "Assets, debts, insurance, and net worth.",
    match: (path, ctx) => path.startsWith("/estate_mgmt") && !ctx?.docsView,
  },
  {
    name: "Documents",
    href: "/estate_mgmt?docs=1",
    description: "Policies, titles, and statements kept next to the estate records.",
    match: (path, ctx) => path.startsWith("/estate_mgmt") && Boolean(ctx?.docsView),
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

/** Sidebar and home-card groups. Names match FINANCIAL_NAV_TABS. */
export const FINANCIAL_NAV_GROUPS = [
  { name: "Plan", names: ["Budget Tracker", "Budget Setup", "Tax"] },
  { name: "Household", names: ["Estate Management", "Garage", "Documents"] },
  { name: "Wealth", names: ["Investments", "Account Map"] },
];

export function financialSidebarGroups(tabs) {
  const byName = new Map(tabs.map((tab) => [tab.name, tab]));
  return FINANCIAL_NAV_GROUPS.map((group) => ({
    name: group.name,
    tabs: group.names.map((name) => byName.get(name)).filter(Boolean),
  })).filter((group) => group.tabs.length);
}
