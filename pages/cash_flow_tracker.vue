<template>
  <main>
    <div v-if="!auth.ready" class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <p class="text-sm text-gray-500 dark:text-gray-400">Loading session...</p>
    </div>

    <div
      v-else-if="!auth.user"
      class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
    >
      You must be logged in to use this page.
    </div>

    <template v-else>
      <div class="relative isolate overflow-hidden">
        <header class="pb-4 pt-6 sm:pb-6">
          <div class="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 sm:flex-nowrap sm:gap-6 sm:px-6 lg:px-8">
            <h1 class="text-sm font-semibold text-gray-900 md:text-base dark:text-white">Budget Tracker</h1>
            <div class="flex flex-wrap items-center gap-3 text-xs md:gap-4 md:text-sm">
              <label class="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                <span class="font-medium">Month</span>
                <select
                  v-model="selectedMonth"
                  class="rounded-md border border-gray-300 bg-white py-1.5 pl-2 pr-7 text-xs text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 md:text-sm dark:border-white/10 dark:bg-gray-900 dark:text-white"
                >
                  <option v-for="m in 12" :key="m" :value="m">{{ monthNames[m - 1] }}</option>
                </select>
              </label>
              <label class="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                <span class="font-medium">Year</span>
                <select
                  v-model="selectedYear"
                  class="rounded-md border border-gray-300 bg-white py-1.5 pl-2 pr-7 text-xs text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 md:text-sm dark:border-white/10 dark:bg-gray-900 dark:text-white"
                >
                  <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
                </select>
              </label>
            </div>
            <div class="ml-auto flex w-full sm:w-auto">
              <input ref="csvFileInputRef" type="file" accept=".csv" class="hidden" @change="onCsvFileSelected" />
              <button
                type="button"
                class="estate-action-btn w-full sm:w-auto"
                @click="csvFileInputRef?.click()"
              >
                <ArrowUpTrayIcon class="size-4 shrink-0 md:size-5" aria-hidden="true" />
                Upload Expenses
              </button>
            </div>
          </div>
        </header>

        <div
          class="absolute left-0 top-full -z-10 mt-96 origin-top-left translate-y-40 -rotate-90 transform-gpu opacity-20 blur-3xl sm:left-1/2 sm:-ml-96 sm:-mt-10 sm:translate-y-0 sm:rotate-0 sm:opacity-50 dark:opacity-10 dark:sm:opacity-30"
          aria-hidden="true"
        >
          <div
            class="aspect-[1154/678] w-[72.125rem] bg-gradient-to-br from-[#FF80B5] to-[#9089FC]"
            style="clip-path: polygon(100% 38.5%, 82.6% 100%, 60.2% 37.7%, 52.4% 32.1%, 47.5% 41.8%, 45.2% 65.6%, 27.5% 23.4%, 0.1% 35.3%, 17.9% 0%, 27.7% 23.4%, 76.2% 2.5%, 74.2% 56%, 100% 38.5%)"
          ></div>
        </div>
      </div>

      <div v-if="loading" class="mx-auto max-w-7xl px-4 py-8 text-xs text-gray-500 sm:px-6 md:py-12 md:text-sm lg:px-8 dark:text-gray-400">Loading...</div>

      <div v-else-if="loadError" class="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <LoadErrorPanel :message="loadError" @retry="loadData" />
      </div>

      <div v-else class="py-4 md:py-6">
        <p class="mx-auto max-w-7xl mb-2 px-4 text-xs text-gray-500 sm:px-6 md:mb-3 md:text-sm lg:px-8 dark:text-gray-400">
          {{ monthNames[selectedMonth - 1] }} {{ selectedYear }} — use the edit icon to view or add transactions
        </p>

        <div class="space-y-4 md:space-y-6">
        <template v-for="section in budgetTrackerDisplaySections" :key="section.key">
          <EstateSection :title="section.title" :total="sectionSummary(section)" :show-add="false" compact>
            <div class="flow-root text-[11px] md:text-sm">
              <div class="-mx-4 overflow-x-auto sm:mx-0">
                <div class="inline-block min-w-full align-middle">
                  <table class="min-w-full divide-y divide-gray-300 dark:divide-white/10">
                    <thead>
                      <tr>
                        <th
                          scope="col"
                          class="sticky top-0 z-10 w-8 border-b border-gray-300 bg-white/95 pl-2 pr-0 py-2 backdrop-blur-sm md:w-10 md:py-3.5 dark:border-white/10 dark:bg-gray-950/95"
                        >
                          <span class="sr-only">Edit</span>
                        </th>
                        <th
                          scope="col"
                          class="sticky top-0 z-10 border-b border-gray-300 bg-white/95 pl-1 pr-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 backdrop-blur-sm md:px-4 md:py-3.5 md:text-xs dark:border-white/10 dark:bg-gray-950/95 dark:text-gray-400"
                        >
                          Category
                        </th>
                        <th
                          scope="col"
                          class="sticky top-0 z-10 border-b border-gray-300 bg-white/95 px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500 backdrop-blur-sm md:px-4 md:py-3.5 md:text-xs dark:border-white/10 dark:bg-gray-950/95 dark:text-gray-400"
                        >
                          Budget
                        </th>
                        <th
                          scope="col"
                          class="sticky top-0 z-10 border-b border-gray-300 bg-white/95 px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500 backdrop-blur-sm md:px-4 md:py-3.5 md:text-xs dark:border-white/10 dark:bg-gray-950/95 dark:text-gray-400"
                        >
                          Actual
                        </th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 bg-white dark:divide-white/10 dark:bg-transparent">
                      <tr
                        v-for="row in section.rows"
                        :key="`${section.key}-${row.item.id}`"
                        class="odd:bg-gray-50 dark:odd:bg-white/[0.03]"
                      >
                        <td class="whitespace-nowrap pl-2 pr-0 py-2 md:py-3.5">
                          <button
                            type="button"
                            class="-mr-0.5 text-gray-400 hover:text-indigo-600 md:-mr-0 dark:hover:text-indigo-400"
                            title="Update"
                            @click="openSubCategoryModal(row.item, section.listType, row.group)"
                          >
                            <span class="sr-only">Edit, {{ row.group.category }}{{ row.item.sub_category ? ` ${row.item.sub_category}` : "" }}</span>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-3.5 md:size-5" aria-hidden="true">
                              <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                            </svg>
                          </button>
                        </td>
                        <td class="pl-1 pr-3 py-2 md:px-4 md:py-3.5">
                          <div class="min-w-0 font-medium text-gray-900 dark:text-white">
                            <span>{{ row.group.category }}</span>
                            <template v-if="(row.item.sub_category || '').trim()">
                              <span class="text-gray-400"> · </span>
                              <span :class="section.accent">{{ row.item.sub_category }}</span>
                            </template>
                            <span
                              class="ml-1 font-normal text-[10px] md:text-xs"
                              :class="getVarianceClass(row.item.id, section.listType, row.item.monthly_amount)"
                            >
                              ({{ formatVariance(row.item.id, section.listType, row.item.monthly_amount) }})
                            </span>
                          </div>
                        </td>
                        <td class="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-700 md:px-4 md:py-3.5 dark:text-gray-200">
                          ${{ formatAmount(row.item.monthly_amount) }}
                        </td>
                        <td class="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-gray-900 md:px-4 md:py-3.5 dark:text-white">
                          ${{ formatAmount(getActualForItem(row.item.id, section.listType)) }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </EstateSection>
        </template>
        </div>

        <p v-if="!loadError && !budgetTrackerDisplaySections.length" class="mx-auto max-w-7xl px-4 py-8 text-center text-xs text-gray-500 sm:px-6 md:text-sm lg:px-8 dark:text-gray-400">
          No budget items yet. Add budget items in Budget Setup first.
        </p>
      </div>
      <!-- Add Transaction Modal -->
      <dialog ref="addDialogRef" class="modal">
        <div class="modal-box" :class="{ 'max-w-2xl max-h-[90vh] overflow-y-auto': isGrossIncomePaycheckMode }">
          <h3 class="font-semibold text-lg mb-4 leading-snug">{{ addTransactionModalTitle }}</h3>
          <form @submit.prevent="submitTransaction" class="space-y-4">
            <div v-if="txForm.type === 'income' || txForm.type === 'tax' || txForm.type === 'insurance'" class="space-y-2">
              <label class="form-control w-full">
                <span class="label-text text-sm">From</span>
                <select
                  v-if="incomeSources.length"
                  v-model="txForm.incomeSourceId"
                  class="select select-bordered w-full"
                >
                  <option value="">Select…</option>
                  <option v-for="s in incomeSources" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
                </select>
                <span v-else class="text-sm text-base-content/60 py-2 block">No sources yet.</span>
              </label>
              <button
                v-if="!showNewIncomeFromInput"
                type="button"
                class="btn btn-ghost btn-sm self-start"
                @click="showNewIncomeFromInput = true"
              >
                Add new From
              </button>
              <div v-if="showNewIncomeFromInput" class="space-y-2 rounded-lg border border-base-300 p-3">
                <label class="form-control w-full">
                  <span class="label-text text-sm">New From name</span>
                  <input v-model.trim="txForm.incomeSourceName" class="input input-bordered w-full" type="text" placeholder="Income source" />
                </label>
                <div class="flex flex-wrap gap-2">
                  <button type="button" class="btn btn-primary btn-sm" @click="addIncomeSourceFromForm">Add</button>
                  <button type="button" class="btn btn-ghost btn-sm" @click="cancelNewIncomeFrom">Cancel</button>
                </div>
              </div>
            </div>
            <div v-if="txForm.type === 'investment'" class="space-y-2">
              <label class="form-control w-full">
                <span class="label-text text-sm">From</span>
                <select
                  v-if="investmentSources.length"
                  v-model="txForm.investmentSourceId"
                  class="select select-bordered w-full"
                >
                  <option value="">Select…</option>
                  <option v-for="s in investmentSources" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
                </select>
                <span v-else class="text-sm text-base-content/60 py-2 block">No sources yet.</span>
              </label>
              <button
                v-if="!showNewInvestmentFromInput"
                type="button"
                class="btn btn-ghost btn-sm self-start"
                @click="showNewInvestmentFromInput = true"
              >
                Add new From
              </button>
              <div v-if="showNewInvestmentFromInput" class="space-y-2 rounded-lg border border-base-300 p-3">
                <label class="form-control w-full">
                  <span class="label-text text-sm">New From name</span>
                  <input v-model.trim="txForm.investmentSourceName" class="input input-bordered w-full" type="text" placeholder="Investment source" />
                </label>
                <div class="flex flex-wrap gap-2">
                  <button type="button" class="btn btn-primary btn-sm" @click="addInvestmentSourceFromForm">Add</button>
                  <button type="button" class="btn btn-ghost btn-sm" @click="cancelNewInvestmentFrom">Cancel</button>
                </div>
              </div>
            </div>
            <div v-if="txForm.type === 'savings'" class="space-y-2">
              <label class="form-control w-full">
                <span class="label-text text-sm">From</span>
                <select
                  v-if="savingsSources.length"
                  v-model="txForm.savingsSourceId"
                  class="select select-bordered w-full"
                >
                  <option value="">Select…</option>
                  <option v-for="s in savingsSources" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
                </select>
                <span v-else class="text-sm text-base-content/60 py-2 block">No sources yet.</span>
              </label>
              <button
                v-if="!showNewSavingsFromInput"
                type="button"
                class="btn btn-ghost btn-sm self-start"
                @click="showNewSavingsFromInput = true"
              >
                Add new From
              </button>
              <div v-if="showNewSavingsFromInput" class="space-y-2 rounded-lg border border-base-300 p-3">
                <label class="form-control w-full">
                  <span class="label-text text-sm">New From name</span>
                  <input v-model.trim="txForm.savingsSourceName" class="input input-bordered w-full" type="text" placeholder="Savings source" />
                </label>
                <div class="flex flex-wrap gap-2">
                  <button type="button" class="btn btn-primary btn-sm" @click="addSavingsSourceFromForm">Add</button>
                  <button type="button" class="btn btn-ghost btn-sm" @click="cancelNewSavingsFrom">Cancel</button>
                </div>
              </div>
            </div>
            <label v-if="txForm.type !== 'tax' && txForm.type !== 'insurance' && txForm.type !== 'savings'" class="form-control w-full">
              <span class="label-text text-sm">Payee</span>
              <input v-model.trim="txForm.payee" class="input input-bordered w-full" type="text" placeholder="Who you paid or received from" />
            </label>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label class="form-control w-full">
                <span class="label-text text-sm">Date <span class="text-error">*</span></span>
                <input
                  v-model="txForm.date"
                  class="input input-bordered w-full"
                  type="date"
                  required
                />
              </label>
              <label class="form-control w-full">
                <span class="label-text text-sm">{{ isGrossIncomePaycheckMode ? "Gross Income" : "Amount" }} <span class="text-error">*</span></span>
                <input
                  v-model.number="txForm.amount"
                  class="input input-bordered w-full"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  required
                />
              </label>
            </div>

            <div v-if="isGrossIncomePaycheckMode" class="space-y-4 rounded-lg border border-base-300 p-3">
              <p class="text-sm text-base-content/70">
                Allocate portions of this paycheck to tax, insurance, retirement, and investment budget lines. The full
                <strong>gross</strong> amount is recorded on this line; take-home is recorded on your paired Net Income line.
              </p>
              <p v-if="pairedNetIncomeBudgetLine" class="text-sm text-base-content/80">
                Take-home posts to:
                <strong>{{ pairedNetIncomeBudgetLine.category }}{{ pairedNetIncomeBudgetLine.sub_category ? ` · ${pairedNetIncomeBudgetLine.sub_category}` : "" }}</strong>
              </p>
              <p v-else class="text-sm text-warning">
                No Net Income line found under the same category (e.g. Payroll · Net Income). Add one in Budget Setup so take-home is tracked separately from gross.
              </p>
              <div v-if="!grossIncomeAllocatableLines.length" class="text-sm text-base-content/50 italic">
                No tax, insurance, retirement, or investment budget lines yet. Add them in Budget Setup, or enter the full amount as net income.
              </div>
              <template v-else>
                <div v-if="grossAllocTaxLines.length" class="space-y-2">
                  <h4 class="text-sm font-semibold text-amber-600 dark:text-amber-400">Tax</h4>
                  <div
                    v-for="line in grossAllocTaxLines"
                    :key="line.key"
                    class="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_7rem] sm:items-center"
                  >
                    <span class="text-sm">{{ line.category }}{{ line.sub_category ? ` › ${line.sub_category}` : "" }}</span>
                    <input
                      v-model.number="grossAllocationAmounts[line.key]"
                      class="input input-bordered input-sm w-full"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div v-if="grossAllocInsuranceLines.length" class="space-y-2">
                  <h4 class="text-sm font-semibold text-gray-600 dark:text-gray-300">Insurance</h4>
                  <div
                    v-for="line in grossAllocInsuranceLines"
                    :key="line.key"
                    class="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_7rem] sm:items-center"
                  >
                    <span class="text-sm">{{ line.category }}{{ line.sub_category ? ` › ${line.sub_category}` : "" }}</span>
                    <input
                      v-model.number="grossAllocationAmounts[line.key]"
                      class="input input-bordered input-sm w-full"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div v-if="grossAllocRetirementLines.length" class="space-y-2">
                  <h4 class="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Retirement</h4>
                  <div
                    v-for="line in grossAllocRetirementLines"
                    :key="line.key"
                    class="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_7rem] sm:items-center"
                  >
                    <span class="text-sm">{{ line.category }}{{ line.sub_category ? ` › ${line.sub_category}` : "" }}</span>
                    <input
                      v-model.number="grossAllocationAmounts[line.key]"
                      class="input input-bordered input-sm w-full"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div v-if="grossAllocInvestmentLines.length" class="space-y-2">
                  <h4 class="text-sm font-semibold text-violet-600 dark:text-violet-400">Investments</h4>
                  <div
                    v-for="line in grossAllocInvestmentLines"
                    :key="line.key"
                    class="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_7rem] sm:items-center"
                  >
                    <span class="text-sm">{{ line.category }}{{ line.sub_category ? ` › ${line.sub_category}` : "" }}</span>
                    <input
                      v-model.number="grossAllocationAmounts[line.key]"
                      class="input input-bordered input-sm w-full"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </template>
              <div class="flex flex-wrap items-baseline justify-between gap-2 border-t border-base-300 pt-3">
                <span class="text-sm font-medium">Net Income</span>
                <span
                  class="text-lg font-semibold tabular-nums"
                  :class="grossIncomeNetAmount < 0 ? 'text-error' : 'text-success'"
                >
                  ${{ formatAmount(Math.max(0, grossIncomeNetAmount)) }}
                </span>
              </div>
              <p v-if="grossIncomeNetAmount < 0" class="text-xs text-error">
                Allocations exceed gross income by ${{ formatAmount(-grossIncomeNetAmount) }}.
              </p>
            </div>

            <label v-if="txForm.type === 'income'" class="form-control w-full">
              <span class="label-text text-sm">To</span>
              <select v-model="txForm.cashInvestmentId" class="select select-bordered w-full">
                <option value="">None</option>
                <option v-for="acct in cashAccounts" :key="acct.ci_id" :value="String(acct.ci_id)">
                  {{ [acct.institution, acct.acct_type].filter(Boolean).join(" — ") || `Account #${acct.ci_id}` }}
                </option>
              </select>
            </label>
            <label v-if="txForm.type === 'investment'" class="form-control w-full">
              <span class="label-text text-sm">To <span class="text-error">*</span></span>
              <select v-model="txForm.cashInvestmentId" class="select select-bordered w-full" required>
                <option value="" disabled>Select account…</option>
                <option v-for="acct in cashAccounts" :key="acct.ci_id" :value="String(acct.ci_id)">
                  {{ [acct.institution, acct.acct_type].filter(Boolean).join(" — ") || `Account #${acct.ci_id}` }}
                </option>
              </select>
            </label>
            <label v-if="txForm.type === 'savings'" class="form-control w-full">
              <span class="label-text text-sm">To <span class="text-error">*</span></span>
              <select v-model="txForm.cashInvestmentId" class="select select-bordered w-full" required>
                <option value="" disabled>Select account…</option>
                <option v-for="acct in cashAccounts" :key="`sav-${acct.ci_id}`" :value="String(acct.ci_id)">
                  {{ [acct.institution, acct.acct_type].filter(Boolean).join(" — ") || `Account #${acct.ci_id}` }}
                </option>
              </select>
            </label>
            <label v-if="showAppliedAccountSelector" class="form-control w-full">
              <span class="label-text text-sm">From Account <span class="text-error">*</span></span>
              <select v-model="txForm.fromCashInvestmentId" class="select select-bordered w-full" required>
                <option value="" disabled>Select account…</option>
                <option v-for="acct in cashAccounts" :key="`from-${acct.ci_id}`" :value="String(acct.ci_id)">
                  {{ [acct.institution, acct.acct_type].filter(Boolean).join(" — ") || `Account #${acct.ci_id}` }}
                </option>
              </select>
            </label>
            <label v-if="showAppliedAccountSelector" class="form-control w-full">
              <span class="label-text text-sm">To Account <span class="text-error">*</span></span>
              <template v-if="useDebtInstitutionsForAddModal">
                <select v-model="txForm.debtId" class="select select-bordered w-full" required>
                  <option value="" disabled>Select debt institution…</option>
                  <option v-for="row in debtRecords" :key="row.dbt_id" :value="String(row.dbt_id)">
                    {{ formatDebtRecordLabel(row) }}
                  </option>
                </select>
                <p v-if="selectedDebtForPayment && !inferIsRevolvingDebt(selectedDebtForPayment)" class="label-text-alt text-base-content/70 mt-1">
                  Installment loan{{ selectedDebtForPayment.interest_rate_annual ? ` · ${selectedDebtForPayment.interest_rate_annual}% APR` : "" }}{{ selectedDebtForPayment.term_months ? ` · ${selectedDebtForPayment.term_months} mo` : "" }}
                </p>
                <p v-if="debtPaymentPreview && !debtPaymentPreview.isRevolving" class="text-xs text-base-content/80 mt-1">
                  Payment ${{ formatAmount(txForm.amount) }} → principal ${{ formatAmount(debtPaymentPreview.principal) }}, interest ${{ formatAmount(debtPaymentPreview.interest) }}
                </p>
              </template>
              <template v-else>
                <select v-model="txForm.cashInvestmentId" class="select select-bordered w-full" required>
                  <option value="" disabled>Select account…</option>
                  <option v-for="acct in cashAccounts" :key="acct.ci_id" :value="String(acct.ci_id)">
                    {{ [acct.institution, acct.acct_type].filter(Boolean).join(" — ") || `Account #${acct.ci_id}` }}
                  </option>
                </select>
                <span class="label-text-alt text-base-content/60">Where this amount is recorded (checking, card, investment, etc.)</span>
              </template>
            </label>
            <label class="form-control w-full">
              <span class="label-text text-sm">Description</span>
              <input v-model.trim="txForm.description" class="input input-bordered w-full" type="text" placeholder="Optional notes" />
            </label>
            <div v-if="txError" class="text-sm text-error">{{ txError }}</div>
            <div class="modal-action">
              <button type="button" class="btn btn-ghost" @click="addDialogRef?.close()">Cancel</button>
              <button type="submit" class="btn btn-primary" :disabled="txSubmitting">
                {{ txSubmitting ? "Adding..." : isGrossIncomePaycheckMode ? "Save paycheck" : "Add Transaction" }}
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      <!-- Sub-category Transactions Modal -->
      <dialog ref="subCategoryModalRef" class="modal">
        <div class="modal-box max-w-2xl max-h-[85vh] flex flex-col">
          <h3 class="font-semibold text-lg mb-4">
            {{ selectedBudgetItem ? `${selectedBudgetItem.category} › ${selectedBudgetItem.sub_category || selectedBudgetItem.category}` : '' }} — Transactions
          </h3>
          <div v-if="selectedBudgetItem" class="flex-1 overflow-y-auto min-h-0">
            <div v-if="!transactionsForModal.length" class="text-base-content/50 italic py-4">No transactions yet.</div>
            <div v-else class="space-y-2 text-xs md:space-y-3 md:text-sm">
              <div
                v-for="tx in transactionsForModal"
                :key="tx.id"
                class="border border-base-200 rounded-lg p-2.5 md:p-3"
              >
                <template v-if="editingTxId === tx.id">
                  <form @submit.prevent="saveEditTransaction" class="space-y-3">
                    <label class="form-control w-full">
                      <span class="label-text text-sm">Category / Sub-category</span>
                      <select v-model="editTxForm.budgetItemId" class="select select-bordered select-sm w-full" required>
                        <option value="">Select...</option>
                        <template v-if="editTxForm.type === 'income'">
                          <optgroup v-for="group in incomeGroupedByCategory" :key="`edit-inc-${group.category}`" :label="group.category">
                            <option v-for="item in group.items" :key="item.id" :value="String(item.id)">
                              {{ item.sub_category || group.category }} — ${{ formatAmount(item.monthly_amount) }}/mo
                            </option>
                          </optgroup>
                        </template>
                        <template v-else>
                          <optgroup v-for="group in expensesGroupedByCategory" :key="`edit-exp-${group.category}`" :label="group.category">
                            <option v-for="item in group.items" :key="item.id" :value="String(item.id)">
                              {{ item.sub_category || group.category }} — ${{ formatAmount(item.monthly_amount) }}/mo
                            </option>
                          </optgroup>
                        </template>
                      </select>
                    </label>
                    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label class="form-control">
                        <span class="label-text text-sm">Date</span>
                        <input v-model="editTxForm.date" class="input input-bordered input-sm w-full" type="date" required />
                      </label>
                      <label class="form-control">
                        <span class="label-text text-sm">Amount</span>
                        <input v-model.number="editTxForm.amount" class="input input-bordered input-sm w-full" type="number" min="0" step="0.01" required />
                      </label>
                    </div>
                    <label class="form-control">
                      <span class="label-text text-sm">Description</span>
                      <input v-model.trim="editTxForm.description" class="input input-bordered input-sm w-full" type="text" />
                    </label>
                    <label v-if="editShowsDebtDestination" class="form-control">
                      <span class="label-text text-sm">Debt institution <span class="text-error">*</span></span>
                      <select v-model="editTxForm.debtId" class="select select-bordered select-sm w-full" required>
                        <option value="" disabled>Select debt institution…</option>
                        <option v-for="row in debtRecords" :key="row.dbt_id" :value="String(row.dbt_id)">
                          {{ formatDebtRecordLabel(row) }}
                        </option>
                      </select>
                      <p v-if="editDebtPaymentPreview && !editDebtPaymentPreview.isRevolving" class="text-xs text-base-content/80 mt-1">
                        Payment ${{ formatAmount(editTxForm.amount) }} → principal ${{ formatAmount(editDebtPaymentPreview.principal) }}, interest ${{ formatAmount(editDebtPaymentPreview.interest) }}
                      </p>
                      <span class="label-text-alt text-base-content/60">Estate Management → Debt</span>
                    </label>
                    <label v-if="editShowsCashDestination" class="form-control">
                      <span class="label-text text-sm">Destination Account</span>
                      <select v-model="editTxForm.cashInvestmentId" class="select select-bordered select-sm w-full">
                        <option value="">None</option>
                        <option v-for="acct in cashAccounts" :key="acct.ci_id" :value="String(acct.ci_id)">
                          {{ [acct.institution, acct.acct_type].filter(Boolean).join(" — ") || `Account #${acct.ci_id}` }}
                        </option>
                      </select>
                    </label>
                    <div v-if="editTxError" class="text-sm text-error">{{ editTxError }}</div>
                    <div class="flex gap-2">
                      <button type="submit" class="btn btn-primary btn-sm" :disabled="editTxSaving">Save</button>
                      <button type="button" class="btn btn-ghost btn-sm" @click="cancelEdit">Cancel</button>
                    </div>
                  </form>
                </template>
                <template v-else>
                  <div class="flex flex-wrap items-center justify-between gap-1.5 md:gap-2">
                    <div class="min-w-0 text-xs md:text-sm">
                      <span class="font-medium">{{ formatDate(tx.date) }}</span>
                      <span class="ml-1.5 font-bold md:ml-2" :class="tx.type === 'income' ? 'text-primary' : 'text-error'">
                        {{ tx.type === 'income' ? '' : '-' }}${{ formatAmount(tx.amount) }}
                      </span>
                      <div v-if="tx.description" class="text-[11px] text-base-content/60 mt-0.5 md:text-sm">{{ tx.description }}</div>
                      <div v-if="tx.destination_institution || tx.destination_acct_type" class="text-[10px] text-base-content/50 mt-0.5 md:text-xs">
                        → {{ [tx.destination_institution, tx.destination_acct_type].filter(Boolean).join(" — ") }}
                      </div>
                      <div v-if="tx.principal_applied != null && Number(tx.principal_applied) > 0" class="text-[10px] text-base-content/60 mt-0.5 md:text-xs">
                        Principal ${{ formatAmount(tx.principal_applied) }}<template v-if="tx.interest_applied != null && Number(tx.interest_applied) > 0"> · interest ${{ formatAmount(tx.interest_applied) }}</template>
                      </div>
                    </div>
                    <div class="flex shrink-0 gap-0.5 -mr-1 md:gap-1 md:mr-0">
                      <button type="button" class="btn btn-ghost btn-xs btn-square md:btn-sm" aria-label="Edit" @click="startEditTx(tx)">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-3.5 md:size-4"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" /></svg>
                      </button>
                      <button type="button" class="btn btn-ghost btn-xs btn-square text-error md:btn-sm" aria-label="Delete" @click="confirmDeleteFromModal(tx)">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-3.5 md:size-4"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                      </button>
                    </div>
                  </div>
                </template>
              </div>
            </div>
            <div class="mt-4 pt-4 border-t border-base-200">
              <button type="button" class="btn btn-primary btn-sm" @click="addTxFromSubCategory">
                Add Transaction
              </button>
            </div>
          </div>
          <div class="modal-action mt-4">
            <button type="button" class="btn btn-ghost" @click="subCategoryModalRef?.close()">Close</button>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      <!-- Delete Confirm Modal -->
      <dialog ref="deleteDialogRef" class="modal">
        <div class="modal-box">
          <h3 class="font-semibold text-lg mb-2">Delete Transaction?</h3>
          <p v-if="deletingTx" class="text-sm text-base-content/70 mb-4">
            Remove {{ deletingTx.category }}{{ deletingTx.sub_category ? ' › ' + deletingTx.sub_category : '' }} — ${{ formatAmount(deletingTx.amount) }}?
          </p>
          <div class="modal-action">
            <button type="button" class="btn btn-ghost" @click="deleteDialogRef?.close()">Cancel</button>
            <button type="button" class="btn btn-error" :disabled="deleting" @click="performDelete">
              {{ deleting ? "Deleting..." : "Delete" }}
            </button>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      <!-- CSV Upload Modal -->
      <dialog ref="csvUploadModalRef" class="modal" @close="closeCsvModal">
        <div class="modal-box max-w-4xl max-h-[90vh] flex flex-col">
          <h3 class="font-semibold text-lg mb-4">Upload Expenses from CSV</h3>
          <p class="text-sm text-base-content/60 mb-4">
            Expenses are imported by assigning an expense budget item to each row. CSV should have Transaction Date (or Date), Amount, and Description columns. Expense items are suggested from your past transactions; rows that match existing entries are flagged as potential duplicates.
          </p>
          <div v-if="csvError" class="alert alert-error mb-4">
            <span>{{ csvError }}</span>
          </div>
          <div v-if="csvImportBanner" class="alert alert-info mb-4">
            <span>{{ csvImportBanner }}</span>
          </div>
          <div v-if="csvRows.length" class="flex-1 overflow-y-auto min-h-0 border border-base-200 rounded-lg">
            <table class="table table-pin-rows table-xs">
              <thead>
                <tr>
                  <th class="w-16">Ignore</th>
                  <th>Date</th>
                  <th class="text-right">Amount</th>
                  <th>Description</th>
                  <th>Expense Item</th>
                  <th class="w-36">Status</th>
                  <th class="w-32">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, idx) in csvRows" :key="idx" :class="csvRowClass(row)">
                  <td>
                    <label class="label cursor-pointer justify-start gap-1">
                      <input v-model="row.ignored" type="checkbox" class="checkbox checkbox-sm" @change="onCsvExpenseItemChange" />
                      <span class="label-text text-xs">Ignore</span>
                    </label>
                  </td>
                  <td class="whitespace-nowrap">{{ row.date }}</td>
                  <td class="text-right font-mono">{{ formatAmount(row.amount) }}</td>
                  <td class="max-w-48 truncate" :title="row.description">{{ row.description || "—" }}</td>
                  <td>
                    <select
                      v-model="row.budgetItemId"
                      class="select select-bordered select-sm w-44"
                      :disabled="row.ignored || row.csvImported"
                      @change="onCsvExpenseItemChange"
                    >
                      <option value="">Select...</option>
                      <optgroup v-for="group in expenseBudgetGroups" :key="`csv-exp-${group.category}`" :label="group.category">
                        <option v-for="item in group.items" :key="item.id" :value="String(item.id)">
                          {{ item.sub_category || group.category }}
                        </option>
                      </optgroup>
                    </select>
                  </td>
                  <td>
                    <span
                      v-if="row.csvPotentialDuplicate && !row.ignored && !row.csvImported"
                      class="badge badge-warning badge-sm whitespace-normal text-left"
                    >
                      Potential duplicate
                    </span>
                    <span v-else-if="row.csvImported && !row.ignored" class="text-xs text-success">Imported</span>
                    <span v-else-if="!row.ignored && row.budgetItemId" class="text-xs text-base-content/50">Ready</span>
                    <span v-else class="text-base-content/30">—</span>
                  </td>
                  <td>
                    <button
                      v-if="row.csvDuplicateSkipped && !row.ignored"
                      type="button"
                      class="btn btn-outline btn-xs whitespace-nowrap"
                      :disabled="row.csvForceAdding || !row.budgetItemId"
                      @click="forceAddCsvExpenseRow(idx)"
                    >
                      {{ row.csvForceAdding ? "…" : "Add entry" }}
                    </button>
                    <span v-else class="text-base-content/30">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="py-8 text-center text-base-content/50 italic">
            No rows to import. Upload a CSV with date, amount, and description columns.
          </div>
          <div class="modal-action mt-4">
            <button type="button" class="btn btn-ghost" @click="closeCsvModal">Cancel</button>
            <button
              type="button"
              class="btn btn-primary"
              :disabled="!allCsvRowsHaveType || csvSaving || !csvHasPendingImportRows"
              @click="saveCsvTransactions"
            >
              {{
                csvSaving
                  ? "Saving..."
                  : `Save ${csvPendingImportCount} Expense${csvPendingImportCount !== 1 ? "s" : ""}`
              }}
            </button>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </template>
  </main>
