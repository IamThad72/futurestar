<template>
  <section class="mx-auto w-full max-w-7xl space-y-4 sm:space-y-6 p-4 sm:p-6 overflow-x-hidden min-w-0">
    <header>
      <h1 class="text-xl sm:text-2xl font-semibold text-base-content">Budget Setup</h1>
    </header>

    <div v-if="!auth.ready" class="rounded-lg border border-base-200 bg-base-300 p-4">
      <span class="text-sm text-base-content/70">Loading session...</span>
    </div>

    <div
      v-else-if="!auth.user"
      class="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning-content"
    >
      You must be logged in to use this page.
    </div>

    <div v-else class="space-y-6">
      <!-- Add Budget Form -->
      <div class="collapse collapse-arrow rounded-lg border border-base-200 bg-base-200">
        <input type="checkbox" />
        <div class="collapse-title font-semibold text-lg min-h-0 py-4 text-primary">Add Budget Item</div>
        <div class="collapse-content bg-base-200">
        <form @submit.prevent="submitBudget" class="space-y-4 pt-2 pb-4 px-1">
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
                :placeholder="form.type === 'tax' ? 'e.g. Federal, State, FICA' : form.type === 'deduction' ? 'e.g. 401k, Health Insurance' : form.type === 'interest' ? 'e.g. Savings, Dividends' : form.type === 'other' ? 'e.g. Rental, Side Gig, Bonus' : form.type === 'savings' ? 'e.g. Emergency Fund, Vacation' : form.type === 'investment' ? 'e.g. Brokerage, IRA' : 'e.g. Housing, Transportation, Salary'"
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
            <label v-else class="form-control w-full">
              <span class="label-text text-sm">Destination Account</span>
              <select v-model="form.cash_investment_id" class="select select-bordered w-full">
                <option value="">None</option>
                <option v-for="acct in cashAccounts" :key="acct.ci_id" :value="String(acct.ci_id)">
                  {{ [acct.institution, acct.acct_type].filter(Boolean).join(" — ") || `Account #${acct.ci_id}` }}
                </option>
              </select>
              <span class="label-text-alt text-base-content/60">Account to add this amount to</span>
            </label>
          </div>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label class="form-control w-full">
              <span class="label-text text-sm">Monthly Amount (default)</span>
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
              <span class="label-text text-sm">Annual Total</span>
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

          <div v-if="submitError" class="text-sm text-error">{{ submitError }}</div>
          <div class="flex justify-center">
            <button
              type="submit"
              class="btn btn-primary gap-2"
              :disabled="submitting"
            >
              <template v-if="submitting">Adding...</template>
              <template v-else>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                Item
              </template>
            </button>
          </div>
        </form>
        </div>
      </div>

      <!-- Budget Summary -->
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <!-- Income & Payroll -->
        <div class="collapse collapse-arrow rounded-lg border border-base-200 bg-base-200">
          <input type="checkbox" checked />
          <div class="collapse-title min-h-0 py-4">
            <h2 class="text-lg font-semibold flex flex-wrap items-center gap-x-4 gap-y-1">
              <span class="text-success">Income & Payroll</span>
              <span v-if="!loading" class="text-xs font-normal text-base-content">
                Total Income: ${{ formatAmount(totalIncome.monthly) }}/mo
              </span>
              <span v-if="!loading" class="text-xs font-normal text-base-content">
                Net Income: ${{ formatAmount(netIncome.monthly) }}/mo
              </span>
            </h2>
          </div>
          <div class="collapse-content px-6 pb-6 bg-base-200">
          <div v-if="loading" class="text-sm text-base-content/70">Loading...</div>
          <template v-else>
            <div v-if="incomeGroupedByCategory.length" class="space-y-4">
              <ul
                v-for="group in incomeGroupedByCategory"
                :key="`income-cat-${group.category}`"
                class="list bg-base-100 rounded-box border border-base-200 shadow-sm"
              >
                <li class="p-3 pb-1 text-sm font-medium text-base-content bg-base-100">{{ group.category }}</li>
                <li
                  v-for="item in group.items"
                  :key="`income-${item.id}`"
                  class="list-row items-center gap-2 px-3 py-2 bg-base-100"
                >
                  <div class="list-col-grow min-w-0">
                    <div class="text-secondary">{{ item.sub_category || "—" }}</div>
                    <div class="text-xs opacity-60 font-bold" :class="item.income_type === 'tax' || item.income_type === 'deduction' ? 'text-secondary' : 'text-primary'">
                      {{ (item.income_type === 'tax' || item.income_type === 'deduction') ? '-' : '' }}${{ formatAmount(item.monthly_amount) }}/mo
                    </div>
                  </div>
                  <div class="flex gap-1 shrink-0">
                    <button type="button" class="btn btn-ghost btn-sm btn-square" aria-label="Edit" @click="openEdit(item, 'income')">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" /></svg>
                    </button>
                    <button type="button" class="btn btn-ghost btn-sm btn-square text-error" aria-label="Delete" @click="confirmDelete(item, 'income')">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                    </button>
                  </div>
                </li>
              </ul>
            </div>
            <p v-else class="text-sm text-base-content/50 italic">No income items yet. Add one above.</p>
          </template>
          </div>
        </div>

        <!-- Expenses -->
        <div class="collapse collapse-arrow rounded-lg border border-base-200 bg-base-200">
          <input type="checkbox" checked />
          <div class="collapse-title min-h-0 py-4">
            <h2 class="text-lg font-semibold flex flex-wrap items-center gap-x-4 gap-y-1">
              <span class="text-error">Expenses</span>
              <span v-if="!loading" class="text-xs font-normal text-base-content">
                Total: ${{ formatAmount(totalExpenses.monthly) }}/mo
              </span>
            </h2>
          </div>
          <div class="collapse-content px-6 pb-6 bg-base-200">
          <div v-if="loading" class="text-sm text-base-content/70">Loading...</div>
          <div v-else-if="!expensesGroupedByCategory.length" class="text-sm text-base-content/60 italic">
            No expense categories yet. Add one above.
          </div>
          <div v-else class="space-y-4">
            <ul
              v-for="group in expensesGroupedByCategory"
              :key="`expense-cat-${group.category}`"
              class="list bg-base-100 rounded-box border border-base-200 shadow-sm"
            >
              <li class="p-3 pb-1 text-sm font-medium text-base-content bg-base-100">{{ group.category }}</li>
              <li
                v-for="item in group.items"
                :key="`expense-${item.id}`"
                class="list-row items-center gap-2 px-3 py-2 bg-base-100"
              >
                <div class="list-col-grow min-w-0">
                  <div class="text-secondary">{{ item.sub_category || "—" }}</div>
                  <div class="text-xs opacity-60 font-bold" :class="item.expense_type === 'savings' ? 'text-secondary' : item.expense_type === 'investment' ? 'text-secondary' : 'text-error'">
                    ${{ formatAmount(item.monthly_amount) }}/mo
                  </div>
                </div>
                <div class="flex gap-1 shrink-0">
                  <button type="button" class="btn btn-ghost btn-sm btn-square" aria-label="Edit" @click="openEdit(item, 'expense')">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" /></svg>
                  </button>
                  <button type="button" class="btn btn-ghost btn-sm btn-square text-error" aria-label="Delete" @click="confirmDelete(item, 'expense')">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                  </button>
                </div>
              </li>
            </ul>
          </div>
          </div>
        </div>
      </div>

      <!-- Edit Modal -->
      <dialog ref="editDialogRef" class="modal">
        <div class="modal-box">
          <h3 class="font-semibold text-lg mb-4">Edit Budget Item</h3>
          <form v-if="editingItem" @submit.prevent="saveEdit" class="space-y-4">
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label v-if="editingItem._type === 'income'" class="form-control w-full">
                <span class="label-text text-sm">Income type</span>
                <select v-model="editForm.income_type" class="select select-bordered w-full">
                  <option value="deduction">Deduction</option>
                  <option value="gross">Gross Pay</option>
                  <option value="interest">Interest</option>
                  <option value="other">Other</option>
                  <option value="tax">Tax</option>
                </select>
              </label>
              <label v-else-if="editingItem._type === 'expense'" class="form-control w-full">
                <span class="label-text text-sm">Type</span>
                <select v-model="editForm.expense_type" class="select select-bordered w-full">
                  <option value="expense">Expense</option>
                  <option value="investment">Investment</option>
                  <option value="savings">Savings</option>
                </select>
              </label>
              <label class="form-control w-full">
                <span class="label-text text-sm">Category</span>
                <input
                  v-model.trim="editForm.category"
                  class="input input-bordered w-full"
                  type="text"
                  required
                />
              </label>
            </div>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label class="form-control w-full">
                <span class="label-text text-sm">Sub-category</span>
                <input
                  v-model.trim="editForm.sub_category"
                  class="input input-bordered w-full"
                  type="text"
                />
              </label>
              <label v-if="editingItem._type !== 'expense' || (editForm.expense_type !== 'savings' && editForm.expense_type !== 'investment')" class="form-control w-full">
                <span class="label-text text-sm">Description</span>
                <input
                  v-model.trim="editForm.description"
                  class="input input-bordered w-full"
                  type="text"
                />
              </label>
              <label v-else class="form-control w-full">
                <span class="label-text text-sm">Destination Account</span>
                <select v-model="editForm.cash_investment_id" class="select select-bordered w-full">
                  <option value="">None</option>
                  <option v-for="acct in cashAccounts" :key="acct.ci_id" :value="String(acct.ci_id)">
                    {{ [acct.institution, acct.acct_type].filter(Boolean).join(" — ") || `Account #${acct.ci_id}` }}
                  </option>
                </select>
              </label>
            </div>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label class="form-control w-full">
                <span class="label-text text-sm">Monthly Amount</span>
                <input
                  v-model.number="editForm.monthly_amount"
                  class="input input-bordered w-full"
                  type="number"
                  min="0"
                  step="0.01"
                  @input="syncEditAnnualFromMonthly"
                />
              </label>
              <label class="form-control w-full">
                <span class="label-text text-sm">Annual Total</span>
                <input
                  v-model.number="editForm.annual_amount"
                  class="input input-bordered w-full"
                  type="number"
                  min="0"
                  step="0.01"
                  @input="syncEditMonthlyFromAnnual"
                />
              </label>
            </div>
            <div v-if="editError" class="text-sm text-error">{{ editError }}</div>
            <div class="modal-action">
              <button type="button" class="btn btn-ghost" @click="editDialogRef?.close()">Cancel</button>
              <button type="submit" class="btn btn-primary" :disabled="saving">
                {{ saving ? "Saving..." : "Save" }}
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      <!-- Delete Confirm Modal -->
      <dialog ref="deleteDialogRef" class="modal">
        <div class="modal-box">
          <h3 class="font-semibold text-lg mb-2">Delete Budget Item?</h3>
          <p v-if="deletingItem" class="text-sm text-base-content/70 mb-4">
            Remove "{{ deletingItem.category }}{{ deletingItem.sub_category ? ' › ' + deletingItem.sub_category : '' }}"?
          </p>
          <div class="modal-action">
            <button type="button" class="btn btn-ghost" @click="deleteDialogRef?.close()">Cancel</button>
            <button
              type="button"
              class="btn btn-error"
              :disabled="deleting"
              @click="performDelete"
            >
              {{ deleting ? "Deleting..." : "Delete" }}
            </button>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </div>
  </section>
