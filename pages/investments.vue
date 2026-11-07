<template>
  <div v-if="!auth.ready || loading" class="app-page">
    <p class="text-sm text-base-content/60">Loading investments...</p>
  </div>

  <div
    v-else-if="!auth.user"
    class="app-page rounded-lg border border-warning/30 bg-warning/10 text-sm text-warning-content"
  >
    You must be logged in to use Investments.
  </div>

  <div
    v-else-if="loadError"
    class="app-page rounded-lg border border-error/30 bg-error/10 p-4 text-sm text-error"
  >
    <p>{{ loadError }}</p>
    <button type="button" class="btn btn-sm mt-3" @click="loadHoldings">Try again</button>
  </div>

  <section v-else class="app-page overflow-x-hidden">
    <header class="mb-6">
      <h1 class="text-lg font-semibold text-base-content sm:text-xl">Investments</h1>
      <p class="mt-1 max-w-3xl text-xs leading-5 text-base-content/60">
        Based on current holdings and cost basis. Excludes realized gains/losses and cash distributions not reflected in the supplied values.
      </p>
    </header>

    <div
      v-if="!holdings.length"
      class="rounded-lg border border-base-300 bg-base-100 px-4 py-10 text-center text-sm text-base-content/60"
    >
      <p>No holdings to show.</p>
      <div class="mt-3 flex justify-center">
        <button type="button" class="investment-edit-btn" @click="openAdd">Add holding</button>
      </div>
    </div>

    <template v-else>
      <dl class="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4 sm:gap-3">
        <div class="rounded-md border border-base-300 bg-base-100 px-3 py-2">
          <dt class="text-[0.65rem] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Total cost basis
          </dt>
          <dd class="mt-0.5 text-base font-semibold tabular-nums text-gray-900 md:text-lg dark:text-white">
            {{ money(totals.costBasis) }}
          </dd>
        </div>
        <div class="rounded-md border border-base-300 bg-base-100 px-3 py-2">
          <dt class="text-[0.65rem] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Current portfolio value
          </dt>
          <dd class="mt-0.5 text-base font-semibold tabular-nums text-gray-900 md:text-lg dark:text-white">
            {{ money(portfolioValue) }}
          </dd>
        </div>
        <div class="rounded-md border border-base-300 bg-base-100 px-3 py-2">
          <dt class="text-[0.65rem] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Unrealized gain/loss ($)
          </dt>
          <dd class="mt-0.5 text-base font-semibold tabular-nums md:text-lg" :class="gainClass(portfolioGain.gainDollars)">
            {{ money(portfolioGain.gainDollars, true) }}
          </dd>
        </div>
        <div class="rounded-md border border-base-300 bg-base-100 px-3 py-2">
          <dt class="text-[0.65rem] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Unrealized gain/loss (%)
          </dt>
          <dd class="mt-0.5 text-base font-semibold tabular-nums md:text-lg" :class="gainClass(portfolioGain.gainPercent)">
            {{ percent(portfolioGain.gainPercent) }}
          </dd>
        </div>
      </dl>

      <p v-if="totals.excluded" class="mb-6 text-xs leading-5 text-base-content/60">
        Unrealized gain/loss is current portfolio value minus total cost basis. The percent is that amount divided by total cost basis.
        {{ totals.excluded }} holding{{ totals.excluded === 1 ? "" : "s" }}
        {{ totals.excluded === 1 ? "has" : "have" }} no cost basis, so {{ totals.excluded === 1 ? "that current value is" : "those current values are" }} included in the gain.
      </p>

      <div class="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 class="text-sm font-semibold text-gray-900 md:text-base dark:text-white">
            Account value
          </h2>
          <ul class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
            <li class="inline-flex items-center gap-1.5">
              <span class="inline-block h-2.5 w-2.5 rounded-sm bg-[#9ca3af]" aria-hidden="true" />
              Lower of cost basis and current value
            </li>
            <li class="inline-flex items-center gap-1.5">
              <span class="inline-block h-2.5 w-2.5 rounded-sm bg-[#059669]" aria-hidden="true" />
              Unrealized gain
            </li>
            <li class="inline-flex items-center gap-1.5">
              <span class="inline-block h-2.5 w-2.5 rounded-sm bg-[#dc2626]" aria-hidden="true" />
              Unrealized loss
            </li>
          </ul>
          <p class="mt-2 max-w-3xl text-xs leading-5 text-base-content/60">
            Each bar is one account. HSA Cash and HSA Investments are combined as HSA. The green or red cap is that account’s current value minus its cost basis. Gray is the lower of those two amounts. Dollar amounts run across the chart. Account names are listed on the side.
          </p>
        </div>
        <label class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 md:text-sm">
          <span class="font-medium" id="investment-sort-label">Sort</span>
          <select
            id="investment-sort"
            aria-labelledby="investment-sort-label"
            class="select select-bordered select-sm min-h-9 bg-base-100 text-xs text-base-content md:text-sm"
            :value="sortKey"
            @change="onSortSelect"
          >
            <option v-if="sortKey === 'share'" value="share">Share of portfolio gain/loss (%)</option>
            <option v-for="option in investmentSortOptions" :key="option.key" :value="option.key">
              {{ option.label }}
            </option>
          </select>
        </label>
      </div>

      <p
        v-if="!chartRows.length"
        class="rounded-lg border border-base-300 bg-base-100 px-4 py-10 text-center text-sm text-base-content/60"
      >
        No account values to chart.
      </p>
      <ClientOnly v-else>
        <div class="overflow-hidden">
          <InvestmentPerformanceChart :rows="chartRows" :currency="currency" />
        </div>
      </ClientOnly>

      <div class="relative z-10 mt-8 flex flex-wrap items-center justify-between gap-2">
        <p class="text-xs leading-5 text-base-content/60">
          Share counts are not added into the portfolio total. Edits are saved on the Estate account.
        </p>
        <button type="button" class="investment-edit-btn" @click="openAdd">Add holding</button>
      </div>
      <p v-if="saveError" class="mt-2 text-xs text-error">{{ saveError }}</p>

      <div class="mt-3 overflow-x-auto rounded-lg border border-base-300 bg-base-100">
        <table class="inv-holdings min-w-[64rem] w-full text-left text-xs md:text-sm">
          <caption class="sr-only">
            Holdings with shares, cost basis, current value, and unrealized gain or loss. Account rows include cost basis. The chart lists accounts in this order, with HSA Cash and HSA Investments combined as HSA.
          </caption>
          <thead class="border-b border-base-300 text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <tr>
              <th
                v-for="column in columns"
                :key="column.key"
                class="px-3 py-2 font-medium"
                :class="column.align === 'right' ? 'text-right' : 'text-left'"
                :aria-sort="ariaSort(column.key)"
              >
                <button
                  type="button"
                  class="inline-flex items-center gap-1 rounded-sm font-medium hover:text-base-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  @click="setSort(column.key)"
                >
                  {{ column.label }}
                  <span v-if="sortKey === column.key" aria-hidden="true">{{ sortDirection === "asc" ? "↑" : "↓" }}</span>
                </button>
              </th>
              <th class="px-3 py-2">
                <span class="sr-only">Edit</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="group in accountGroups" :key="group.account">
            <tr class="border-b border-base-300 bg-base-200/70 font-semibold">
              <th scope="rowgroup" class="py-2 text-left text-sm text-primary">
                {{ group.account }}
              </th>
              <td />
              <td />
              <td class="py-2 text-right text-sm tabular-nums text-primary">{{ money(group.costBasis) }}</td>
              <td class="py-2 text-right text-sm tabular-nums text-primary">{{ money(group.value) }}</td>
              <td class="py-2 text-right text-sm tabular-nums" :class="gainClass(group.gainDollars)">
                {{ money(group.gainDollars, true) }}
              </td>
              <td class="py-2 text-right text-sm tabular-nums" :class="gainClass(group.gainPercent)">
                {{ percent(group.gainPercent) }}
              </td>
              <td v-if="showContribution" />
              <td />
            </tr>
            <tr
              v-for="row in group.rows"
              :key="row.id"
              class="border-b border-base-200 last:border-0"
            >
              <td class="px-3 py-2">
                <div class="flex min-w-0 items-baseline gap-2" :title="row.name">
                  <span class="shrink-0 text-sm font-semibold text-gray-900 md:text-base dark:text-white">{{ row.ticker || "—" }}</span>
                  <span v-if="row.name" class="truncate text-[0.7rem] text-base-content/60">{{ shortDescription(row.name) }}</span>
                </div>
              </td>
              <td class="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-white">{{ shares(row.shares) }}</td>
              <td class="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-white">{{ money(row.price) }}</td>
              <td class="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-white">{{ money(row.metrics.costBasis) }}</td>
              <td class="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-white">{{ money(row.metrics.currentValue) }}</td>
              <td class="px-3 py-2 text-right tabular-nums" :class="gainClass(row.metrics.gainDollars)">
                {{ money(row.metrics.gainDollars, true) }}
              </td>
              <td class="px-3 py-2 text-right tabular-nums" :class="gainClass(row.metrics.gainPercent)">
                {{ percent(row.metrics.gainPercent) }}
              </td>
              <td v-if="showContribution" class="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-white">
                {{ percent(row.share) }}
              </td>
              <td class="px-3 py-2 text-right">
                <button type="button" class="investment-edit-btn" @click="openEdit(row)">
                  Edit
                  <span class="sr-only">{{ row.name }}</span>
                </button>
              </td>
            </tr>
            </template>
          </tbody>
          <tfoot class="border-t border-base-300 bg-base-200/40 font-semibold">
            <tr>
              <th scope="row" class="px-3 py-2 text-left text-gray-900 dark:text-white">Portfolio total</th>
              <td class="px-3 py-2 text-right text-base-content/50">
                <span class="sr-only">Share counts are not totaled</span>
              </td>
              <td class="px-3 py-2 text-right text-base-content/50">
                <span class="sr-only">Prices are not totaled</span>
              </td>
              <td class="px-3 py-2 text-right tabular-nums">{{ money(totals.costBasis) }}</td>
              <td class="px-3 py-2 text-right tabular-nums">{{ money(portfolioValue) }}</td>
              <td class="px-3 py-2 text-right tabular-nums" :class="gainClass(portfolioGain.gainDollars)">
                {{ money(portfolioGain.gainDollars, true) }}
              </td>
              <td class="px-3 py-2 text-right tabular-nums" :class="gainClass(portfolioGain.gainPercent)">
                {{ percent(portfolioGain.gainPercent) }}
              </td>
              <td v-if="showContribution" class="px-3 py-2 text-right tabular-nums">{{ contributionFooter }}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <label class="mt-3 flex items-start gap-2 text-xs leading-5 text-base-content/70">
        <input v-model="showContribution" type="checkbox" class="checkbox checkbox-xs mt-0.5" />
        <span>
          Show share of portfolio gain/loss. This is each holding’s dollar gain or loss divided by the portfolio’s net unrealized gain/loss.
          It can be negative or above 100% when gains and losses offset each other. It shows N/A when the portfolio net gain/loss is zero.
        </span>
      </label>
    </template>

    <InvestmentHoldingForm
      :open="editorOpen"
      :holding="editorHolding"
      :accounts="accounts"
      :save-error="saveError"
      @save="saveHolding"
      @cancel="closeEditor"
      @remove="removeHolding"
    />
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { formatInvestmentCurrency, formatInvestmentPercent, formatInvestmentShares, truncateDescription } from "~/utils/investmentFormat";
import {
  accountValueStack,
  defaultSortDirection,
  gainFromTotals,
  holdingMetrics,
  investmentSortOptions,
  portfolioMetrics,
  shareOfPortfolioGain,
  sortHoldings,
} from "~/utils/investmentPerformance";

