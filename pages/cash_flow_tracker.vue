<template>
  <section class="mx-auto w-full max-w-7xl space-y-4 sm:space-y-6 p-4 sm:p-6 overflow-x-hidden min-w-0">
    <header>
      <h1 class="text-xl sm:text-2xl font-semibold">Cash Flow Tracker</h1>
    </header>

    <div v-if="!auth.ready" class="rounded-lg border border-base-200 bg-base-100 p-4">
      <span class="text-sm text-base-content/70">Loading session...</span>
    </div>

    <div
      v-else-if="!auth.user"
      class="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning-content"
    >
      You must be logged in to use this page.
    </div>

    <div v-else class="space-y-6">
      <!-- Month selector & Add Transaction -->
      <div class="flex flex-wrap items-center gap-4">
        <div class="flex items-center gap-2">
          <label class="label-text text-sm">Month</label>
          <select v-model="selectedMonth" class="select select-bordered select-sm w-36">
            <option v-for="m in 12" :key="m" :value="m">{{ monthNames[m - 1] }}</option>
          </select>
        </div>
        <div class="flex items-center gap-2">
          <label class="label-text text-sm">Year</label>
          <select v-model="selectedYear" class="select select-bordered select-sm w-24">
            <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
          </select>
        </div>
        <button type="button" class="btn btn-primary btn-sm" @click="showAddTransaction = true">
          Add Transaction
        </button>
      </div>

      <!-- Budget vs Actual Table -->
      <div class="collapse collapse-arrow rounded-lg border border-base-200 bg-base-100">
        <input type="checkbox" />
        <div class="collapse-title font-semibold text-lg min-h-0 py-4">
          Budget vs Actual — {{ monthNames[selectedMonth - 1] }} {{ selectedYear }}
        </div>
        <div class="collapse-content">
        <div v-if="loading" class="p-8 text-center text-base-content/70">Loading...</div>
        <div v-else class="overflow-x-auto">
          <table class="table [&_th]:py-2 [&_th]:px-3 [&_td]:py-2 [&_td]:px-3">
            <thead>
              <tr>
                <th>Type</th>
                <th>Category</th>
                <th>Sub-category</th>
                <th class="text-right">Budgeted (mo)</th>
                <th class="text-right">Actual</th>
                <th class="text-right">Variance</th>
              </tr>
            </thead>
            <tbody>
              <!-- Income rows -->
              <template v-for="group in incomeGroupedByCategory" :key="`inc-${group.category}`">
                <tr v-for="(item, idx) in group.items" :key="`inc-${item.id}`">
                  <td v-if="idx === 0" :rowspan="group.items.length" class="font-medium text-success">Income</td>
                  <td v-if="idx === 0" :rowspan="group.items.length">{{ group.category }}</td>
                  <td>
                    <button
                      type="button"
                      class="link link-hover link-success text-left"
                      @click="openSubCategoryModal(item, 'income', group)"
                    >
                      {{ item.sub_category || "—" }}
                    </button>
                  </td>
                  <td class="text-right">{{ formatAmount(item.monthly_amount) }}</td>
                  <td class="text-right">{{ formatAmount(getActualForItem(item.id, 'income')) }}</td>
                  <td class="text-right" :class="getVarianceClass(item.id, 'income', item.monthly_amount)">
                    {{ formatVariance(item.id, 'income', item.monthly_amount) }}
                  </td>
                </tr>
              </template>
              <!-- Expense rows -->
              <template v-for="group in expensesGroupedByCategory" :key="`exp-${group.category}`">
                <tr v-for="(item, idx) in group.items" :key="`exp-${item.id}`">
                  <td v-if="idx === 0" :rowspan="group.items.length" class="font-medium text-error">Expense</td>
                  <td v-if="idx === 0" :rowspan="group.items.length">{{ group.category }}</td>
                  <td>
                    <button
                      type="button"
                      class="link link-hover link-error text-left"
                      @click="openSubCategoryModal(item, 'expense', group)"
                    >
                      {{ item.sub_category || "—" }}
                    </button>
                  </td>
                  <td class="text-right">{{ formatAmount(item.monthly_amount) }}</td>
                  <td class="text-right">{{ formatAmount(getActualForItem(item.id, 'expense')) }}</td>
                  <td class="text-right" :class="getVarianceClass(item.id, 'expense', item.monthly_amount)">
                    {{ formatVariance(item.id, 'expense', item.monthly_amount) }}
                  </td>
                </tr>
              </template>
              <tr v-if="!loading && !incomeGroupedByCategory.length && !expensesGroupedByCategory.length">
                <td colspan="6" class="text-center text-base-content/50 py-8">
                  No budget items yet. Add budget items in Cash Flow Management first.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        </div>
      </div>

      <!-- Add Transaction Modal -->
      <dialog ref="addDialogRef" class="modal">
        <div class="modal-box">
          <h3 class="font-semibold text-lg mb-4">Add Transaction</h3>
          <form @submit.prevent="submitTransaction" class="space-y-4">
            <div class="flex flex-wrap gap-4">
              <label class="flex items-center gap-2 cursor-pointer">
                <input v-model="txForm.type" type="radio" value="income" class="radio radio-primary" />
                <span>Income</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input v-model="txForm.type" type="radio" value="expense" class="radio radio-primary" />
                <span>Expense</span>
              </label>
            </div>
            <label class="form-control w-full">
              <span class="label-text text-sm">Budget Item <span class="text-error">*</span></span>
              <select v-model="txForm.budgetItemId" class="select select-bordered w-full" required>
                <option value="">Select...</option>
                <template v-if="txForm.type === 'income'">
                  <optgroup v-for="group in incomeGroupedByCategory" :key="`opt-inc-${group.category}`" :label="group.category">
                    <option v-for="item in group.items" :key="item.id" :value="item.id">
                      {{ item.sub_category || group.category }} — ${{ formatAmount(item.monthly_amount) }}/mo
                    </option>
                  </optgroup>
                </template>
                <template v-else>
                  <optgroup v-for="group in expensesGroupedByCategory" :key="`opt-exp-${group.category}`" :label="group.category">
                    <option v-for="item in group.items" :key="item.id" :value="item.id">
                      {{ item.sub_category || group.category }} — ${{ formatAmount(item.monthly_amount) }}/mo
                    </option>
                  </optgroup>
                </template>
              </select>
            </label>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label class="form-control w-full">
                <span class="label-text text-sm">Date <span class="text-error">*</span></span>
                <input
                  v-model="txForm.date"
                  class="input input-bordered w-full"
                  type="date"
                  required
                />
              </label>
              <label class="form-control w-full">
                <span class="label-text text-sm">Amount <span class="text-error">*</span></span>
                <input
                  v-model.number="txForm.amount"
                  class="input input-bordered w-full"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  required
                />
              </label>
            </div>
            <label class="form-control w-full">
              <span class="label-text text-sm">Description</span>
              <input v-model.trim="txForm.description" class="input input-bordered w-full" type="text" placeholder="Optional" />
            </label>
            <div v-if="txError" class="text-sm text-error">{{ txError }}</div>
            <div class="modal-action">
              <button type="button" class="btn btn-ghost" @click="addDialogRef?.close()">Cancel</button>
              <button type="submit" class="btn btn-primary" :disabled="txSubmitting">
                {{ txSubmitting ? "Adding..." : "Add Transaction" }}
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      <!-- Sub-category Transactions Modal -->
      <dialog ref="subCategoryModalRef" class="modal">
        <div class="modal-box max-w-2xl max-h-[85vh] flex flex-col">
          <h3 class="font-semibold text-lg mb-4">
            {{ selectedBudgetItem ? `${selectedBudgetItem.category} › ${selectedBudgetItem.sub_category || selectedBudgetItem.category}` : '' }} — Transactions
          </h3>
          <div v-if="selectedBudgetItem" class="flex-1 overflow-y-auto min-h-0">
            <div v-if="!transactionsForModal.length" class="text-base-content/50 italic py-4">No transactions yet.</div>
            <div v-else class="space-y-3">
              <div
                v-for="tx in transactionsForModal"
                :key="tx.id"
                class="border border-base-200 rounded-lg p-3"
              >
                <template v-if="editingTxId === tx.id">
                  <form @submit.prevent="saveEditTransaction" class="space-y-3">
                    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label class="form-control">
                        <span class="label-text text-sm">Date</span>
                        <input v-model="editTxForm.date" class="input input-bordered input-sm w-full" type="date" required />
                      </label>
                      <label class="form-control">
                        <span class="label-text text-sm">Amount</span>
                        <input v-model.number="editTxForm.amount" class="input input-bordered input-sm w-full" type="number" min="0" step="0.01" required />
                      </label>
                    </div>
                    <label class="form-control">
                      <span class="label-text text-sm">Description</span>
                      <input v-model.trim="editTxForm.description" class="input input-bordered input-sm w-full" type="text" />
                    </label>
                    <div v-if="editTxError" class="text-sm text-error">{{ editTxError }}</div>
                    <div class="flex gap-2">
                      <button type="submit" class="btn btn-primary btn-sm" :disabled="editTxSaving">Save</button>
                      <button type="button" class="btn btn-ghost btn-sm" @click="cancelEdit">Cancel</button>
                    </div>
                  </form>
                </template>
                <template v-else>
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span class="font-medium">{{ formatDate(tx.date) }}</span>
                      <span class="ml-2" :class="tx.type === 'income' ? 'text-success' : 'text-error'">
                        {{ tx.type === 'income' ? '' : '-' }}${{ formatAmount(tx.amount) }}
                      </span>
                      <div v-if="tx.description" class="text-sm text-base-content/60 mt-0.5">{{ tx.description }}</div>
                    </div>
                    <div class="flex gap-1">
                      <button type="button" class="btn btn-ghost btn-sm btn-square" aria-label="Edit" @click="startEditTx(tx)">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" /></svg>
                      </button>
                      <button type="button" class="btn btn-ghost btn-sm btn-square text-error" aria-label="Delete" @click="confirmDeleteFromModal(tx)">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                      </button>
                    </div>
                  </div>
                </template>
              </div>
            </div>
            <div class="mt-4 pt-4 border-t border-base-200">
              <button type="button" class="btn btn-primary btn-sm" @click="addTxForSubCategory">
                Add Transaction
              </button>
            </div>
          </div>
          <div class="modal-action mt-4">
            <button type="button" class="btn btn-ghost" @click="subCategoryModalRef?.close()">Close</button>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      <!-- Delete Confirm Modal -->
      <dialog ref="deleteDialogRef" class="modal">
        <div class="modal-box">
          <h3 class="font-semibold text-lg mb-2">Delete Transaction?</h3>
          <p v-if="deletingTx" class="text-sm text-base-content/70 mb-4">
            Remove {{ deletingTx.category }}{{ deletingTx.sub_category ? ' › ' + deletingTx.sub_category : '' }} — ${{ formatAmount(deletingTx.amount) }}?
          </p>
          <div class="modal-action">
            <button type="button" class="btn btn-ghost" @click="deleteDialogRef?.close()">Cancel</button>
            <button type="button" class="btn btn-error" :disabled="deleting" @click="performDelete">
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
const addDialogRef = ref(null);
const deleteDialogRef = ref(null);
const subCategoryModalRef = ref(null);
const selectedBudgetItem = ref(null);
const editingTxId = ref(null);
const editTxForm = ref({ date: "", amount: null, description: "" });
const editTxError = ref("");
const editTxSaving = ref(false);
const budgets = ref({ income: [], expenses: [] });
const transactions = ref([]);
const loading = ref(true);
const showAddTransaction = ref(false);
const txSubmitting = ref(false);
const deleting = ref(false);
const txError = ref("");
const deletingTx = ref(null);