</template>

<script setup>
import { ArrowUpTrayIcon } from "@heroicons/vue/20/solid";
import {
  formatDebtRecordLabel,
  textLooksLikeLoanOrCreditCard,
} from "~/utils/budgetDebt";
import { computeDebtPaymentApplication, inferIsRevolvingDebt } from "~/utils/debtPayment";
import { isNetIncomeBudgetLine } from "~/utils/budgetChart";
import {
  buildGrossAllocatableLines,
  computeNetFromGross,
  findNetIncomeBudgetLine,
  getPositiveGrossAllocations,
  grossAllocationKey,
  isGrossIncomeBudgetItem,
  partitionSavingsInvestmentForGrossAlloc,
  sumGrossAllocationAmounts,
} from "~/utils/grossIncomeAllocation";
import {
  enrichCsvExpenseRows,
  applyCsvDuplicateFlags,
  expenseCsvDedupeKey,
  buildExistingExpenseDedupeSets,
} from "~/utils/csvExpenseImport";

useHead({ title: "Budget Tracker" });

const auth = useAuthStore();
const addDialogRef = ref(null);
const deleteDialogRef = ref(null);
const subCategoryModalRef = ref(null);
const csvFileInputRef = ref(null);
const csvUploadModalRef = ref(null);
const selectedBudgetItem = ref(null);
const editingTxId = ref(null);
const editTxForm = ref({ date: "", amount: null, description: "", budgetItemId: "", type: "income", cashInvestmentId: "", debtId: "" });
/** When editing, original row had debt_id — keep showing debt picker even if labels change */
const editSourceDebtId = ref(null);
const editTxError = ref("");
const editTxSaving = ref(false);
const budgets = ref({ income: [], expenses: [] });
const transactions = ref([]);
const cashAccounts = ref([]);
const debtRecords = ref([]);
const incomeSources = ref([]);
const investmentSources = ref([]);
const savingsSources = ref([]);
const showNewIncomeFromInput = ref(false);
const showNewInvestmentFromInput = ref(false);
const showNewSavingsFromInput = ref(false);
const loading = ref(true);
const loadError = ref("");
const txSubmitting = ref(false);
const deleting = ref(false);
const txError = ref("");
const deletingTx = ref(null);
const csvRows = ref([]);
const csvError = ref("");
const csvImportBanner = ref("");
const csvSaving = ref(false);
const now = new Date();
const currentYear = now.getFullYear();
const selectedMonth = ref(now.getMonth() + 1);
const selectedYear = ref(currentYear >= 2026 && currentYear <= 2032 ? currentYear : 2026);
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const yearOptions = computed(() => {
  const years = [];
  for (let y = 2026; y <= 2032; y++) {
    years.push(y);
  }
  return years;
});

