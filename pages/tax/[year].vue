<template>
  <section
    class="app-page-wide space-y-4 sm:space-y-6"
  >
    <header class="flex flex-wrap items-center gap-4 sm:gap-6">
      <div class="min-w-0">
        <h1 class="text-lg sm:text-xl font-semibold text-base-content">Tax</h1>
        <p class="mt-0.5 text-xs text-base-content/60">
          Fiscal year {{ selectedYear }}
        </p>
      </div>
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

    <template v-else>
      <nav
        class="flex flex-wrap gap-1 rounded-lg border border-base-200 bg-base-200/40 p-1"
        aria-label="Fiscal years"
      >
        <NuxtLink
          v-for="year in fiscalYears"
          :key="year"
          :to="`/tax/${year}`"
          class="rounded-md px-3 py-1.5 text-sm font-medium no-underline transition-colors"
          :class="
            year === selectedYear
              ? 'bg-primary text-primary-content'
              : 'text-base-content/70 hover:bg-base-100 hover:text-base-content'
          "
          :aria-current="year === selectedYear ? 'page' : undefined"
        >
          {{ year }}
        </NuxtLink>
      </nav>

      <p v-if="loadError" class="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
        {{ loadError }}
      </p>

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <!-- Income -->
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
            <li
              v-for="row in incomeRows"
              :key="row.key"
              class="flex items-center justify-between gap-3 px-3 py-3 sm:px-4"
            >
              <span class="text-sm text-base-content/80">{{ row.label }}</span>
              <span class="text-sm font-semibold tabular-nums text-base-content">
                <span v-if="loading" class="text-base-content/40">…</span>
                <template v-else>${{ formatAmount(row.amount) }}</template>
              </span>
            </li>
          </ul>
        </section>

        <!-- Tax -->
        <section class="overflow-hidden rounded-lg border border-primary bg-transparent">
          <div class="border-b border-primary px-3 py-3 sm:px-4">
            <h2 class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-lg font-semibold text-warning">
              <span>Tax</span>
              <span class="text-sm font-semibold tabular-nums text-base-content">
                <span v-if="loading" class="text-base-content/40">…</span>
                <template v-else>${{ formatAmount(taxSectionTotal) }}</template>
              </span>
            </h2>
          </div>
          <ul class="divide-y divide-base-200">
            <li
              v-for="row in taxRows"
              :key="row.key"
              class="flex items-center justify-between gap-3 px-3 py-3 sm:px-4"
            >
              <span class="text-sm text-base-content/80">{{ row.label }}</span>
              <span class="text-sm font-semibold tabular-nums text-base-content">
                <span v-if="loading" class="text-base-content/40">…</span>
                <template v-else>${{ formatAmount(row.amount) }}</template>
              </span>
            </li>
          </ul>
        </section>

        <!-- Pre-tax -->
        <section class="overflow-hidden rounded-lg border border-primary bg-transparent">
          <div class="border-b border-primary px-3 py-3 sm:px-4">
            <h2 class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-lg font-semibold text-base-content">
              <span>Pre-Tax</span>
              <span class="text-sm font-semibold tabular-nums">
                <span v-if="loading" class="text-base-content/40">…</span>
                <template v-else>${{ formatAmount(preTaxSectionTotal) }}</template>
              </span>
            </h2>
          </div>
          <ul class="divide-y divide-base-200">
            <li
              v-for="row in preTaxRows"
              :key="row.key"
              class="flex items-center justify-between gap-3 px-3 py-3 sm:px-4"
            >
              <span class="text-sm text-base-content/80">{{ row.label }}</span>
              <span class="text-sm font-semibold tabular-nums text-base-content">
                <span v-if="loading" class="text-base-content/40">…</span>
                <template v-else>${{ formatAmount(row.amount) }}</template>
              </span>
            </li>
          </ul>
        </section>

        <!-- Post-Tax -->
        <section class="overflow-hidden rounded-lg border border-primary bg-transparent">
          <div class="border-b border-primary px-3 py-3 sm:px-4">
            <h2 class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-lg font-semibold text-base-content">
              <span>Post-Tax</span>
              <span class="text-sm font-semibold tabular-nums">
                <span v-if="loading" class="text-base-content/40">…</span>
                <template v-else>${{ formatAmount(postTaxSectionTotal) }}</template>
              </span>
            </h2>
          </div>
          <ul class="divide-y divide-base-200">
            <li
              v-for="row in postTaxRows"
              :key="row.key"
              class="flex items-center justify-between gap-3 px-3 py-3 sm:px-4"
            >
              <span class="text-sm text-base-content/80">{{ row.label }}</span>
              <span class="text-sm font-semibold tabular-nums text-base-content">
                <span v-if="loading" class="text-base-content/40">…</span>
                <template v-else>${{ formatAmount(row.amount) }}</template>
              </span>
            </li>
          </ul>
        </section>
      </div>

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <section
          v-for="section in estimateSections"
          :key="section.key"
          class="overflow-hidden rounded-lg border border-primary bg-transparent"
        >
          <div class="border-b border-primary px-3 py-3 sm:px-4">
            <h2 class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-lg font-semibold text-base-content">
              <span>{{ section.title }}</span>
              <span
                class="text-sm font-semibold tabular-nums"
                :class="balanceClass(section.balance)"
              >
                <span v-if="loading" class="text-base-content/40">…</span>
                <template v-else>{{ balanceLabel(section.balance) }} ${{ formatAmount(Math.abs(section.balance)) }}</template>
              </span>
            </h2>
            <p class="mt-1 text-xs text-base-content/60">
              {{ section.subtitle }}
            </p>
          </div>
          <ul class="divide-y divide-base-200">
            <li
              v-for="row in section.rows"
              :key="row.key"
              class="flex items-center justify-between gap-3 px-3 py-3 sm:px-4"
              :class="row.emphasis ? 'bg-base-200/40' : ''"
            >
              <span class="text-sm" :class="row.emphasis ? 'font-medium text-base-content' : 'text-base-content/80'">
                {{ row.label }}
              </span>
              <span
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
    </template>
  </section>
