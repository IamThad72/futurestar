<template>
  <dialog ref="addBudgetDialogRef" class="modal" @close="submitError = ''">
    <div
      class="modal-box max-h-[90vh] overflow-y-auto"
      :class="form.type === 'income' ? 'max-w-2xl' : 'max-w-lg'"
    >
      <h3 class="font-semibold text-lg mb-4">{{ addBudgetModalTitle }}</h3>
      <form @submit.prevent="submitBudget" class="space-y-4">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label class="form-control w-full">
            <span class="label-text text-sm">Type</span>
            <select v-model="form.type" class="select select-bordered w-full">
              <option v-for="opt in budgetTypeOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </label>
          <label class="form-control w-full">
            <span class="label-text text-sm">Category <span class="text-error">*</span></span>
            <input
              v-model.trim="form.category"
              class="input input-bordered w-full"
              type="text"
              :placeholder="addCategoryPlaceholder"
              required
            />
          </label>
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label class="form-control w-full">
            <span class="label-text text-sm">Sub-category</span>
            <input
              v-model.trim="form.sub_category"
              class="input input-bordered w-full"
              type="text"
              placeholder="e.g. Rent, Utilities"
            />
          </label>
          <label v-if="form.type !== 'savings' && form.type !== 'investment'" class="form-control w-full">
            <span class="label-text text-sm">Description</span>
            <input
              v-model.trim="form.description"
              class="input input-bordered w-full"
              type="text"
              placeholder="Optional notes"
            />
          </label>
          <label v-if="form.type === 'expense'" class="form-control w-full md:col-span-2">
            <span class="label-text text-sm">
              Estate Management debt
              <span v-if="addNeedsDebtLink" class="text-error">*</span>
            </span>
            <select
              v-model="form.debt_id"
              class="select select-bordered w-full"
              :required="addNeedsDebtLink"
            >
              <option value="">
                {{ debtRecords.length ? "Select debt record…" : "No debt records — add in Estate Management" }}
              </option>
              <option v-for="row in debtRecords" :key="row.dbt_id" :value="String(row.dbt_id)">
                {{ formatDebtRecordLabel(row) }}
              </option>
            </select>
            <span class="label-text-alt text-base-content/60">
              Link this budget line to a loan or credit card from Estate Management (used in Budget Tracker).
            </span>
          </label>
          <template v-else>
            <label class="form-control w-full">
              <span class="label-text text-sm">From Account</span>
              <select v-model="form.from_cash_investment_id" class="select select-bordered w-full">
                <option value="">None</option>
                <option v-for="acct in cashAccounts" :key="`from-${acct.ci_id}`" :value="String(acct.ci_id)">
                  {{ [acct.institution, acct.acct_type].filter(Boolean).join(" — ") || `Account #${acct.ci_id}` }}
                </option>
              </select>
              <span class="label-text-alt text-base-content/60">Cash or investment account the amount comes from</span>
            </label>
            <label class="form-control w-full">
              <span class="label-text text-sm">To Account</span>
              <select v-model="form.cash_investment_id" class="select select-bordered w-full">
                <option value="">None</option>
                <option v-for="acct in cashAccounts" :key="`to-${acct.ci_id}`" :value="String(acct.ci_id)">
                  {{ [acct.institution, acct.acct_type].filter(Boolean).join(" — ") || `Account #${acct.ci_id}` }}
                </option>
              </select>
              <span class="label-text-alt text-base-content/60">Account to add this amount to</span>
            </label>
          </template>
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label class="form-control w-full">
            <span class="label-text text-sm">{{ form.type === 'income' ? 'Gross Income (monthly)' : 'Monthly Amount (default)' }}</span>
            <input
              v-model.number="form.monthly_amount"
              class="input input-bordered w-full"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              @input="syncAnnualFromMonthly"
            />
          </label>
          <label class="form-control w-full">
            <span class="label-text text-sm">{{ form.type === 'income' ? 'Gross Income (annual)' : 'Annual Total' }}</span>
            <input
              v-model.number="form.annual_amount"
              class="input input-bordered w-full"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              @input="syncMonthlyFromAnnual"
            />
          </label>
        </div>

        <div v-if="form.type === 'income'" class="space-y-4 rounded-lg border border-base-300 p-3">
          <p class="text-sm text-base-content/70">
            Allocate gross income to existing tax, insurance, retirement, and investment budget lines. The gross amount is saved on the line you are adding; the remainder updates your Net Income budget line when one exists.
          </p>
          <div v-if="!grossIncomeAllocatableLines.length" class="text-sm text-base-content/50 italic">
            No tax, insurance, retirement, or investment lines yet. The full gross amount is saved on this line; add a Net Income line to track take-home separately.
          </div>
          <template v-else>
            <div v-if="grossAllocTaxLines.length" class="space-y-2">
              <h4 class="text-sm font-semibold text-warning">Tax</h4>
              <div
                v-for="line in grossAllocTaxLines"
                :key="line.key"
                class="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_7rem] sm:items-center"
              >
                <span class="text-sm">{{ line.category }}{{ line.sub_category ? ` › ${line.sub_category}` : "" }}</span>
                <input
                  v-model.number="grossAllocationAmounts[line.key]"
                  class="input input-bordered input-sm w-full"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div v-if="grossAllocInsuranceLines.length" class="space-y-2">
              <h4 class="text-sm font-semibold">Insurance</h4>
              <div
                v-for="line in grossAllocInsuranceLines"
                :key="line.key"
                class="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_7rem] sm:items-center"
              >
                <span class="text-sm">{{ line.category }}{{ line.sub_category ? ` › ${line.sub_category}` : "" }}</span>
                <input
                  v-model.number="grossAllocationAmounts[line.key]"
                  class="input input-bordered input-sm w-full"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div v-if="grossAllocRetirementLines.length" class="space-y-2">
              <h4 class="text-sm font-semibold text-primary">Retirement</h4>
              <div
                v-for="line in grossAllocRetirementLines"
                :key="line.key"
                class="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_7rem] sm:items-center"
              >
                <span class="text-sm">{{ line.category }}{{ line.sub_category ? ` › ${line.sub_category}` : "" }}</span>
                <input
                  v-model.number="grossAllocationAmounts[line.key]"
                  class="input input-bordered input-sm w-full"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div v-if="grossAllocInvestmentLines.length" class="space-y-2">
              <h4 class="text-sm font-semibold text-secondary">Investments</h4>
              <div
                v-for="line in grossAllocInvestmentLines"
                :key="line.key"
                class="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_7rem] sm:items-center"
              >
                <span class="text-sm">{{ line.category }}{{ line.sub_category ? ` › ${line.sub_category}` : "" }}</span>
                <input
                  v-model.number="grossAllocationAmounts[line.key]"
                  class="input input-bordered input-sm w-full"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>
            </div>
          </template>
          <div class="flex flex-wrap items-baseline justify-between gap-2 border-t border-base-300 pt-3">
            <span class="text-sm font-medium">Net Income (monthly)</span>
            <span
              class="text-lg font-semibold tabular-nums"
              :class="grossIncomeNetMonthly < 0 ? 'text-error' : 'text-success'"
            >
              ${{ formatAmount(Math.max(0, grossIncomeNetMonthly)) }}
            </span>
          </div>
          <p v-if="grossIncomeNetMonthly < 0" class="text-xs text-error">
            Allocations exceed gross income by ${{ formatAmount(-grossIncomeNetMonthly) }}.
          </p>
        </div>

        <div v-if="submitError" class="text-sm text-error">{{ submitError }}</div>
        <div class="modal-action flex-wrap gap-2 mt-2">
          <button type="button" class="btn btn-ghost" @click="addBudgetDialogRef?.close()">Cancel</button>
          <button type="submit" class="btn btn-primary gap-2" :disabled="submitting">
            <template v-if="submitting">Adding...</template>
            <template v-else>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-5 shrink-0">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              Add item
            </template>
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button aria-label="Close">close</button>
    </form>
  </dialog>