</template>

<script setup>
const auth = useAuthStore();
const editDialogRef = ref(null);
const deleteDialogRef = ref(null);
const budgets = ref({ income: [], expenses: [] });
const loading = ref(true);
const submitting = ref(false);
const saving = ref(false);
const deleting = ref(false);
const submitError = ref("");
const editError = ref("");
const editingItem = ref(null);
const deletingItem = ref(null);

const cashAccounts = ref([]);

const form = ref({
  type: "income",
  category: "",
  sub_category: "",
  description: "",
  cash_investment_id: "",
  monthly_amount: null,
  annual_amount: null,
});

const editForm = ref({
  income_type: "gross",
  expense_type: "expense",
  category: "",
  sub_category: "",
  description: "",
  cash_investment_id: "",
  monthly_amount: null,
  annual_amount: null,
});

const budgetTypeOptions = [
  { value: "deduction", label: "Deduction" },
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "interest", label: "Interest" },
  { value: "investment", label: "Investment" },
  { value: "other", label: "Other" },
  { value: "savings", label: "Savings" },
  { value: "tax", label: "Tax" },
];

const incomeByType = computed(() => {
  const income = budgets.value.income ?? [];
  return {
    gross: income.filter((i) => (i.income_type || "gross") === "gross"),
    interest: income.filter((i) => i.income_type === "interest"),
    other: income.filter((i) => i.income_type === "other"),
    tax: income.filter((i) => i.income_type === "tax"),
    deduction: income.filter((i) => i.income_type === "deduction"),
  };
});

