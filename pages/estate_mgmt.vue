<template>
  <main>

    <div v-if="!auth.ready" class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <p class="text-sm text-gray-500 dark:text-gray-400">Loading session...</p>
    </div>

    <div
      v-else-if="!auth.user"
      class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
    >
      You must be logged in to use estate management.
    </div>

    <template v-else>
      <div class="relative isolate overflow-hidden">
        <header class="pb-4 pt-6 sm:pb-6">
          <div class="mx-auto flex max-w-7xl flex-wrap items-center gap-6 px-4 sm:flex-nowrap sm:px-6 lg:px-8">
            <h1 class="text-lg font-semibold text-base-content md:text-xl">Estate Management</h1>
            <div class="ml-auto flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
              <button
                v-if="auth.user"
                type="button"
                class="estate-action-btn"
                @click="openUploadDocument"
              >
                Upload document
              </button>
              <button
                v-if="auth.user"
                type="button"
                class="estate-action-btn"
                @click="openManageAssetCategoriesModal"
              >
                Manage Asset Categories
              </button>
            </div>
          </div>
        </header>
        <div class="border-b border-gray-900/10 lg:border-t lg:border-t-gray-900/5 dark:border-white/10 dark:lg:border-t-white/5">
          <dl class="mx-auto grid max-w-7xl grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 lg:px-2 xl:px-0">
            <div
              v-for="(stat, statIdx) in estateStats"
              :key="stat.name"
              :class="[
                statIdx % 2 === 1 ? 'sm:border-l' : statIdx === 2 ? 'lg:border-l' : '',
                'flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-gray-900/5 px-4 py-6 sm:px-6 md:gap-x-4 md:gap-y-2 md:py-10 lg:border-t-0 xl:px-8 dark:border-white/5',
              ]"
            >
              <dt class="text-xs font-medium text-gray-500 md:text-sm dark:text-gray-400">{{ stat.name }}</dt>
              <dd class="w-full flex-none text-xl font-medium tracking-tight text-gray-900 tabular-nums md:text-3xl dark:text-white">{{ stat.value }}</dd>
            </div>
          </dl>
        </div>
        <div
          class="absolute left-0 top-full -z-10 mt-96 origin-top-left translate-y-40 -rotate-90 transform-gpu opacity-20 blur-3xl sm:left-1/2 sm:-ml-96 sm:-mt-10 sm:translate-y-0 sm:rotate-0 sm:opacity-50 dark:opacity-10 dark:sm:opacity-30"
          aria-hidden="true"
        >
          <div
            class="aspect-[1154/678] w-[72.125rem] bg-gradient-to-br from-primary/40 to-secondary/40"
            style="clip-path: polygon(100% 38.5%, 82.6% 100%, 60.2% 37.7%, 52.4% 32.1%, 47.5% 41.8%, 45.2% 65.6%, 27.5% 23.4%, 0.1% 35.3%, 17.9% 0%, 27.7% 23.4%, 76.2% 2.5%, 74.2% 56%, 100% 38.5%)"
          ></div>
        </div>
      </div>

      <div class="space-y-10 py-8 md:space-y-16 md:py-16 xl:space-y-20">
        <div id="estate-documents">
          <EstateSection title="Documents" add-label="Upload" @add="openUploadDocument">
            <EstateDocumentsPanel ref="docsPanelRef" />
          </EstateSection>
        </div>

        <div v-if="loading" class="mx-auto max-w-7xl px-4 py-4 text-xs text-gray-500 sm:px-6 md:text-sm lg:px-8 dark:text-gray-400">Loading records...</div>

        <template v-else>
        <EstateSection title="Asset Inventory" :total="formatMoney(totalAssetInventory)" @add="openAddModal('asset')">
          <EstateRecordList
            :items="sortedAssetInventory"
            item-key="ai_id"
            :columns="assetInventoryColumns"
            :sort-state="sortState.assetInventory"
            :map-row="mapAssetInventoryRow"
            @sort="setSort('assetInventory', $event)"
            @edit="openEditModal('asset', $event)"
          />
        </EstateSection>
        <EstateSection
          title="Asset Vehicles"
          title-to="/garage"
          :total="formatMoney(totalAssetVehicles)"
          @add="openAddModal('vehicle')"
        >
          <EstateRecordList
            :items="sortedAssetVehicles"
            item-key="vh_id"
            :columns="assetVehicleColumns"
            :sort-state="sortState.assetVehicles"
            :map-row="mapAssetVehicleRow"
            click-emits="select"
            show-edit-button
            @sort="setSort('assetVehicles', $event)"
            @select="openVehicleGarage"
            @edit="openEditModal('vehicle', $event)"
          />
        </EstateSection>
        <EstateSection title="Cash and Investments" :total="formatMoney(totalCashAndInvestments)" @add="openAddModal('cash')">
          <EstateRecordList
            :items="sortedCashAndInvestments"
            item-key="ci_id"
            :columns="cashColumns"
            :sort-state="sortState.cashAndInvestments"
            :map-row="mapCashRow"
            @sort="setSort('cashAndInvestments', $event)"
            @edit="openEditModal('cash', $event)"
          />
        </EstateSection>
        <EstateSection title="Debt" :total="formatMoney(totalDebtTable)" @add="openAddModal('debt')">
          <EstateRecordList
            :items="sortedDebt"
            item-key="dbt_id"
            :columns="debtColumns"
            :sort-state="sortState.debt"
            :map-row="mapDebtRow"
            @sort="setSort('debt', $event)"
            @edit="openEditModal('debt', $event)"
          />
        </EstateSection>
        <EstateSection title="Real Estate" :total="formatMoney(totalRealEstateValue)" @add="openAddModal('real_estate')">
          <EstateRecordList
            :items="sortedRealEstate"
            item-key="re_id"
            :columns="realEstateColumns"
            :sort-state="sortState.realEstate"
            :map-row="mapRealEstateRow"
            @sort="setSort('realEstate', $event)"
            @edit="openEditModal('real_estate', $event)"
          />
        </EstateSection>
        <EstateSection title="Insurance" @add="openAddModal('insurance')">
          <EstateRecordList
            :items="sortedInsurance"
            item-key="ins_id"
            :columns="insuranceColumns"
            :sort-state="sortState.insurance"
            :map-row="mapInsuranceRow"
            @sort="setSort('insurance', $event)"
            @edit="openEditModal('insurance', $event)"
          />
        </EstateSection>
        </template>
      </div>
    </template>

    <LazyAddEstateRecordModal
      v-if="modalsMounted.addEstate"
      ref="addEstateModalRef"
      @saved="loadSummary"
    />

    <LazyEditEstateRecordModal
      v-if="modalsMounted.editEstate"
      ref="editEstateModalRef"
      @saved="loadSummary"
      @deleted="loadSummary"
    />

    <dialog ref="manageAssetCategoriesModalRef" class="modal">
      <div
        class="modal-box w-[calc(100%-2rem)] max-w-5xl max-h-[90vh] overflow-y-auto overscroll-contain sm:w-full"
      >
        <h3 class="text-lg font-bold">Manage Asset Categories</h3>
        <p class="text-sm text-base-content/70 mt-1 mb-4">
          Choose a category and classification, then enter details for your entry.
        </p>
        <LazyEstateAssetCategoriesPanel
          v-if="modalsMounted.categories"
          layout="modal"
          @records-updated="onEstatePanelRecordsUpdated"
        />
        <div class="modal-action">
          <form method="dialog">
            <button type="submit" class="btn btn-outline">Close</button>
          </form>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="submit">close</button>
      </form>
    </dialog>
  </main>
