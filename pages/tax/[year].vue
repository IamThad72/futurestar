<template>
  <section class="app-page-wide space-y-4 sm:space-y-6">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div class="min-w-0">
        <h1 class="flex items-center gap-2 text-lg font-semibold text-base-content sm:text-xl">
          <AppIcon name="receipt" :size="22" :stroke-width="1.75" />
          Tax
        </h1>
        <p class="mt-0.5 text-xs text-base-content/60">Fiscal year {{ selectedYear }}</p>
      </div>
      <button
        v-if="auth.user"
        type="button"
        class="btn btn-primary min-h-11"
        :disabled="loading"
        @click="openProfile"
      >
        <AppIcon name="pencil" :size="18" :stroke-width="1.75" />
        Edit tax profile
      </button>
    </header>

    <aside class="app-card flex gap-3 border-warning/40 bg-warning/10 px-4 py-3" role="note">
      <AppIcon name="info" :size="20" :stroke-width="1.75" class="mt-0.5 shrink-0 text-warning" />
      <p class="text-sm leading-6 text-base-content">
        This is an estimate, not tax advice and not a filing. It uses published federal and state figures with the income and choices in your tax profile. It does not include every credit, deduction, or local rule.
      </p>
    </aside>

    <div v-if="!auth.ready" class="app-card p-4">
      <span class="text-sm text-base-content/70">Loading session...</span>
    </div>

    <div v-else-if="!auth.user" class="app-card border-warning/30 bg-warning/10 p-4 text-sm text-base-content">
      You must be logged in to use this page.
    </div>

    <template v-else>
      <nav
        class="flex flex-wrap gap-1 rounded-lg border border-base-300 bg-base-200/40 p-1"
        aria-label="Fiscal years"
      >
        <NuxtLink
          v-for="year in fiscalYears"
          :key="year"
          :to="`/tax/${year}`"
          class="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium no-underline transition-colors"
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

      <div class="max-w-3xl">
        <button type="button" class="btn btn-ghost min-h-11" :disabled="explaining || loading" @click="explainYear">
          {{ explaining ? "Writing…" : "Why this number" }}
        </button>
        <p v-if="explainError" class="mt-2 text-sm text-error">{{ explainError }}</p>
        <p v-else-if="explainText" class="mt-2 text-sm leading-6 text-base-content/80">{{ explainText }}</p>
      </div>

      <p v-if="loadError" class="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
        {{ loadError }}
      </p>

      <section class="app-card overflow-hidden">
        <div class="flex flex-wrap items-start justify-between gap-3 border-b border-base-300 px-4 py-3">
          <div>
            <h2 class="text-lg font-semibold text-base-content">Tax profile</h2>
            <p class="mt-1 text-sm text-base-content/70">
              <span v-if="loading">Loading…</span>
              <template v-else>
                {{ profileSummary }}
              </template>
            </p>
          </div>
          <button type="button" class="btn btn-outline min-h-11" :disabled="loading" @click="openProfile">
            <AppIcon name="users" :size="18" :stroke-width="1.75" />
            Filing and dependents
          </button>
        </div>
        <p v-if="!loading && incomeSource === 'budget'" class="px-4 py-3 text-sm text-base-content/70">
          Income matches your budget. A separate fiscal snapshot is not used for this estimate.
        </p>
        <p v-else-if="!loading" class="px-4 py-3 text-sm text-base-content/70">
          Income is the amount saved on this profile. Turn on budget income if it should follow your budget lines.
        </p>
      </section>

      <div class="grid gap-4 lg:grid-cols-2">
        <section class="app-card overflow-hidden">
          <div class="border-b border-base-300 px-4 py-3">
            <h2 class="flex flex-wrap items-baseline justify-between gap-x-3 text-lg font-semibold text-base-content">
              <span>Income</span>
              <span class="text-sm tabular-nums">
                <span v-if="loading" class="text-base-content/40">…</span>
                <template v-else>${{ formatAmount(incomeTotal) }}</template>
              </span>
            </h2>
          </div>
          <ul class="divide-y divide-base-300">
            <li v-for="row in incomeRows" :key="row.key" class="flex min-h-11 items-center justify-between gap-3 px-4 py-3">
              <span class="text-sm text-base-content/80">{{ row.label }}</span>
              <span class="text-sm font-semibold tabular-nums text-base-content">
                <span v-if="loading" class="text-base-content/40">…</span>
                <template v-else>${{ formatAmount(row.amount) }}</template>
              </span>
            </li>
          </ul>
          <p class="border-t border-base-300 px-4 py-3 text-xs leading-5 text-base-content/60">
            Budget prefill uses gross pay, interest, and other income lines. Enter W-2 box 1 yourself if pre-tax 401(k) or health premiums should come out first.
          </p>
        </section>

        <section class="app-card overflow-hidden">
          <div class="border-b border-base-300 px-4 py-3">
            <h2 class="flex flex-wrap items-baseline justify-between gap-x-3 text-lg font-semibold text-warning">
              <span>Withholding</span>
              <span class="text-sm font-semibold tabular-nums text-base-content">
                <span v-if="loading" class="text-base-content/40">…</span>
                <template v-else>${{ formatAmount(withholdingTotal) }}</template>
              </span>
            </h2>
          </div>
          <ul class="divide-y divide-base-300">
            <li v-for="row in withholdingRows" :key="row.key" class="flex min-h-11 items-center justify-between gap-3 px-4 py-3">
              <span class="text-sm text-base-content/80">{{ row.label }}</span>
              <span class="text-sm font-semibold tabular-nums text-base-content">
                <span v-if="loading" class="text-base-content/40">…</span>
                <template v-else>${{ formatAmount(row.amount) }}</template>
              </span>
            </li>
          </ul>
        </section>
      </div>

      <p v-if="estimate && !loading" class="text-sm text-base-content/80">
        Estimated tax from the figures below:
        <span class="font-semibold tabular-nums text-base-content">${{ formatAmount(estimate.totalTax) }}</span>
        · Combined effective rate {{ percentLabel(estimate.effectiveRate) }}
      </p>

      <div v-if="estimate && !loading" class="grid gap-4 lg:grid-cols-3">
        <section v-for="section in estimateSections" :key="section.key" class="app-card overflow-hidden">
          <div class="border-b border-base-300 px-4 py-3">
            <h2 class="flex flex-wrap items-baseline justify-between gap-x-3 text-lg font-semibold text-base-content">
              <span>{{ section.title }}</span>
              <span v-if="section.showBalance" class="text-sm font-semibold tabular-nums" :class="balanceClass(section.balance)">
                {{ balanceLabel(section.balance) }} ${{ formatAmount(Math.abs(section.balance)) }}
              </span>
            </h2>
            <p class="mt-1 text-xs leading-5 text-base-content/60">{{ section.subtitle }}</p>
          </div>
          <p v-if="section.message" class="px-4 py-4 text-sm leading-6 text-base-content">
            {{ section.message }}
          </p>
          <ul v-else class="divide-y divide-base-300">
            <li
              v-for="row in section.rows"
              :key="row.key"
              class="flex min-h-11 items-center justify-between gap-3 px-4 py-3"
              :class="row.emphasis ? 'bg-base-200/60' : ''"
            >
              <span class="text-sm" :class="row.emphasis ? 'font-medium text-base-content' : 'text-base-content/80'">
                {{ row.label }}
              </span>
              <span class="text-sm font-semibold tabular-nums" :class="row.amountClass || 'text-base-content'">
                {{ formatSignedAmount(row.amount, row.signed) }}
              </span>
            </li>
          </ul>
        </section>
      </div>
    </template>

    <TaxProfileSheet ref="profileSheet" @saved="applyProfilePayload" />
  </section>
