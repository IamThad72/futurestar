<template>
  <!-- Update Record Modal -->
  <dialog ref="updateModalRef" class="modal" @close="editRecord = null">
    <div class="modal-box w-[calc(100%-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto overscroll-contain sm:w-full">
      <h3 class="text-lg font-bold">Update Record</h3>
      <div v-if="editRecord" class="mt-4 space-y-3">
        <div v-if="editRecordType === 'asset_inventory'" class="grid grid-cols-1 gap-3 sm:grid-cols-2" :key="'ai-' + (editRecord?.ai_id ?? '')">
          <label class="form-control sm:col-span-2"><span class="label-text text-sm">Title</span><input v-model="editRecord.title" class="input input-bordered input-sm w-full" /></label>
          <label class="form-control"><span class="label-text text-sm">Classification</span><input v-model="editRecord.classification" class="input input-bordered input-sm w-full" /></label>
          <label class="form-control"><span class="label-text text-sm">Value</span><input :value="editRecord.assetValue" @input="e => { const v = e.target.value; editRecord.assetValue = v === '' ? '' : (parseFloat(v) || '') }" class="input input-bordered input-sm w-full" type="number" step="0.01" /></label>
          <label class="form-control sm:col-span-2"><span class="label-text text-sm">Description</span><textarea v-model="editRecord.description" class="textarea textarea-bordered textarea-sm w-full" rows="2" /></label>
          <label class="form-control sm:col-span-2"><span class="label-text text-sm">Location</span><input v-model="editRecord.location" class="input input-bordered input-sm w-full" /></label>
        </div>
        <div v-else-if="editRecordType === 'asset_vehicles'" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label class="form-control"><span class="label-text text-sm">Year</span><input v-model.number="editRecord.year" class="input input-bordered input-sm w-full" type="number" /></label>
          <label class="form-control"><span class="label-text text-sm">Make</span><input v-model="editRecord.make" class="input input-bordered input-sm w-full" /></label>
          <label class="form-control"><span class="label-text text-sm">Model</span><input v-model="editRecord.model" class="input input-bordered input-sm w-full" /></label>
          <label class="form-control"><span class="label-text text-sm">VIN</span><input v-model="editRecord.vin" class="input input-bordered input-sm w-full" /></label>
          <label class="form-control"><span class="label-text text-sm">Value</span><input v-model.number="editRecord.value" class="input input-bordered input-sm w-full" type="number" step="0.01" /></label>
          <label class="form-control"><span class="label-text text-sm">Trust (Y/N)</span><select v-model="editRecord.trust_designated" class="select select-bordered select-sm w-full"><option :value="true">Y</option><option :value="false">N</option></select></label>
          <label class="form-control sm:col-span-2"><span class="label-text text-sm">Description</span><textarea v-model="editRecord.description" class="textarea textarea-bordered textarea-sm w-full" rows="2" /></label>
        </div>
        <div v-else-if="editRecordType === 'cash_and_investments'" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label class="form-control"><span class="label-text text-sm">Institution</span><input v-model="editRecord.institution" class="input input-bordered input-sm w-full" /></label>
          <label class="form-control"><span class="label-text text-sm">Account #</span><input v-model="editRecord.acct_number" class="input input-bordered input-sm w-full" /></label>
          <label class="form-control"><span class="label-text text-sm">Type</span><input v-model="editRecord.acct_type" class="input input-bordered input-sm w-full" /></label>
          <label class="form-control"><span class="label-text text-sm">Value</span><input :value="editRecord.cashValue" @input="e => { const v = e.target.value; editRecord.cashValue = v === '' ? '' : (parseFloat(v) || '') }" class="input input-bordered input-sm w-full" type="number" step="0.01" /></label>
          <label class="form-control"><span class="label-text text-sm">Trust (Y/N)</span><select v-model="editRecord.trust_designated" class="select select-bordered select-sm w-full"><option :value="true">Y</option><option :value="false">N</option></select></label>
          <label class="form-control"><span class="label-text text-sm">Support #</span><input v-model="editRecord.acct_support_number" class="input input-bordered input-sm w-full" /></label>
          <label class="form-control sm:col-span-2"><span class="label-text text-sm">URL</span><input v-model="editRecord.institution_url" class="input input-bordered input-sm w-full" type="url" /></label>
        </div>
        <div v-else-if="editRecordType === 'debt'" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label class="form-control"><span class="label-text text-sm">Institution</span><input v-model="editRecord.institution" class="input input-bordered input-sm w-full" /></label>
          <label class="form-control"><span class="label-text text-sm">Loan #</span><input v-model="editRecord.loan_number" class="input input-bordered input-sm w-full" /></label>
          <label class="form-control"><span class="label-text text-sm">Loan Type</span><input v-model="editRecord.loan_type" class="input input-bordered input-sm w-full" /></label>
          <label class="form-control sm:col-span-2"><span class="label-text text-sm">Debt structure</span>
            <select v-model="editRecord.is_revolving" class="select select-bordered select-sm w-full">
              <option :value="true">Revolving</option>
              <option :value="false">Installment</option>
            </select>
          </label>
          <label class="form-control">
            <span class="label-text text-sm">{{ editRecord.is_revolving ? "Current balance" : "Principal balance" }}</span>
            <input v-model="editRecord.debtLoanAmmount" class="input input-bordered input-sm w-full" type="number" step="0.01" min="0" />
          </label>
          <label v-if="!editRecord.is_revolving" class="form-control"><span class="label-text text-sm">Annual interest rate (%)</span><input v-model="editRecord.interest_rate_annual" class="input input-bordered input-sm w-full" type="number" step="0.001" min="0" /></label>
          <label v-if="!editRecord.is_revolving" class="form-control"><span class="label-text text-sm">Remaining term (months)</span><input v-model="editRecord.term_months" class="input input-bordered input-sm w-full" type="number" step="1" min="1" /></label>
          <label v-if="!editRecord.is_revolving" class="form-control"><span class="label-text text-sm">Scheduled monthly payment</span><input v-model="editRecord.scheduled_monthly_payment" class="input input-bordered input-sm w-full" type="number" step="0.01" min="0" /></label>
          <label v-if="!editRecord.is_revolving" class="form-control"><span class="label-text text-sm">Loan start date</span><input v-model="editRecord.loan_start_date" class="input input-bordered input-sm w-full" type="date" /></label>
          <label class="form-control sm:col-span-2"><span class="label-text text-sm">Link to Asset</span><select v-model="editRecord.linked_asset" class="select select-bordered select-sm w-full"><option value="">None (no link)</option><option v-for="a in linkedAssets" :key="a.type + ':' + a.id" :value="a.type + ':' + a.id">{{ a.label }}</option></select></label>
          <label class="form-control"><span class="label-text text-sm">Borrower</span><input v-model="editRecord.borrower" class="input input-bordered input-sm w-full" /></label>
          <label class="form-control"><span class="label-text text-sm">Support #</span><input v-model="editRecord.customer_support_no" class="input input-bordered input-sm w-full" /></label>
          <label class="form-control"><span class="label-text text-sm">URL</span><input v-model="editRecord.address_url" class="input input-bordered input-sm w-full" type="url" /></label>
        </div>
        <div v-else-if="editRecordType === 'real_estate'" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label class="form-control"><span class="label-text text-sm">Number</span><input v-model="editRecord.number" class="input input-bordered input-sm w-full" /></label>
          <label class="form-control"><span class="label-text text-sm">Street</span><input v-model="editRecord.street" class="input input-bordered input-sm w-full" /></label>
          <label class="form-control"><span class="label-text text-sm">City</span><input v-model="editRecord.city" class="input input-bordered input-sm w-full" /></label>
          <label class="form-control"><span class="label-text text-sm">State</span><input v-model="editRecord.state" class="input input-bordered input-sm w-full" /></label>
          <label class="form-control"><span class="label-text text-sm">Zipcode</span><input v-model="editRecord.zipcode" class="input input-bordered input-sm w-full" /></label>
          <label class="form-control"><span class="label-text text-sm">Value</span><input v-model.number="editRecord.value" class="input input-bordered input-sm w-full" type="number" step="0.01" /></label>
          <label class="form-control"><span class="label-text text-sm">Trust (Y/N)</span><select v-model="editRecord.trust_designated" class="select select-bordered select-sm w-full"><option :value="true">Y</option><option :value="false">N</option></select></label>
        </div>
        <div v-else-if="editRecordType === 'insurance'" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label class="form-control"><span class="label-text text-sm">Policy Holder</span><input v-model="editRecord.policy_holder" class="input input-bordered input-sm w-full" /></label>
          <label class="form-control"><span class="label-text text-sm">Policy #</span><input v-model="editRecord.polocy_number" class="input input-bordered input-sm w-full" /></label>
          <label class="form-control"><span class="label-text text-sm">Entity Covered</span><input v-model="editRecord.entity_covered" class="input input-bordered input-sm w-full" /></label>
          <label class="form-control"><span class="label-text text-sm">Amount</span><input :value="editRecord.insurancePolicyAmt" @input="e => { const v = e.target.value; editRecord.insurancePolicyAmt = v === '' ? '' : (parseFloat(v) || ''); editRecord.policy_amt = editRecord.insurancePolicyAmt !== '' && !Number.isNaN(Number(editRecord.insurancePolicyAmt)) ? Number(editRecord.insurancePolicyAmt) : null }" class="input input-bordered input-sm w-full" type="number" step="0.01" /></label>
          <label class="form-control sm:col-span-2"><span class="label-text text-sm">Intent</span><input v-model="editRecord.intent" class="input input-bordered input-sm w-full" /></label>
        </div>
      </div>
      <div v-if="error" class="mt-2 text-sm text-error">{{ error }}</div>
      <div class="modal-action justify-between">
        <button type="button" class="btn btn-error btn-outline btn-sm min-h-9" :disabled="updateSaving || deleteSaving" @click="deleteRecord">
          {{ deleteSaving ? "Deleting..." : "Delete" }}
        </button>
        <div class="flex gap-2">
          <form method="dialog">
            <button type="button" class="btn btn-ghost min-h-9" @click="updateModalRef?.close()">Cancel</button>
          </form>
          <button type="button" class="btn btn-primary min-h-9" :disabled="updateSaving || deleteSaving" @click="saveEdit">
            {{ updateSaving ? "Saving..." : "Save" }}
          </button>
        </div>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button type="submit">close</button>
    </form>
  </dialog>
