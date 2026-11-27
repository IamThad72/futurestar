<template>
  <div>
    <header class="page-header">
      <div class="page-header__copy">
        <h1>Budget Tracker</h1>
        <p class="page-header__lede">Log spending against this month's plan.</p>
        <p class="mt-2 hidden lg:block">
          <NuxtLink to="/account_map" class="text-sm text-base-content/60 underline-offset-2 hover:underline">
            Edit the plan on Account Map
          </NuxtLink>
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2 sm:justify-end">
          <label class="flex items-center gap-1.5 text-sm text-base-content/70">
            <span class="font-medium">Month</span>
            <select
              class="select select-bordered select-sm min-h-9 bg-base-100 text-sm text-base-content"
              :value="monthControlValue"
              aria-label="Month"
              @change="onMonthControlChange"
            >
              <option v-for="opt in monthControlOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </label>
          <details v-if="canWrite" class="dropdown dropdown-end import-menu">
            <summary class="btn btn-ghost btn-sm" aria-haspopup="menu">Import</summary>
            <ul class="dropdown-content menu z-30 mt-1 w-52 rounded-box border border-base-300 bg-base-100 p-2 shadow" role="menu">
              <li role="none">
                <button type="button" role="menuitem" @click="chooseImport('checking', $event)">From checking</button>
              </li>
              <li role="none">
                <button type="button" role="menuitem" @click="chooseImport('credit', $event)">From a credit card</button>
              </li>
            </ul>
          </details>
          <input ref="csvFileInputRef" type="file" accept=".csv" class="hidden" @change="onCsvFileSelected" />
      </div>
    </header>
    <div v-if="showPlanControl" class="-mt-3 mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-base-content/70 sm:justify-end">
          <label class="flex items-center gap-1.5">
            <span>Plan:</span>
            <select
              :value="periodBudgetId ?? ''"
              class="select select-ghost select-sm min-h-9 bg-transparent text-sm"
              :disabled="budgetAssignBusy || !budgetOptions.length"
              aria-label="Plan"
              @change="onPeriodBudgetChange($event)"
            >
              <option v-for="b in budgetOptions" :key="b.budget_id" :value="b.budget_id">
                {{ b.name }}{{ b.is_active ? " (default)" : "" }}
              </option>
            </select>
          </label>
          <span v-if="periodBudgetName" class="text-xs">
            {{
              periodIsOverride
                ? "Override for month"
                : periodIsInferred
                  ? "Matched to this month’s spending"
                  : "Using default"
            }}
          </span>
          <button
            v-if="periodIsOverride"
            type="button"
            class="text-xs font-medium text-primary underline hover:no-underline disabled:opacity-50"
            :disabled="budgetAssignBusy"
            @click="clearPeriodBudgetOverride"
          >
            Use default
          </button>
          <button
            v-else-if="periodIsInferred && periodBudgetId"
            type="button"
            class="text-xs font-medium text-primary underline hover:no-underline disabled:opacity-50"
            :disabled="budgetAssignBusy"
            @click="pinInferredPeriodBudget"
          >
            Pin for this month
          </button>
    </div>
    <p v-if="csvPageNotice" class="mb-4 text-sm text-base-content/70">{{ csvPageNotice }}</p>
  </div>
</template>

<script setup>
const tracker = inject("budgetTracker");
const {
  auth,
  canWrite,
  monthControlValue,
  monthControlOptions,
  onMonthControlChange,
  showPlanControl,
  periodBudgetId,
  budgetAssignBusy,
  budgetOptions,
  onPeriodBudgetChange,
  periodBudgetName,
  periodIsOverride,
  periodIsInferred,
  clearPeriodBudgetOverride,
  pinInferredPeriodBudget,
  csvFileInputRef,
  onCsvFileSelected,
  startCsvUpload,
  csvPageNotice,
} = tracker;

function chooseImport(kind, event) {
  startCsvUpload(kind);
  event?.currentTarget?.closest("details")?.removeAttribute("open");
}
</script>

<style scoped>
.import-menu > summary {
  list-style: none;
}

.import-menu > summary::-webkit-details-marker {
  display: none;
}
</style>
