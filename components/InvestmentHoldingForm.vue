<template>
  <Teleport to="body">
  <div v-if="open" class="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
    <div class="absolute inset-0 bg-black/50" @click="cancel" />
    <form
      class="relative max-h-[90vh] w-full overflow-y-auto bg-base-100 p-4 shadow-lg sm:max-w-md sm:rounded-lg sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="investment-holding-title"
      @submit.prevent="submit"
      @click.stop
    >
      <div class="flex items-center justify-between gap-3">
        <h2 id="investment-holding-title" class="text-base font-semibold text-base-content">
          {{ holding ? "Edit holding" : "Add holding" }}
        </h2>
        <button class="btn btn-ghost btn-sm" type="button" @click="cancel">Close</button>
      </div>

      <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="form-control sm:col-span-2">
          <span class="label-text text-xs">Name</span>
          <input v-model="form.name" class="input input-bordered input-sm w-full" required autocomplete="off" />
        </label>
        <label class="form-control">
          <span class="label-text text-xs">Ticker</span>
          <input v-model="form.ticker" class="input input-bordered input-sm w-full" required autocomplete="off" />
        </label>
        <label class="form-control">
          <span class="label-text text-xs">Account</span>
          <select v-model="form.accountId" class="select select-bordered select-sm w-full" required>
            <option value="" disabled>Select account…</option>
            <option v-for="acct in accountOptions" :key="acct.ci_id" :value="String(acct.ci_id)">
              {{ accountLabel(acct) }}
            </option>
          </select>
          <span v-if="!accounts.length" class="label-text-alt text-base-content/60">
            Add a cash or investment account in Estate Management first.
          </span>
        </label>
        <label class="form-control">
          <span class="label-text text-xs">Shares</span>
          <input
            v-model="form.shares"
            class="input input-bordered input-sm w-full tabular-nums"
            inputmode="decimal"
            autocomplete="off"
            placeholder="Blank if unknown"
          />
        </label>
        <label class="form-control">
          <span class="label-text text-xs">Price</span>
          <input
            v-model="form.price"
            class="input input-bordered input-sm w-full tabular-nums"
            inputmode="decimal"
            autocomplete="off"
            placeholder="Blank if unknown"
          />
        </label>
        <label class="form-control">
          <span class="label-text text-xs">Cost basis</span>
          <input
            v-model="form.costBasis"
            class="input input-bordered input-sm w-full tabular-nums"
            inputmode="decimal"
            autocomplete="off"
            placeholder="Blank if unknown"
          />
        </label>
        <label class="form-control sm:col-span-2">
          <span class="label-text text-xs">Current value</span>
          <input
            v-model="form.currentValue"
            class="input input-bordered input-sm w-full tabular-nums"
            inputmode="decimal"
            autocomplete="off"
            placeholder="Blank if unknown"
          />
        </label>
      </div>

      <p v-if="error || saveError" class="mt-3 text-xs text-error">{{ error || saveError }}</p>

      <div class="mt-4 flex flex-wrap items-center justify-between gap-2">
        <button v-if="holding" class="btn btn-ghost btn-sm text-error" type="button" @click="remove">
          Remove
        </button>
        <span v-else />
        <div class="flex gap-2">
          <button class="btn btn-ghost btn-sm" type="button" @click="cancel">Cancel</button>
          <button class="btn btn-primary btn-sm" type="submit">Save</button>
        </div>
      </div>
    </form>
  </div>
  </Teleport>
</template>

<script setup>
import { computed, onUnmounted, reactive, ref, watch } from "vue";
import { parseOptionalAmount } from "~/utils/investmentPerformance";

const props = defineProps({
  open: { type: Boolean, default: false },
  holding: { type: Object, default: null },
  accounts: { type: Array, default: () => [] },
  saveError: { type: String, default: "" },
});

const emit = defineEmits(["save", "cancel", "remove"]);

const form = reactive({
  name: "",
  ticker: "",
  accountId: "",
  shares: "",
  price: "",
  costBasis: "",
  currentValue: "",
});
const error = ref("");

function accountLabel(acct) {
  return [acct?.institution, acct?.acct_type].filter(Boolean).join(" — ") || `Account #${acct?.ci_id}`;
}

const accountOptions = computed(() => {
  const rows = [...props.accounts];
  const currentId = props.holding?.accountId;
  if (currentId != null && !rows.some((acct) => String(acct.ci_id) === String(currentId))) {
    rows.push({
      ci_id: currentId,
      institution: props.holding?.account || `Account #${currentId}`,
    });
  }
  return rows.sort((a, b) => accountLabel(a).localeCompare(accountLabel(b)));
});

function fieldText(value) {
  return value == null || value === "" ? "" : String(value);
}

function fillForm(holding) {
  form.name = holding?.name || "";
  form.ticker = holding?.ticker || "";
  form.accountId = holding?.accountId != null ? String(holding.accountId) : "";
  form.shares = fieldText(holding?.shares);
  form.price = fieldText(holding?.price);
  form.costBasis = fieldText(holding?.costBasis);
  form.currentValue = fieldText(holding?.currentValue);
  error.value = "";
}

watch(
  () => [props.open, props.holding],
  () => {
    if (props.open) fillForm(props.holding);
  },
  { immediate: true },
);

function onKeydown(event) {
  if (event.key === "Escape") cancel();
}

watch(
  () => props.open,
  (isOpen) => {
    if (!import.meta.client) return;
    if (isOpen) window.addEventListener("keydown", onKeydown);
    else window.removeEventListener("keydown", onKeydown);
  },
);

onUnmounted(() => {
  if (import.meta.client) window.removeEventListener("keydown", onKeydown);
});

function amountField(label, raw) {
  const parsed = parseOptionalAmount(raw);
  if (!parsed.ok) return { error: `${label} must be a number, or left blank.` };
  if (parsed.value != null && parsed.value < 0) return { error: `${label} cannot be negative.` };
  return { value: parsed.value };
}

function submit() {
  const name = form.name.trim();
  const ticker = form.ticker.trim();
  const account = props.accounts.find((acct) => String(acct.ci_id) === form.accountId)
    || accountOptions.value.find((acct) => String(acct.ci_id) === form.accountId);
  if (!name) {
    error.value = "Name is required.";
    return;
  }
  if (!ticker) {
    error.value = "Ticker is required.";
    return;
  }
  if (!account) {
    error.value = "Choose an account.";
    return;
  }
  const shares = amountField("Shares", form.shares);
  const price = amountField("Price", form.price);
  const costBasis = amountField("Cost basis", form.costBasis);
  const currentValue = amountField("Current value", form.currentValue);
  const problem = shares.error || price.error || costBasis.error || currentValue.error;
  if (problem) {
    error.value = problem;
    return;
  }
  emit("save", {
    id: props.holding?.id,
    name,
    ticker,
    account: account.institution || "",
    accountId: Number(account.ci_id),
    shares: shares.value,
    price: price.value,
    costBasis: costBasis.value,
    currentValue: currentValue.value,
  });
}

function cancel() {
  emit("cancel");
}

function remove() {
  if (!props.holding?.id) return;
  emit("remove", props.holding.id);
}
</script>