const grossAllocationAmounts = ref({});

const txForm = ref({
  type: "expense",
  budgetItemId: "",
  date: "",
  amount: null,
  payee: "",
  incomeSourceId: "",
  incomeSourceName: "",
  investmentSourceId: "",
  investmentSourceName: "",
  savingsSourceId: "",
  savingsSourceName: "",
  description: "",
  fromCashInvestmentId: "",
  cashInvestmentId: "",
  debtId: "",
});

function expenseBudgetItemById(id) {
  if (!id) return null;
  return (budgets.value.expenses ?? []).find((e) => String(e.id) === String(id));
}

function groupBudgetItemsByCategory(items) {
  const byCategory = {};
  for (const item of items) {
    const cat = item.category || "Uncategorized";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(item);
  }
  for (const cat of Object.keys(byCategory)) {
    byCategory[cat].sort((a, b) =>
      (a.sub_category || "").toLowerCase().localeCompare((b.sub_category || "").toLowerCase()),
    );
  }
  return Object.entries(byCategory)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, grouped]) => ({ category, items: grouped }));
}

/** Group income by category (all income rows — Budget Details list) */
const incomeGroupedByCategory = computed(() => groupBudgetItemsByCategory(budgets.value.income ?? []));

/** Group expenses by category (all expense rows — Budget Details list) */
const expensesGroupedByCategory = computed(() => groupBudgetItemsByCategory(budgets.value.expenses ?? []));