const now = new Date();
const currentYear = now.getFullYear();
const selectedMonth = ref(now.getMonth() + 1);
const selectedYear = ref(currentYear >= 2026 && currentYear <= 2032 ? currentYear : 2026);
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const yearOptions = computed(() => {
  const years = [];
  for (let y = 2026; y <= 2032; y++) {
    years.push(y);
  }
  return years;
});

const txForm = ref({
  type: "expense",
  budgetItemId: "",
  date: "",
  amount: null,
  description: "",
});

/** Group income by category */
const incomeGroupedByCategory = computed(() => {
  const items = budgets.value.income ?? [];
  const byCategory = {};
  for (const item of items) {
    const cat = item.category || "Uncategorized";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(item);
  }
  for (const cat of Object.keys(byCategory)) {
    byCategory[cat].sort((a, b) => ((a.sub_category || "").toLowerCase()).localeCompare((b.sub_category || "").toLowerCase()));
  }
  return Object.entries(byCategory)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, items]) => ({ category, items }));
});

/** Group expenses by category */
const expensesGroupedByCategory = computed(() => {
  const items = budgets.value.expenses ?? [];
  const byCategory = {};
  for (const item of items) {
    const cat = item.category || "Uncategorized";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(item);
  }
  for (const cat of Object.keys(byCategory)) {
    byCategory[cat].sort((a, b) => ((a.sub_category || "").toLowerCase()).localeCompare((b.sub_category || "").toLowerCase()));
  }
  return Object.entries(byCategory)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, items]) => ({ category, items }));
});

