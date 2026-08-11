<template>
  <!-- Add Record Modal -->
  <dialog ref="addModalRef" class="modal" @close="addModalType = null">
    <div class="modal-box w-[calc(100%-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto overscroll-contain sm:w-full">
      <h3 class="text-lg font-bold">{{ addModalTitle }}</h3>

      <!-- Add Asset -->
      <form v-if="addModalType === 'asset'" class="mt-4 space-y-3" @submit.prevent="submitAddAsset">
        <label class="form-control w-full"><span class="label-text text-sm">Classification</span>
          <select class="select select-bordered select-sm w-full" v-model="addAssetForm.classification_type" required>
            <option disabled value="">Select classification...</option>
            <option v-for="c in addAssetClassifications" :key="c" :value="c">{{ c }}</option>
          </select>
        </label>
        <label class="form-control w-full"><span class="label-text text-sm">Title</span><input v-model.trim="addAssetForm.title" class="input input-bordered input-sm w-full" required /></label>
        <label class="form-control w-full"><span class="label-text text-sm">Value</span><input v-model.number="addAssetForm.value" class="input input-bordered input-sm w-full" type="number" step="0.01" min="0" required /></label>
        <label class="form-control w-full"><span class="label-text text-sm">Description</span><textarea v-model.trim="addAssetForm.description" class="textarea textarea-bordered textarea-sm w-full" rows="2" required /></label>
        <label class="form-control w-full"><span class="label-text text-sm">Location</span><input v-model.trim="addAssetForm.location" class="input input-bordered input-sm w-full" /></label>
        <div v-if="addError" class="text-sm text-error">{{ addError }}</div>
        <div class="modal-action">
          <button type="button" class="btn btn-ghost btn-sm min-h-9" @click="addModalRef?.close()">Cancel</button>
          <button type="submit" class="btn btn-primary btn-sm min-h-9" :disabled="addSaving">{{ addSaving ? 'Saving...' : 'Save' }}</button>
        </div>
      </form>

      <!-- Add Real Estate -->
      <form v-else-if="addModalType === 'real_estate'" class="mt-4 space-y-3" @submit.prevent="submitAddRealEstate">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label class="form-control"><span class="label-text text-sm">Number</span><input v-model.trim="addRealEstateForm.number" class="input input-bordered input-sm w-full" /></label>
          <label class="form-control"><span class="label-text text-sm">Street</span><input v-model.trim="addRealEstateForm.street" class="input input-bordered input-sm w-full" required /></label>
        </div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label class="form-control"><span class="label-text text-sm">City</span><input v-model.trim="addRealEstateForm.city" class="input input-bordered input-sm w-full" required /></label>
          <label class="form-control"><span class="label-text text-sm">State</span><input v-model.trim="addRealEstateForm.state" class="input input-bordered input-sm w-full" required /></label>
          <label class="form-control"><span class="label-text text-sm">Zipcode</span><input v-model.trim="addRealEstateForm.zipcode" class="input input-bordered input-sm w-full" required /></label>
        </div>
        <label class="form-control"><span class="label-text text-sm">Value</span><input v-model.number="addRealEstateForm.value" class="input input-bordered input-sm w-full" type="number" step="0.01" min="0" required /></label>
        <label class="form-control"><span class="label-text text-sm">Trust (Y/N)</span><select v-model="addRealEstateForm.trust_designated" class="select select-bordered select-sm w-full" required><option value="">Select...</option><option value="Y">Y</option><option value="N">N</option></select></label>
        <div v-if="addError" class="text-sm text-error">{{ addError }}</div>
        <div class="modal-action">
          <button type="button" class="btn btn-ghost btn-sm min-h-9" @click="addModalRef?.close()">Cancel</button>
          <button type="submit" class="btn btn-primary btn-sm min-h-9" :disabled="addSaving">{{ addSaving ? 'Saving...' : 'Save' }}</button>
        </div>
      </form>

      <!-- Add Insurance -->
      <form v-else-if="addModalType === 'insurance'" class="mt-4 space-y-3" @submit.prevent="submitAddInsurance">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label class="form-control"><span class="label-text text-sm">Policy Holder</span><input v-model.trim="addInsuranceForm.policy_holder" class="input input-bordered input-sm w-full" required /></label>
          <label class="form-control"><span class="label-text text-sm">Policy #</span><input v-model.trim="addInsuranceForm.polocy_number" class="input input-bordered input-sm w-full" /></label>
        </div>
        <label class="form-control"><span class="label-text text-sm">Entity Covered</span><input v-model.trim="addInsuranceForm.entity_covered" class="input input-bordered input-sm w-full" /></label>
        <label class="form-control"><span class="label-text text-sm">Amount</span><input v-model="addInsuranceForm.policy_amt" class="input input-bordered input-sm w-full" type="number" step="0.01" min="0" /></label>
        <label class="form-control"><span class="label-text text-sm">Intent</span><input v-model.trim="addInsuranceForm.intent" class="input input-bordered input-sm w-full" placeholder="e.g. Life, Auto, Home" /></label>
        <label class="form-control"><span class="label-text text-sm">Institution URL</span><input v-model.trim="addInsuranceForm.institution_url" class="input input-bordered input-sm w-full" type="url" /></label>
        <div v-if="addError" class="text-sm text-error">{{ addError }}</div>
        <div class="modal-action">
          <button type="button" class="btn btn-ghost btn-sm min-h-9" @click="addModalRef?.close()">Cancel</button>
          <button type="submit" class="btn btn-primary btn-sm min-h-9" :disabled="addSaving">{{ addSaving ? 'Saving...' : 'Save' }}</button>
        </div>
      </form>

      <!-- Add Debt -->
      <form v-else-if="addModalType === 'debt'" class="mt-4 space-y-3" @submit.prevent="submitAddDebt">
        <label class="form-control"><span class="label-text text-sm">Debt Type</span>
          <select class="select select-bordered select-sm w-full" v-model="addDebtForm.loan_type">
            <option value="">Select debt type...</option>
            <option v-for="t in addDebtTypes" :key="t" :value="t">{{ t }}</option>
          </select>
        </label>
        <label class="form-control"><span class="label-text text-sm">Debt structure</span>
          <select v-model="addDebtForm.is_revolving" class="select select-bordered select-sm w-full">
            <option :value="true">Revolving (credit card, line of credit)</option>
            <option :value="false">Installment (mortgage, auto loan, etc.)</option>
          </select>
        </label>
        <label class="form-control"><span class="label-text text-sm">Institution</span><input v-model.trim="addDebtForm.institution" class="input input-bordered input-sm w-full" required /></label>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label class="form-control"><span class="label-text text-sm">Loan #</span><input v-model.trim="addDebtForm.loan_number" class="input input-bordered input-sm w-full" /></label>
          <label class="form-control">
            <span class="label-text text-sm">{{ addDebtForm.is_revolving ? "Current balance" : "Principal balance" }}</span>
            <input v-model="addDebtForm.loan_ammount" class="input input-bordered input-sm w-full" type="number" step="0.01" min="0" />
          </label>
        </div>
        <div
          v-if="!addDebtForm.is_revolving"
          class="grid grid-cols-1 gap-3 sm:grid-cols-2 rounded-lg border border-base-300 p-3"
        >
          <label class="form-control"><span class="label-text text-sm">Annual interest rate (%)</span><input v-model="addDebtForm.interest_rate_annual" class="input input-bordered input-sm w-full" type="number" step="0.001" min="0" placeholder="e.g. 6.5" /></label>
          <label class="form-control"><span class="label-text text-sm">Term (months)</span><input v-model="addDebtForm.term_months" class="input input-bordered input-sm w-full" type="number" step="1" min="1" placeholder="e.g. 360" /></label>
          <label class="form-control"><span class="label-text text-sm">Scheduled monthly payment</span><input v-model="addDebtForm.scheduled_monthly_payment" class="input input-bordered input-sm w-full" type="number" step="0.01" min="0" /></label>
          <label class="form-control"><span class="label-text text-sm">Loan start date</span><input v-model="addDebtForm.loan_start_date" class="input input-bordered input-sm w-full" type="date" /></label>
        </div>
        <label class="form-control"><span class="label-text text-sm">Link to Asset</span>
          <select class="select select-bordered select-sm w-full" v-model="addDebtForm.linked_asset">
            <option value="">None (no link)</option>
            <option v-for="a in linkedAssets" :key="a.type + ':' + a.id" :value="a.type + ':' + a.id">{{ a.label }}</option>
          </select>
        </label>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label class="form-control"><span class="label-text text-sm">Borrower</span><input v-model.trim="addDebtForm.borrower" class="input input-bordered input-sm w-full" /></label>
          <label class="form-control"><span class="label-text text-sm">Support #</span><input v-model.trim="addDebtForm.customer_support_no" class="input input-bordered input-sm w-full" /></label>
        </div>
        <label class="form-control"><span class="label-text text-sm">URL</span><input v-model.trim="addDebtForm.address_url" class="input input-bordered input-sm w-full" type="url" /></label>
        <div v-if="addError" class="text-sm text-error">{{ addError }}</div>
        <div class="modal-action">
          <button type="button" class="btn btn-ghost btn-sm min-h-9" @click="addModalRef?.close()">Cancel</button>
          <button type="submit" class="btn btn-primary btn-sm min-h-9" :disabled="addSaving">{{ addSaving ? 'Saving...' : 'Save' }}</button>
        </div>
      </form>

      <!-- Add Cash/Investment -->
      <form v-else-if="addModalType === 'cash'" class="mt-4 space-y-3" @submit.prevent="submitAddCash">
        <label class="form-control"><span class="label-text text-sm">Category</span>
          <div class="flex gap-4">
            <label class="label cursor-pointer gap-2">
              <input type="radio" name="cash-category" value="Cash" v-model="addCashForm.asset_category" class="radio radio-sm" @change="onAddCashCategoryChange" />
              <span class="label-text">Cash</span>
            </label>
            <label class="label cursor-pointer gap-2">
              <input type="radio" name="cash-category" value="Investment" v-model="addCashForm.asset_category" class="radio radio-sm" @change="onAddCashCategoryChange" />
              <span class="label-text">Investment</span>
            </label>
          </div>
        </label>
        <label class="form-control"><span class="label-text text-sm">Classification (Type)</span>
          <select class="select select-bordered select-sm w-full" v-model="addCashForm.classification_type" required>
            <option disabled value="">Select type...</option>
            <option v-for="c in addCashClassifications" :key="c" :value="c">{{ c }}</option>
          </select>
        </label>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label class="form-control"><span class="label-text text-sm">Institution</span><input v-model.trim="addCashForm.institution" class="input input-bordered input-sm w-full" required /></label>
          <label class="form-control"><span class="label-text text-sm">Account #</span><input v-model.trim="addCashForm.account_number" class="input input-bordered input-sm w-full" required /></label>
        </div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label class="form-control"><span class="label-text text-sm">Value</span><input v-model.number="addCashForm.value" class="input input-bordered input-sm w-full" type="number" step="0.01" min="0" required /></label>
          <label class="form-control"><span class="label-text text-sm">Support #</span><input v-model.trim="addCashForm.account_support_number" class="input input-bordered input-sm w-full" required /></label>
        </div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label class="form-control"><span class="label-text text-sm">Institution URL</span><input v-model.trim="addCashForm.institution_url" class="input input-bordered input-sm w-full" type="url" required /></label>
          <label class="form-control"><span class="label-text text-sm">Account Holder</span><input v-model.trim="addCashForm.account_holder" class="input input-bordered input-sm w-full" required /></label>
        </div>
        <label class="form-control"><span class="label-text text-sm">Account Intent</span><input v-model.trim="addCashForm.account_intent" class="input input-bordered input-sm w-full" required /></label>
        <label class="form-control"><span class="label-text text-sm">Trust (Y/N)</span><select v-model="addCashForm.trust_designated" class="select select-bordered select-sm w-full" required><option value="">Select...</option><option value="Y">Y</option><option value="N">N</option></select></label>
        <div v-if="addError" class="text-sm text-error">{{ addError }}</div>
        <div class="modal-action">
          <button type="button" class="btn btn-ghost btn-sm min-h-9" @click="addModalRef?.close()">Cancel</button>
          <button type="submit" class="btn btn-primary btn-sm min-h-9" :disabled="addSaving">{{ addSaving ? 'Saving...' : 'Save' }}</button>
        </div>
      </form>

      <!-- Add Vehicle (same as Estate Management) -->
      <form v-else-if="addModalType === 'vehicle'" class="mt-4 space-y-3" @submit.prevent="submitAddVehicle">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label class="form-control"><span class="label-text text-sm">Year</span>
            <select class="select select-bordered select-sm w-full" v-model.number="addVehicleYear" required>
              <option disabled value="">Select year...</option>
              <option v-for="y in addVehicleYears" :key="y" :value="y">{{ y }}</option>
            </select>
          </label>
          <label class="form-control"><span class="label-text text-sm">Make</span>
            <input v-model.trim="addVehicleMakeFilter" class="input input-bordered input-sm w-full" type="text" placeholder="Filter makes..." />
            <select class="select select-bordered select-sm w-full mt-1" v-model="addVehicleMake" :disabled="addVehicleMakesLoading || !addVehicleYear">
              <option disabled value="">{{ addVehicleMakesLoading ? "Loading makes..." : "Select make..." }}</option>
              <option v-for="m in filteredAddVehicleMakes" :key="m" :value="m">{{ m }}</option>
            </select>
          </label>
          <label class="form-control"><span class="label-text text-sm">Type</span>
            <select class="select select-bordered select-sm w-full" v-model="addVehicleType" :disabled="!addVehicleMake || addVehicleTypesLoading">
              <option disabled value="">{{ addVehicleTypesLoading ? "Loading types..." : "Select type..." }}</option>
              <option v-for="t in addVehicleTypes" :key="t" :value="t">{{ t }}</option>
            </select>
          </label>
        </div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label class="form-control"><span class="label-text text-sm">Model</span>
            <select v-if="addVehicleModels.length > 0" class="select select-bordered select-sm w-full" v-model="addVehicleModel" :disabled="!addVehicleYear || !addVehicleMake || !addVehicleType || addVehicleModelsLoading">
              <option disabled value="">{{ addVehicleModelsLoading ? "Loading models..." : "Select model..." }}</option>
              <option v-for="m in addVehicleModels" :key="m" :value="m">{{ m }}</option>
            </select>
            <input v-else v-model.trim="addVehicleModel" class="input input-bordered input-sm w-full" type="text" :disabled="!addVehicleYear || !addVehicleMake || !addVehicleType" placeholder="Enter model..." />
          </label>
        </div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label class="form-control"><span class="label-text text-sm">VIN</span><input ref="addVehicleVinInputRef" v-model.trim="addVehicleVin" class="input input-bordered input-sm w-full" /></label>
          <label class="form-control"><span class="label-text text-sm">Value</span><input v-model.trim="addVehicleValue" class="input input-bordered input-sm w-full" type="text" /></label>
          <label class="form-control"><span class="label-text text-sm">Vehicle Age</span><input class="input input-bordered input-sm w-full" :value="addVehicleAge" readonly /></label>
        </div>
        <label class="form-control"><span class="label-text text-sm">Description</span><textarea v-model.trim="addVehicleDescription" class="textarea textarea-bordered textarea-sm w-full" rows="2" required /></label>
        <label class="form-control"><span class="label-text text-sm">Trust Designated (Y/N)</span>
          <select class="select select-bordered select-sm w-full" v-model="addVehicleTrustDesignated" required>
            <option disabled value="">Select...</option>
            <option value="Y">Y</option>
            <option value="N">N</option>
          </select>
        </label>
        <div v-if="addError" class="text-sm text-error">{{ addError }}</div>
        <div class="modal-action">
          <button type="button" class="btn btn-ghost btn-sm min-h-9" @click="addModalRef?.close()">Cancel</button>
          <button type="submit" class="btn btn-primary btn-sm min-h-9" :disabled="addSaving || !canSubmitAddVehicle">{{ addSaving ? 'Saving...' : 'Save' }}</button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button type="submit">close</button>
    </form>
  </dialog>

  <dialog ref="addVehicleVinDuplicateRef" class="modal" @close="onAddVehicleVinDuplicateClose">
    <div class="modal-box">
      <p class="py-2">This vehicle already exists in the database. Please try again.</p>
      <div class="modal-action">
        <form method="dialog">
          <button type="submit" class="btn btn-primary">Okay</button>
        </form>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button type="submit">close</button>
    </form>
  </dialog>