</template>

<script setup>
import { estimateFederalTaxMfjStandardOneChild } from "~/utils/federalTaxEstimate";
import { estimateOhioTaxMfjOneDependent } from "~/utils/ohioTaxEstimate";
import { estimateWoosterLocalTax, woosterQualifyingWages } from "~/utils/ohioLocalTaxEstimate";

const FISCAL_YEARS = [2026, 2027, 2028, 2029, 2030, 2031];

const INCOME_KIND_ORDER = [
  { key: "gross", label: "Gross Income" },
  { key: "taxable", label: "Taxable Income" },
  { key: "net", label: "Net Income" },
];

const TAX_KIND_ORDER = [
  { key: "federal", label: "Federal" },
  { key: "state", label: "State" },
  { key: "local", label: "Local" },
  { key: "medicare", label: "Medicare" },
  { key: "social_security", label: "Social Security" },
];

const PRETAX_KIND_ORDER = [
  { key: "medical", label: "Medical Insurance" },
  { key: "dental", label: "Dental Insurance" },
  { key: "vision", label: "Vision Insurance" },
  { key: "401k", label: "401K" },
  { key: "hsa", label: "HSA" },
];

const POSTTAX_KIND_ORDER = [
  { key: "supplemental_life", label: "Supplemental Life" },
  { key: "stock_option_offset", label: "Stock Option Offset" },
];

const auth = useAuthStore();
const route = useRoute();

const fiscalYears = FISCAL_YEARS;
const loading = ref(false);
const loadError = ref("");
const incomeTotalsByKind = ref({});
const taxTotalsByKind = ref({});
const pretaxTotalsByKind = ref({});
const posttaxTotalsByKind = ref({});

const selectedYear = computed(() => {
  const raw = Number(route.params.year);
  return FISCAL_YEARS.includes(raw) ? raw : FISCAL_YEARS[0];
});

const grossIncomeTotal = computed(
  () => Number(incomeTotalsByKind.value.gross) || 0,
);

const taxRows = computed(() =>
  TAX_KIND_ORDER.map((row) => ({
    ...row,
    amount: Number(taxTotalsByKind.value[row.key]) || 0,
  })),
);

const preTaxRows = computed(() =>
  PRETAX_KIND_ORDER.map((row) => ({
    ...row,
    amount: Number(pretaxTotalsByKind.value[row.key]) || 0,
  })),
);

const postTaxRows = computed(() =>
  POSTTAX_KIND_ORDER.map((row) => ({
    ...row,
    amount: Number(posttaxTotalsByKind.value[row.key]) || 0,
  })),
);

function sumRowAmounts(rows) {
  return rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
}

const taxSectionTotal = computed(() => sumRowAmounts(taxRows.value));
const preTaxSectionTotal = computed(() => sumRowAmounts(preTaxRows.value));
const postTaxSectionTotal = computed(() => sumRowAmounts(postTaxRows.value));