function sumAmounts(items, field) {
  return (items ?? []).reduce((acc, i) => acc + (Number(i[field]) || 0), 0);
}

const totals = computed(() => ({
  gross: {
    monthly: sumAmounts(incomeByType.value.gross, "monthly_amount"),
    annual: sumAmounts(incomeByType.value.gross, "annual_amount"),
  },
  interest: {
    monthly: sumAmounts(incomeByType.value.interest, "monthly_amount"),
    annual: sumAmounts(incomeByType.value.interest, "annual_amount"),
  },
  other: {
    monthly: sumAmounts(incomeByType.value.other, "monthly_amount"),
    annual: sumAmounts(incomeByType.value.other, "annual_amount"),
  },
  tax: {
    monthly: sumAmounts(incomeByType.value.tax, "monthly_amount"),
    annual: sumAmounts(incomeByType.value.tax, "annual_amount"),
  },
  deduction: {
    monthly: sumAmounts(incomeByType.value.deduction, "monthly_amount"),
    annual: sumAmounts(incomeByType.value.deduction, "annual_amount"),
  },
}));

/** Total Income = Gross Income + Interest + Other (excludes tax/deduction) */
const totalIncome = computed(() => ({
  monthly: totals.value.gross.monthly + totals.value.interest.monthly + totals.value.other.monthly,
  annual: totals.value.gross.annual + totals.value.interest.annual + totals.value.other.annual,
}));