/** Add Entry modal: radio values map to budget line subsets (aligned with Budget Setup) */
const addModalBudgetTypeOptions = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "investment", label: "Investments" },
  { value: "savings", label: "Savings" },
  { value: "tax", label: "Tax" },
];

const incomeBudgetGroups = computed(() =>
  groupBudgetItemsByCategory(
    (budgets.value.income ?? []).filter((i) => i.income_type !== "tax" && i.income_type !== "deduction"),
  ),
);

const taxBudgetGroups = computed(() =>
  groupBudgetItemsByCategory((budgets.value.income ?? []).filter((i) => i.income_type === "tax")),
);

const expenseBudgetGroups = computed(() =>
  groupBudgetItemsByCategory(
    (budgets.value.expenses ?? []).filter((e) => (e.expense_type || "expense") === "expense"),
  ),
);

const validExpenseBudgetItemIds = computed(() => {
  const ids = new Set();
  for (const e of budgets.value.expenses ?? []) {
    if ((e.expense_type || "expense") === "expense") ids.add(String(e.id));
  }
  return ids;
});

const savingsBudgetGroups = computed(() =>
  groupBudgetItemsByCategory((budgets.value.expenses ?? []).filter((e) => e.expense_type === "savings")),
);

const investmentBudgetGroups = computed(() =>
  groupBudgetItemsByCategory((budgets.value.expenses ?? []).filter((e) => e.expense_type === "investment")),
);

/** Insurance budget lines (income_type deduction) */
const insuranceBudgetGroups = computed(() =>
  groupBudgetItemsByCategory((budgets.value.income ?? []).filter((i) => i.income_type === "deduction")),
);

function budgetGroupsForTxType(t) {
  switch (t) {
    case "income":
      return incomeBudgetGroups.value;
    case "tax":
      return taxBudgetGroups.value;
    case "insurance":
      return insuranceBudgetGroups.value;
    case "expense":
      return expenseBudgetGroups.value;
    case "savings":
      return savingsBudgetGroups.value;
    case "investment":
      return investmentBudgetGroups.value;
    default:
      return [];
  }
}

function firstBudgetItemIdForType(t) {
  const groups = budgetGroupsForTxType(t);
  const first = groups[0]?.items?.[0];
  return first != null ? String(first.id) : "";
}

const addModalBudgetLineMeta = computed(() => {
  const id = txForm.value.budgetItemId;
  if (!id) return null;
  const groups = budgetGroupsForTxType(txForm.value.type);
  for (const g of groups) {
    const item = g.items.find((i) => String(i.id) === String(id));
    if (item) {
      const sub = (item.sub_category || "").trim();
      return {
        category: g.category,
        subcategoryDisplay: sub || "—",
        categorySubLabel: sub ? `${g.category}-${sub}` : g.category,
      };
    }
  }
  return null;
});

const selectedGrossIncomeBudgetItem = computed(() => {
  if (txForm.value.type !== "income" || !txForm.value.budgetItemId) return null;
  const item = (budgets.value.income ?? []).find((i) => String(i.id) === String(txForm.value.budgetItemId));
  if (!item || isNetIncomeBudgetLine(item)) return null;
  return isGrossIncomeBudgetItem(item) ? item : null;
});

const isGrossIncomePaycheckMode = computed(() => selectedGrossIncomeBudgetItem.value != null);

const pairedNetIncomeBudgetLine = computed(() => {
  const gross = selectedGrossIncomeBudgetItem.value;
  if (!gross) return null;
  return findNetIncomeBudgetLine(budgets.value.income, {
    category: gross.category,
    excludeId: gross.id,
  });
});

const grossAllocExpensePartition = computed(() =>
  partitionSavingsInvestmentForGrossAlloc(savingsBudgetGroups.value, investmentBudgetGroups.value),
);

const grossIncomeAllocatableLines = computed(() =>
  buildGrossAllocatableLines(
    taxBudgetGroups.value,
    insuranceBudgetGroups.value,
    grossAllocExpensePartition.value.retirementGroups,
    [],
    grossAllocExpensePartition.value.investmentGroups,
  ).map((line) => ({
    ...line,
    key: grossAllocationKey(line.kind, line.id),
  })),
);