const auth = useAuthStore();
useHead({ title: "Investments" });

const loading = ref(true);
const loadError = ref("");
const currency = ref("USD");
const holdings = ref([]);
const sortKey = ref("currentValue");
const sortDirection = ref("desc");
const showContribution = ref(false);
const editorOpen = ref(false);
const editorHolding = ref(null);
const saveError = ref("");
const accounts = ref([]);

const totals = computed(() => portfolioMetrics(holdings.value));
const portfolioValue = computed(() => sumCurrentValue(holdings.value));
const portfolioGain = computed(() => gainFromTotals(totals.value.costBasis, portfolioValue.value));
const sortedHoldings = computed(() => {
  if (sortKey.value !== "share") {
    return sortHoldings(holdings.value, sortKey.value, sortDirection.value);
  }
  const portfolio = portfolioGain.value;
  const dir = sortDirection.value === "asc" ? 1 : -1;
  return [...holdings.value].sort((a, b) => {
    const av = shareOfPortfolioGain(a, portfolio);
    const bv = shareOfPortfolioGain(b, portfolio);
    if (av == null && bv == null) return String(a.name || "").localeCompare(String(b.name || ""));
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av === bv) return String(a.name || "").localeCompare(String(b.name || ""));
    return (av - bv) * dir;
  });
});