</template>

<script setup>
import { estimateTax, percentLabel } from "~/utils/tax/estimate";
import { FILING_STATUS_LABELS } from "~/utils/tax/profile";

const FISCAL_YEARS = [2025, 2026, 2027, 2028, 2029, 2030, 2031];

const WITHHOLDING_KINDS = [
  { key: "federal", label: "Federal" },
  { key: "state", label: "State" },
  { key: "local", label: "Local" },
  { key: "medicare", label: "Medicare" },
  { key: "social_security", label: "Social Security" },
];

const auth = useAuthStore();
const route = useRoute();
const profileSheet = ref(null);

const fiscalYears = FISCAL_YEARS;
const loading = ref(false);
const loadError = ref("");
const profile = ref(null);
const budgetIncome = ref(null);
const resolvedIncome = ref(null);
const taxTotalsByKind = ref({});

const selectedYear = computed(() => {
  const raw = Number(route.params.year);
  return FISCAL_YEARS.includes(raw) ? raw : FISCAL_YEARS[1];
});

const incomeSource = computed(() => resolvedIncome.value?.source || "");

const incomeRows = computed(() => {
  const income = resolvedIncome.value || {};
  return [
    { key: "wages", label: "W-2 wages", amount: Number(income.wages) || 0 },
    { key: "se", label: "Self-employment net", amount: Number(income.self_employment) || 0 },
    { key: "retirement", label: "Retirement / pension", amount: Number(income.retirement) || 0 },
    { key: "other", label: "Other income", amount: Number(income.other_income) || 0 },
  ];
});