/** Taxable Income = Gross − (Medical + Dental + Vision + 401k + HSA). */
const taxableIncomeTotal = computed(() =>
  Math.max(0, Math.round((grossIncomeTotal.value - preTaxSectionTotal.value) * 100) / 100),
);

const incomeRows = computed(() =>
  INCOME_KIND_ORDER.map((row) => ({
    ...row,
    amount:
      row.key === "taxable"
        ? taxableIncomeTotal.value
        : Number(incomeTotalsByKind.value[row.key]) || 0,
  })),
);

const federalEstimate = computed(() =>
  estimateFederalTaxMfjStandardOneChild({
    incomeAfterPretax: taxableIncomeTotal.value,
    federalWithheld: Number(taxTotalsByKind.value.federal) || 0,
    year: selectedYear.value,
  }),
);

const ohioEstimate = computed(() =>
  estimateOhioTaxMfjOneDependent({
    incomeAfterPretax: taxableIncomeTotal.value,
    stateWithheld: Number(taxTotalsByKind.value.state) || 0,
    year: selectedYear.value,
  }),
);

const localEstimate = computed(() =>
  estimateWoosterLocalTax({
    qualifyingWages: woosterQualifyingWages({
      gross: grossIncomeTotal.value,
      medical: Number(pretaxTotalsByKind.value.medical) || 0,
      dental: Number(pretaxTotalsByKind.value.dental) || 0,
      vision: Number(pretaxTotalsByKind.value.vision) || 0,
      hsa: Number(pretaxTotalsByKind.value.hsa) || 0,
      taxableFallback: taxableIncomeTotal.value,
    }),
    localWithheld: Number(taxTotalsByKind.value.local) || 0,
  }),
);

function balanceLabel(balance) {
  if (balance > 0) return "Owed";
  if (balance < 0) return "Refund";
  return "Settled";
}

function balanceClass(balance) {
  if (balance > 0) return "text-warning";
  if (balance < 0) return "text-success";
  return "text-base-content";
}

function balanceRow(est) {
  return {
    key: "balance",
    label: est.balance >= 0 ? "Estimated amount owed" : "Estimated refund",
    amount: Math.abs(est.balance),
    emphasis: true,
    amountClass:
      est.balance > 0 ? "text-warning" : est.balance < 0 ? "text-success" : "text-base-content",
  };
}

const federalEstimateRows = computed(() => {
  const est = federalEstimate.value;
  const rows = [
    { key: "agi", label: "Income after pre-tax", amount: est.incomeAfterPretax },
    { key: "std", label: "Standard deduction (MFJ)", amount: -est.standardDeduction, signed: true },
    { key: "taxable", label: "Taxable income", amount: est.taxableIncome, emphasis: true },
    { key: "before", label: "Tax before credits", amount: est.taxBeforeCredits },
    { key: "ctc", label: "Child tax credit (1)", amount: -est.childTaxCredit, signed: true },
    {
      key: "est",
      label: "Estimated federal tax",
      amount: est.estimatedFederalTax,
      emphasis: true,
    },
  ];
  if (est.refundableChildTaxCredit > 0) {
    rows.push({
      key: "actc",
      label: "Refundable child tax credit",
      amount: -est.refundableChildTaxCredit,
      signed: true,
    });
  }
  rows.push(
    { key: "withheld", label: "Federal withheld", amount: -est.federalWithheld, signed: true },
    balanceRow(est),
  );
  return rows;
});

const ohioEstimateRows = computed(() => {
  const est = ohioEstimate.value;
  const exemptionLabel =
    est.exemptionPerPerson > 0
      ? `Personal exemptions (${est.exemptionCount} × $${est.exemptionPerPerson.toLocaleString("en-US")})`
      : "Personal exemptions";
  const rows = [
    { key: "agi", label: "Ohio AGI (after pre-tax)", amount: est.incomeAfterPretax },
    { key: "exemptions", label: exemptionLabel, amount: -est.personalExemptions, signed: true },
    { key: "taxable", label: "Ohio taxable income", amount: est.taxableIncome, emphasis: true },
    { key: "before", label: "Tax before credits", amount: est.taxBeforeCredits },
  ];
  if (est.personalExemptionCredit > 0) {
    rows.push({
      key: "pec",
      label: "Personal exemption credit",
      amount: -est.personalExemptionCredit,
      signed: true,
    });
  }
  if (est.jointFilingCredit > 0) {
    const pct = Math.round(est.jointFilingCreditRate * 100);
    rows.push({
      key: "jfc",
      label: `Joint filing credit (${pct}%)`,
      amount: -est.jointFilingCredit,
      signed: true,
    });
  }
  rows.push(
    {
      key: "est",
      label: "Estimated Ohio tax",
      amount: est.estimatedOhioTax,
      emphasis: true,
    },
    { key: "withheld", label: "State withheld", amount: -est.stateWithheld, signed: true },
    balanceRow(est),
  );
  return rows;
});

