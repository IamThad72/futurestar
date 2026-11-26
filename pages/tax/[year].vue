<template>
  <section class="app-page-wide space-y-4 sm:space-y-6">
    <header class="flex flex-wrap items-center gap-3 sm:gap-4">
      <h1 class="text-lg sm:text-xl font-semibold text-base-content">Tax</h1>
      <p v-if="auth.ready && auth.user && !loading && model.profileMissing" class="min-w-0 text-sm text-base-content/80">
        Federal, state, and local estimates wait until you save a filing status for {{ selectedYear }}. Nothing is assumed. Withholding and paycheck totals stay visible either way.
      </p>
      <p v-else-if="auth.ready && auth.user && profileSummary" class="min-w-0 text-sm text-base-content/80">
        {{ profileSummary }}
      </p>
      <button
        v-if="auth.ready && auth.user"
        type="button"
        class="estate-action-btn"
        :disabled="loading"
        @click="openProfileModal"
      >
        {{ model.profileMissing || profileUnavailable ? "Set up your tax profile" : "Edit tax profile" }}
      </button>
    </header>

    <div v-if="!auth.ready" class="rounded-lg border border-base-200 bg-base-300 p-4">
      <span class="text-sm text-base-content/70">Loading session...</span>
    </div>

    <div
      v-else-if="!auth.user"
      class="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-base-content"
    >
      You must be logged in to use this page.
    </div>

    <template v-else>
      <nav
        class="flex flex-wrap gap-1 rounded-lg border border-base-200 bg-base-200/40 p-1"
        aria-label="Fiscal years"
      >
        <NuxtLink
          v-for="year in fiscalYears"
          :key="year"
          :to="`/tax/${year}`"
          class="rounded-md px-3 py-1.5 text-sm transition-colors"
          :class="
            year === selectedYear
              ? 'font-bold text-base-content underline'
              : 'font-medium text-base-content/70 no-underline hover:bg-base-100 hover:text-base-content'
          "
          :aria-current="year === selectedYear ? 'page' : undefined"
        >
          {{ year }}
        </NuxtLink>
      </nav>

      <p class="text-sm text-warning">
        {{ disclaimer }}
      </p>

      <p v-if="loadError" class="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
        {{ loadError }}
      </p>
      <p v-if="profileNotice" class="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-base-content">
        {{ profileNotice }}
      </p>

      <dialog ref="profileDialogRef" class="modal" @close="onProfileModalClose">
        <div class="modal-box max-h-[90vh] max-w-3xl overflow-y-auto">
          <h3 class="text-lg font-semibold text-base-content">
            {{ model.profileMissing || profileUnavailable ? "Set up your tax profile" : "Edit tax profile" }}
          </h3>
          <p v-if="model.profileMissing" class="mt-1 text-sm text-base-content/70">
            Save a filing status for {{ selectedYear }}. Estimates use only what you enter here.
          </p>
          <div class="mt-4">
            <TaxHouseholdProfileForm
              v-if="profileModalOpen"
              :profile="profileRow"
              :household-key="householdKey"
              :disabled="profileUnavailable || savingProfile"
              :saving="savingProfile"
              @save="saveProfile"
            />
          </div>
          <p v-if="profileSaveError" class="mt-2 text-sm text-error">{{ profileSaveError }}</p>
          <div class="modal-action">
            <button type="button" class="btn btn-ghost" :disabled="savingProfile" @click="closeProfileModal">
              Cancel
            </button>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button type="submit" :disabled="savingProfile">close</button>
        </form>
      </dialog>

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <section class="overflow-hidden rounded-lg border border-primary bg-transparent">
          <div class="border-b border-primary px-3 py-3 sm:px-4">
            <h2 class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-lg font-semibold text-base-content">
              <span>Income</span>
              <span class="text-sm font-semibold tabular-nums">
                <span v-if="loading" class="text-base-content/40">…</span>
                <template v-else>${{ formatAmount(grossIncomeTotal) }}</template>
              </span>
            </h2>
          </div>
          <ul class="divide-y divide-base-200">
            <li v-for="row in model.incomeRows" :key="row.key" class="flex items-center justify-between gap-3 px-3 py-3 sm:px-4">
              <span class="text-sm text-base-content/80">{{ row.label }}</span>
              <span class="text-sm font-semibold tabular-nums text-base-content">
                <span v-if="loading" class="text-base-content/40">…</span>
                <template v-else>${{ formatAmount(row.amount) }}</template>
              </span>
            </li>
          </ul>
        </section>

        <section class="overflow-hidden rounded-lg border border-primary bg-transparent">
          <div class="border-b border-primary px-3 py-3 sm:px-4">
            <h2 class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-lg font-semibold text-warning">
              <span>Tax</span>
              <span class="text-sm font-semibold tabular-nums text-base-content">
                <span v-if="loading" class="text-base-content/40">…</span>
                <template v-else>${{ formatAmount(model.taxSectionTotal) }}</template>
              </span>
            </h2>
          </div>
          <ul class="divide-y divide-base-200">
            <li v-for="row in model.taxRows" :key="row.key" class="flex items-center justify-between gap-3 px-3 py-3 sm:px-4">
              <span class="text-sm text-base-content/80">{{ row.label }}</span>
              <span class="text-sm font-semibold tabular-nums text-base-content">
                <span v-if="loading" class="text-base-content/40">…</span>
                <template v-else>${{ formatAmount(row.amount) }}</template>
              </span>
            </li>
          </ul>
        </section>

        <section class="overflow-hidden rounded-lg border border-primary bg-transparent">
          <div class="border-b border-primary px-3 py-3 sm:px-4">
            <h2 class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-lg font-semibold text-base-content">
              <span>Pre-Tax</span>
              <span class="text-sm font-semibold tabular-nums">
                <span v-if="loading" class="text-base-content/40">…</span>
                <template v-else>${{ formatAmount(model.preTaxSectionTotal) }}</template>
              </span>
            </h2>
          </div>
          <ul class="divide-y divide-base-200">
            <li v-for="row in model.preTaxRows" :key="row.key" class="flex items-center justify-between gap-3 px-3 py-3 sm:px-4">
              <span class="text-sm text-base-content/80">{{ row.label }}</span>
              <span class="text-sm font-semibold tabular-nums text-base-content">
                <span v-if="loading" class="text-base-content/40">…</span>
                <template v-else>${{ formatAmount(row.amount) }}</template>
              </span>
            </li>
          </ul>
        </section>

        <section class="overflow-hidden rounded-lg border border-primary bg-transparent">
          <div class="border-b border-primary px-3 py-3 sm:px-4">
            <h2 class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-lg font-semibold text-base-content">
              <span>Post-Tax</span>
              <span class="text-sm font-semibold tabular-nums">
                <span v-if="loading" class="text-base-content/40">…</span>
                <template v-else>${{ formatAmount(model.postTaxSectionTotal) }}</template>
              </span>
            </h2>
          </div>
          <ul class="divide-y divide-base-200">
            <li v-for="row in model.postTaxRows" :key="row.key" class="flex items-center justify-between gap-3 px-3 py-3 sm:px-4">
              <span class="text-sm text-base-content/80">{{ row.label }}</span>
              <span class="text-sm font-semibold tabular-nums text-base-content">
                <span v-if="loading" class="text-base-content/40">…</span>
                <template v-else>${{ formatAmount(row.amount) }}</template>
              </span>
            </li>
          </ul>
        </section>
      </div>

      <div v-if="estimateSections.length" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <section
          v-for="section in estimateSections"
          :key="section.key"
          class="overflow-hidden rounded-lg border border-primary bg-transparent"
        >
          <div class="border-b border-primary px-3 py-3 sm:px-4">
            <h2 class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-lg font-semibold text-base-content">
              <span>{{ section.title }}</span>
              <span class="text-sm font-semibold tabular-nums" :class="balanceClass(section.balance)">
                <span v-if="loading" class="text-base-content/40">…</span>
                <template v-else-if="section.balance == null">Not available</template>
                <template v-else>{{ balanceLabel(section.balance) }} ${{ formatAmount(Math.abs(section.balance)) }}</template>
              </span>
            </h2>
            <p class="mt-1 text-xs text-base-content/60">{{ section.subtitle }}</p>
          </div>
          <ul class="divide-y divide-base-200">
            <li
              v-for="row in section.rows"
              :key="row.key"
              class="flex items-center justify-between gap-3 px-3 py-3 sm:px-4"
              :class="row.emphasis ? 'bg-base-200/40' : ''"
            >
              <span class="text-sm" :class="row.emphasis ? 'font-medium text-base-content' : 'text-base-content/80'">
                {{ row.text || row.label }}
              </span>
              <span
                v-if="!row.text"
                class="text-sm font-semibold tabular-nums"
                :class="row.amountClass || 'text-base-content'"
              >
                <span v-if="loading" class="text-base-content/40">…</span>
                <template v-else>{{ formatSignedAmount(row.amount, row.signed) }}</template>
              </span>
            </li>
          </ul>
        </section>
      </div>

      <div class="grid items-start gap-4 md:grid-cols-2">
      <details class="group overflow-hidden rounded-lg border border-primary bg-transparent [&:not([open])>:not(summary)]:hidden">
        <summary class="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 sm:px-4">
          <h2 class="text-lg font-semibold text-base-content">How taxable wages were figured</h2>
          <svg class="size-5 shrink-0 transition-transform group-open:rotate-180" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </summary>
        <div class="border-t border-primary">
          <p class="px-3 pt-3 text-xs text-base-content/60 sm:px-4">Gross − traditional retirement − Section 125 = W-2 Box 1.</p>
          <ul class="divide-y divide-base-200">
            <li
              v-for="row in model.wageFigure"
              :key="row.key"
              class="flex items-center justify-between gap-3 px-3 py-3 sm:px-4"
              :class="[row.emphasis ? 'bg-base-200/40' : '', row.detail ? 'pl-8' : '']"
            >
              <span class="text-sm" :class="row.emphasis ? 'font-medium text-base-content' : 'text-base-content/80'">
                {{ row.label }}
              </span>
              <span class="text-sm font-semibold tabular-nums text-base-content">
                <span v-if="loading" class="text-base-content/40">…</span>
                <template v-else>{{ formatSignedAmount(row.amount, row.signed) }}</template>
              </span>
            </li>
          </ul>
        </div>
      </details>

      <details class="group overflow-hidden rounded-lg border border-primary bg-transparent [&:not([open])>:not(summary)]:hidden">
        <summary class="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 sm:px-4">
          <h2 class="text-lg font-semibold text-base-content">Social Security and Medicare check</h2>
          <svg class="size-5 shrink-0 transition-transform group-open:rotate-180" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </summary>
        <div class="border-t border-primary">
          <p class="px-3 pt-3 text-xs text-base-content/60 sm:px-4">
            Expected employee tax is 6.2% of Box 3 and 1.45% of Box 5, plus Additional Medicare when a profile is saved.
            Box 3 stops at the Social Security wage base. A gap above ${{ formatAmount(model.ytd.fica.overTolerance) }} is flagged.
          </p>
          <ul class="divide-y divide-base-200">
            <li v-for="row in ficaRows" :key="row.key" class="flex items-center justify-between gap-3 px-3 py-3 sm:px-4">
              <span class="text-sm" :class="row.warn ? 'font-medium text-warning' : 'text-base-content/80'">{{ row.label }}</span>
              <span class="text-sm font-semibold tabular-nums" :class="row.warn ? 'text-warning' : 'text-base-content'">
                <span v-if="loading" class="text-base-content/40">…</span>
                <template v-else>{{ row.text || formatSignedAmount(row.amount, row.signed) }}</template>
              </span>
            </li>
          </ul>
        </div>
      </details>
      </div>
    </template>
  </section>