const incomeTotal = computed(() =>
  incomeRows.value.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
);

const withholdingRows = computed(() =>
  WITHHOLDING_KINDS.map((row) => ({
    ...row,
    amount: Number(taxTotalsByKind.value[row.key]) || 0,
  })),
);

const withholdingTotal = computed(() =>
  withholdingRows.value.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
);

const profileSummary = computed(() => {
  const row = profile.value;
  if (!row) return "Set filing status, state, and dependents.";
  const status = FILING_STATUS_LABELS[row.filing_status] || "Single";
  const state = row.state_code || "No state";
  const kids = Number(row.children_under_17) || 0;
  const others = Number(row.other_dependents) || 0;
  const deduction = row.deduction_method === "itemized" ? "Itemized deduction" : "Standard deduction";
  return `${status} · ${state} · ${kids} under 17 · ${others} other dependents · ${deduction}`;
});

const estimate = computed(() => {
  if (!profile.value || !resolvedIncome.value) return null;
  const income = resolvedIncome.value;
  return estimateTax({
    year: selectedYear.value,
    profile: {
      ...profile.value,
      wages: income.wages,
      self_employment: income.self_employment,
      retirement: income.retirement,
      other_income: income.other_income,
      use_budget_income: false,
    },
    withheld: {
      federal: Number(taxTotalsByKind.value.federal) || 0,
      state: Number(taxTotalsByKind.value.state) || 0,
      local: Number(taxTotalsByKind.value.local) || 0,
    },
  });
});

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

function balanceRow(balance) {
  return {
    key: "balance",
    label: balance >= 0 ? "Estimated amount owed" : "Estimated refund",
    amount: Math.abs(balance),
    emphasis: true,
    amountClass: balance > 0 ? "text-warning" : balance < 0 ? "text-success" : "text-base-content",
  };
}

function signedRow(key, label, amount) {
  return { key, label, amount: -Math.abs(amount), signed: true };
}

const federalRows = computed(() => {
  const fed = estimate.value?.federal;
  if (!fed) return [];
  const rows = [
    { key: "wages", label: "W-2 wages", amount: fed.wages },
    { key: "se-income", label: "Self-employment net", amount: fed.selfEmploymentIncome },
    { key: "retirement", label: "Retirement / pension", amount: fed.retirement },
    { key: "other", label: "Other income", amount: fed.otherIncome },
  ];
  if (fed.selfEmployment.deductibleHalf > 0) {
    rows.push(signedRow("half", "Deductible half of self-employment tax", fed.selfEmployment.deductibleHalf));
  }
  rows.push(
    { key: "agi", label: "AGI", amount: fed.agi, emphasis: true },
    signedRow(
      "deduction",
      fed.deductionMethod === "itemized" ? "Itemized deduction" : "Standard deduction",
      fed.deduction,
    ),
    { key: "taxable", label: "Taxable income", amount: fed.taxableIncome, emphasis: true },
  );
  for (const slice of fed.brackets) {
    rows.push({
      key: `bracket-${slice.rate}`,
      label: `${percentLabel(slice.rate)} bracket`,
      amount: slice.tax,
    });
  }
  rows.push({ key: "before", label: "Tax before credits", amount: fed.taxBeforeCredits });
  if (fed.credits.childCreditAfterPhaseout > 0) {
    rows.push(signedRow("ctc", "Child tax credit", Math.min(fed.credits.childCreditAfterPhaseout, fed.credits.nonrefundable)));
  }
  const odcUsed = Math.max(0, fed.credits.nonrefundable - Math.min(fed.credits.childCreditAfterPhaseout, fed.credits.nonrefundable));
  if (odcUsed > 0) {
    rows.push(signedRow("odc", "Credit for other dependents", odcUsed));
  }
  rows.push({ key: "income-tax", label: "Federal income tax", amount: fed.incomeTax, emphasis: true });
  if (fed.selfEmployment.total > 0) {
    rows.push({ key: "se-ss", label: "Self-employment Social Security", amount: fed.selfEmployment.socialSecurityTax });
    rows.push({ key: "se-med", label: "Self-employment Medicare", amount: fed.selfEmployment.medicareTax });
    if (fed.selfEmployment.additionalMedicareTax > 0) {
      rows.push({
        key: "se-add",
        label: "Additional Medicare tax",
        amount: fed.selfEmployment.additionalMedicareTax,
      });
    }
  }
  if (fed.credits.refundable > 0) {
    rows.push(signedRow("actc", "Refundable child tax credit", fed.credits.refundable));
  }
  rows.push(
    { key: "est", label: "Estimated federal tax", amount: fed.totalTax, emphasis: true },
    signedRow("withheld", "Federal withheld", fed.withheld),
    balanceRow(fed.balance),
  );
  return rows;
});