const localEstimateRows = computed(() => {
  const est = localEstimate.value;
  const cityPct = (est.cityRate * 100).toFixed(1);
  const rows = [
    { key: "wages", label: "Qualifying wages", amount: est.qualifyingWages },
    {
      key: "city",
      label: `City of ${est.city} (${cityPct}%)`,
      amount: est.cityTax,
    },
  ];
  if (est.schoolDistrictRate > 0) {
    rows.push({
      key: "sd",
      label: `${est.schoolDistrict} (${(est.schoolDistrictRate * 100).toFixed(2)}%)`,
      amount: est.schoolDistrictTax,
    });
  } else {
    rows.push({
      key: "sd",
      label: `${est.schoolDistrict} income tax`,
      amount: 0,
    });
  }
  rows.push(
    {
      key: "est",
      label: "Estimated local tax",
      amount: est.estimatedLocalTax,
      emphasis: true,
    },
    { key: "withheld", label: "Local withheld", amount: -est.localWithheld, signed: true },
    balanceRow(est),
  );
  return rows;
});

const estimateSections = computed(() => {
  const fed = federalEstimate.value;
  const oh = ohioEstimate.value;
  const loc = localEstimate.value;
  const fedNote =
    fed.paramsYear !== selectedYear.value ? ` · Using ${fed.paramsYear} IRS figures` : "";
  const ohNote =
    oh.paramsYear !== selectedYear.value ? ` · Using ${oh.paramsYear} Ohio figures` : "";
  return [
    {
      key: "federal",
      title: "Estimated Federal Tax",
      subtitle: `${fed.filingStatusLabel} · Standard deduction · ${fed.qualifyingChildren} child tax credit${fedNote}`,
      balance: fed.balance,
      rows: federalEstimateRows.value,
    },
    {
      key: "ohio",
      title: "Estimated Ohio Tax",
      subtitle: `${oh.filingStatusLabel} · Personal exemptions · ${oh.dependents} dependent${ohNote}`,
      balance: oh.balance,
      rows: ohioEstimateRows.value,
    },
    {
      key: "local",
      title: "Estimated Local Tax",
      subtitle: `${loc.city}, ${loc.county} · ZIP ${loc.zip} · ${loc.schoolDistrict}`,
      balance: loc.balance,
      rows: localEstimateRows.value,
    },
  ];
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

async function loadTotals() {
  if (!auth.user) return;
  loading.value = true;
  loadError.value = "";
  try {
    const [taxData, fiscalData] = await Promise.all([
      $fetch("/api/budget/tax-annual-totals", {
        query: { year: selectedYear.value },
      }),
      $fetch("/api/budget/fiscal-annual-totals", {
        query: { year: selectedYear.value },
      }),
    ]);

    const taxByKind = {};
    for (const row of taxData?.totals ?? []) {
      taxByKind[row.tax_kind] = Number(row.total_amount) || 0;
    }
    taxTotalsByKind.value = taxByKind;

    const incomeByKind = {};
    for (const row of fiscalData?.income ?? []) {
      incomeByKind[row.total_kind] = Number(row.total_amount) || 0;
    }
    incomeTotalsByKind.value = incomeByKind;

    const pretaxByKind = {};
    for (const row of fiscalData?.pretax ?? []) {
      pretaxByKind[row.total_kind] = Number(row.total_amount) || 0;
    }
    pretaxTotalsByKind.value = pretaxByKind;

    const posttaxByKind = {};
    for (const row of fiscalData?.posttax ?? []) {
      posttaxByKind[row.total_kind] = Number(row.total_amount) || 0;
    }
    posttaxTotalsByKind.value = posttaxByKind;
  } catch (err) {
    console.error("Failed to load tax page totals", err);
    loadError.value = err?.data?.statusMessage || err?.message || "Failed to load totals.";
    incomeTotalsByKind.value = {};
    taxTotalsByKind.value = {};
    pretaxTotalsByKind.value = {};
    posttaxTotalsByKind.value = {};
  } finally {
    loading.value = false;
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
    if (auth.user) {
      void loadTotals();
    }
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
