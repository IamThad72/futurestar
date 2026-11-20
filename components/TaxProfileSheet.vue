<template>
  <dialog ref="dialogRef" class="modal">
    <div class="modal-box max-h-[90vh] max-w-lg overflow-y-auto">
      <h3 class="mb-1 text-lg font-semibold text-base-content">Tax profile</h3>
      <p class="mb-5 text-sm text-base-content/70">
        These choices apply to your estimate. Income can follow the budget so both pages use the same pay.
      </p>
      <form class="space-y-5" @submit.prevent="save">
        <label class="form-control w-full">
          <span class="label-text text-sm">Filing status</span>
          <select v-model="draft.filing_status" class="select select-bordered min-h-11 w-full">
            <option v-for="status in FILING_STATUSES" :key="status" :value="status">
              {{ FILING_STATUS_LABELS[status] }}
            </option>
          </select>
        </label>

        <label class="form-control w-full">
          <span class="label-text text-sm">State</span>
          <select v-model="draft.state_code" class="select select-bordered min-h-11 w-full">
            <option value="">Select a state</option>
            <option v-for="state in US_STATES" :key="state.code" :value="state.code">
              {{ state.name }}
            </option>
          </select>
        </label>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label class="form-control w-full">
            <span class="label-text text-sm">Local jurisdiction</span>
            <input
              v-model.trim="draft.local_jurisdiction"
              class="input input-bordered min-h-11 w-full"
              type="text"
              maxlength="120"
              placeholder="City or school district"
              autocomplete="off"
            />
          </label>
          <label class="form-control w-full">
            <span class="label-text text-sm">ZIP (optional)</span>
            <input
              v-model.trim="draft.local_zip"
              class="input input-bordered min-h-11 w-full"
              type="text"
              inputmode="numeric"
              maxlength="10"
              placeholder="12345"
              autocomplete="postal-code"
            />
          </label>
        </div>

        <label class="form-control w-full">
          <span class="label-text text-sm">Local tax rate</span>
          <span class="label-text text-xs text-base-content/60">Percent of wages and self-employment. Example: 1.5 for a 1.5% city tax.</span>
          <input
            v-model="draft.local_rate_percent"
            class="input input-bordered min-h-11 w-full"
            type="number"
            min="0"
            max="15"
            step="0.001"
            placeholder="0"
          />
        </label>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label class="form-control w-full">
            <span class="label-text text-sm">Children under 17</span>
            <input
              v-model.number="draft.children_under_17"
              class="input input-bordered min-h-11 w-full"
              type="number"
              min="0"
              max="20"
              step="1"
            />
          </label>
          <label class="form-control w-full">
            <span class="label-text text-sm">Other dependents</span>
            <input
              v-model.number="draft.other_dependents"
              class="input input-bordered min-h-11 w-full"
              type="number"
              min="0"
              max="20"
              step="1"
            />
          </label>
        </div>

        <fieldset class="space-y-2">
          <legend class="text-sm text-base-content">Deduction</legend>
          <label class="flex min-h-11 items-center gap-3">
            <input v-model="draft.deduction_method" class="radio radio-primary" type="radio" value="standard" />
            <span class="text-sm">Standard deduction</span>
          </label>
          <label class="flex min-h-11 items-center gap-3">
            <input v-model="draft.deduction_method" class="radio radio-primary" type="radio" value="itemized" />
            <span class="text-sm">Itemized deduction</span>
          </label>
        </fieldset>

        <label v-if="draft.deduction_method === 'itemized'" class="form-control w-full">
          <span class="label-text text-sm">Itemized amount</span>
          <input
            v-model.number="draft.itemized_deduction"
            class="input input-bordered min-h-11 w-full"
            type="number"
            min="0"
            step="0.01"
          />
        </label>

        <label class="flex min-h-11 items-start gap-3 rounded-lg border border-base-300 bg-base-200/40 px-3 py-2">
          <input v-model="draft.use_budget_income" class="checkbox checkbox-primary mt-0.5" type="checkbox" @change="onBudgetToggle" />
          <span class="text-sm">
            <span class="font-medium text-base-content">Use budget income</span>
            <span class="mt-0.5 block text-base-content/70">
              Wages, self-employment, retirement, and other income come from your budget lines.
            </span>
          </span>
        </label>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label v-for="field in incomeFields" :key="field.key" class="form-control w-full">
            <span class="label-text text-sm">{{ field.label }}</span>
            <input
              v-model.number="draft[field.key]"
              class="input input-bordered min-h-11 w-full"
              type="number"
              min="0"
              step="0.01"
              :disabled="draft.use_budget_income"
            />
          </label>
        </div>

        <p v-if="formError" class="text-sm text-error">{{ formError }}</p>

        <div class="modal-action mt-2 flex-wrap gap-2">
          <button type="button" class="btn btn-ghost min-h-11" @click="close">Cancel</button>
          <button type="submit" class="btn btn-primary min-h-11" :disabled="saving">
            {{ saving ? "Saving…" : "Save profile" }}
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button type="button">close</button>
    </form>
  </dialog>
</template>