const stateRows = computed(() => {
  const state = estimate.value?.state;
  if (!state || !state.available) return [];
  if (state.kind === "none") {
    return [
      { key: "tax", label: "Estimated state tax", amount: 0, emphasis: true },
      signedRow("withheld", "State withheld", state.withheld),
      balanceRow(state.balance),
    ];
  }
  if (state.kind === "ohio" && state.detail) {
    const detail = state.detail;
    const rows = [
      { key: "agi", label: "Ohio AGI (federal AGI)", amount: estimate.value.federal.agi },
      signedRow(
        "exemptions",
        `Personal exemptions (${detail.exemptionCount} × $${formatAmount(detail.exemptionPerPerson)})`,
        detail.personalExemptions,
      ),
      { key: "taxable", label: "Ohio taxable income", amount: detail.taxableIncome, emphasis: true },
      { key: "before", label: "Tax before credits", amount: detail.taxBeforeCredits },
    ];
    if (detail.personalExemptionCredit > 0) {
      rows.push(signedRow("pec", "Personal exemption credit", detail.personalExemptionCredit));
    }
    if (detail.jointFilingCredit > 0) {
      rows.push(
        signedRow("jfc", `Joint filing credit (${Math.round(detail.jointFilingCreditRate * 100)}%)`, detail.jointFilingCredit),
      );
    }
    rows.push(
      { key: "est", label: "Estimated Ohio tax", amount: detail.tax, emphasis: true },
      signedRow("withheld", "State withheld", state.withheld),
      balanceRow(state.balance),
    );
    return rows;
  }
  if (state.kind === "flat" && state.detail) {
    const detail = state.detail;
    const rows = [{ key: "agi", label: "Federal AGI", amount: estimate.value.federal.agi }];
    if (detail.standardDeduction > 0) rows.push(signedRow("std", "State standard deduction", detail.standardDeduction));
    if (detail.personalExemption > 0) rows.push(signedRow("ex", "Personal exemption", detail.personalExemption));
    if (detail.dependentExemption > 0) rows.push(signedRow("dep", "Dependent exemptions", detail.dependentExemption));
    if (detail.zeroRateBand > 0) rows.push(signedRow("zero", "Zero-rate band", detail.zeroRateBand));
    rows.push({ key: "taxable", label: "State taxable income", amount: detail.taxableIncome, emphasis: true });
    rows.push({
      key: "rate",
      label: `Tax at ${percentLabel(detail.rate)}`,
      amount: detail.taxBeforeCredits,
    });
    if (detail.credit > 0) rows.push(signedRow("credit", "State credit", detail.credit));
    rows.push(
      { key: "est", label: `Estimated ${state.name} tax`, amount: detail.tax, emphasis: true },
      signedRow("withheld", "State withheld", state.withheld),
      balanceRow(state.balance),
    );
    return rows;
  }
  return [];
});

const localRows = computed(() => {
  const local = estimate.value?.local;
  if (!local || local.rate <= 0) return [];
  return [
    { key: "base", label: "Wages and self-employment", amount: local.base },
    { key: "rate", label: `Local rate (${percentLabel(local.rate)})`, amount: local.tax },
    { key: "est", label: "Estimated local tax", amount: local.tax, emphasis: true },
    signedRow("withheld", "Local withheld", local.withheld),
    balanceRow(local.balance),
  ];
});