const tableRows = computed(() =>
  sortedHoldings.value.map((holding) => ({
    ...holding,
    metrics: holdingMetrics(holding),
    share: shareOfPortfolioGain(holding, portfolioGain.value),
  })),
);

const accountGroups = computed(() => {
  const order = [];
  const buckets = new Map();
  const ensure = (account) => {
    const name = String(account || "Other").trim() || "Other";
    if (!buckets.has(name)) {
      buckets.set(name, []);
      order.push(name);
    }
    return name;
  };
  for (const holding of holdings.value) ensure(holding.account);
  for (const row of tableRows.value) buckets.get(ensure(row.account)).push(row);
  return order
    .map((account) => {
      const rows = buckets.get(account);
      const performance = portfolioMetrics(rows);
      const value = sumCurrentValue(rows);
      const gain = gainFromTotals(performance.costBasis, value);
      return {
        account,
        rows,
        value,
        costBasis: performance.costBasis,
        gainDollars: gain.gainDollars,
        gainPercent: gain.gainPercent,
      };
    })
    .filter((group) => group.rows.length);
});

function isHsaChartAccount(account) {
  const name = String(account || "").toLowerCase().replace(/[^a-z]/g, "");
  return name === "hsacash" || name === "hsainvestments";
}

function chartRowFromGroups(id, name, groups) {
  const holdings = groups.flatMap((group) => group.rows);
  const stack = accountValueStack(holdings);
  let currentValue = 0;
  let hasValue = false;
  for (const group of groups) {
    if (typeof group.value === "number" && Number.isFinite(group.value)) {
      currentValue += group.value;
      hasValue = true;
    }
  }
  const gain = gainFromTotals(stack.costBasis, hasValue ? currentValue : null);
  return {
    id,
    name,
    currentValue: hasValue ? currentValue : null,
    gainDollars: gain.gainDollars,
    gainPercent: gain.gainPercent,
    ...stack,
  };
}