</template>

<script setup>
const emit = defineEmits(["created", "saved"]);

const addModalRef = ref(null);
const addModalType = ref(null);
const addSaving = ref(false);
const addError = ref("");
const linkedAssets = ref([]);

const addAssetForm = reactive({ classification_type: "", title: "", value: "", description: "", location: "" });
const addAssetClassifications = ref([]);
const addRealEstateForm = reactive({ number: "", street: "", city: "", state: "", zipcode: "", value: "", trust_designated: "" });
const addInsuranceForm = reactive({ policy_holder: "", polocy_number: "", entity_covered: "", policy_amt: "", intent: "", institution_url: "" });
const addDebtForm = reactive({
  institution: "",
  loan_number: "",
  loan_ammount: "",
  loan_type: "",
  linked_asset: "",
  borrower: "",
  customer_support_no: "",
  address_url: "",
  is_revolving: false,
  interest_rate_annual: "",
  term_months: "",
  scheduled_monthly_payment: "",
  loan_start_date: "",
});
const addDebtTypes = ref([]);
const addCashForm = reactive({
  asset_category: "Cash",
  classification_type: "",
  institution: "",
  account_number: "",
  value: "",
  account_support_number: "",
  institution_url: "",
  account_holder: "",
  account_intent: "",
  trust_designated: "",
});
const addCashClassifications = ref([]);
const addVehicleYear = ref("");
const addVehicleMake = ref("");
const addVehicleMakeFilter = ref("");
const addVehicleModel = ref("");
const addVehicleType = ref("");
const addVehicleVin = ref("");
const addVehicleValue = ref("");
const addVehicleDescription = ref("");
const addVehicleTrustDesignated = ref("");
const addVehicleMakes = ref([]);
const addVehicleModels = ref([]);
const addVehicleTypes = ref([]);
const addVehicleMakesLoading = ref(false);
const addVehicleModelsLoading = ref(false);
const addVehicleTypesLoading = ref(false);
const addVehicleVinDuplicateRef = ref(null);
const addVehicleVinInputRef = ref(null);