</template>

<script setup>
import { nextTick } from "vue";
import { inferIsRevolvingDebt } from "~/utils/debtPayment";
import { isEstateDocumentsView } from "~/utils/financialNav";

useHead({ title: "Estate Management" });

const assetInventoryColumns = [
  { k: "title", l: "Title" },
  { k: "classification", l: "Classification" },
  { k: "value", l: "Value" },
  { k: "location", l: "Location", desktopOnly: true },
];

const assetVehicleColumns = [
  { k: "make", l: "Make" },
  { k: "model", l: "Model" },
  { k: "vin", l: "VIN", desktopOnly: true },
  { k: "value", l: "Value" },
  { k: "trust_designated", l: "Trust", desktopOnly: true },
];

const cashColumns = [
  { k: "acct_type", l: "Type" },
  { k: "institution", l: "Institution" },
  { k: "acct_number", l: "Account #", desktopOnly: true },
  { k: "value", l: "Value" },
  { k: "trust_designated", l: "Trust", desktopOnly: true },
];

const debtColumns = [
  { k: "institution", l: "Institution" },
  { k: "loan_number", l: "Loan #", desktopOnly: true },
  { k: "loan_type", l: "Loan Type" },
  { k: "loan_ammount", l: "Loan Amount" },
  { k: "linked_asset", l: "Linked Asset", desktopOnly: true },
  { k: "customer_support_no", l: "Support #", desktopOnly: true },
];