</template>

<script setup>
import { TAX_ESTIMATE_DISCLAIMER, buildTaxPageModel } from "~/utils/tax/pageModel";

const FISCAL_YEARS = [2026, 2027, 2028, 2029, 2030, 2031];

const auth = useAuthStore();
const route = useRoute();

const fiscalYears = FISCAL_YEARS;
const disclaimer = TAX_ESTIMATE_DISCLAIMER;
const loading = ref(false);
const loadError = ref("");
const grossIncome = ref(0);
const netIncome = ref(0);
const deductionAmounts = ref({});
const withholdingAmounts = ref({});
const profileRow = ref(null);
const profileUnavailable = ref(false);
const profileNotice = ref("");
const householdKey = ref("");
const profileDialogRef = ref(null);
const profileModalOpen = ref(false);
const savingProfile = ref(false);
const profileSaveError = ref("");
const paychecksSoFar = ref(null);
const budgetPlan = ref(null);

const selectedYear = computed(() => {
  const raw = Number(route.params.year);
  return FISCAL_YEARS.includes(raw) ? raw : FISCAL_YEARS[0];
});

const model = computed(() =>
  buildTaxPageModel({
    year: selectedYear.value,
    profile: profileRow.value,
    profileUnavailable: profileUnavailable.value,
    gross: grossIncome.value,
    net: netIncome.value,
    deductions: deductionAmounts.value,
    withholding: withholdingAmounts.value,
    paychecksSoFar: paychecksSoFar.value,
    budgetPlan: budgetPlan.value,
  }),
);