const chartRows = computed(() => {
  const rows = [];
  const hsaGroups = [];
  let hsaIndex = -1;
  for (const group of accountGroups.value) {
    if (isHsaChartAccount(group.account)) {
      if (hsaIndex < 0) hsaIndex = rows.length;
      hsaGroups.push(group);
      continue;
    }
    const row = chartRowFromGroups(group.account, group.account, [group]);
    if (row.base + row.gain + row.loss > 0) rows.push(row);
  }
  if (hsaGroups.length) {
    const hsa = chartRowFromGroups("HSA", "HSA", hsaGroups);
    if (hsa.base + hsa.gain + hsa.loss > 0) rows.splice(Math.max(hsaIndex, 0), 0, hsa);
  }
  return rows;
});

const columns = computed(() => {
  const base = [
    { key: "name", label: "Investment", align: "left" },
    { key: "shares", label: "Shares", align: "right" },
    { key: "price", label: "Price", align: "right" },
    { key: "costBasis", label: "Cost basis", align: "right" },
    { key: "currentValue", label: "Current value", align: "right" },
    { key: "gainDollars", label: "Unrealized gain/loss ($)", align: "right" },
    { key: "gainPercent", label: "Unrealized gain/loss (%)", align: "right" },
  ];
  if (showContribution.value) {
    base.push({ key: "share", label: "Share of portfolio gain/loss (%)", align: "right" });
  }
  return base;
});

const contributionFooter = computed(() => {
  if (portfolioGain.value.gainDollars == null || portfolioGain.value.gainDollars === 0) return "N/A";
  return percent(100);
});

