export interface BudgetChartRow {
  id: string;
  label: string;
  categoryLabel: string;
  shortLabel: string;
  budgeted: number;
  actual: number;
  isOver: boolean;
  difference: number;
  varianceLabel: string;
  listType: "income" | "expense";
  sectionKey: string;
}