const grossIncomeTotal = computed(() => model.value.incomeRows.find((row) => row.key === "gross")?.amount || 0);

const profileSummary = computed(() => {
  const profile = model.value.ytd?.federal;
  if (!profileRow.value || !profile) return "";
  const state = model.value.ytd.state?.name || profileRow.value.state_code;
  return `${profile.filingStatusLabel} · ${state} · ${profile.childrenUnder17} child${profile.childrenUnder17 === 1 ? "" : "ren"} under 17`;
});

function withProjected(part, projectedPart) {
  const rows = [...(part?.rows || [])];
  if (projectedPart && projectedPart.balance != null && projectedPart.available !== false) {
    rows.push({
      key: "projected",
      label: projectedPart.balance >= 0 ? "Projected full year owed" : "Projected full year refund",
      amount: Math.abs(projectedPart.balance),
      emphasis: true,
      amountClass:
        projectedPart.balance > 0 ? "text-warning" : projectedPart.balance < 0 ? "text-success" : "text-base-content",
    });
  }
  return rows;
}

const estimateSections = computed(() => {
  const ytd = model.value.ytd;
  if (!ytd?.federal) return [];
  const projected = model.value.projected?.estimate;
  const stateTitle = ytd.state?.name ? `Estimated ${ytd.state.name} Tax` : "Estimated State Tax";
  return [
    {
      key: "federal",
      title: "Estimated Federal Tax",
      subtitle: ytd.federal.subtitle,
      balance: ytd.federal.balance,
      rows: withProjected(ytd.federal, projected?.federal),
    },
    {
      key: "state",
      title: stateTitle,
      subtitle: ytd.state.subtitle,
      balance: ytd.state.available ? ytd.state.balance : null,
      rows: withProjected(ytd.state, projected?.state),
    },
    {
      key: "local",
      title: "Estimated Local Tax",
      subtitle: ytd.local.subtitle,
      balance: ytd.local.balance,
      rows: withProjected(ytd.local, projected?.local),
    },
  ];
});

