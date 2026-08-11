<template>
  <section
    class="mx-auto w-full max-w-[96rem] space-y-4 sm:space-y-6 px-0.5 pr-0 pt-[0.8rem] pb-4 sm:-mx-2 sm:pl-2 sm:pr-1.5 sm:pt-[1.2rem] sm:pb-6 overflow-x-hidden min-w-0"
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
    </template>
  </section>
</template>

<script setup>
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

const incomeRows = computed(() =>
  INCOME_KIND_ORDER.map((row) => ({
    ...row,
    amount: Number(incomeTotalsByKind.value[row.key]) || 0,
  })),
);

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