const estimateSections = computed(() => {
  const current = estimate.value;
  if (!current) return [];
  const fed = current.federal;
  const state = current.state;
  const local = current.local;
  const fedNote = fed.usingPriorYearRules ? `Uses ${fed.rulesYear} IRS figures for ${fed.year}. ` : "";
  const stateUnavailable = !state.available;
  const localLabel = local.label || "No jurisdiction entered";
  return [
    {
      key: "federal",
      title: "Estimated federal tax",
      subtitle: `${fedNote}${fed.filingStatusLabel}. Marginal rate ${percentLabel(fed.marginalRate)}. Effective rate ${percentLabel(fed.effectiveRate)}.`,
      balance: fed.balance,
      showBalance: true,
      rows: federalRows.value,
    },
    {
      key: "state",
      title: state.name ? `Estimated ${state.name} tax` : "Estimated state tax",
      subtitle: stateUnavailable
        ? "No state figure is shown until this state is supported."
        : state.kind === "none"
          ? state.message
          : `${state.detail?.note || state.message || "Starts from federal AGI."}${state.usingPriorYearRules ? ` Uses ${state.rulesYear} state figures.` : ""}`,
      balance: state.balance,
      showBalance: state.available,
      message: stateUnavailable ? state.message : "",
      rows: stateRows.value,
    },
    {
      key: "local",
      title: "Estimated local tax",
      subtitle: local.rate > 0 ? `${localLabel}. Applied to wages and self-employment.` : local.message,
      balance: local.balance,
      showBalance: local.rate > 0,
      message: local.rate > 0 ? "" : local.message,
      rows: localRows.value,
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

function applyProfilePayload(payload) {
  profile.value = payload?.profile || null;
  budgetIncome.value = payload?.budget_income || null;
  resolvedIncome.value = payload?.income || null;
}

function openProfile() {
  profileSheet.value?.open(profile.value, budgetIncome.value);
}

async function loadPage() {
  if (!auth.user) return;
  loading.value = true;
  loadError.value = "";
  try {
    const [profileData, taxData] = await Promise.all([
      $fetch("/api/tax/profile"),
      $fetch("/api/budget/tax-annual-totals", {
        query: { year: selectedYear.value },
      }),
    ]);
    applyProfilePayload(profileData);
    const taxByKind = {};
    for (const row of taxData?.totals ?? []) {
      taxByKind[row.tax_kind] = Number(row.total_amount) || 0;
    }
    taxTotalsByKind.value = taxByKind;
  } catch (err) {
    console.error("Failed to load tax page", err);
    loadError.value = err?.data?.statusMessage || err?.message || "Failed to load the tax estimate.";
    profile.value = null;
    budgetIncome.value = null;
    resolvedIncome.value = null;
    taxTotalsByKind.value = {};
  } finally {
    loading.value = false;
  }
}

const explainText = ref("");
const explainError = ref("");
const explaining = ref(false);

async function explainYear() {
  if (explaining.value) return;
  explaining.value = true;
  explainError.value = "";
  const rows = [
    ...incomeRows.value,
    ...withholdingRows.value,
    ...estimateSections.value.flatMap((section) => [
      { label: section.title, amount: section.showBalance ? section.balance : 0 },
      ...(section.rows || []).map((row) => ({ label: `${section.title}: ${row.label}`, amount: row.amount })),
    ]),
  ]
    .filter((row) => Number.isFinite(Number(row.amount)))
    .slice(0, 24)
    .map((row) => ({ label: row.label, amount: Math.round(Number(row.amount) * 100) / 100 }));
  try {
    const data = await $fetch("/api/tax/explain", {
      method: "POST",
      body: { year: selectedYear.value, rows },
    });
    explainText.value = String(data?.text || "");
  } catch (error) {
    explainError.value = error?.data?.statusMessage || error?.statusMessage || "Could not explain this year.";
  } finally {
    explaining.value = false;
  }
}

watch(
  () => route.params.year,
  (yearParam) => {
    const raw = Number(yearParam);
    if (!FISCAL_YEARS.includes(raw)) {
      void navigateTo(`/tax/${FISCAL_YEARS[1]}`, { replace: true });
      return;
    }
    explainText.value = "";
    if (auth.user) void loadPage();
  },
  { immediate: true },
);

watch(
  () => auth.user,
  (user) => {
    if (user) void loadPage();
  },
);
</script>