const ficaRows = computed(() => {
  const ytd = model.value.ytd.fica;
  const projected = model.value.projected.estimate?.fica;
  const rows = [
    { key: "box3", label: "Social Security wages (Box 3)", amount: model.value.wages.box3 },
    { key: "ss-expected", label: "Expected Social Security (6.2%)", amount: ytd.expectedSocialSecurity },
    { key: "ss-withheld", label: "Social Security withheld", amount: -ytd.socialSecurityWithheld, signed: true },
  ];
  if (ytd.socialSecurityOver) {
    rows.push({
      key: "ss-over",
      label: "Social Security over-withheld",
      amount: ytd.socialSecurityDifference,
      warn: true,
    });
  }
  rows.push(
    { key: "box5", label: "Medicare wages (Box 5)", amount: model.value.wages.box5 },
    { key: "med-expected", label: "Expected Medicare (1.45%)", amount: ytd.expectedMedicareBase },
  );
  if (ytd.additionalNote) {
    rows.push({ key: "add-note", label: ytd.additionalNote, text: ytd.additionalNote });
  } else {
    rows.push({
      key: "add-med",
      label: "Expected Additional Medicare (0.9%)",
      amount: ytd.expectedAdditionalMedicare,
    });
  }
  rows.push({ key: "med-withheld", label: "Medicare withheld", amount: -ytd.medicareWithheld, signed: true });
  if (ytd.medicareOver) {
    rows.push({ key: "med-over", label: "Medicare over-withheld", amount: ytd.medicareDifference, warn: true });
  }
  if (projected) {
    rows.push({
      key: "ss-projected",
      label: "Projected Social Security expected",
      amount: projected.expectedSocialSecurity,
    });
    rows.push({
      key: "med-projected",
      label: "Projected Medicare expected",
      amount: projected.expectedMedicare,
    });
    if (projected.socialSecurityOver || projected.medicareOver) {
      rows.push({ key: "projected-over", label: "Projected withholding is above the expected tax", text: "Over-withheld", warn: true });
    }
  }
  return rows;
});

useHead(() => ({
  title: `Tax ${selectedYear.value}`,
}));