const addVehicleYears = computed(() => {
  const y = new Date().getFullYear();
  return Array.from({ length: 31 }, (_, i) => y - i);
});
const addVehicleAge = computed(() => {
  if (!addVehicleYear.value) return "";
  return String(new Date().getFullYear() - Number(addVehicleYear.value));
});
const filteredAddVehicleMakes = computed(() => {
  const f = addVehicleMakeFilter.value.trim().toLowerCase();
  if (!f) return addVehicleMakes.value;
  return addVehicleMakes.value.filter((m) => m.toLowerCase().includes(f));
});
const canSubmitAddVehicle = computed(() =>
  Boolean(
    addVehicleYear.value &&
    addVehicleMake.value &&
    addVehicleModel.value &&
    addVehicleType.value &&
    addVehicleValue.value !== "" &&
    addVehicleAge.value &&
    addVehicleDescription.value &&
    addVehicleTrustDesignated.value,
  ),
);

const addModalTitle = computed(() => {
  const t = addModalType.value;
  if (t === "asset") return "Add Asset";
  if (t === "vehicle") return "Add Vehicle";
  if (t === "cash") return "Add Cash or Investment";
  if (t === "debt") return "Add Debt";
  if (t === "real_estate") return "Add Real Estate";
  if (t === "insurance") return "Add Insurance";
  return "Add Record";
});