const grossAllocTaxLines = computed(() => grossIncomeAllocatableLines.value.filter((l) => l.kind === "tax"));
const grossAllocInsuranceLines = computed(() => grossIncomeAllocatableLines.value.filter((l) => l.kind === "insurance"));
const grossAllocRetirementLines = computed(() => grossIncomeAllocatableLines.value.filter((l) => l.kind === "retirement"));
const grossAllocInvestmentLines = computed(() =>
  grossIncomeAllocatableLines.value.filter((l) => l.kind === "investment"),
);

const grossIncomeAllocatedTotal = computed(() => sumGrossAllocationAmounts(grossAllocationAmounts.value));

const grossIncomeNetAmount = computed(() =>
  computeNetFromGross(txForm.value.amount, grossIncomeAllocatedTotal.value),
);

const addTransactionModalTitle = computed(() => {
  if (isGrossIncomePaycheckMode.value) {
    const meta = addModalBudgetLineMeta.value;
    if (meta?.categorySubLabel) {
      return `Add Gross Income — ${meta.categorySubLabel}`;
    }
    return "Add Gross Income";
  }
  const opt = addModalBudgetTypeOptions.find((o) => o.value === txForm.value.type);
  const typeLabel = opt?.label ?? txForm.value.type;
  const meta = addModalBudgetLineMeta.value;
  if (meta?.categorySubLabel) {
    return `Add - ${typeLabel} ${meta.categorySubLabel} item`;
  }
  return `Add - ${typeLabel} item`;
});

/** Budget Details: by type, then flat rows "Category — Subcategory" (group order, then subcategory sort) */
const budgetTrackerDisplaySections = computed(() => {
  const base = [
    { key: "expense", title: "Expenses", listType: "expense", accent: "text-red-600 dark:text-red-400", groups: expenseBudgetGroups.value },
    { key: "income", title: "Income", listType: "income", accent: "text-emerald-600 dark:text-emerald-400", groups: incomeBudgetGroups.value },
    { key: "investment", title: "Investments", listType: "expense", accent: "text-violet-600 dark:text-violet-400", groups: investmentBudgetGroups.value },
    { key: "savings", title: "Savings", listType: "expense", accent: "text-sky-600 dark:text-sky-400", groups: savingsBudgetGroups.value },
    { key: "tax", title: "Tax", listType: "income", accent: "text-amber-600 dark:text-amber-400", groups: taxBudgetGroups.value },
    { key: "insurance", title: "Insurance", listType: "income", accent: "text-gray-600 dark:text-gray-300", groups: insuranceBudgetGroups.value },
  ];
  return base
    .map((s) => ({
      ...s,
      rows: s.groups.flatMap((group) =>
        group.items.map((item) => {
          const sub = (item.sub_category || "").trim();
          return {
            item,
            group,
            categorySubcategoryLabel: sub ? `${group.category}-${sub}` : group.category,
          };
        }),
      ),
    }))
    .filter((s) => s.rows.length > 0);
});
function sectionSummary(section) {
  let budget = 0;
  let actual = 0;
  for (const row of section.rows) {
    budget += Number(row.item.monthly_amount) || 0;
    actual += getActualForItem(row.item.id, section.listType);
  }
  return `$${formatAmount(actual)} / $${formatAmount(budget)}`;
}


function isIncomeSideBudgetType(t) {
  return t === "income" || t === "tax" || t === "insurance";
}

/** From / To cash or debt (plain expense only; savings & investment use their own From source + To account) */
const showAppliedAccountSelector = computed(() => txForm.value.type === "expense");

const addModalExpenseForAppliedAccount = computed(() => {
  if (txForm.value.type !== "expense") return null;
  return expenseBudgetItemById(txForm.value.budgetItemId);
});

/** Loan / credit card lines use Estate Management debt institutions instead of cash accounts */
const selectedDebtForPayment = computed(() => {
  if (!txForm.value.debtId) return null;
  return debtRecords.value.find((r) => String(r.dbt_id) === String(txForm.value.debtId)) ?? null;
});

const debtPaymentPreview = computed(() => {
  if (!useDebtInstitutionsForAddModal.value || !selectedDebtForPayment.value) return null;
  const amount = Number(txForm.value.amount);
  if (!amount || isNaN(amount) || amount <= 0) return null;
  return computeDebtPaymentApplication(selectedDebtForPayment.value, amount);
});

const editSelectedDebtForPayment = computed(() => {
  if (!editTxForm.value.debtId) return null;
  return debtRecords.value.find((r) => String(r.dbt_id) === String(editTxForm.value.debtId)) ?? null;
});

const editDebtPaymentPreview = computed(() => {
  if (!editShowsDebtDestination.value || !editSelectedDebtForPayment.value) return null;
  const amount = Number(editTxForm.value.amount);
  if (!amount || isNaN(amount) || amount <= 0) return null;
  return computeDebtPaymentApplication(editSelectedDebtForPayment.value, amount);
});

const useDebtInstitutionsForAddModal = computed(() => {
  if (!showAppliedAccountSelector.value) return false;
  const ex = addModalExpenseForAppliedAccount.value;
  if (!ex) return false;
  const et = ex.expense_type || "expense";
  if (et === "savings" || et === "investment") return false;
  if (ex.debt_id != null && ex.debt_id !== "") return true;
  return textLooksLikeLoanOrCreditCard(ex.category, ex.sub_category, ex.description);
});

const editModalExpenseItem = computed(() => {
  if (editTxForm.value.type !== "expense") return null;
  return expenseBudgetItemById(editTxForm.value.budgetItemId);
});

const editShowsDebtDestination = computed(() => {
  if (editTxForm.value.type !== "expense") return false;
  const ex = editModalExpenseItem.value;
  if (!ex) return false;
  const et = ex.expense_type || "expense";
  if (et === "savings" || et === "investment") return false;
  if (editSourceDebtId.value != null) return true;
  if (ex.debt_id != null && ex.debt_id !== "") return true;
  return textLooksLikeLoanOrCreditCard(ex.category, ex.sub_category, ex.description);
});

const editShowsCashDestination = computed(() => {
  if (editTxForm.value.type === "income") {
    const inc = (budgets.value.income ?? []).find((i) => String(i.id) === String(editTxForm.value.budgetItemId));
    return inc != null && (inc.income_type || "gross") === "gross";
  }
  if (editTxForm.value.type !== "expense") return false;
  const ex = editModalExpenseItem.value;
  return ex != null && (ex.expense_type === "savings" || ex.expense_type === "investment");
});

/** Actual totals by budget item for selected month */
const actualByItem = computed(() => {
  const byItem = {};
  const txList = transactions.value ?? [];
  const y = selectedYear.value;
  const m = selectedMonth.value;
  for (const tx of txList) {
    const d = new Date(tx.date);
    if (d.getFullYear() !== y || d.getMonth() + 1 !== m) continue;
    const key = tx.income_id != null ? `income-${tx.income_id}` : `expense-${tx.expense_id}`;
    byItem[key] = (byItem[key] || 0) + Number(tx.amount);
  }
  return byItem;
});

/** Transactions for the selected sub-category (budget item) */
const transactionsForModal = computed(() => {
  const item = selectedBudgetItem.value;
  if (!item) return [];
  const txList = transactions.value ?? [];
  return txList
    .filter((tx) =>
      item.type === "income"
        ? tx.income_id === item.id
        : tx.expense_id === item.id,
    )
    .sort((a, b) => new Date(b.date) - new Date(a.date));
});

function getActualForItem(itemId, type) {
  const key = type === "income" ? `income-${itemId}` : `expense-${itemId}`;
  return actualByItem.value[key] ?? 0;
}

function getVarianceClass(itemId, type, budgeted) {
  const actual = getActualForItem(itemId, type);
  const variance = type === "income" ? actual - (budgeted || 0) : (budgeted || 0) - actual;
  if (Math.abs(variance) < 0.01) return "text-gray-500 dark:text-gray-400";
  // More than budgeted (over) = error; under = secondary
  const isOver = type === "income" ? variance > 0 : variance < 0;
  return isOver ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400";
}

function formatVariance(itemId, type, budgeted) {
  const actual = getActualForItem(itemId, type);
  const variance = type === "income" ? actual - (budgeted || 0) : (budgeted || 0) - actual;
  const sign = variance >= 0 ? "+" : "";
  return `${sign}$${formatAmount(Math.abs(variance))}`;
}