</template>

<script setup>
import { budgetExpenseNeedsDebtLink, formatDebtRecordLabel } from "~/utils/budgetDebt";
import {
  buildGrossAllocatableLines,
  computeNetFromGross,
  findNetIncomeBudgetLine,
  getPositiveGrossAllocations,
  grossAllocationKey,
  partitionSavingsInvestmentForGrossAlloc,
  sumGrossAllocationAmounts,
} from "~/utils/grossIncomeAllocation";

const props = defineProps({
  /** When set, scopes list/create requests to this budget instead of the active one */
  budgetId: { type: Number, default: null },
});

const emit = defineEmits(["created", "saved"]);

const addBudgetDialogRef = ref(null);

const budgets = ref({ income: [], expenses: [] });
const cashAccounts = ref([]);
const debtRecords = ref([]);

const submitting = ref(false);
const submitError = ref("");

const grossAllocationAmounts = ref({});

const form = ref({
  type: "income",
  category: "",
  sub_category: "",
  description: "",
  debt_id: "",
  from_cash_investment_id: "",
  cash_investment_id: "",
  monthly_amount: null,
  annual_amount: null,
});

const addNeedsDebtLink = computed(() =>
  form.value.type === "expense" &&
  budgetExpenseNeedsDebtLink(form.value.category, form.value.sub_category, form.value.description),
);

/** Add-form Type dropdown: maps to income (gross/tax/deduction) or expense rows on submit */
const budgetTypeOptions = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "insurance", label: "Insurance" },
  { value: "investment", label: "Investments" },
  { value: "savings", label: "Savings" },
  { value: "tax", label: "Tax" },
];