async function loadAddCashClassifications() {
  let cat = addCashForm.asset_category || "Cash";
  if (cat === "Investments") cat = "Investment"; // DB uses Investment
  const r = await $fetch("/api/asset-classifications", { params: { category: cat } });
  addCashClassifications.value = r?.classifications ?? [];
}

function onAddCashCategoryChange() {
  addCashForm.classification_type = "";
  void loadAddCashClassifications();
}

async function loadLinkedAssets() {
  linkedAssets.value = await $fetch("/api/records/linked-assets").then((d) => d?.assets ?? []).catch(() => []);
}

const VIN_DUPLICATE_MSG = "This vehicle already exists in the database. Please try again.";

async function loadAddVehicleMakes() {
  addVehicleMakesLoading.value = true;
  try {
    const res = await fetch("https://vpic.nhtsa.dot.gov/api/vehicles/GetAllMakes?format=json");
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    const data = await res.json();
    addVehicleMakes.value = Array.isArray(data?.Results)
      ? data.Results.map((r) => r.Make_Name).filter(Boolean)
      : [];
  } catch {
    addVehicleMakes.value = [];
  } finally {
    addVehicleMakesLoading.value = false;
  }
}

async function loadAddVehicleTypes() {
  if (!addVehicleMake.value) return;
  addVehicleTypesLoading.value = true;
  try {
    const make = encodeURIComponent(addVehicleMake.value);
    const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/GetVehicleTypesForMake/${make}?format=json`);
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    const data = await res.json();
    addVehicleTypes.value = Array.isArray(data?.Results)
      ? data.Results.map((r) => r.VehicleTypeName).filter(Boolean)
      : [];
  } catch {
    addVehicleTypes.value = [];
  } finally {
    addVehicleTypesLoading.value = false;
  }
}

async function loadAddVehicleModels() {
  if (!addVehicleMake.value || !addVehicleYear.value || !addVehicleType.value) return;
  addVehicleModelsLoading.value = true;
  try {
    const make = encodeURIComponent(addVehicleMake.value);
    const year = encodeURIComponent(String(addVehicleYear.value));
    const type = encodeURIComponent(addVehicleType.value);
    const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/${make}/modelyear/${year}/vehicletype/${type}?format=json`);
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    const data = await res.json();
    const results = Array.isArray(data?.Results) ? data.Results : [];
    addVehicleModels.value = results.map((r) => r.Model_Name || r.Model_Name?.trim()).filter(Boolean);
  } catch {
    addVehicleModels.value = [];
  } finally {
    addVehicleModelsLoading.value = false;
  }
}