function formatAmount(val) {
  if (val == null || val === "" || isNaN(val)) return "0.00";
  return Number(val).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatSignedAmount(val, signed) {
  const n = Number(val) || 0;
  if (signed && n < 0) return `-$${formatAmount(Math.abs(n))}`;
  return `$${formatAmount(n)}`;
}

function balanceLabel(balance) {
  if (balance > 0) return "Owed";
  if (balance < 0) return "Refund";
  return "Settled";
}

function balanceClass(balance) {
  if (balance == null) return "text-base-content/60";
  if (balance > 0) return "text-warning";
  if (balance < 0) return "text-success";
  return "text-base-content";
}

function amountsByKind(rows, key) {
  const out = {};
  for (const row of rows ?? []) out[row[key]] = Number(row.total_amount) || 0;
  return out;
}

async function loadTotals() {
  if (!auth.user) return;
  loading.value = true;
  loadError.value = "";
  profileSaveError.value = "";
  try {
    const [taxData, fiscalData] = await Promise.all([
      $fetch("/api/budget/tax-annual-totals", { query: { year: selectedYear.value } }),
      $fetch("/api/budget/fiscal-annual-totals", { query: { year: selectedYear.value } }),
    ]);
    withholdingAmounts.value = amountsByKind(taxData?.totals, "tax_kind");
    const income = amountsByKind(fiscalData?.income, "total_kind");
    grossIncome.value = income.gross || 0;
    netIncome.value = income.net || 0;
    deductionAmounts.value = {
      ...amountsByKind(fiscalData?.pretax, "total_kind"),
      ...amountsByKind(fiscalData?.posttax, "total_kind"),
    };
  } catch (err) {
    console.error("Failed to load tax page totals", err);
    loadError.value = err?.data?.statusMessage || err?.message || "Failed to load totals.";
    grossIncome.value = 0;
    netIncome.value = 0;
    deductionAmounts.value = {};
    withholdingAmounts.value = {};
    loading.value = false;
    return;
  }

  try {
    const profileData = await $fetch("/api/tax/household-profile", { query: { year: selectedYear.value } });
    profileRow.value = profileData?.profile ?? null;
    profileUnavailable.value = Boolean(profileData?.unavailable);
    householdKey.value = profileData?.household_key || "";
    profileNotice.value = profileData?.unavailable
      ? "Tax profile storage is not set up yet. Withholding below is unchanged."
      : "";
  } catch (err) {
    profileRow.value = null;
    profileUnavailable.value = true;
    profileNotice.value = err?.data?.statusMessage || "The tax profile could not be loaded. Withholding below is unchanged.";
  }

  try {
    const projection = await $fetch("/api/tax/projection", { query: { year: selectedYear.value } });
    paychecksSoFar.value = projection?.paychecksSoFar ?? null;
    budgetPlan.value = projection?.budgetPlan ?? null;
  } catch {
    paychecksSoFar.value = null;
    budgetPlan.value = null;
  } finally {
    loading.value = false;
  }
}

function openProfileModal() {
  profileSaveError.value = "";
  profileModalOpen.value = true;
  nextTick(() => profileDialogRef.value?.showModal());
}

function closeProfileModal() {
  profileDialogRef.value?.close();
}

function onProfileModalClose() {
  profileModalOpen.value = false;
}

async function saveProfile(payload) {
  savingProfile.value = true;
  profileSaveError.value = "";
  try {
    const saved = await $fetch("/api/tax/household-profile", {
      method: "PUT",
      body: { ...payload, tax_year: selectedYear.value },
    });
    profileRow.value = saved?.profile ?? null;
    profileUnavailable.value = false;
    householdKey.value = saved?.household_key || householdKey.value;
    profileNotice.value = "";
    closeProfileModal();
  } catch (err) {
    profileSaveError.value = err?.data?.statusMessage || err?.message || "Could not save the tax profile.";
  } finally {
    savingProfile.value = false;
  }
}

watch(
  () => route.params.year,
  (yearParam) => {
    const raw = Number(yearParam);
    if (!FISCAL_YEARS.includes(raw)) {
      void navigateTo(`/tax/${FISCAL_YEARS[0]}`, { replace: true });
      return;
    }
    if (auth.user) void loadTotals();
  },
  { immediate: true },
);

watch(
  () => auth.user,
  (user) => {
    if (user) void loadTotals();
  },
);
</script>