const realEstateColumns = [
  { k: "address", l: "Address" },
  { k: "city", l: "City", desktopOnly: true },
  { k: "state", l: "State", desktopOnly: true },
  { k: "zipcode", l: "Zip" },
  { k: "value", l: "Value" },
  { k: "trust_designated", l: "Trust", desktopOnly: true },
];

const insuranceColumns = [
  { k: "policy_holder", l: "Policy Holder" },
  { k: "polocy_number", l: "Policy #", desktopOnly: true },
  { k: "entity_covered", l: "Entity Covered" },
  { k: "policy_amt", l: "Amount" },
  { k: "intent", l: "Intent", desktopOnly: true },
];

const auth = useAuthStore();
const route = useRoute();
const loading = ref(true);
const addEstateModalRef = ref(null);
const editEstateModalRef = ref(null);
const manageAssetCategoriesModalRef = ref(null);
const docsPanelRef = ref(null);
const modalsMounted = reactive({
  addEstate: false,
  editEstate: false,
  categories: false,
});

async function ensureModal(key) {
  if (!modalsMounted[key]) {
    modalsMounted[key] = true;
    await nextTick();
  }
}
const assetInventory = ref([]);
const assetVehicles = ref([]);
const cashAndInvestments = ref([]);
const debt = ref([]);
const realEstate = ref([]);
const insurance = ref([]);
const linkedAssets = ref([]);

function formatDebtTermsLine(r) {
  if (inferIsRevolvingDebt(r)) return "";
  const parts = [];
  if (r.interest_rate_annual != null && r.interest_rate_annual !== "") {
    parts.push(`${r.interest_rate_annual}% APR`);
  }
  if (r.term_months != null && r.term_months !== "") {
    parts.push(`${r.term_months} mo remaining`);
  }
  if (r.scheduled_monthly_payment != null && r.scheduled_monthly_payment !== "") {
    parts.push(`${formatMoney(r.scheduled_monthly_payment)}/mo`);
  }
  return parts.length ? parts.join(" · ") : "Installment loan";
}