</template>

<script setup>
import { inferIsRevolvingDebt } from "~/utils/debtPayment";

const emit = defineEmits(["saved", "deleted"]);

const updateModalRef = ref(null);
const updateSaving = ref(false);
const deleteSaving = ref(false);
const editRecord = ref(null);
const editRecordType = ref("");
const linkedAssets = ref([]);
const error = ref("");

const API_PATH_MAP = {
  asset_inventory: "asset-inventory",
  asset_vehicles: "asset-vehicles",
  cash_and_investments: "cash-and-investments",
  debt: "debt",
  real_estate: "real-estate",
  insurance: "insurance",
};

const ID_KEY_MAP = {
  asset_inventory: "ai_id",
  asset_vehicles: "vh_id",
  cash_and_investments: "ci_id",
  debt: "dbt_id",
  real_estate: "re_id",
  insurance: "ins_id",
};

// Public type names (shared with AddEstateRecordModal's `open(type)`) mapped to internal record types.
const TYPE_ALIAS_MAP = {
  asset: "asset_inventory",
  vehicle: "asset_vehicles",
  cash: "cash_and_investments",
  debt: "debt",
  real_estate: "real_estate",
  insurance: "insurance",
};

function toNumber(val) {
  if (val == null || val === "") return NaN;
  if (typeof val === "number") return val;
  const s = String(val).replace(/[$,]/g, "").trim();
  return parseFloat(s) || NaN;
}