const addBudgetModalTitle = computed(() => {
  const opt = budgetTypeOptions.find((o) => o.value === form.value.type);
  if (form.value.type === "income") return "Add Gross Income";
  return opt ? `Add ${opt.label}` : "Add Budget Item";
});

function isIncomeBudgetFormType(t) {
  return t === "income" || t === "tax" || t === "insurance";
}

function incomeTypeForBudgetFormType(t) {
  if (t === "income") return "gross";
  if (t === "tax") return "tax";
  if (t === "insurance") return "deduction";
  return undefined;
}

const addCategoryPlaceholder = computed(() => {
  switch (form.value.type) {
    case "tax":
      return "e.g. Federal, State, FICA";
    case "insurance":
      return "e.g. Health, Dental, Life";
    case "expense":
      return "e.g. Housing, Transportation";
    case "savings":
      return "e.g. Emergency Fund, Vacation";
    case "investment":
      return "e.g. Brokerage, IRA";
    default:
      return "e.g. Salary, Wages";
  }
});

function groupBudgetByCategory(items) {
  const byCategory = {};
  for (const item of items) {
    const cat = item.category || "Uncategorized";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(item);
  }
  for (const cat of Object.keys(byCategory)) {
    byCategory[cat].sort((a, b) =>
      (a.sub_category || "").toLowerCase().localeCompare((b.sub_category || "").toLowerCase()),
    );
  }
  return Object.entries(byCategory)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, grouped]) => ({ category, items: grouped }));
}

const taxGroupedByCategory = computed(() =>
  groupBudgetByCategory((budgets.value.income ?? []).filter((i) => i.income_type === "tax")),
);

const insuranceGroupedByCategory = computed(() =>
  groupBudgetByCategory((budgets.value.income ?? []).filter((i) => i.income_type === "deduction")),
);

const savingsGroupedByCategory = computed(() =>
  groupBudgetByCategory((budgets.value.expenses ?? []).filter((e) => e.expense_type === "savings")),
);

const investmentsGroupedByCategory = computed(() =>
  groupBudgetByCategory((budgets.value.expenses ?? []).filter((e) => e.expense_type === "investment")),
);

const grossAllocExpensePartition = computed(() =>
  partitionSavingsInvestmentForGrossAlloc(
    savingsGroupedByCategory.value,
    investmentsGroupedByCategory.value,
  ),
);

const grossIncomeAllocatableLines = computed(() =>
  buildGrossAllocatableLines(
    taxGroupedByCategory.value,
    insuranceGroupedByCategory.value,
    grossAllocExpensePartition.value.retirementGroups,
    [],
    grossAllocExpensePartition.value.investmentGroups,
  ).map((line) => ({
    ...line,
    key: grossAllocationKey(line.kind, line.id),
  })),
);

const grossAllocTaxLines = computed(() => grossIncomeAllocatableLines.value.filter((l) => l.kind === "tax"));
const grossAllocInsuranceLines = computed(() => grossIncomeAllocatableLines.value.filter((l) => l.kind === "insurance"));
const grossAllocRetirementLines = computed(() => grossIncomeAllocatableLines.value.filter((l) => l.kind === "retirement"));
const grossAllocInvestmentLines = computed(() =>
  grossIncomeAllocatableLines.value.filter((l) => l.kind === "investment"),
);

const grossIncomeAllocatedTotal = computed(() => sumGrossAllocationAmounts(grossAllocationAmounts.value));

const grossIncomeNetMonthly = computed(() =>
  computeNetFromGross(form.value.monthly_amount, grossIncomeAllocatedTotal.value),
);