/** Match deduction by category/sub_category (case-insensitive) */
function matchDeduction(items, patterns) {
  const match = (text) => {
    const t = (text || "").toLowerCase();
    return patterns.some((p) => t.includes(p));
  };
  return (items ?? []).filter(
    (i) => match(i.category) || match(i.sub_category),
  );
}

/** Net Income = Income + Interest - Family Insurance - Supplemental Life Insurance - Savings - Taxes */
const netIncome = computed(() => {
  const deductions = incomeByType.value.deduction;
  const familyInsurance = matchDeduction(deductions, ["family insurance", "family health", "health insurance"]);
  const supplementalLife = matchDeduction(deductions, ["supplemental life", "supplemental life insurance"]);
  const savingsItems = (budgets.value.expenses ?? []).filter((e) => e.expense_type === "savings");

  const familyInsuranceMonthly = sumAmounts(familyInsurance, "monthly_amount");
  const familyInsuranceAnnual = sumAmounts(familyInsurance, "annual_amount");
  const supplementalLifeMonthly = sumAmounts(supplementalLife, "monthly_amount");
  const supplementalLifeAnnual = sumAmounts(supplementalLife, "annual_amount");
  const savingsMonthly = sumAmounts(savingsItems, "monthly_amount");
  const savingsAnnual = sumAmounts(savingsItems, "annual_amount");

  return {
    monthly:
      totalIncome.value.monthly -
      familyInsuranceMonthly -
      supplementalLifeMonthly -
      savingsMonthly -
      totals.value.tax.monthly,
    annual:
      totalIncome.value.annual -
      familyInsuranceAnnual -
      supplementalLifeAnnual -
      savingsAnnual -
      totals.value.tax.annual,
  };
});