function formatAmount(val) {
  if (val == null || val === "" || isNaN(val)) return "0.00";
  return Number(val).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const CATEGORY_SUBCATEGORY_DISPLAY_MAX = 14;

function truncateCategoryLabel(text) {
  const s = String(text ?? "");
  if (s.length <= CATEGORY_SUBCATEGORY_DISPLAY_MAX) return s;
  return `${s.slice(0, CATEGORY_SUBCATEGORY_DISPLAY_MAX)}…`;
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

async function loadData() {
  if (!auth.user) return;
  loading.value = true;
  loadError.value = "";
  try {
    const [budgetData, txData, cashData, debtData, srcData, invSrcData, savSrcData] = await Promise.all([
      $fetch("/api/budget/list"),
      $fetch("/api/budget/transactions/list"),
      $fetch("/api/records/cash-and-investments"),
      $fetch("/api/records/debt").then((d) => d?.records ?? []).catch(() => []),
      $fetch("/api/budget/income-sources/list").then((d) => d?.sources ?? []).catch(() => []),
      $fetch("/api/budget/investment-sources/list").then((d) => d?.sources ?? []).catch(() => []),
      $fetch("/api/budget/savings-sources/list").then((d) => d?.sources ?? []).catch(() => []),
    ]);
    budgets.value = { income: budgetData.income ?? [], expenses: budgetData.expenses ?? [] };
    transactions.value = txData.transactions ?? [];
    cashAccounts.value = cashData.records ?? [];
    debtRecords.value = Array.isArray(debtData) ? debtData : [];
    incomeSources.value = Array.isArray(srcData) ? srcData : [];
    investmentSources.value = Array.isArray(invSrcData) ? invSrcData : [];
    savingsSources.value = Array.isArray(savSrcData) ? savSrcData : [];
  } catch (err) {
    console.error("Failed to load", err);
    loadError.value = parseFetchError(
      err,
      "Failed to load budget tracker. If you recently updated the app, run: npm run migrate",
    );
    budgets.value = { income: [], expenses: [] };
    transactions.value = [];
    cashAccounts.value = [];
    debtRecords.value = [];
    incomeSources.value = [];
    investmentSources.value = [];
    savingsSources.value = [];
  } finally {
    loading.value = false;
  }
}

function cancelNewIncomeFrom() {
  showNewIncomeFromInput.value = false;
  txForm.value.incomeSourceName = "";
}

function cancelNewInvestmentFrom() {
  showNewInvestmentFromInput.value = false;
  txForm.value.investmentSourceName = "";
}

function cancelNewSavingsFrom() {
  showNewSavingsFromInput.value = false;
  txForm.value.savingsSourceName = "";
}

async function addSavingsSourceFromForm() {
  const name = (txForm.value.savingsSourceName || "").trim();
  if (!name) {
    txError.value = "Enter a savings source.";
    return;
  }
  try {
    const created = await $fetch("/api/budget/savings-sources/submit", { method: "POST", body: { name } });
    const src = created?.source;
    const next = await $fetch("/api/budget/savings-sources/list").then((d) => d?.sources ?? []).catch(() => []);
    savingsSources.value = Array.isArray(next) ? next : [];
    if (src?.id) {
      txForm.value.savingsSourceId = String(src.id);
      txForm.value.savingsSourceName = "";
    }
    showNewSavingsFromInput.value = false;
  } catch (err) {
    txError.value = err?.data?.message || err?.message || "Failed to add savings source.";
  }
}

async function addInvestmentSourceFromForm() {
  const name = (txForm.value.investmentSourceName || "").trim();
  if (!name) {
    txError.value = "Enter an investment source.";
    return;
  }
  try {
    const created = await $fetch("/api/budget/investment-sources/submit", { method: "POST", body: { name } });
    const src = created?.source;
    const next = await $fetch("/api/budget/investment-sources/list").then((d) => d?.sources ?? []).catch(() => []);
    investmentSources.value = Array.isArray(next) ? next : [];
    if (src?.id) {
      txForm.value.investmentSourceId = String(src.id);
      txForm.value.investmentSourceName = "";
    }
    showNewInvestmentFromInput.value = false;
  } catch (err) {
    txError.value = err?.data?.message || err?.message || "Failed to add investment source.";
  }
}

async function addIncomeSourceFromForm() {
  const name = (txForm.value.incomeSourceName || "").trim();
  if (!name) {
    txError.value = "Enter an income source.";
    return;
  }
  try {
    const created = await $fetch("/api/budget/income-sources/submit", { method: "POST", body: { name } });
    const src = created?.source;
    const next = await $fetch("/api/budget/income-sources/list").then((d) => d?.sources ?? []).catch(() => []);
    incomeSources.value = Array.isArray(next) ? next : [];
    if (src?.id) {
      txForm.value.incomeSourceId = String(src.id);
      txForm.value.incomeSourceName = "";
    }
    showNewIncomeFromInput.value = false;
  } catch (err) {
    txError.value = err?.data?.message || err?.message || "Failed to add income source.";
  }
}

/** Non-ignored CSV rows that will be imported */
const csvRowsToImport = computed(() => csvRows.value.filter((r) => !r.ignored));

/** All non-ignored rows have an expense item selected */
const allCsvRowsHaveType = computed(() => {
  const toImport = csvRowsToImport.value;
  if (!toImport.length) return false;
  return toImport.every((r) => r.budgetItemId);
});

/** Rows that still need a normal Save (excludes duplicate-skipped rows until expense changes or Add entry is used) */
const csvRowsPendingImport = computed(() =>
  csvRows.value.filter((r) => !r.ignored && r.budgetItemId && !r.csvImported && !r.csvDuplicateSkipped),
);
const csvPendingImportCount = computed(() => csvRowsPendingImport.value.length);
const csvHasPendingImportRows = computed(() => csvPendingImportCount.value > 0);

/** Parse CSV text into rows with date, amount, description */
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const rows = [];
  const transactionDateCols = ["transaction date", "trans date", "transaction_date", "transactiondate"];
  const otherDateCols = ["date", "posting date", "posted"];
  const amountCols = ["amount", "debit", "credit", "withdrawal", "deposit"];
  const descCols = ["description", "memo", "details", "name", "payee", "merchant"];
  const headerParts = parseCsvLine(lines[0]);
  let dateIdx = headerParts.findIndex((p) => transactionDateCols.some((c) => p.toLowerCase().trim().includes(c)));
  if (dateIdx < 0) {
    dateIdx = headerParts.findIndex((p) => otherDateCols.some((c) => p.toLowerCase().trim().includes(c)));
  }
  const useDateIdx = dateIdx >= 0 ? dateIdx : 0;
  let amountIdx = headerParts.findIndex((p) => amountCols.some((c) => p.toLowerCase().includes(c)));
  if (amountIdx < 0) amountIdx = 1;
  const descIdx = headerParts.findIndex((p) => descCols.some((c) => p.toLowerCase().includes(c)));
  const hasDebit = headerParts.some((p) => p.toLowerCase().includes("debit"));
  const hasCredit = headerParts.some((p) => p.toLowerCase().includes("credit"));
  for (let i = 1; i < lines.length; i++) {
    const parts = parseCsvLine(lines[i]);
    if (parts.length < 2) continue;
    let dateVal = (parts[useDateIdx] || "").trim();
    let amountVal = amountIdx >= 0 ? (parts[amountIdx] || "").trim() : "";
    const descVal = descIdx >= 0 ? (parts[descIdx] || "").trim() : parts.slice(2).join(" ").trim() || "";
    if (hasDebit && hasCredit) {
      const debitIdx = headerParts.findIndex((p) => p.toLowerCase().includes("debit"));
      const creditIdx = headerParts.findIndex((p) => p.toLowerCase().includes("credit"));
      const debit = parseFloat(String(parts[debitIdx] || "0").replace(/[$,()\s]/g, "")) || 0;
      const credit = parseFloat(String(parts[creditIdx] || "0").replace(/[$,()\s]/g, "")) || 0;
      amountVal = credit > 0 ? String(credit) : debit > 0 ? `-${debit}` : "0";
    }
    const amount = parseAmount(amountVal);
    if (amount == null || isNaN(amount) || amount === 0) continue;
    const normDate = toISODateString(dateVal);
    if (!normDate) continue;
    rows.push({
      date: normDate,
      amount: Math.abs(amount),
      description: descVal || null,
      type: "expense",
      budgetItemId: "",
      ignored: false,
      csvImported: false,
      csvDuplicateSkipped: false,
      csvPotentialDuplicate: false,
      csvForceAdding: false,
    });
  }
  return rows;
}

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if ((c === "," || c === "\t") && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

function parseAmount(val) {
  if (!val) return null;
  const cleaned = String(val).replace(/[$,]/g, "").replace(/\(([^)]+)\)/, "-$1").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/** Convert any date value to ISO format YYYY-MM-DD for PostgreSQL insert */
function toISODateString(val) {
  if (val == null || val === "") return null;
  const str = String(val).trim();
  if (!str) return null;
  const pad = (n) => String(n).padStart(2, "0");

  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]|$)/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const mo = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return `${y}-${pad(mo)}-${pad(d)}`;
    }
  }

  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const a = parseInt(slashMatch[1], 10);
    const b = parseInt(slashMatch[2], 10);
    let y = parseInt(slashMatch[3], 10);
    if (y < 100) y += 2000;
    let mo, d;
    if (a > 12) {
      d = a;
      mo = b;
    } else if (b > 12) {
      mo = a;
      d = b;
    } else {
      mo = a;
      d = b;
    }
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return `${y}-${pad(mo)}-${pad(d)}`;
    }
  }

  const dashMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    const a = parseInt(dashMatch[1], 10);
    const b = parseInt(dashMatch[2], 10);
    let y = parseInt(dashMatch[3], 10);
    if (y < 100) y += 2000;
    let mo, d;
    if (a > 12) {
      d = a;
      mo = b;
    } else if (b > 12) {
      mo = a;
      d = b;
    } else {
      mo = a;
      d = b;
    }
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return `${y}-${pad(mo)}-${pad(d)}`;
    }
  }

  const num = parseInt(str, 10);
  if (!isNaN(num) && num > 1000) {
    const excelEpoch = new Date(1899, 11, 30);
    const d = new Date(excelEpoch.getTime() + num * 86400000);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return null;
}

function buildExistingExpenseCsvDedupeKeySet() {
  return buildExistingExpenseDedupeSets(transactions.value).keysWithExpense;
}

function csvRowClass(row) {
  if (row.ignored) return "opacity-50 bg-base-200/50";
  if (!row.budgetItemId) return "bg-error/10";
  if (row.csvPotentialDuplicate && !row.csvImported) return "bg-warning/20";
  if (row.csvImported) return "bg-success/10";
  return "";
}

function onCsvExpenseItemChange() {
  applyCsvDuplicateFlags(csvRows.value, transactions.value);
}

function csvImportSummary(rows) {
  const dup = rows.filter((r) => !r.ignored && r.csvPotentialDuplicate).length;
  const suggested = rows.filter((r) => !r.ignored && r.budgetItemId).length;
  const parts = [];
  if (suggested) parts.push(`${suggested} row(s) have a suggested expense item from your history.`);
  if (dup) {
    parts.push(
      `${dup} potential duplicate(s) found (same date, amount, and description or budget line as an existing entry). Review flagged rows or use Add entry to import anyway.`,
    );
  }
  return parts.join(" ");
}

async function onCsvFileSelected(ev) {
  const file = ev?.target?.files?.[0];
  ev.target.value = "";
  if (!file) return;
  csvError.value = "";
  csvImportBanner.value = "";
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const text = e.target?.result;
      if (!text) {
        csvError.value = "Could not read file.";
        return;
      }
      const rows = parseCsv(text);
      if (!rows.length) {
        csvError.value = "No valid transactions found. Ensure CSV has date, amount, and description columns.";
        csvRows.value = [];
      } else {
        await loadData();
        const enriched = enrichCsvExpenseRows(
          rows,
          transactions.value,
          validExpenseBudgetItemIds.value,
        );
        csvRows.value = enriched;
        csvError.value = "";
        csvImportBanner.value = csvImportSummary(enriched);
        nextTick(() => csvUploadModalRef.value?.showModal());
      }
    } catch (err) {
      csvError.value = err?.message || "Failed to parse CSV.";
      csvRows.value = [];
    }
  };
  reader.readAsText(file, "UTF-8");
}

function closeCsvModal() {
  csvUploadModalRef.value?.close();
  csvRows.value = [];
  csvError.value = "";
  csvImportBanner.value = "";
}