function formatAmount(val) {
  if (val == null || val === "" || isNaN(val)) return "0.00";
  return Number(val).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function syncAnnualFromMonthly() {
  const m = form.value.monthly_amount;
  if (m != null && !isNaN(m)) {
    form.value.annual_amount = Math.round(m * 12 * 100) / 100;
  }
}

function syncMonthlyFromAnnual() {
  const a = form.value.annual_amount;
  if (a != null && !isNaN(a)) {
    form.value.monthly_amount = Math.round((a / 12) * 100) / 100;
  }
}

async function loadFormData() {
  try {
    const listQuery = props.budgetId != null ? { budget_id: props.budgetId } : undefined;
    const [budgetData, cashData, debtData] = await Promise.all([
      $fetch("/api/budget/list", listQuery ? { query: listQuery } : undefined),
      $fetch("/api/records/cash-and-investments").catch(() => ({ records: [] })),
      $fetch("/api/records/debt").then((d) => d?.records ?? []).catch(() => []),
    ]);
    budgets.value = { income: budgetData?.income ?? [], expenses: budgetData?.expenses ?? [] };
    cashAccounts.value = cashData?.records ?? [];
    debtRecords.value = Array.isArray(debtData) ? debtData : [];
  } catch (err) {
    console.error("Failed to load add-budget-item data", err);
  }
}

async function submitBudget() {
  submitError.value = "";
  let monthly = form.value.monthly_amount;
  let annual = form.value.annual_amount;
  if ((monthly == null || isNaN(monthly)) && (annual == null || isNaN(annual))) {
    submitError.value = "Enter a monthly or annual amount.";
    return;
  }
  if (form.value.type === "income") {
    if (grossIncomeNetMonthly.value < 0) {
      submitError.value = "Allocations cannot exceed gross income.";
      return;
    }
  }
  if (
    form.value.type === "expense" &&
    addNeedsDebtLink.value &&
    !form.value.debt_id
  ) {
    submitError.value = "Select the Estate Management debt record for this expense line.";
    return;
  }

  submitting.value = true;
  try {
    if (form.value.type === "income") {
      const allocations = getPositiveGrossAllocations(grossAllocationAmounts.value);
      for (const alloc of allocations) {
        const allocAnnual = Math.round(alloc.amount * 12 * 100) / 100;
        if (alloc.kind === "tax" || alloc.kind === "insurance") {
          await $fetch(`/api/budget/income/${alloc.id}`, {
            method: "PUT",
            body: {
              ...(props.budgetId != null ? { budget_id: props.budgetId } : {}),
              monthly_amount: alloc.amount,
              annual_amount: allocAnnual,
            },
          });
        } else {
          await $fetch(`/api/budget/expenses/${alloc.id}`, {
            method: "PUT",
            body: {
              ...(props.budgetId != null ? { budget_id: props.budgetId } : {}),
              monthly_amount: alloc.amount,
              annual_amount: allocAnnual,
            },
          });
        }
      }
    }

    const response = await $fetch("/api/budget/submit", {
      method: "POST",
      body: {
        ...(props.budgetId != null ? { budget_id: props.budgetId } : {}),
        type: isIncomeBudgetFormType(form.value.type) ? "income" : "expense",
        income_type: incomeTypeForBudgetFormType(form.value.type),
        expense_type:
          form.value.type === "savings"
            ? "savings"
            : form.value.type === "investment"
              ? "investment"
              : form.value.type === "expense"
                ? "expense"
                : undefined,
        category: form.value.category,
        sub_category: form.value.sub_category || null,
        description: form.value.type === "savings" || form.value.type === "investment" ? null : form.value.description || null,
        cash_investment_id: (form.value.type === "savings" || form.value.type === "investment") && form.value.cash_investment_id ? parseInt(String(form.value.cash_investment_id), 10) : null,
        from_cash_investment_id:
          (form.value.type === "savings" || form.value.type === "investment") && form.value.from_cash_investment_id
            ? parseInt(String(form.value.from_cash_investment_id), 10)
            : null,
        debt_id:
          form.value.type === "expense" && form.value.debt_id
            ? parseInt(String(form.value.debt_id), 10)
            : null,
        monthly_amount: monthly != null && !isNaN(monthly) ? monthly : null,
        annual_amount: annual != null && !isNaN(annual) ? annual : null,
      },
    });

    if (form.value.type === "income") {
      const netMonthly = grossIncomeNetMonthly.value;
      const netLine = findNetIncomeBudgetLine(budgets.value.income, {
        category: form.value.category,
      });
      if (netLine?.id != null && netMonthly >= 0) {
        const netAnnual = Math.round(netMonthly * 12 * 100) / 100;
        await $fetch(`/api/budget/income/${netLine.id}`, {
          method: "PUT",
          body: {
            ...(props.budgetId != null ? { budget_id: props.budgetId } : {}),
            monthly_amount: netMonthly,
            annual_amount: netAnnual,
          },
        });
      }
    }

    grossAllocationAmounts.value = {};
    form.value = {
      type: form.value.type,
      category: "",
      sub_category: "",
      description: "",
      debt_id: "",
      from_cash_investment_id: "",
      cash_investment_id: "",
      monthly_amount: null,
      annual_amount: null,
    };
    await loadFormData();
    addBudgetDialogRef.value?.close();

    if (response?.type && response?.id != null) {
      emit("created", { type: response.type, id: Number(response.id) });
    }
    emit("saved");
  } catch (err) {
    submitError.value = err?.data?.message || err?.message || "Failed to add budget.";
  } finally {
    submitting.value = false;
  }
}

function open(type) {
  submitError.value = "";
  grossAllocationAmounts.value = {};
  if (typeof type === "string" && type.length > 0) {
    form.value.type = type;
  }
  loadFormData();
  nextTick(() => addBudgetDialogRef.value?.showModal());
}

function close() {
  addBudgetDialogRef.value?.close();
}

defineExpose({ open, close });
</script>