function formatMoney(val) {
  if (val == null || val === '') return '—';
  const n = toNumber(val);
  if (Number.isNaN(n)) return String(val);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function estateDetailLines(entries) {
  return entries.filter((line) => line && line.value != null && line.value !== "" && line.value !== "—");
}

function mapAssetInventoryRow(r) {
  return {
    title: r.title || "—",
    subtitle: r.asset_classification ?? r.classification_type ?? "—",
    note: formatMoney(r.value),
    lines: estateDetailLines([r.location ? { label: "Location", value: r.location } : null]),
  };
}

function mapAssetVehicleRow(r) {
  const title = [r.year, r.make, r.model].filter(Boolean).join(" ") || "—";
  return {
    title,
    subtitle: r.vin ? `VIN ${r.vin}` : undefined,
    note: formatMoney(r.value),
    lines: estateDetailLines([{ label: "Trust", value: r.trust_designated ? "Y" : "N" }]),
  };
}

function openVehicleGarage(item) {
  if (!item?.vh_id) return;
  void navigateTo(`/garage/${item.vh_id}`);
}

function mapCashRow(r) {
  return {
    title: r.institution || "—",
    subtitle: r.acct_type || undefined,
    note: formatMoney(r.value),
    lines: estateDetailLines([
      r.acct_number ? { label: "Account #", value: r.acct_number } : null,
      { label: "Trust", value: r.trust_designated ? "Y" : "N" },
    ]),
  };
}

function mapDebtRow(r) {
  const terms = formatDebtTermsLine(r);
  return {
    title: r.institution || "—",
    subtitle: r.loan_type || undefined,
    note: formatMoney(r.loan_ammount),
    lines: estateDetailLines([
      r.loan_number ? { label: "Loan #", value: r.loan_number } : null,
      getLinkedAssetLabel(r) !== "—" ? { label: "Linked", value: getLinkedAssetLabel(r) } : null,
      r.customer_support_no ? { label: "Support", value: r.customer_support_no } : null,
      terms ? { label: "Terms", value: terms } : null,
    ]),
  };
}

function mapRealEstateRow(r) {
  const address = [r.number, r.street].filter(Boolean).join(" ") || "—";
  return {
    title: address,
    subtitle: [r.city, r.state].filter(Boolean).join(", ") || undefined,
    note: formatMoney(r.value),
    lines: estateDetailLines([
      r.zipcode ? { label: "Zip", value: r.zipcode } : null,
      { label: "Trust", value: r.trust_designated ? "Y" : "N" },
    ]),
  };
}

function mapInsuranceRow(r) {
  return {
    title: r.policy_holder || "—",
    subtitle: r.entity_covered || undefined,
    note: formatMoney(r.policy_amt),
    lines: estateDetailLines([
      r.polocy_number ? { label: "Policy #", value: r.polocy_number } : null,
      r.intent ? { label: "Intent", value: r.intent } : null,
    ]),
  };
}

function toNumber(val) {
  if (val == null || val === '') return NaN;
  if (typeof val === 'number') return val;
  const s = String(val).replace(/[$,]/g, '').trim();
  return parseFloat(s) || NaN;
}
function getLinkedAssetLabel(r) {
  if (!r?.linked_asset_type || !r?.linked_asset_id) return '—';
  const a = linkedAssets.value.find((x) => x.type === r.linked_asset_type && x.id === Number(r.linked_asset_id));
  return a ? a.label : '—';
}

const sortState = reactive({
  assetInventory: { key: 'title', dir: 'asc' },
  assetVehicles: { key: 'make', dir: 'asc' },
  cashAndInvestments: { key: 'institution', dir: 'asc' },
  debt: { key: 'institution', dir: 'asc' },
  realEstate: { key: 'city', dir: 'asc' },
  insurance: { key: 'policy_holder', dir: 'asc' },
});

function setSort(table, key) {
  const s = sortState[table];
  if (s.key === key) s.dir = s.dir === 'asc' ? 'desc' : 'asc';
  else { s.key = key; s.dir = 'asc'; }
}

function sortCompare(a, b, key, dir, getVal) {
  const va = getVal(a, key);
  const vb = getVal(b, key);
  const isNum = typeof va === 'number' && typeof vb === 'number';
  let cmp = 0;
  if (isNum || (typeof va === 'number' && !Number.isNaN(va)) || (typeof vb === 'number' && !Number.isNaN(vb))) {
    const na = typeof va === 'number' ? va : toNumber(va);
    const nb = typeof vb === 'number' ? vb : toNumber(vb);
    cmp = (Number.isNaN(na) ? -Infinity : na) - (Number.isNaN(nb) ? -Infinity : nb);
  } else {
    cmp = String(va ?? '').toLowerCase().localeCompare(String(vb ?? '').toLowerCase());
  }
  return dir === 'asc' ? cmp : -cmp;
}

const sortedAssetInventory = computed(() => {
  const arr = [...assetInventory.value];
  const { key, dir } = sortState.assetInventory;
  const getVal = (r, k) => {
    if (k === 'classification') return r.asset_classification ?? r.classification_type ?? '';
    if (k === 'value') return toNumber(r.value);
    return r[k] ?? '';
  };
  arr.sort((a, b) => sortCompare(a, b, key, dir, getVal));
  return arr;
});

const sortedAssetVehicles = computed(() => {
  const arr = [...assetVehicles.value];
  const { key, dir } = sortState.assetVehicles;
  const getVal = (r, k) => k === 'value' ? toNumber(r.value) : (r[k] ?? '');
  arr.sort((a, b) => sortCompare(a, b, key, dir, getVal));
  return arr;
});

const sortedCashAndInvestments = computed(() => {
  const arr = [...cashAndInvestments.value];
  const { key, dir } = sortState.cashAndInvestments;
  const getVal = (r, k) => (k === 'value' ? toNumber(r.value) : (r[k] ?? ''));
  arr.sort((a, b) => sortCompare(a, b, key, dir, getVal));
  return arr;
});

const sortedDebt = computed(() => {
  const arr = [...debt.value];
  const { key, dir } = sortState.debt;
  const getVal = (r, k) => {
    if (k === 'value' || k === 'loan_ammount') return toNumber(r.loan_ammount);
    if (k === 'linked_asset') return getLinkedAssetLabel(r);
    return r[k] ?? '';
  };
  arr.sort((a, b) => sortCompare(a, b, key, dir, getVal));
  return arr;
});

const sortedRealEstate = computed(() => {
  const arr = [...realEstate.value];
  const { key, dir } = sortState.realEstate;
  const getVal = (r, k) => {
    if (k === 'address') return [r.number, r.street].filter(Boolean).join(' ') || '';
    if (k === 'value') return toNumber(r.value);
    return r[k] ?? '';
  };
  arr.sort((a, b) => sortCompare(a, b, key, dir, getVal));
  return arr;
});

const sortedInsurance = computed(() => {
  const arr = [...insurance.value];
  const { key, dir } = sortState.insurance;
  const getVal = (r, k) => k === 'value' || k === 'policy_amt' ? toNumber(r.policy_amt) : (r[k] ?? '');
  arr.sort((a, b) => sortCompare(a, b, key, dir, getVal));
  return arr;
});

const netWealthRows = computed(() => [
  { category: 'Assets', total: totalAssets.value },
  { category: 'Debt', total: totalDebt.value },
]);

const totalAssets = computed(() => {
  const sum = (arr, key) => arr.reduce((a, r) => a + (toNumber(r[key]) || 0), 0);
  return (
    sum(assetInventory.value, 'value') +
    sum(assetVehicles.value, 'value') +
    sum(cashAndInvestments.value, 'value') +
    sum(realEstate.value, 'value')
  );
});

const totalDebt = computed(() => {
  return debt.value.reduce((a, r) => {
    const amt = toNumber(r.loan_ammount) ?? toNumber(r.balance) ?? toNumber(r.amount) ?? toNumber(r.value) ?? toNumber(r.balance_amt);
    return a + (amt || 0);
  }, 0);
});

const netWealth = computed(() => totalAssets.value - totalDebt.value);

const totalHardAssets = computed(() => totalAssetInventory.value + totalAssetVehicles.value);

const estateStats = computed(() => [
  { name: "Assets", value: formatMoney(totalAssets.value) },
  { name: "Debt", value: formatMoney(totalDebt.value) },
  { name: "Hard Assets", value: formatMoney(totalHardAssets.value) },
  { name: "Net Wealth", value: formatMoney(netWealth.value) },
]);

const sumByKey = (arr, key) => arr.reduce((a, r) => a + (toNumber(r[key]) || 0), 0);
const totalAssetInventory = computed(() => sumByKey(assetInventory.value, 'value'));
const totalAssetVehicles = computed(() => sumByKey(assetVehicles.value, 'value'));
const totalCashAndInvestments = computed(() => sumByKey(cashAndInvestments.value, 'value'));
const totalDebtTable = computed(() =>
  debt.value.reduce((a, r) => {
    const amt = toNumber(r.loan_ammount) ?? toNumber(r.balance) ?? toNumber(r.amount) ?? toNumber(r.value) ?? toNumber(r.balance_amt);
    return a + (amt || 0);
  }, 0)
);
const totalRealEstateValue = computed(() => sumByKey(realEstate.value, 'value'));

async function openAddModal(type) {
  await ensureModal("addEstate");
  addEstateModalRef.value?.open(type);
}

async function openManageAssetCategoriesModal() {
  await ensureModal("categories");
  await nextTick();
  manageAssetCategoriesModalRef.value?.showModal();
}

function openUploadDocument() {
  docsPanelRef.value?.openUpload();
}

function scrollToDocumentsIfNeeded() {
  if (!isEstateDocumentsView(route.query, route.hash)) return;
  nextTick(() => {
    document.getElementById("estate-documents")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function onEstatePanelRecordsUpdated() {
  void loadSummary();
}

async function openEditModal(type, record) {
  await ensureModal("editEstate");
  editEstateModalRef.value?.open(type, record);
}

async function loadSummary() {
  if (!auth.user) return;
  loading.value = true;
  try {
    const [inv, vehicles, cash, debtRes, real, ins, linked] = await Promise.all([
      $fetch('/api/records/asset-inventory').then((d) => d?.records ?? []).catch(() => []),
      $fetch('/api/records/asset-vehicles').then((d) => d?.records ?? []).catch(() => []),
      $fetch('/api/records/cash-and-investments').then((d) => d?.records ?? []).catch(() => []),
      $fetch('/api/records/debt').then((d) => d?.records ?? []).catch(() => []),
      $fetch('/api/records/real-estate').then((d) => d?.records ?? []).catch(() => []),
      $fetch('/api/records/insurance').then((d) => d?.records ?? []).catch(() => []),
      $fetch('/api/records/linked-assets').then((d) => d?.assets ?? []).catch(() => []),
    ]);
    assetInventory.value = inv;
    assetVehicles.value = vehicles;
    cashAndInvestments.value = cash;
    debt.value = debtRes;
    realEstate.value = real;
    insurance.value = ins;
    linkedAssets.value = linked;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  if (!auth.ready) auth.fetchSession();
  void loadSummary();
  scrollToDocumentsIfNeeded();
});

watch(() => auth.user, (user) => {
  if (user) void loadSummary();
}, { immediate: false });

watch(
  () => [route.query.docs, route.hash],
  () => {
    scrollToDocumentsIfNeeded();
  },
);
</script>

<style scoped>
.summary-section-scroll {
  max-height: 200px;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}
@media (min-width: 640px) {
  .summary-section-scroll {
    max-height: 240px;
  }
}
.table-category-title {
  text-transform: capitalize;
}
</style>