async function loadLinkedAssets() {
  linkedAssets.value = await $fetch("/api/records/linked-assets").then((d) => d?.assets ?? []).catch(() => []);
}

function open(type, record) {
  error.value = "";
  const resolvedType = TYPE_ALIAS_MAP[type] ?? type;
  editRecordType.value = resolvedType;
  const cloned = JSON.parse(JSON.stringify(record));
  if (resolvedType === "asset_inventory") {
    cloned.classification = cloned.asset_classification ?? cloned.classification_type ?? "";
    const val = cloned.value ?? cloned.asset_value;
    const num = val != null && val !== "" ? toNumber(val) : NaN;
    cloned.assetValue = Number.isNaN(num) ? "" : num;
  }
  if (resolvedType === "cash_and_investments") {
    const val = cloned.value ?? cloned.asset_value;
    const num = val != null && val !== "" ? toNumber(val) : NaN;
    cloned.cashValue = Number.isNaN(num) ? "" : num;
  }
  if (resolvedType === "debt") {
    const val = cloned.loan_ammount;
    const num = val != null && val !== "" ? toNumber(val) : NaN;
    cloned.debtLoanAmmount = Number.isNaN(num) ? "" : num;
    cloned.linked_asset = (cloned.linked_asset_type && cloned.linked_asset_id)
      ? cloned.linked_asset_type + ":" + cloned.linked_asset_id
      : "";
    cloned.is_revolving = inferIsRevolvingDebt(cloned);
    cloned.interest_rate_annual =
      cloned.interest_rate_annual != null && cloned.interest_rate_annual !== ""
        ? String(cloned.interest_rate_annual)
        : "";
    cloned.term_months =
      cloned.term_months != null && cloned.term_months !== "" ? String(cloned.term_months) : "";
    cloned.scheduled_monthly_payment =
      cloned.scheduled_monthly_payment != null && cloned.scheduled_monthly_payment !== ""
        ? String(cloned.scheduled_monthly_payment)
        : "";
    cloned.loan_start_date = cloned.loan_start_date
      ? String(cloned.loan_start_date).slice(0, 10)
      : "";
    void loadLinkedAssets();
  }
  if (resolvedType === "insurance") {
    const val = cloned.policy_amt;
    const num = val != null && val !== "" ? toNumber(String(val).replace(/[$,]/g, "")) : NaN;
    cloned.insurancePolicyAmt = Number.isNaN(num) ? "" : num;
  }
  editRecord.value = cloned;
  updateModalRef.value?.showModal();
}