const totalExpenses = computed(() => {
  const items = budgets.value.expenses ?? [];
  return {
    monthly: sumAmounts(items, "monthly_amount"),
    annual: sumAmounts(items, "annual_amount"),
  };
});

/** Group income items by category, with items ordered by sub-category within each category */
const incomeGroupedByCategory = computed(() => {
  const items = budgets.value.income ?? [];
  const byCategory = {};
  for (const item of items) {
    const cat = item.category || "Uncategorized";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(item);
  }
  for (const cat of Object.keys(byCategory)) {
    byCategory[cat].sort((a, b) => {
      const sa = (a.sub_category || "").toLowerCase();
      const sb = (b.sub_category || "").toLowerCase();
      return sa.localeCompare(sb);
    });
  }
  return Object.entries(byCategory)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, items]) => ({ category, items }));
});

/** Group expense items by category, with items ordered by sub-category within each category */
const expensesGroupedByCategory = computed(() => {
  const items = budgets.value.expenses ?? [];
  const byCategory = {};
  for (const item of items) {
    const cat = item.category || "Uncategorized";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(item);
  }
  for (const cat of Object.keys(byCategory)) {
    byCategory[cat].sort((a, b) => {
      const sa = (a.sub_category || "").toLowerCase();
      const sb = (b.sub_category || "").toLowerCase();
      return sa.localeCompare(sb);
    });
  }
  return Object.entries(byCategory)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, items]) => ({ category, items }));
});

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

function syncEditAnnualFromMonthly() {
  const m = editForm.value.monthly_amount;
  if (m != null && !isNaN(m)) {
    editForm.value.annual_amount = Math.round(m * 12 * 100) / 100;
  }
}

function syncEditMonthlyFromAnnual() {
  const a = editForm.value.annual_amount;
  if (a != null && !isNaN(a)) {
    editForm.value.monthly_amount = Math.round((a / 12) * 100) / 100;
  }
}

async function loadBudgets() {
  if (!auth.user) return;
  loading.value = true;
  try {
    const [budgetData, cashData] = await Promise.all([
      $fetch("/api/budget/list"),
      $fetch("/api/records/cash-and-investments"),
    ]);
    budgets.value = { income: budgetData.income ?? [], expenses: budgetData.expenses ?? [] };
    cashAccounts.value = cashData.records ?? [];
  } catch (err) {
    console.error("Failed to load budgets", err);
    budgets.value = { income: [], expenses: [] };
    cashAccounts.value = [];
  } finally {
    loading.value = false;
  }
}

async function submitBudget() {
  submitError.value = "";
  const monthly = form.value.monthly_amount;
  const annual = form.value.annual_amount;
  if ((monthly == null || isNaN(monthly)) && (annual == null || isNaN(annual))) {
    submitError.value = "Enter a monthly or annual amount.";
    return;
  }

  submitting.value = true;
  try {
    await $fetch("/api/budget/submit", {
      method: "POST",
      body: {
        type: form.value.type === "income" || form.value.type === "tax" || form.value.type === "deduction" || form.value.type === "interest" || form.value.type === "other" ? "income" : "expense",
        income_type: form.value.type === "income" ? "gross" : form.value.type === "tax" ? "tax" : form.value.type === "deduction" ? "deduction" : form.value.type === "interest" ? "interest" : form.value.type === "other" ? "other" : undefined,
        expense_type: form.value.type === "savings" ? "savings" : form.value.type === "investment" ? "investment" : form.value.type === "expense" ? "expense" : undefined,
        category: form.value.category,
        sub_category: form.value.sub_category || null,
        description: form.value.type === "savings" || form.value.type === "investment" ? null : form.value.description || null,
        cash_investment_id: (form.value.type === "savings" || form.value.type === "investment") && form.value.cash_investment_id ? parseInt(String(form.value.cash_investment_id), 10) : null,
        monthly_amount: monthly != null && !isNaN(monthly) ? monthly : null,
        annual_amount: annual != null && !isNaN(annual) ? annual : null,
      },
    });
    form.value = {
      type: form.value.type,
      category: "",
      sub_category: "",
      description: "",
      cash_investment_id: "",
      monthly_amount: null,
      annual_amount: null,
    };
    await loadBudgets();
  } catch (err) {
    submitError.value = err?.data?.message || err?.message || "Failed to add budget.";
  } finally {
    submitting.value = false;
  }
}