function onAddVehicleVinDuplicateClose() {
  nextTick(() => {
    addVehicleVinInputRef.value?.focus();
  });
}

async function submitAddAsset() {
  addError.value = "";
  addSaving.value = true;
  try {
    const r = await $fetch("/api/estate-mgmt/submit", {
      method: "POST",
      body: {
        classification_type: addAssetForm.classification_type,
        title: addAssetForm.title,
        description: addAssetForm.description,
        value: addAssetForm.value,
        location: addAssetForm.location || undefined,
      },
    });
    addModalRef.value?.close();
    emit("created", { type: r.type, id: r.id });
    emit("saved");
  } catch (err) {
    addError.value = err?.data?.statusMessage || err?.message || "Failed to add asset.";
  } finally {
    addSaving.value = false;
  }
}

async function submitAddRealEstate() {
  addError.value = "";
  addSaving.value = true;
  try {
    const r = await $fetch("/api/estate-mgmt/real-estate", {
      method: "POST",
      body: {
        number: addRealEstateForm.number || undefined,
        street: addRealEstateForm.street,
        city: addRealEstateForm.city,
        state: addRealEstateForm.state,
        zipcode: addRealEstateForm.zipcode,
        value: addRealEstateForm.value,
        trust_designated: addRealEstateForm.trust_designated,
      },
    });
    addModalRef.value?.close();
    emit("created", { type: r.type, id: r.id });
    emit("saved");
  } catch (err) {
    addError.value = err?.data?.statusMessage || err?.message || "Failed to add real estate.";
  } finally {
    addSaving.value = false;
  }
}

