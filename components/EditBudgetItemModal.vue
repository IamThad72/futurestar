<template>
  <dialog ref="editDialogRef" class="modal">
    <div class="modal-box max-h-[90vh] max-w-lg overflow-y-auto">
      <h3 class="font-semibold text-lg mb-5">Edit Budget Item</h3>
      <form v-if="editingItem" @submit.prevent="saveEdit" class="space-y-5">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label v-if="editingItem._type === 'income'" class="form-control w-full">
            <span class="label-text text-sm">Type</span>
            <select v-model="editForm.income_type" class="select select-bordered w-full">
              <option value="gross">Income</option>
              <option value="deduction">Insurance</option>
              <option value="tax">Tax</option>
              <option value="interest">Interest</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label v-else-if="editingItem._type === 'expense'" class="form-control w-full">
            <span class="label-text text-sm">Type</span>
            <select v-model="editForm.expense_type" class="select select-bordered w-full">
              <option value="expense">Expense</option>
              <option value="savings">Savings</option>
              <option value="investment">Investments</option>
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
          <label
            v-if="editingItem._type === 'expense' && editForm.expense_type === 'expense'"
            class="form-control w-full md:col-span-2"
          >
            <span class="label-text text-sm">
              Estate Management debt
              <span v-if="editNeedsDebtLink" class="text-error">*</span>
            </span>
            <select
              v-model="editForm.debt_id"
              class="select select-bordered w-full"
              :required="editNeedsDebtLink"
            >
              <option value="">
                {{ debtRecords.length ? "Select debt record…" : "No debt records — add in Estate Management" }}
              </option>
              <option v-for="row in debtRecords" :key="`edit-debt-${row.dbt_id}`" :value="String(row.dbt_id)">
                {{ formatDebtRecordLabel(row) }}
              </option>
            </select>
          </label>
          <template v-else>
            <label class="form-control w-full">
              <span class="label-text text-sm">From Account</span>
              <select v-model="editForm.from_cash_investment_id" class="select select-bordered w-full">
                <option value="">None</option>
                <option v-for="acct in cashAccounts" :key="`edit-from-${acct.ci_id}`" :value="String(acct.ci_id)">
                  {{ [acct.institution, acct.acct_type].filter(Boolean).join(" — ") || `Account #${acct.ci_id}` }}
                </option>
              </select>
            </label>
            <label class="form-control w-full">
              <span class="label-text text-sm">To Account</span>
              <select v-model="editForm.cash_investment_id" class="select select-bordered w-full">
                <option value="">None</option>
                <option v-for="acct in cashAccounts" :key="`edit-to-${acct.ci_id}`" :value="String(acct.ci_id)">
                  {{ [acct.institution, acct.acct_type].filter(Boolean).join(" — ") || `Account #${acct.ci_id}` }}
                </option>
              </select>
            </label>
          </template>
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
        <div class="modal-action flex-wrap gap-2 mt-2">
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
</template>

<script setup>
import { budgetExpenseNeedsDebtLink, formatDebtRecordLabel } from "~/utils/budgetDebt";

const props = defineProps({
  /** When set, scopes any list refresh requests to this budget instead of the active one */
  budgetId: { type: Number, default: null },
});

const emit = defineEmits(["saved"]);

const editDialogRef = ref(null);
const saving = ref(false);
const editError = ref("");
const editingItem = ref(null);

const cashAccounts = ref([]);
const debtRecords = ref([]);

const editForm = ref({
  income_type: "gross",
  expense_type: "expense",
  category: "",
  sub_category: "",
  description: "",
  debt_id: "",
  from_cash_investment_id: "",
  cash_investment_id: "",
  monthly_amount: null,
  annual_amount: null,
});

const editNeedsDebtLink = computed(() => {
  if (!editingItem.value || editingItem.value._type !== "expense") return false;
  if (editForm.value.expense_type !== "expense") return false;
  return budgetExpenseNeedsDebtLink(
    editForm.value.category,
    editForm.value.sub_category,
    editForm.value.description,
  );
});

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

async function loadEditFormData() {
  try {
    const [cashData, debtData] = await Promise.all([
      $fetch("/api/records/cash-and-investments").catch(() => ({ records: [] })),
      $fetch("/api/records/debt").then((d) => d?.records ?? []).catch(() => []),
    ]);
    cashAccounts.value = cashData?.records ?? [];
    debtRecords.value = Array.isArray(debtData) ? debtData : [];
  } catch (err) {
    console.error("Failed to load edit-budget-item data", err);
  }
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
  if (item._type === "expense" && editNeedsDebtLink.value && !editForm.value.debt_id) {
    editError.value = "Select the Estate Management debt record for this expense line.";
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
        ...(props.budgetId != null ? { budget_id: props.budgetId } : {}),
        income_type: item._type === "income" ? editForm.value.income_type : undefined,
        expense_type: item._type === "expense" ? editForm.value.expense_type : undefined,
        category: editForm.value.category,
        sub_category: editForm.value.sub_category || null,
        description: (item._type !== "expense" || (editForm.value.expense_type !== "savings" && editForm.value.expense_type !== "investment")) ? editForm.value.description || null : null,
        cash_investment_id: item._type === "expense" && (editForm.value.expense_type === "savings" || editForm.value.expense_type === "investment") && editForm.value.cash_investment_id ? parseInt(String(editForm.value.cash_investment_id), 10) : null,
        from_cash_investment_id:
          item._type === "expense" && (editForm.value.expense_type === "savings" || editForm.value.expense_type === "investment")
            ? editForm.value.from_cash_investment_id
              ? parseInt(String(editForm.value.from_cash_investment_id), 10)
              : null
            : null,
        debt_id:
          item._type === "expense"
            ? editForm.value.expense_type === "expense"
              ? editForm.value.debt_id
                ? parseInt(String(editForm.value.debt_id), 10)
                : null
              : null
            : undefined,
        monthly_amount: monthly != null && !isNaN(monthly) ? monthly : null,
        annual_amount: annual != null && !isNaN(annual) ? annual : null,
      },
    });
    editDialogRef.value?.close();
    editingItem.value = null;
    emit("saved");
  } catch (err) {
    editError.value = err?.data?.statusMessage || err?.data?.message || err?.message || "Failed to update budget.";
  } finally {
    saving.value = false;
  }
}

function open(item, type) {
  editingItem.value = { ...item, _type: type };
  editForm.value = {
    income_type: ["gross", "tax", "deduction", "interest", "other"].includes(item.income_type)
      ? item.income_type
      : "gross",
    expense_type: item.expense_type || "expense",
    category: item.category,
    sub_category: item.sub_category || "",
    description: item.description || "",
    debt_id: item.debt_id ? String(item.debt_id) : "",
    from_cash_investment_id: item.from_cash_investment_id ? String(item.from_cash_investment_id) : "",
    cash_investment_id: item.cash_investment_id ? String(item.cash_investment_id) : "",
    monthly_amount: item.monthly_amount,
    annual_amount: item.annual_amount,
  };
  editError.value = "";
  loadEditFormData();
  nextTick(() => editDialogRef.value?.showModal());
}

function close() {
  editDialogRef.value?.close();
}

defineExpose({ open, close });
</script>