function close() {
  updateModalRef.value?.close();
}

async function saveEdit() {
  if (!editRecord.value || !editRecordType.value) return;
  const type = editRecordType.value;
  const idKey = ID_KEY_MAP[type];
  const id = editRecord.value[idKey];
  if (!id) return;

  const path = API_PATH_MAP[type];
  const url = `/api/records/${path}/${id}`;

  let body;
  if (type === "debt") {
    const r = editRecord.value;
    const av = r.debtLoanAmmount;
    const loanAmt = (av !== "" && av != null && !Number.isNaN(Number(av)))
      ? Number(av)
      : (r.loan_ammount != null && r.loan_ammount !== "" ? r.loan_ammount : null);
    const [linkedType, linkedId] = r.linked_asset ? r.linked_asset.split(":") : [null, null];
    body = {
      institution: r.institution ?? null,
      loan_number: r.loan_number ?? null,
      loan_type: r.loan_type ?? null,
      customer_support_no: r.customer_support_no ?? null,
      address_url: r.address_url ?? null,
      borrower: r.borrower ?? null,
      loan_ammount: loanAmt,
      linked_asset_type: linkedType || null,
      linked_asset_id: linkedId ? Number(linkedId) : null,
      is_revolving: r.is_revolving === true || r.is_revolving === "true" ? true : r.is_revolving === false || r.is_revolving === "false" ? false : inferIsRevolvingDebt(r),
      interest_rate_annual:
        r.interest_rate_annual !== "" && r.interest_rate_annual != null ? Number(r.interest_rate_annual) : null,
      term_months: r.term_months !== "" && r.term_months != null ? Number(r.term_months) : null,
      scheduled_monthly_payment:
        r.scheduled_monthly_payment !== "" && r.scheduled_monthly_payment != null
          ? Number(r.scheduled_monthly_payment)
          : null,
      loan_start_date: r.loan_start_date || null,
    };
  } else {
    body = { ...editRecord.value };
    delete body[idKey];
    delete body.user_id;
    delete body.group_id;
    delete body.created_at;

    if (type === "asset_inventory") {
      body.classification_type = body.classification ?? body.asset_classification ?? body.classification_type;
      body.asset_category = body.asset_category ?? "Asset";
      const av = body.assetValue;
      body.value = (av !== "" && av != null && !Number.isNaN(Number(av))) ? Number(av) : body.value;
    }
    if (type === "cash_and_investments") {
      const cv = body.cashValue;
      body.value = (cv !== "" && cv != null && !Number.isNaN(Number(cv))) ? Number(cv) : body.value;
    }
    if (type === "asset_vehicles") body.age = editRecord.value.age ?? (editRecord.value.year ? new Date().getFullYear() - editRecord.value.year : null);
    if (type === "insurance") {
      const av = body.insurancePolicyAmt;
      body.policy_amt = (av !== "" && av != null && !Number.isNaN(Number(av)))
        ? Number(av)
        : (body.policy_amt != null ? toNumber(String(body.policy_amt).replace(/[$,]/g, "")) : null);
      delete body.insurancePolicyAmt;
    }
  }

  updateSaving.value = true;
  try {
    await $fetch(url, { method: "PUT", body });
    updateModalRef.value?.close();
    emit("saved");
  } catch (err) {
    error.value = err?.data?.statusMessage || err?.data?.message || err?.message || "Update failed.";
    return;
  } finally {
    updateSaving.value = false;
  }
}

async function deleteRecord() {
  if (!editRecord.value || !editRecordType.value) return;
  if (!confirm("Are you sure you want to delete this record? This cannot be undone.")) return;

  const type = editRecordType.value;
  const idKey = ID_KEY_MAP[type];
  const id = editRecord.value[idKey];
  if (!id) return;

  const path = API_PATH_MAP[type];
  const url = `/api/records/${path}/${id}`;

  deleteSaving.value = true;
  error.value = "";
  try {
    await $fetch(url, { method: "DELETE" });
    updateModalRef.value?.close();
    emit("deleted");
  } catch (err) {
    error.value = err?.data?.statusMessage || err?.message || "Delete failed.";
  } finally {
    deleteSaving.value = false;
  }
}

defineExpose({ open, close });
</script>