async function submitAddInsurance() {
  addError.value = "";
  addSaving.value = true;
  try {
    const r = await $fetch("/api/estate-mgmt/insurance", {
      method: "POST",
      body: {
        policy_holder: addInsuranceForm.policy_holder,
        polocy_number: addInsuranceForm.polocy_number || undefined,
        entity_covered: addInsuranceForm.entity_covered || undefined,
        policy_amt: addInsuranceForm.policy_amt !== "" ? addInsuranceForm.policy_amt : undefined,
        intent: addInsuranceForm.intent || undefined,
        institution_url: addInsuranceForm.institution_url || undefined,
      },
    });
    addModalRef.value?.close();
    emit("created", { type: r.type, id: r.id });
    emit("saved");
  } catch (err) {
    addError.value = err?.data?.statusMessage || err?.message || "Failed to add insurance.";
  } finally {
    addSaving.value = false;
  }
}

async function submitAddDebt() {
  addError.value = "";
  addSaving.value = true;
  try {
    const [linkedType, linkedId] = addDebtForm.linked_asset ? addDebtForm.linked_asset.split(":") : [null, null];
    const r = await $fetch("/api/estate-mgmt/debt", {
      method: "POST",
      body: {
        institution: addDebtForm.institution,
        loan_number: addDebtForm.loan_number || undefined,
        loan_type: addDebtForm.loan_type || undefined,
        loan_ammount: addDebtForm.loan_ammount !== "" ? addDebtForm.loan_ammount : undefined,
        linked_asset_type: linkedType || undefined,
        linked_asset_id: linkedId ? Number(linkedId) : undefined,
        customer_support_no: addDebtForm.customer_support_no || undefined,
        address_url: addDebtForm.address_url || undefined,
        borrower: addDebtForm.borrower || undefined,
        is_revolving: addDebtForm.is_revolving,
        interest_rate_annual: addDebtForm.interest_rate_annual !== "" ? addDebtForm.interest_rate_annual : undefined,
        term_months: addDebtForm.term_months !== "" ? addDebtForm.term_months : undefined,
        scheduled_monthly_payment:
          addDebtForm.scheduled_monthly_payment !== "" ? addDebtForm.scheduled_monthly_payment : undefined,
        loan_start_date: addDebtForm.loan_start_date || undefined,
      },
    });
    addModalRef.value?.close();
    emit("created", { type: r.type, id: r.id });
    emit("saved");
  } catch (err) {
    addError.value = err?.data?.statusMessage || err?.message || "Failed to add debt.";
  } finally {
    addSaving.value = false;
  }
}