async function forceAddCsvExpenseRow(idx) {
  const row = csvRows.value[idx];
  if (!row || row.ignored || !row.budgetItemId) return;
  csvError.value = "";
  row.csvForceAdding = true;
  try {
    const dateStr = toISODateString(row.date);
    if (!dateStr) {
      csvError.value = `Invalid date for row: ${row.description || row.amount}`;
      return;
    }
    const body = {
      type: "expense",
      expense_id: parseInt(String(row.budgetItemId), 10),
      transaction_date: dateStr,
      amount: row.amount,
      description: row.description || null,
    };
    await $fetch("/api/budget/transactions/submit", { method: "POST", body });
    row.csvImported = true;
    row.csvDuplicateSkipped = false;
    row.csvPotentialDuplicate = false;
    await loadData();
    csvImportBanner.value = csvImportSummary(csvRows.value);
    const active = csvRows.value.filter((r) => !r.ignored);
    if (active.length > 0 && active.every((r) => r.csvImported)) {
      closeCsvModal();
    }
  } catch (err) {
    csvError.value = err?.data?.message || err?.message || "Failed to add transaction.";
  } finally {
    row.csvForceAdding = false;
  }
}

async function saveCsvTransactions() {
  if (!allCsvRowsHaveType.value || csvSaving.value || !csvHasPendingImportRows.value) return;
  csvError.value = "";
  csvImportBanner.value = "";
  csvSaving.value = true;
  let skippedDup = 0;
  try {
    const keySet = buildExistingExpenseCsvDedupeKeySet();
    const pending = csvRows.value.filter((r) => !r.ignored && r.budgetItemId && !r.csvImported && !r.csvDuplicateSkipped);
    for (const row of pending) {
      const dateStr = toISODateString(row.date);
      if (!dateStr) {
        csvError.value = `Invalid date for row: ${row.description || row.amount}`;
        return;
      }
      const expenseId = parseInt(String(row.budgetItemId), 10);
      const key = expenseCsvDedupeKey(expenseId, dateStr, row.amount);
      if (!key) {
        csvError.value = "Invalid expense item or amount for a row.";
        return;
      }
      if (keySet.has(key)) {
        row.csvDuplicateSkipped = true;
        skippedDup++;
        continue;
      }
      const body = {
        type: "expense",
        expense_id: expenseId,
        transaction_date: dateStr,
        amount: row.amount,
        description: row.description || null,
      };
      await $fetch("/api/budget/transactions/submit", { method: "POST", body });
      keySet.add(key);
      row.csvImported = true;
      row.csvDuplicateSkipped = false;
      row.csvPotentialDuplicate = false;
    }
    await loadData();
    applyCsvDuplicateFlags(csvRows.value, transactions.value);
    if (skippedDup > 0) {
      csvImportBanner.value = `${skippedDup} row(s) were skipped as potential duplicates. Use Add entry on a row to import anyway. ${csvImportSummary(csvRows.value)}`.trim();
    } else {
      csvImportBanner.value = csvImportSummary(csvRows.value);
    }
    const active = csvRows.value.filter((r) => !r.ignored);
    if (active.length > 0 && active.every((r) => r.csvImported)) {
      closeCsvModal();
    }
  } catch (err) {
    csvError.value = err?.data?.message || err?.message || "Failed to save transactions.";
  } finally {
    csvSaving.value = false;
  }
}

function buildAddTxDescription(payee, description) {
  const p = (payee || "").trim();
  const d = (description || "").trim();
  if (p && d) return `Payee: ${p} · ${d}`;
  if (p) return `Payee: ${p}`;
  return d || null;
}

async function submitTransaction() {
  txError.value = "";
  const id = txForm.value.budgetItemId;
  const amount = txForm.value.amount;
  if (!id || amount == null || isNaN(amount)) {
    txError.value = !id
      ? "No budget line is set. Use Add from a row under Budget Details, or add lines in Budget Setup."
      : "Enter a valid amount.";
    return;
  }
  if (txForm.value.type === "investment" || txForm.value.type === "savings") {
    const toId = txForm.value.cashInvestmentId ? parseInt(String(txForm.value.cashInvestmentId), 10) : NaN;
    if (!toId || isNaN(toId) || toId <= 0) {
      txError.value = "Select the to account.";
      return;
    }
  }
  if (txForm.value.type !== "income" && txForm.value.type !== "investment" && txForm.value.type !== "savings" && showAppliedAccountSelector.value) {
    const fromId = txForm.value.fromCashInvestmentId ? parseInt(String(txForm.value.fromCashInvestmentId), 10) : NaN;
    if (!fromId || isNaN(fromId) || fromId <= 0) {
      txError.value = "Select the from account.";
      return;
    }
    if (useDebtInstitutionsForAddModal.value) {
      const did = txForm.value.debtId ? parseInt(String(txForm.value.debtId), 10) : NaN;
      if (!did || isNaN(did) || did <= 0) {
        txError.value = "Select the debt institution this amount applies to.";
        return;
      }
    } else {
      const cid = txForm.value.cashInvestmentId ? parseInt(String(txForm.value.cashInvestmentId), 10) : NaN;
      if (!cid || isNaN(cid) || cid <= 0) {
        txError.value = "Select the account this amount is applied to.";
        return;
      }
    }
  }

  if (isGrossIncomePaycheckMode.value) {
    if (grossIncomeNetAmount.value < 0) {
      txError.value = "Allocations cannot exceed gross income.";
      return;
    }
    const gross = Number(txForm.value.amount);
    if (!gross || isNaN(gross) || gross <= 0) {
      txError.value = "Enter a valid gross income amount.";
      return;
    }
    const net = grossIncomeNetAmount.value;
    const allocations = getPositiveGrossAllocations(grossAllocationAmounts.value);
    if (net <= 0 && allocations.length === 0) {
      txError.value =
        "Enter a net income amount or allocate to at least one tax, insurance, retirement, or investment line.";
      return;
    }
    const grossItem = selectedGrossIncomeBudgetItem.value;
    const netLine = findNetIncomeBudgetLine(budgets.value.income, {
      category: grossItem?.category,
      excludeId: txForm.value.budgetItemId,
    });
    if (net > 0 && !netLine?.id) {
      txError.value =
        'Add a Net Income budget line in Budget Setup (e.g. sub-category "Net Income" under the same category) to record take-home pay.';
      return;
    }
    await doSubmitGrossIncomePaycheck();
    return;
  }

  await doSubmitTransaction();
}

function resolveIncomeTxContext() {
  const incomeSourceId = txForm.value.incomeSourceId ? parseInt(String(txForm.value.incomeSourceId), 10) : null;
  const effectiveIncomeSourceId =
    incomeSourceId && !isNaN(incomeSourceId) && incomeSourceId > 0 ? incomeSourceId : null;
  const to = txForm.value.cashInvestmentId ? parseInt(String(txForm.value.cashInvestmentId), 10) : null;
  const effectiveCiId = to && !isNaN(to) && to > 0 ? to : null;
  return {
    description: buildAddTxDescription(txForm.value.payee, txForm.value.description),
    effectiveIncomeSourceId,
    effectiveCiId,
    transaction_date: txForm.value.date,
  };
}

async function doSubmitGrossIncomePaycheck() {
  const grossLineId = parseInt(String(txForm.value.budgetItemId), 10);
  const gross = Number(txForm.value.amount);
  const net = grossIncomeNetAmount.value;
  const ctx = resolveIncomeTxContext();
  const allocations = getPositiveGrossAllocations(grossAllocationAmounts.value);
  const lineByKey = Object.fromEntries(grossIncomeAllocatableLines.value.map((l) => [l.key, l]));
  const grossItem = selectedGrossIncomeBudgetItem.value;
  const netLine = findNetIncomeBudgetLine(budgets.value.income, {
    category: grossItem?.category,
    excludeId: grossLineId,
  });

  txSubmitting.value = true;
  try {
    if (gross > 0 && !isNaN(gross)) {
      await $fetch("/api/budget/transactions/submit", {
        method: "POST",
        body: {
          type: "income",
          income_id: grossLineId,
          transaction_date: ctx.transaction_date,
          amount: gross,
          description: ctx.description,
          cash_investment_id: null,
          debt_id: null,
          from_cash_investment_id: null,
          income_source_id: ctx.effectiveIncomeSourceId,
          investment_source_id: null,
          savings_source_id: null,
        },
      });
    }

    if (net > 0 && netLine?.id != null) {
      const netIncomeId = parseInt(String(netLine.id), 10);
      await $fetch("/api/budget/transactions/submit", {
        method: "POST",
        body: {
          type: "income",
          income_id: netIncomeId,
          transaction_date: ctx.transaction_date,
          amount: net,
          description: ctx.description,
          cash_investment_id: ctx.effectiveCiId,
          debt_id: null,
          from_cash_investment_id: null,
          income_source_id: ctx.effectiveIncomeSourceId,
          investment_source_id: null,
          savings_source_id: null,
        },
      });
    }

    for (const alloc of allocations) {
      const line = lineByKey[alloc.key];
      if (!line) continue;

      if (alloc.kind === "tax" || alloc.kind === "insurance") {
        await $fetch("/api/budget/transactions/submit", {
          method: "POST",
          body: {
            type: "income",
            income_id: parseInt(alloc.id, 10),
            transaction_date: ctx.transaction_date,
            amount: alloc.amount,
            description: ctx.description,
            cash_investment_id: null,
            debt_id: null,
            from_cash_investment_id: null,
            income_source_id: ctx.effectiveIncomeSourceId,
            investment_source_id: null,
            savings_source_id: null,
          },
        });
        continue;
      }

      const ex = expenseBudgetItemById(alloc.id);
      const toRaw = ex?.cash_investment_id;
      const toId = toRaw != null && toRaw !== "" ? parseInt(String(toRaw), 10) : null;
      if (!toId || isNaN(toId) || toId <= 0) {
        const label = line.sub_category || line.category;
        const kindLabel =
          alloc.kind === "savings" ? "Savings" : alloc.kind === "retirement" ? "Retirement" : "Investment";
        throw new Error(`${kindLabel} line "${label}" needs a To account in Budget Setup.`);
      }
      const fromRaw = ex?.from_cash_investment_id || ctx.effectiveCiId;
      const fromId = fromRaw != null && fromRaw !== "" ? parseInt(String(fromRaw), 10) : null;
      if (!fromId || isNaN(fromId) || fromId <= 0) {
        throw new Error("Select the deposit account (To) for this paycheck, or set a From account on the budget line.");
      }

      await $fetch("/api/budget/transactions/submit", {
        method: "POST",
        body: {
          type: "expense",
          expense_id: parseInt(alloc.id, 10),
          transaction_date: ctx.transaction_date,
          amount: alloc.amount,
          description: ctx.description,
          cash_investment_id: toId,
          debt_id: null,
          from_cash_investment_id: fromId,
          income_source_id: null,
          investment_source_id: null,
          savings_source_id: null,
        },
      });
    }

    grossAllocationAmounts.value = {};
    addDialogRef.value?.close();
    await loadData();
    if (selectedBudgetItem.value) {
      nextTick(() => subCategoryModalRef.value?.showModal());
    }
  } catch (err) {
    txError.value = err?.data?.message || err?.message || "Failed to save paycheck.";
  } finally {
    txSubmitting.value = false;
  }
}