function openEdit(item, type) {
  editingItem.value = { ...item, _type: type };
  editForm.value = {
    income_type: item.income_type || "gross",
    expense_type: item.expense_type || "expense",
    category: item.category,
    sub_category: item.sub_category || "",
    description: item.description || "",
    cash_investment_id: item.cash_investment_id ? String(item.cash_investment_id) : "",
    monthly_amount: item.monthly_amount,
    annual_amount: item.annual_amount,
  };
  editError.value = "";
  nextTick(() => editDialogRef.value?.showModal());
}

async function saveEdit() {
  editError.value = "";
  const item = editingItem.value;
  if (!item) return;

  const monthly = editForm.value.monthly_amount;
  const annual = editForm.value.annual_amount;
  if ((monthly == null || isNaN(monthly)) && (annual == null || isNaN(annual))) {
    editError.value = "Enter a monthly or annual amount.";
    return;
  }

  saving.value = true;
  try {
    const path = item._type === "income"
      ? `/api/budget/income/${item.id}`
      : `/api/budget/expenses/${item.id}`;
    await $fetch(path, {
      method: "PUT",
      body: {
        income_type: item._type === "income" ? editForm.value.income_type : undefined,
        expense_type: item._type === "expense" ? editForm.value.expense_type : undefined,
        category: editForm.value.category,
        sub_category: editForm.value.sub_category || null,
        description: (item._type !== "expense" || (editForm.value.expense_type !== "savings" && editForm.value.expense_type !== "investment")) ? editForm.value.description || null : null,
        cash_investment_id: item._type === "expense" && (editForm.value.expense_type === "savings" || editForm.value.expense_type === "investment") && editForm.value.cash_investment_id ? parseInt(String(editForm.value.cash_investment_id), 10) : null,
        monthly_amount: monthly != null && !isNaN(monthly) ? monthly : null,
        annual_amount: annual != null && !isNaN(annual) ? annual : null,
      },
    });
    editDialogRef.value?.close();
    editingItem.value = null;
    await loadBudgets();
  } catch (err) {
    editError.value = err?.data?.message || err?.message || "Failed to update budget.";
  } finally {
    saving.value = false;
  }
}

function confirmDelete(item, type) {
  deletingItem.value = { ...item, _type: type };
  nextTick(() => deleteDialogRef.value?.showModal());
}

async function performDelete() {
  const item = deletingItem.value;
  if (!item) return;

  deleting.value = true;
  try {
    const path = item._type === "income"
      ? `/api/budget/income/${item.id}`
      : `/api/budget/expenses/${item.id}`;
    await $fetch(path, { method: "DELETE" });
    deleteDialogRef.value?.close();
    deletingItem.value = null;
    await loadBudgets();
  } catch (err) {
    console.error("Failed to delete", err);
  } finally {
    deleting.value = false;
  }
}

onMounted(() => {
  if (!auth.ready) {
    auth.fetchSession();
  }
});

watch(
  () => auth.user,
  (user) => {
    if (user) loadBudgets();
  },
  { immediate: true },
);
</script>