function sumCurrentValue(rows) {
  let sum = 0;
  let count = 0;
  for (const row of rows ?? []) {
    const value = row.metrics?.currentValue ?? row.currentValue;
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    sum += value;
    count += 1;
  }
  return count ? sum : null;
}

function shortDescription(name) {
  return truncateDescription(name, 8);
}

function shares(amount) {
  return formatInvestmentShares(amount);
}

function openEdit(row) {
  saveError.value = "";
  editorHolding.value = { ...row };
  editorOpen.value = true;
}

function openAdd() {
  saveError.value = "";
  editorHolding.value = null;
  editorOpen.value = true;
}

function closeEditor() {
  editorOpen.value = false;
}

function requestError(error, fallback) {
  return error?.data?.statusMessage || error?.statusMessage || fallback;
}

async function saveHolding(draft) {
  saveError.value = "";
  const numericId = Number(draft.id);
  const existing = Number.isInteger(numericId) && holdings.value.some((holding) => holding.id === numericId);
  try {
    if (existing) {
      await $fetch(`/api/investments/positions/${numericId}`, { method: "PUT", body: draft });
    } else {
      await $fetch("/api/investments/positions", { method: "POST", body: draft });
    }
    closeEditor();
    await loadHoldings({ silent: true });
  } catch (error) {
    saveError.value = requestError(error, "Could not save the holding.");
  }
}

async function removeHolding(id) {
  saveError.value = "";
  try {
    await $fetch(`/api/investments/positions/${id}`, { method: "DELETE" });
    closeEditor();
    await loadHoldings({ silent: true });
  } catch (error) {
    saveError.value = requestError(error, "Could not remove the holding.");
  }
}

function money(amount, signed = false) {
  return formatInvestmentCurrency(amount, currency.value, { signed });
}

function percent(amount) {
  return formatInvestmentPercent(amount);
}

function gainClass(amount) {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount === 0) {
    return "text-gray-900 dark:text-white";
  }
  return amount > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400";
}

function setSort(key) {
  if (sortKey.value === key) {
    sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
    return;
  }
  sortKey.value = key;
  sortDirection.value = defaultSortDirection(key);
}

function onSortSelect(event) {
  const key = event.target?.value;
  if (!key) return;
  sortKey.value = key;
  sortDirection.value = defaultSortDirection(key);
}

function ariaSort(key) {
  if (sortKey.value !== key) return "none";
  return sortDirection.value === "asc" ? "ascending" : "descending";
}

async function loadHoldings({ silent = false } = {}) {
  if (!silent) loading.value = true;
  loadError.value = "";
  try {
    const [data, cashData] = await Promise.all([
      $fetch("/api/investments/positions"),
      $fetch("/api/records/cash-and-investments").catch(() => ({ records: [] })),
    ]);
    currency.value = data?.currency || "USD";
    holdings.value = Array.isArray(data?.positions) ? data.positions : [];
    accounts.value = Array.isArray(cashData?.records) ? cashData.records : [];
  } catch (error) {
    if (!silent) holdings.value = [];
    loadError.value = requestError(error, "Could not load investment holdings.");
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  if (!auth.ready) auth.fetchSession();
  if (auth.user) void loadHoldings();
  else loading.value = false;
});

watch(
  () => auth.user,
  (user) => {
    if (user) void loadHoldings();
  },
);
</script>

<style scoped>
.inv-holdings th,
.inv-holdings td {
  padding-left: 1.125rem !important;
  padding-right: 1.125rem !important;
}

.inv-holdings th:first-child,
.inv-holdings td:first-child {
  padding-left: 1.5rem !important;
}

.inv-holdings th:last-child,
.inv-holdings td:last-child {
  padding-right: 1.5rem !important;
}

.investment-edit-btn {
  border: 1px solid color-mix(in srgb, var(--color-base-content, #151616) 18%, transparent);
  border-radius: 9999px;
  background: var(--color-base-100, #ffffff);
  color: var(--color-base-content, #151616);
  padding: 0.2rem 0.55rem;
  font-size: 0.6875rem;
  font-weight: 600;
  line-height: 1.25rem;
  cursor: pointer;
  white-space: nowrap;
}

.investment-edit-btn:hover {
  border-color: var(--color-primary, #06b6d4);
  color: var(--color-primary, #06b6d4);
}
</style>