async function doSubmitTransaction() {
  const id = txForm.value.budgetItemId;
  const amount = txForm.value.amount;
  const description = buildAddTxDescription(txForm.value.payee, txForm.value.description);
  const incomeSourceId = txForm.value.incomeSourceId ? parseInt(String(txForm.value.incomeSourceId), 10) : null;
  const effectiveIncomeSourceId = incomeSourceId && !isNaN(incomeSourceId) && incomeSourceId > 0 ? incomeSourceId : null;
  const investmentSourceId = txForm.value.investmentSourceId ? parseInt(String(txForm.value.investmentSourceId), 10) : null;
  const effectiveInvestmentSourceId = investmentSourceId && !isNaN(investmentSourceId) && investmentSourceId > 0 ? investmentSourceId : null;
  const savingsSourceId = txForm.value.savingsSourceId ? parseInt(String(txForm.value.savingsSourceId), 10) : null;
  const effectiveSavingsSourceId = savingsSourceId && !isNaN(savingsSourceId) && savingsSourceId > 0 ? savingsSourceId : null;
  const fromCashInvestmentId = txForm.value.fromCashInvestmentId ? parseInt(String(txForm.value.fromCashInvestmentId), 10) : null;
  const effectiveFromCiId = fromCashInvestmentId && !isNaN(fromCashInvestmentId) && fromCashInvestmentId > 0 ? fromCashInvestmentId : null;
  let effectiveCiId = null;
  let effectiveDebtId = null;
  if (txForm.value.type === "income") {
    const to = txForm.value.cashInvestmentId ? parseInt(String(txForm.value.cashInvestmentId), 10) : null;
    effectiveCiId = to && !isNaN(to) && to > 0 ? to : null;
  } else if (txForm.value.type === "investment" || txForm.value.type === "savings") {
    const to = txForm.value.cashInvestmentId ? parseInt(String(txForm.value.cashInvestmentId), 10) : null;
    effectiveCiId = to && !isNaN(to) && to > 0 ? to : null;
  } else if (showAppliedAccountSelector.value) {
    if (useDebtInstitutionsForAddModal.value) {
      const d = txForm.value.debtId ? parseInt(String(txForm.value.debtId), 10) : null;
      effectiveDebtId = d && !isNaN(d) && d > 0 ? d : null;
    } else {
      const cashInvestmentId = txForm.value.cashInvestmentId ? parseInt(String(txForm.value.cashInvestmentId), 10) : null;
      effectiveCiId = cashInvestmentId && !isNaN(cashInvestmentId) && cashInvestmentId > 0 ? cashInvestmentId : null;
    }
  }

  txSubmitting.value = true;
  try {
    const body = isIncomeSideBudgetType(txForm.value.type)
      ? {
          type: "income",
          income_id: parseInt(id, 10),
          transaction_date: txForm.value.date,
          amount,
          description,
          cash_investment_id: effectiveCiId,
          debt_id: null,
          from_cash_investment_id: null,
          income_source_id: effectiveIncomeSourceId,
          investment_source_id: null,
          savings_source_id: null,
        }
      : {
          type: "expense",
          expense_id: parseInt(id, 10),
          transaction_date: txForm.value.date,
          amount,
          description,
          cash_investment_id: effectiveDebtId != null ? null : effectiveCiId,
          debt_id: effectiveDebtId,
          from_cash_investment_id:
            txForm.value.type === "investment" || txForm.value.type === "savings" ? null : effectiveFromCiId,
          income_source_id: null,
          investment_source_id: txForm.value.type === "investment" ? effectiveInvestmentSourceId : null,
          savings_source_id: txForm.value.type === "savings" ? effectiveSavingsSourceId : null,
        };
    await $fetch("/api/budget/transactions/submit", { method: "POST", body });
    addDialogRef.value?.close();
    await loadData();
    if (selectedBudgetItem.value) {
      nextTick(() => subCategoryModalRef.value?.showModal());
    }
  } catch (err) {
    txError.value = err?.data?.message || err?.message || "Failed to add transaction.";
  } finally {
    txSubmitting.value = false;
  }
}

function openSubCategoryModal(item, type, group) {
  selectedBudgetItem.value = {
    ...item,
    type,
    category: group.category,
    sub_category: item.sub_category || null,
  };
  editingTxId.value = null;
  nextTick(() => subCategoryModalRef.value?.showModal());
}

function startEditTx(tx) {
  editingTxId.value = tx.id;
  const d = new Date(tx.date);
  const type = tx.type === "income" ? "income" : "expense";
  const budgetItemId = tx.income_id != null ? String(tx.income_id) : String(tx.expense_id);
  editTxForm.value = {
    date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    amount: tx.amount,
    description: tx.description || "",
    budgetItemId,
    type,
    cashInvestmentId: tx.cash_investment_id != null ? String(tx.cash_investment_id) : "",
    debtId: tx.debt_id != null ? String(tx.debt_id) : "",
  };
  editSourceDebtId.value = tx.debt_id != null ? Number(tx.debt_id) : null;
  editTxError.value = "";
}

function cancelEdit() {
  editingTxId.value = null;
  editSourceDebtId.value = null;
}

async function saveEditTransaction() {
  if (!editingTxId.value) return;
  editTxError.value = "";
  const amount = editTxForm.value.amount;
  const budgetItemId = editTxForm.value.budgetItemId;
  if (amount == null || isNaN(amount)) {
    editTxError.value = "Enter a valid amount.";
    return;
  }
  if (!budgetItemId) {
    editTxError.value = "Select a category / sub-category.";
    return;
  }
  if (editShowsDebtDestination.value) {
    const did = editTxForm.value.debtId ? parseInt(String(editTxForm.value.debtId), 10) : NaN;
    if (!did || isNaN(did) || did <= 0) {
      editTxError.value = "Select a debt institution.";
      return;
    }
  }
  editTxSaving.value = true;
  try {
    const body = {
      transaction_date: editTxForm.value.date,
      amount,
      description: editTxForm.value.description || null,
    };
    if (editTxForm.value.type === "income") {
      body.income_id = parseInt(budgetItemId, 10);
    } else {
      body.expense_id = parseInt(budgetItemId, 10);
    }
    if (editShowsDebtDestination.value) {
      const did = parseInt(String(editTxForm.value.debtId), 10);
      body.cash_investment_id = null;
      body.debt_id = did;
    } else if (editShowsCashDestination.value) {
      const cashInvestmentId = editTxForm.value.cashInvestmentId
        ? parseInt(String(editTxForm.value.cashInvestmentId), 10)
        : null;
      const effectiveCiId = cashInvestmentId && !isNaN(cashInvestmentId) && cashInvestmentId > 0 ? cashInvestmentId : null;
      body.cash_investment_id = effectiveCiId;
      body.debt_id = null;
    }
    await $fetch(`/api/budget/transactions/${editingTxId.value}`, {
      method: "PUT",
      body,
    });
    editingTxId.value = null;
    editSourceDebtId.value = null;
    await loadData();
  } catch (err) {
    editTxError.value = err?.data?.message || err?.message || "Failed to update.";
  } finally {
    editTxSaving.value = false;
  }
}

function confirmDeleteFromModal(tx) {
  subCategoryModalRef.value?.close();
  confirmDelete(tx);
}

function addModalBudgetTypeFromItem(item, listType) {
  if (listType === "income") {
    if (item.income_type === "tax") return "tax";
    if (item.income_type === "deduction") return "insurance";
    return "income";
  }
  const et = item.expense_type || "expense";
  if (et === "savings") return "savings";
  if (et === "investment") return "investment";
  return "expense";
}

function addTxFromSubCategory() {
  const item = selectedBudgetItem.value;
  if (!item) return;
  subCategoryModalRef.value?.close();
  showNewIncomeFromInput.value = false;
  showNewInvestmentFromInput.value = false;
  showNewSavingsFromInput.value = false;
  const pad = (n) => String(n).padStart(2, "0");
  grossAllocationAmounts.value = {};
  txForm.value = {
    type: addModalBudgetTypeFromItem(item, item.type),
    budgetItemId: String(item.id),
    date: `${selectedYear.value}-${pad(selectedMonth.value)}-01`,
    amount: null,
    payee: "",
    incomeSourceId: "",
    incomeSourceName: "",
    investmentSourceId: "",
    investmentSourceName: "",
    savingsSourceId: "",
    savingsSourceName: "",
    description: "",
    fromCashInvestmentId: "",
    cashInvestmentId: "",
    debtId: "",
  };
  txError.value = "";
  nextTick(() => addDialogRef.value?.showModal());
}

function confirmDelete(tx) {
  deletingTx.value = tx;
  nextTick(() => deleteDialogRef.value?.showModal());
}

async function performDelete() {
  if (!deletingTx.value) return;
  deleting.value = true;
  try {
    await $fetch(`/api/budget/transactions/${deletingTx.value.id}`, { method: "DELETE" });
    deleteDialogRef.value?.close();
    deletingTx.value = null;
    await loadData();
    if (selectedBudgetItem.value) {
      nextTick(() => subCategoryModalRef.value?.showModal());
    }
  } catch (err) {
    console.error("Delete failed", err);
  } finally {
    deleting.value = false;
  }
}

watch(
  () => txForm.value.budgetItemId,
  (id) => {
    if (txForm.value.type !== "expense" || !id) return;
    const ex = expenseBudgetItemById(id);
    if (ex?.debt_id != null && ex.debt_id !== "") {
      txForm.value.debtId = String(ex.debt_id);
    }
  },
);

onMounted(() => {
  if (!auth.ready) auth.fetchSession();
});

watch(
  () => auth.user,
  (user) => {
    if (user) loadData();
  },
  { immediate: true },
);
</script>