/** Actual totals by budget item for selected month */
const actualByItem = computed(() => {
  const byItem = {};
  const txList = transactions.value ?? [];
  const y = selectedYear.value;
  const m = selectedMonth.value;
  for (const tx of txList) {
    const d = new Date(tx.date);
    if (d.getFullYear() !== y || d.getMonth() + 1 !== m) continue;
    const key = tx.income_id != null ? `income-${tx.income_id}` : `expense-${tx.expense_id}`;
    byItem[key] = (byItem[key] || 0) + Number(tx.amount);
  }
  return byItem;
});

/** Transactions for the selected sub-category (budget item) */
const transactionsForModal = computed(() => {
  const item = selectedBudgetItem.value;
  if (!item) return [];
  const txList = transactions.value ?? [];
  return txList
    .filter((tx) =>
      item.type === "income"
        ? tx.income_id === item.id
        : tx.expense_id === item.id,
    )
    .sort((a, b) => new Date(b.date) - new Date(a.date));
});

function getActualForItem(itemId, type) {
  const key = type === "income" ? `income-${itemId}` : `expense-${itemId}`;
  return actualByItem.value[key] ?? 0;
}

function getVarianceClass(itemId, type, budgeted) {
  const actual = getActualForItem(itemId, type);
  const variance = type === "income" ? actual - (budgeted || 0) : (budgeted || 0) - actual;
  if (Math.abs(variance) < 0.01) return "text-base-content/60";
  if (type === "income") return variance >= 0 ? "text-success" : "text-warning";
  return variance >= 0 ? "text-success" : "text-error";
}