async function submitAddCash() {
  addError.value = "";
  addSaving.value = true;
  try {
    const r = await $fetch("/api/estate-mgmt/cash-investment", {
      method: "POST",
      body: {
        asset_category: addCashForm.asset_category,
        classification_type: addCashForm.classification_type,
        institution: addCashForm.institution,
        account_number: addCashForm.account_number,
        value: addCashForm.value,
        account_support_number: addCashForm.account_support_number,
        institution_url: addCashForm.institution_url,
        account_holder: addCashForm.account_holder,
        account_intent: addCashForm.account_intent,
        trust_designated: addCashForm.trust_designated,
      },
    });
    addModalRef.value?.close();
    emit("created", { type: r.type, id: r.id });
    emit("saved");
  } catch (err) {
    addError.value = err?.data?.statusMessage || err?.message || "Failed to add cash/investment.";
  } finally {
    addSaving.value = false;
  }
}

async function submitAddVehicle() {
  addError.value = "";
  addSaving.value = true;
  try {
    const r = await $fetch("/api/estate-mgmt/vehicle", {
      method: "POST",
      body: {
        classification_type: addVehicleType.value,
        year: addVehicleYear.value,
        make: addVehicleMake.value,
        model: addVehicleModel.value,
        vin: addVehicleVin.value || undefined,
        value: addVehicleValue.value,
        age: addVehicleAge.value,
        description: addVehicleDescription.value,
        trust_designated: addVehicleTrustDesignated.value,
      },
    });
    addModalRef.value?.close();
    emit("created", { type: r.type, id: r.id });
    emit("saved");
  } catch (err) {
    const msg = err?.data?.statusMessage || err?.message || "Failed to add vehicle.";
    if (msg === VIN_DUPLICATE_MSG) {
      addVehicleVinDuplicateRef.value?.showModal();
    } else {
      addError.value = msg;
    }
  } finally {
    addSaving.value = false;
  }
}