<script setup>
import { FILING_STATUS_LABELS, FILING_STATUSES, US_STATES } from "~/utils/tax/profile";

const emit = defineEmits(["saved"]);

const dialogRef = ref(null);
const saving = ref(false);
const formError = ref("");
const budgetIncome = ref({
  wages: 0,
  self_employment: 0,
  retirement: 0,
  other_income: 0,
});

const incomeFields = [
  { key: "wages", label: "W-2 wages" },
  { key: "self_employment", label: "Self-employment net" },
  { key: "retirement", label: "Retirement / pension" },
  { key: "other_income", label: "Other income" },
];

function blankDraft() {
  return {
    filing_status: "single",
    state_code: "",
    local_jurisdiction: "",
    local_zip: "",
    local_rate_percent: "",
    children_under_17: 0,
    other_dependents: 0,
    deduction_method: "standard",
    itemized_deduction: 0,
    use_budget_income: true,
    wages: 0,
    self_employment: 0,
    retirement: 0,
    other_income: 0,
  };
}

const draft = ref(blankDraft());

function shownIncome(key) {
  if (draft.value.use_budget_income) return Number(budgetIncome.value[key]) || 0;
  return Number(draft.value[key]) || 0;
}

function onBudgetToggle() {
  if (draft.value.use_budget_income) {
    for (const field of incomeFields) {
      draft.value[field.key] = Number(budgetIncome.value[field.key]) || 0;
    }
    return;
  }
  for (const field of incomeFields) {
    if (draft.value[field.key] == null || draft.value[field.key] === "") {
      draft.value[field.key] = Number(budgetIncome.value[field.key]) || 0;
    }
  }
}

function open(profile, budget) {
  formError.value = "";
  budgetIncome.value = {
    wages: Number(budget?.wages) || 0,
    self_employment: Number(budget?.self_employment) || 0,
    retirement: Number(budget?.retirement) || 0,
    other_income: Number(budget?.other_income) || 0,
  };
  const useBudget = profile?.use_budget_income !== false;
  const rate = profile?.local_rate;
  draft.value = {
    filing_status: profile?.filing_status || "single",
    state_code: profile?.state_code || "",
    local_jurisdiction: profile?.local_jurisdiction || "",
    local_zip: profile?.local_zip || "",
    local_rate_percent: rate == null || rate === "" ? "" : Math.round(Number(rate) * 1000000) / 10000,
    children_under_17: Number(profile?.children_under_17) || 0,
    other_dependents: Number(profile?.other_dependents) || 0,
    deduction_method: profile?.deduction_method === "itemized" ? "itemized" : "standard",
    itemized_deduction: Number(profile?.itemized_deduction) || 0,
    use_budget_income: useBudget,
    wages: useBudget ? budgetIncome.value.wages : Number(profile?.wages) || 0,
    self_employment: useBudget ? budgetIncome.value.self_employment : Number(profile?.self_employment) || 0,
    retirement: useBudget ? budgetIncome.value.retirement : Number(profile?.retirement) || 0,
    other_income: useBudget ? budgetIncome.value.other_income : Number(profile?.other_income) || 0,
  };
  dialogRef.value?.showModal();
}

function close() {
  dialogRef.value?.close();
}

async function save() {
  if (saving.value) return;
  formError.value = "";
  const percent = draft.value.local_rate_percent;
  let localRate = null;
  if (percent !== "" && percent != null) {
    const parsed = Number(percent);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 15) {
      formError.value = "Local rate must be between 0 and 15 percent.";
      return;
    }
    localRate = Math.round((parsed / 100) * 1e6) / 1e6;
  }
  const zip = String(draft.value.local_zip || "").trim();
  if (zip && !/^\d{5}(-\d{4})?$/.test(zip)) {
    formError.value = "ZIP must be 5 digits, or 5+4.";
    return;
  }
  saving.value = true;
  try {
    const saved = await $fetch("/api/tax/profile", {
      method: "PUT",
      body: {
        filing_status: draft.value.filing_status,
        state_code: draft.value.state_code,
        local_jurisdiction: draft.value.local_jurisdiction,
        local_zip: zip,
        local_rate: localRate,
        children_under_17: Number(draft.value.children_under_17) || 0,
        other_dependents: Number(draft.value.other_dependents) || 0,
        deduction_method: draft.value.deduction_method,
        itemized_deduction:
          draft.value.deduction_method === "itemized" ? Number(draft.value.itemized_deduction) || 0 : 0,
        use_budget_income: Boolean(draft.value.use_budget_income),
        wages: draft.value.use_budget_income ? null : shownIncome("wages"),
        self_employment: draft.value.use_budget_income ? null : shownIncome("self_employment"),
        retirement: draft.value.use_budget_income ? null : shownIncome("retirement"),
        other_income: draft.value.use_budget_income ? null : shownIncome("other_income"),
      },
    });
    emit("saved", saved);
    close();
  } catch (error) {
    formError.value = error?.data?.statusMessage || error?.statusMessage || "Could not save the tax profile.";
  } finally {
    saving.value = false;
  }
}

defineExpose({ open });
</script>
