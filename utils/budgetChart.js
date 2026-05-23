/** Build flat budget-vs-actual rows for dashboard charts (aligned with cash flow tracker sections). */

const SECTION_DEFS = [
  {
    key: "expense",
    title: "Expenses",
    listType: "expense",
    filterExpense: (e) => (e.expense_type || "expense") === "expense",
    filterIncome: null,
  },
  {
    key: "income",
    title: "Income",
    listType: "income",
    filterExpense: null,
    filterIncome: (i) => i.income_type !== "tax",
  },
  {
    key: "investment",
    title: "Investments",
    listType: "expense",
    filterExpense: (e) => e.expense_type === "investment",
    filterIncome: null,
  },
  {
    key: "savings",
    title: "Savings",
    listType: "expense",
    filterExpense: (e) => e.expense_type === "savings",
    filterIncome: null,
  },
  {
    key: "tax",
    title: "Tax",
    listType: "income",
    filterExpense: null,
    filterIncome: (i) => i.income_type === "tax",
  },
];

function toNumber(val) {
  if (val == null || val === "") return 0;
  if (typeof val === "number") return val;
  const n = parseFloat(String(val).replace(/[$,]/g, "").trim());
  return Number.isNaN(n) ? 0 : n;
}

export function formatChartMoney(val) {
  return Number(val).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Whole dollars for chart labels and tooltips */
export function formatChartMoneyRounded(val) {
  return Math.round(Number(val)).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function formatSignedChartMoney(signed) {
  const rounded = Math.round(Number(signed));
  if (rounded === 0) return "$0";
  const mag = formatChartMoneyRounded(Math.abs(rounded));
  return rounded > 0 ? `+$${mag}` : `-$${mag}`;
}

/** Truncated category name for chart x-axis labels (text only, no amounts) */
export function buildAxisCategoryLabel(categoryName, maxLen = 22) {
  let base = (categoryName || "").trim() || "Uncategorized";
  if (base.length > maxLen) base = `${base.slice(0, maxLen - 1)}…`;
  return base;
}

/** Chart label by category only, e.g. "Expense-Health/Beauty" */
export function budgetCategoryLabel(sectionTitle, category) {
  const cat = (category || "").trim() || "Uncategorized";
  const prefix = sectionTitle === "Expenses" ? "Expense" : sectionTitle;
  return `${prefix}-${cat}`;
}

const INSURANCE_CHART_GROUP = "Insurance";

/** Life / health insurance lines share one dashboard bar */
export function isLifeOrHealthInsuranceLabel(text) {
  const t = (text || "").toLowerCase().trim();
  if (!t) return false;
  if (t.includes("health") && (t.includes("insurance") || t.includes("medical") || t.includes("family"))) {
    return true;
  }
  if (t.includes("life") && t.includes("insurance")) return true;
  if (t.includes("supplemental life")) return true;
  return false;
}

/** Category key for chart grouping (merges life + health insurance) */
export function chartCategoryGroupKey(item, listType) {
  const category = (item.category || "").trim() || "Uncategorized";
  if (listType !== "income") return category;
  const sub = (item.sub_category || "").trim();
  if (isLifeOrHealthInsuranceLabel(category) || isLifeOrHealthInsuranceLabel(sub)) {
    return INSURANCE_CHART_GROUP;
  }
  return category;
}

export function isPayrollCategory(category) {
  return /payroll/i.test((category || "").trim());
}

function labelLooksLikeGrossIncome(text) {
  const t = (text || "").toLowerCase().trim();
  if (!t) return false;
  return (
    t === "gross" ||
    t.includes("gross income") ||
    t.includes("gross pay") ||
    t.includes("gross salary") ||
    t.includes("gross wages")
  );
}

function subcategoryLooksLikeNetIncome(sub) {
  if (!sub) return false;
  return (
    /\bnet\s+income\b/.test(sub) ||
    /\bnet\s+pay\b/.test(sub) ||
    sub === "net" ||
    sub.includes("take home") ||
    sub.includes("take-home")
  );
}

/** Gross pay lines — excluded from Payroll bar; net take-home posts on Net Income lines */
export function isGrossIncomeBudgetLine(item) {
  if (isNetIncomeBudgetLine(item)) return false;
  const type = (item.income_type || "gross").toLowerCase();
  const cat = (item.category || "").trim();
  const sub = (item.sub_category || "").trim();
  if (labelLooksLikeGrossIncome(cat) || labelLooksLikeGrossIncome(sub)) return true;
  if (type !== "gross") return false;
  if (isPayrollCategory(cat)) return true;
  return false;
}

export function isNetIncomeBudgetLine(item) {
  const cat = (item.category || "").trim().toLowerCase();
  const sub = (item.sub_category || "").trim().toLowerCase();
  if (subcategoryLooksLikeNetIncome(sub)) return true;
  if (labelLooksLikeGrossIncome(sub)) return false;
  if (labelLooksLikeGrossIncome(cat)) return false;
  return (
    /\bnet\s+income\b/.test(cat) ||
    /\bnet\s+pay\b/.test(cat)
  );
}

/** Omit standalone gross-income category bars from the income chart */
function shouldOmitIncomeChartItem(item) {
  const cat = (item.category || "").trim().toLowerCase();
  if (cat === "gross income" || labelLooksLikeGrossIncome(cat)) return true;
  if (isGrossIncomeBudgetLine(item) && !isPayrollCategory(item.category)) return true;
  return false;
}

/** Budget + actual totals for tax, insurance (deduction), savings, and investments */
function chartWithholdingTotals(budgets, transactions, year, month) {
  const byItem = actualByItemForMonth(transactions, year, month);
  let budgeted = 0;
  let itemIds = [];

  const addIncome = (item) => {
    if (item.income_type === "tax" || item.income_type === "deduction") {
      budgeted += toNumber(item.monthly_amount);
      itemIds.push({ id: item.id, listType: "income" });
    }
  };
  const addExpense = (item) => {
    const et = item.expense_type || "expense";
    if (et === "savings" || et === "investment") {
      budgeted += toNumber(item.monthly_amount);
      itemIds.push({ id: item.id, listType: "expense" });
    }
  };

  for (const item of budgets?.income ?? []) addIncome(item);
  for (const item of budgets?.expenses ?? []) addExpense(item);

  let actual = 0;
  for (const { id, listType } of itemIds) {
    actual += getActual(byItem, id, listType);
  }

  return { budgeted, actual };
}

/**
 * Payroll bar: net take-home only (excludes gross pay lines; subtracts withholdings when needed).
 * @param {{ item: object, listType: string }[]} payrollItems
 */
function computePayrollChartGroup(payrollItems, budgets, transactions, year, month) {
  const category =
    (payrollItems[0]?.item?.category || "").trim() || "Payroll";
  const byItem = actualByItemForMonth(transactions, year, month);

  const netLines = payrollItems.filter(({ item }) => isNetIncomeBudgetLine(item));
  const grossLines = payrollItems.filter(({ item }) => isGrossIncomeBudgetLine(item));

  if (netLines.length > 0) {
    let budgeted = 0;
    const itemIds = [];
    for (const { item } of netLines) {
      budgeted += toNumber(item.monthly_amount);
      itemIds.push(item.id);
    }
    const precomputedActual = sumActualForItemIds(byItem, itemIds, "income");
    return { category, listType: "income", budgeted, precomputedActual, itemIds };
  }

  let grossBudgeted = 0;
  const grossItemIds = [];
  for (const { item } of grossLines) {
    grossBudgeted += toNumber(item.monthly_amount);
    grossItemIds.push(item.id);
  }
  const grossActual = sumActualForItemIds(byItem, grossItemIds, "income");
  const withholding = chartWithholdingTotals(budgets, transactions, year, month);

  return {
    category,
    listType: "income",
    budgeted: Math.max(0, Math.round((grossBudgeted - withholding.budgeted) * 100) / 100),
    precomputedActual: Math.max(0, Math.round((grossActual - withholding.actual) * 100) / 100),
    itemIds: grossItemIds,
  };
}

function sumActualForItemIds(byItem, itemIds, listType) {
  return itemIds.reduce((sum, id) => sum + getActual(byItem, id, listType), 0);
}

function actualByItemForMonth(transactions, year, month) {
  const byItem = {};
  for (const tx of transactions ?? []) {
    const d = new Date(tx.date);
    if (d.getFullYear() !== year || d.getMonth() + 1 !== month) continue;
    const key = tx.income_id != null ? `income-${tx.income_id}` : `expense-${tx.expense_id}`;
    byItem[key] = (byItem[key] || 0) + Number(tx.amount);
  }
  return byItem;
}

function getActual(byItem, itemId, listType) {
  const key = listType === "income" ? `income-${itemId}` : `expense-${itemId}`;
  return byItem[key] ?? 0;
}

/** @returns {{ variance: number, isOver: boolean, varianceLabel: string }} isOver = unfavorable (red) */
export function budgetVariance(listType, budgeted, actual) {
  const b = toNumber(budgeted);
  const a = toNumber(actual);
  const isIncome = listType === "income";
  const isOver = isIncome ? a < b : a > b;
  const diff = Math.abs(a - b);
  const difference = isIncome ? a - b : b - a;
  if (Math.round(diff) === 0) {
    return { variance: 0, isOver: false, difference: 0, varianceLabel: "$0" };
  }
  return {
    variance: difference,
    isOver,
    difference,
    varianceLabel: formatSignedChartMoney(difference),
  };
}

/**
 * @param {{ income?: unknown[], expenses?: unknown[] }} budgets
 * @param {unknown[]} transactions
 * @param {number} year
 * @param {number} month 1-12
 */
export function buildBudgetChartRows(budgets, transactions, year, month) {
  const byItem = actualByItemForMonth(transactions, year, month);
  const rows = [];

  for (const section of SECTION_DEFS) {
    let items = [];
    if (section.filterExpense) {
      items = (budgets?.expenses ?? []).filter(section.filterExpense).map((item) => ({
        item,
        listType: section.listType,
      }));
    } else if (section.filterIncome) {
      items = (budgets?.income ?? [])
        .filter(section.filterIncome)
        .filter((item) => !shouldOmitIncomeChartItem(item))
        .map((item) => ({
          item,
          listType: section.listType,
        }));
    }

    /** Payroll handled separately (net only); other categories grouped normally */
    const payrollItems = items.filter(({ item }) => isPayrollCategory(item.category));
    const nonPayrollItems = items.filter(({ item }) => !isPayrollCategory(item.category));

    const byCategory = new Map();
    for (const { item, listType } of nonPayrollItems) {
      if (isGrossIncomeBudgetLine(item)) continue;
      const cat = chartCategoryGroupKey(item, listType);
      let group = byCategory.get(cat);
      if (!group) {
        group = { category: cat, listType, budgeted: 0, itemIds: [] };
        byCategory.set(cat, group);
      }
      group.budgeted += toNumber(item.monthly_amount);
      group.itemIds.push(item.id);
    }

    if (payrollItems.length > 0) {
      const payrollGroup = computePayrollChartGroup(
        payrollItems,
        budgets,
        transactions,
        year,
        month,
      );
      byCategory.set(payrollGroup.category, payrollGroup);
    }

    const categories = [...byCategory.values()].sort((a, b) =>
      a.category.localeCompare(b.category),
    );

    for (const group of categories) {
      const actual =
        group.precomputedActual != null
          ? group.precomputedActual
          : sumActualForItemIds(byItem, group.itemIds, group.listType);
      const { isOver, varianceLabel, difference } = budgetVariance(
        group.listType,
        group.budgeted,
        actual,
      );
      const categoryName = group.category.trim() || "Uncategorized";
      const label = budgetCategoryLabel(section.title, group.category);
      const slug = group.category.replace(/[^\w]+/g, "-").toLowerCase() || "uncategorized";
      rows.push({
        id: `${section.key}-${slug}`,
        label,
        categoryLabel: categoryName,
        shortLabel: buildAxisCategoryLabel(categoryName),
        budgeted: group.budgeted,
        actual,
        isOver,
        difference,
        varianceLabel,
        listType: group.listType,
        sectionKey: section.key,
      });
    }
  }

  return rows;
}

function sumIncomeBudgetActual(budgets, byItem, predicate) {
  let budgeted = 0;
  let actual = 0;
  for (const item of budgets?.income ?? []) {
    if (!predicate(item)) continue;
    budgeted += toNumber(item.monthly_amount);
    actual += getActual(byItem, item.id, "income");
  }
  return { budgeted, actual };
}

function sumExpenseBudgetActual(budgets, byItem, predicate) {
  let budgeted = 0;
  let actual = 0;
  for (const item of budgets?.expenses ?? []) {
    if (!predicate(item)) continue;
    budgeted += toNumber(item.monthly_amount);
    actual += getActual(byItem, item.id, "expense");
  }
  return { budgeted, actual };
}

function makeSummaryChartRow({ id, categoryLabel, listType, budgeted, actual, sectionKey }) {
  const b = Math.round(budgeted * 100) / 100;
  const a = Math.round(actual * 100) / 100;
  const { isOver, varianceLabel, difference } = budgetVariance(listType, b, a);
  return {
    id,
    label: categoryLabel,
    categoryLabel,
    shortLabel: buildAxisCategoryLabel(categoryLabel),
    budgeted: b,
    actual: a,
    isOver,
    difference,
    varianceLabel,
    listType,
    sectionKey,
  };
}

/**
 * Second dashboard chart: fixed bars — Net Income, Investments, Savings, Tax, Insurance.
 * @param {{ income?: unknown[], expenses?: unknown[] }} budgets
 * @param {unknown[]} transactions
 * @param {number} year
 * @param {number} month 1-12
 */
export function buildOtherBudgetChartRows(budgets, transactions, year, month) {
  const byItem = actualByItemForMonth(transactions, year, month);

  const isTotalIncomeLine = (item) => {
    const t = (item.income_type || "gross").toLowerCase();
    if (t === "interest" || t === "other") return true;
    if (t === "gross") return isGrossIncomeBudgetLine(item) && !isNetIncomeBudgetLine(item);
    return false;
  };

  const totalIncome = sumIncomeBudgetActual(budgets, byItem, isTotalIncomeLine);
  const tax = sumIncomeBudgetActual(budgets, byItem, (i) => i.income_type === "tax");
  const insurance = sumIncomeBudgetActual(budgets, byItem, (i) => i.income_type === "deduction");
  const savings = sumExpenseBudgetActual(
    budgets,
    byItem,
    (e) => (e.expense_type || "expense") === "savings",
  );
  const investments = sumExpenseBudgetActual(budgets, byItem, (e) => e.expense_type === "investment");

  const netBudgeted = Math.max(
    0,
    Math.round((totalIncome.budgeted - tax.budgeted - insurance.budgeted - savings.budgeted) * 100) / 100,
  );
  const netActual = Math.max(
    0,
    Math.round((totalIncome.actual - tax.actual - insurance.actual - savings.actual) * 100) / 100,
  );

  return [
    makeSummaryChartRow({
      id: "summary-net-income",
      categoryLabel: "Net Income",
      listType: "income",
      budgeted: netBudgeted,
      actual: netActual,
      sectionKey: "income",
    }),
    makeSummaryChartRow({
      id: "summary-investments",
      categoryLabel: "Investments",
      listType: "expense",
      budgeted: investments.budgeted,
      actual: investments.actual,
      sectionKey: "investment",
    }),
    makeSummaryChartRow({
      id: "summary-savings",
      categoryLabel: "Savings",
      listType: "expense",
      budgeted: savings.budgeted,
      actual: savings.actual,
      sectionKey: "savings",
    }),
    makeSummaryChartRow({
      id: "summary-tax",
      categoryLabel: "Tax",
      listType: "expense",
      budgeted: tax.budgeted,
      actual: tax.actual,
      sectionKey: "tax",
    }),
    makeSummaryChartRow({
      id: "summary-insurance",
      categoryLabel: "Insurance",
      listType: "expense",
      budgeted: insurance.budgeted,
      actual: insurance.actual,
      sectionKey: "insurance",
    }),
  ];
}