async function open(type) {
  addModalType.value = type;
  addError.value = "";
  if (type === "asset") {
    const r = await $fetch("/api/asset-classifications", { params: { category: "Asset" } });
    addAssetClassifications.value = r?.classifications ?? [];
    addAssetForm.classification_type = "";
    addAssetForm.title = "";
    addAssetForm.value = "";
    addAssetForm.description = "";
    addAssetForm.location = "";
  } else if (type === "real_estate") {
    addRealEstateForm.number = "";
    addRealEstateForm.street = "";
    addRealEstateForm.city = "";
    addRealEstateForm.state = "";
    addRealEstateForm.zipcode = "";
    addRealEstateForm.value = "";
    addRealEstateForm.trust_designated = "";
  } else if (type === "insurance") {
    addInsuranceForm.policy_holder = "";
    addInsuranceForm.polocy_number = "";
    addInsuranceForm.entity_covered = "";
    addInsuranceForm.policy_amt = "";
    addInsuranceForm.intent = "";
    addInsuranceForm.institution_url = "";
  } else if (type === "debt") {
    const r = await $fetch("/api/debt-types");
    addDebtTypes.value = r?.debtTypes ?? [];
    void loadLinkedAssets();
    addDebtForm.institution = "";
    addDebtForm.loan_number = "";
    addDebtForm.loan_ammount = "";
    addDebtForm.loan_type = "";
    addDebtForm.linked_asset = "";
    addDebtForm.borrower = "";
    addDebtForm.customer_support_no = "";
    addDebtForm.address_url = "";
    addDebtForm.is_revolving = false;
    addDebtForm.interest_rate_annual = "";
    addDebtForm.term_months = "";
    addDebtForm.scheduled_monthly_payment = "";
    addDebtForm.loan_start_date = "";
  } else if (type === "cash") {
    await loadAddCashClassifications();
    addCashForm.asset_category = "Cash";
    addCashForm.classification_type = "";
    addCashForm.institution = "";
    addCashForm.account_number = "";
    addCashForm.value = "";
    addCashForm.account_support_number = "";
    addCashForm.institution_url = "";
    addCashForm.account_holder = "";
    addCashForm.account_intent = "";
    addCashForm.trust_designated = "";
  } else if (type === "vehicle") {
    addVehicleYear.value = "";
    addVehicleMake.value = "";
    addVehicleMakeFilter.value = "";
    addVehicleModel.value = "";
    addVehicleType.value = "";
    addVehicleVin.value = "";
    addVehicleValue.value = "";
    addVehicleDescription.value = "";
    addVehicleTrustDesignated.value = "";
    addVehicleModels.value = [];
    addVehicleTypes.value = [];
    if (addVehicleMakes.value.length === 0) void loadAddVehicleMakes();
  }
  addModalRef.value?.showModal();
}

function close() {
  addModalRef.value?.close();
}

watch(addVehicleYear, () => {
  addVehicleMake.value = "";
  addVehicleMakeFilter.value = "";
  addVehicleModel.value = "";
  addVehicleModels.value = [];
  addVehicleType.value = "";
  addVehicleTypes.value = [];
});

watch(addVehicleMake, () => {
  addVehicleModel.value = "";
  addVehicleModels.value = [];
  addVehicleType.value = "";
  addVehicleTypes.value = [];
  if (addVehicleMake.value && addVehicleYear.value) void loadAddVehicleModels();
  if (addVehicleMake.value) void loadAddVehicleTypes();
});

watch(addVehicleType, () => {
  addVehicleModel.value = "";
  addVehicleModels.value = [];
  if (addVehicleMake.value && addVehicleYear.value && addVehicleType.value) void loadAddVehicleModels();
});

onMounted(() => {
  void loadAddVehicleMakes();
});

defineExpose({ open, close });
</script>