function formatVariance(itemId, type, budgeted) {
  const actual = getActualForItem(itemId, type);
  const variance = type === "income" ? actual - (budgeted || 0) : (budgeted || 0) - actual;
  const sign = variance >= 0 ? "+" : "";
  return `${sign}$${formatAmount(Math.abs(variance))}`;
}

function formatAmount(val) {
  if (val == null || val === "" || isNaN(val)) return "0.00";
  return Number(val).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

async function loadData() {
  if (!auth.user) return;
  loading.value = true;
  try {
    const [budgetData, txData] = await Promise.all([
      $fetch("/api/budget/list"),
      $fetch("/api/budget/transactions/list"),
    ]);
    budgets.value = { income: budgetData.income ?? [], expenses: budgetData.expenses ?? [] };
    transactions.value = txData.transactions ?? [];
  } catch (err) {
    console.error("Failed to load", err);
    budgets.value = { income: [], expenses: [] };
    transactions.value = [];
  } finally {
    loading.value = false;
  }
}

watch(showAddTransaction, (v) => {
  if (v) {
    const pad = (n) => String(n).padStart(2, "0");
    txForm.value = {
      type: "expense",
      budgetItemId: "",
      date: `${selectedYear.value}-${pad(selectedMonth.value)}-01`,
      amount: null,
      description: "",
    };
    txError.value = "";
    nextTick(() => addDialogRef.value?.showModal());
    showAddTransaction.value = false;
  }
});

watch(() => txForm.value.type, () => {
  txForm.value.budgetItemId = "";
});

async function submitTransaction() {
  txError.value = "";
  const id = txForm.value.budgetItemId;
  const amount = txForm.value.amount;
  if (!id || amount == null || isNaN(amount)) {
    txError.value = "Please select a budget item and enter an amount.";
    return;
  }

  txSubmitting.value = true;
  try {
    const body =
      txForm.value.type === "income"
        ? { type: "income", income_id: parseInt(id, 10), transaction_date: txForm.value.date, amount, description: txForm.value.description || null }
        : { type: "expense", expense_id: parseInt(id, 10), transaction_date: txForm.value.date, amount, description: txForm.value.description || null };
    await $fetch("/api/budget/transactions/submit", { method: "POST", body });
    addDialogRef.value?.close();
    await loadData();
    if (selectedBudgetItem.value) {
      nextTick(() => subCategoryModalRef.value?.showModal());
    }
  } catch (err) {
    txError.value = err?.data?.message || err?.message || "Failed to add transaction.";
  } finally {
    txSubmitting.value = false;
  }
}

function openSubCategoryModal(item, type, group) {
  selectedBudgetItem.value = {
    ...item,
    type,
    category: group.category,
    sub_category: item.sub_category || null,
  };
  editingTxId.value = null;
  nextTick(() => subCategoryModalRef.value?.showModal());
}

function startEditTx(tx) {
  editingTxId.value = tx.id;
  const d = new Date(tx.date);
  editTxForm.value = {
    date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    amount: tx.amount,
    description: tx.description || "",
  };
  editTxError.value = "";
}

function cancelEdit() {
  editingTxId.value = null;
}

async function saveEditTransaction() {
  if (!editingTxId.value) return;
  editTxError.value = "";
  const amount = editTxForm.value.amount;
  if (amount == null || isNaN(amount)) {
    editTxError.value = "Enter a valid amount.";
    return;
  }
  editTxSaving.value = true;
  try {
    await $fetch(`/api/budget/transactions/${editingTxId.value}`, {
      method: "PUT",
      body: {
        transaction_date: editTxForm.value.date,
        amount,
        description: editTxForm.value.description || null,
      },
    });
    editingTxId.value = null;
    await loadData();
  } catch (err) {
    editTxError.value = err?.data?.message || err?.message || "Failed to update.";
  } finally {
    editTxSaving.value = false;
  }
}

function confirmDeleteFromModal(tx) {
  subCategoryModalRef.value?.close();
  confirmDelete(tx);
}

function addTxForSubCategory() {
  const item = selectedBudgetItem.value;
  if (!item) return;
  subCategoryModalRef.value?.close();
  const pad = (n) => String(n).padStart(2, "0");
  txForm.value = {
    type: item.type,
    budgetItemId: String(item.id),
    date: `${selectedYear.value}-${pad(selectedMonth.value)}-01`,
    amount: null,
    description: "",
  };
  txError.value = "";
  nextTick(() => addDialogRef.value?.showModal());
}

function confirmDelete(tx) {
  deletingTx.value = tx;
  nextTick(() => deleteDialogRef.value?.showModal());
}

async function performDelete() {
  if (!deletingTx.value) return;
  deleting.value = true;
  try {
    await $fetch(`/api/budget/transactions/${deletingTx.value.id}`, { method: "DELETE" });
    deleteDialogRef.value?.close();
    deletingTx.value = null;
    await loadData();
    if (selectedBudgetItem.value) {
      nextTick(() => subCategoryModalRef.value?.showModal());
    }
  } catch (err) {
    console.error("Delete failed", err);
  } finally {
    deleting.value = false;
  }
}

onMounted(() => {
  if (!auth.ready) auth.fetchSession();
});

watch(
  () => auth.user,
  (user) => {
    if (user) loadData();
  },
  { immediate: true },
);
</script>
