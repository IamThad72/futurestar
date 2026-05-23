<template>
  <section
    class="mx-auto w-full max-w-[96rem] space-y-4 sm:space-y-6 px-0.5 pr-0 pt-[0.8rem] pb-4 sm:-mx-2 sm:pl-2 sm:pr-1.5 sm:pt-[1.2rem] sm:pb-6 overflow-x-hidden min-w-0"
  >
    <header class="flex flex-wrap items-center gap-4 sm:gap-6">
      <h1 class="text-lg sm:text-xl font-semibold text-base-content">Budget Setup</h1>
      <button
        v-if="auth.user && auth.ready && !loadError"
        type="button"
        class="estate-action-btn ml-auto"
        @click="openAddBudgetModal()"
      >
        Add Budget Item
      </button>
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

    <LoadErrorPanel
      v-else-if="loadError"
      :message="loadError"
      @retry="loadBudgets"
    />

    <div v-else class="space-y-6">
      <!-- Add Budget Item modal -->
      <dialog ref="addBudgetDialogRef" class="modal" @close="submitError = ''">
        <div
          class="modal-box max-h-[90vh] overflow-y-auto"
          :class="form.type === 'income' ? 'max-w-2xl' : 'max-w-lg'"
        >
          <h3 class="font-semibold text-lg mb-4">{{ addBudgetModalTitle }}</h3>
          <form @submit.prevent="submitBudget" class="space-y-4">
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label class="form-control w-full">
                <span class="label-text text-sm">Type</span>
                <select v-model="form.type" class="select select-bordered w-full">
                  <option v-for="opt in budgetTypeOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
              </label>
              <label class="form-control w-full">
                <span class="label-text text-sm">Category <span class="text-error">*</span></span>
                <input
                  v-model.trim="form.category"
                  class="input input-bordered w-full"
                  type="text"
                  :placeholder="addCategoryPlaceholder"
                  required
                />
              </label>
            </div>

            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label class="form-control w-full">
                <span class="label-text text-sm">Sub-category</span>
                <input
                  v-model.trim="form.sub_category"
                  class="input input-bordered w-full"
                  type="text"
                  placeholder="e.g. Rent, Utilities"
                />
              </label>
              <label v-if="form.type !== 'savings' && form.type !== 'investment'" class="form-control w-full">
                <span class="label-text text-sm">Description</span>
                <input
                  v-model.trim="form.description"
                  class="input input-bordered w-full"
                  type="text"
                  placeholder="Optional notes"
                />
              </label>
              <label v-if="form.type === 'expense'" class="form-control w-full md:col-span-2">
                <span class="label-text text-sm">
                  Estate Management debt
                  <span v-if="addNeedsDebtLink" class="text-error">*</span>
                </span>
                <select
                  v-model="form.debt_id"
                  class="select select-bordered w-full"
                  :required="addNeedsDebtLink"
                >
                  <option value="">
                    {{ debtRecords.length ? "Select debt record…" : "No debt records — add in Estate Management" }}
                  </option>
                  <option v-for="row in debtRecords" :key="row.dbt_id" :value="String(row.dbt_id)">
                    {{ formatDebtRecordLabel(row) }}
                  </option>
                </select>
                <span class="label-text-alt text-base-content/60">
                  Link this budget line to a loan or credit card from Estate Management (used in Budget Tracker).
                </span>
              </label>
              <template v-else>
                <label class="form-control w-full">
                  <span class="label-text text-sm">From Account</span>
                  <select v-model="form.from_cash_investment_id" class="select select-bordered w-full">
                    <option value="">None</option>
                    <option v-for="acct in cashAccounts" :key="`from-${acct.ci_id}`" :value="String(acct.ci_id)">
                      {{ [acct.institution, acct.acct_type].filter(Boolean).join(" — ") || `Account #${acct.ci_id}` }}
                    </option>
                  </select>
                  <span class="label-text-alt text-base-content/60">Cash or investment account the amount comes from</span>
                </label>
                <label class="form-control w-full">
                  <span class="label-text text-sm">To Account</span>
                  <select v-model="form.cash_investment_id" class="select select-bordered w-full">
                    <option value="">None</option>
                    <option v-for="acct in cashAccounts" :key="`to-${acct.ci_id}`" :value="String(acct.ci_id)">
                      {{ [acct.institution, acct.acct_type].filter(Boolean).join(" — ") || `Account #${acct.ci_id}` }}
                    </option>
                  </select>
                  <span class="label-text-alt text-base-content/60">Account to add this amount to</span>
                </label>
              </template>
            </div>

            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label class="form-control w-full">
                <span class="label-text text-sm">{{ form.type === 'income' ? 'Gross Income (monthly)' : 'Monthly Amount (default)' }}</span>
                <input
                  v-model.number="form.monthly_amount"
                  class="input input-bordered w-full"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  @input="syncAnnualFromMonthly"
                />
              </label>
              <label class="form-control w-full">
                <span class="label-text text-sm">{{ form.type === 'income' ? 'Gross Income (annual)' : 'Annual Total' }}</span>
                <input
                  v-model.number="form.annual_amount"
                  class="input input-bordered w-full"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  @input="syncMonthlyFromAnnual"
                />
              </label>
            </div>

            <div v-if="form.type === 'income'" class="space-y-4 rounded-lg border border-base-300 p-3">
              <p class="text-sm text-base-content/70">
                Allocate gross income to existing tax, insurance, retirement, and investment budget lines. The gross amount is saved on the line you are adding; the remainder updates your Net Income budget line when one exists.
              </p>
              <div v-if="!grossIncomeAllocatableLines.length" class="text-sm text-base-content/50 italic">
                No tax, insurance, retirement, or investment lines yet. The full gross amount is saved on this line; add a Net Income line to track take-home separately.
              </div>
              <template v-else>
                <div v-if="grossAllocTaxLines.length" class="space-y-2">
                  <h4 class="text-sm font-semibold text-warning">Tax</h4>
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
                  <h4 class="text-sm font-semibold">Insurance</h4>
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
                  <h4 class="text-sm font-semibold text-secondary">Investments</h4>
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
                <span class="text-sm font-medium">Net Income (monthly)</span>
                <span
                  class="text-lg font-semibold tabular-nums"
                  :class="grossIncomeNetMonthly < 0 ? 'text-error' : 'text-success'"
                >
                  ${{ formatAmount(Math.max(0, grossIncomeNetMonthly)) }}
                </span>
              </div>
              <p v-if="grossIncomeNetMonthly < 0" class="text-xs text-error">
                Allocations exceed gross income by ${{ formatAmount(-grossIncomeNetMonthly) }}.
              </p>
            </div>

            <div v-if="submitError" class="text-sm text-error">{{ submitError }}</div>
            <div class="modal-action flex-wrap gap-2 mt-2">
              <button type="button" class="btn btn-ghost" @click="addBudgetDialogRef?.close()">Cancel</button>
              <button type="submit" class="btn btn-primary gap-2" :disabled="submitting">
                <template v-if="submitting">Adding...</template>
                <template v-else>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-5 shrink-0">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  Add item
                </template>
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button aria-label="Close">close</button>
        </form>
      </dialog>

      <!-- Budget summary (A–Z by section title; always expanded) -->
      <div class="grid w-full grid-cols-1 gap-6">
        <!-- Expenses (expense type only) -->
        <div class="w-full overflow-hidden rounded-lg border border-primary bg-transparent">
          <div class="border-b border-primary pl-2.5 pr-1.5 py-4">
            <h2 class="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 text-lg font-semibold">
              <div class="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
                <span class="shrink-0 text-error">Expenses</span>
                <span v-if="!loading" class="text-xs font-normal text-base-content">
                  Total: ${{ formatAmount(expenseTypeOnlyTotals.monthly) }}/mo
                </span>
              </div>
              <button
                type="button"
                class="btn btn-ghost btn-sm h-auto min-h-0 shrink-0 gap-2 py-1.5 pl-1 pr-2 font-medium normal-case text-base-content hover:bg-base-200"
                @click="openAddBudgetModal('expense')"
              >
                <span class="flex size-[1.05rem] shrink-0 items-center justify-center rounded-full bg-primary text-primary-content">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="size-[0.525rem] shrink-0" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </span>
                Add Expense
              </button>
            </h2>
          </div>
          <div class="pl-2.5 pr-1.5 py-4 pb-6">
          <div v-if="loading" class="text-sm text-base-content/70">Loading...</div>
          <div v-else-if="!expensesGroupedByCategory.length" class="text-sm text-base-content/60 italic">
            No expense categories yet. Use Add Expense above.
          </div>
          <div v-else class="space-y-8">
            <div
              v-for="group in expensesGroupedByCategory"
              :key="`expense-cat-${group.category}`"
            >
              <ul
                role="list"
                class="divide-y divide-gray-100 rounded-md bg-white shadow-sm ring-1 ring-gray-900/5 dark:divide-white/5 dark:bg-gray-900/50 dark:shadow-none dark:ring-white/10"
              >
                <li
                  v-for="item in group.items"
                  :key="`expense-${item.id}`"
                  class="flex items-center justify-between gap-x-6 pl-2 pr-1 py-5 sm:pl-2.5 sm:pr-1.5"
                >
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-start gap-x-3 gap-y-1">
                      <p class="text-sm/6 font-semibold text-gray-900 dark:text-white">
                        {{ item.sub_category || "—" }}
                      </p>
                      <p
                        class="mt-0.5 shrink-0 rounded-md bg-gray-50 px-1.5 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20"
                      >
                        {{ group.category }}
                      </p>
                    </div>
                    <div class="mt-1 flex items-center gap-x-2 text-xs/5 text-gray-500 dark:text-gray-400">
                      <p class="whitespace-nowrap text-error">
                        ${{ formatAmount(item.monthly_amount) }}/mo
                      </p>
                      <svg viewBox="0 0 2 2" class="size-0.5 shrink-0 fill-current" aria-hidden="true">
                        <circle cx="1" cy="1" r="1" />
                      </svg>
                      <p class="truncate">{{ item.description?.trim() || "—" }}</p>
                    </div>
                    <p v-if="debtLabelForBudgetItem(item)" class="mt-1 text-xs text-base-content/70">
                      Linked debt: {{ debtLabelForBudgetItem(item) }}
                    </p>
                  </div>
                  <div class="flex flex-none items-center gap-x-4">
                    <HeadlessMenu as="div" class="relative flex-none">
                      <HeadlessMenuButton
                        class="budget-row-menu__trigger relative block rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
                      >
                        <span class="sr-only">Open options</span>
                        <EllipsisVerticalIcon class="size-5" aria-hidden="true" />
                      </HeadlessMenuButton>
                      <transition
                        enter-active-class="transition ease-out duration-100"
                        enter-from-class="transform scale-95 opacity-0"
                        enter-to-class="transform scale-100 opacity-100"
                        leave-active-class="transition ease-in duration-75"
                        leave-from-class="transform scale-100 opacity-100"
                        leave-to-class="transform scale-95 opacity-0"
                      >
                        <HeadlessMenuItems
                          class="budget-row-menu absolute right-0 z-10 mt-2 w-44 origin-top-right focus:outline-none"
                        >
                          <div class="budget-row-menu__list">
                          <HeadlessMenuItem v-slot="{ active }" class="w-full">
                            <button
                              type="button"
                              class="budget-row-menu__item" :class="{ 'budget-row-menu__item--active': active }"
                              @click="openEdit(item, 'expense')"
                            >
                              Edit<span class="sr-only">, {{ item.sub_category || item.category }}</span>
                            </button>
                          </HeadlessMenuItem>
                          <HeadlessMenuItem v-slot="{ active }" class="w-full">
                            <button
                              type="button"
                              class="budget-row-menu__item budget-row-menu__item--danger"
                              :class="{ 'budget-row-menu__item--active': active }"
                              @click="confirmDelete(item, 'expense')"
                            >
                              Delete<span class="sr-only">, {{ item.sub_category || item.category }}</span>
                            </button>
                          </HeadlessMenuItem>
                          </div>
                        </HeadlessMenuItems>
                      </transition>
                    </HeadlessMenu>
                  </div>
                </li>
              </ul>
            </div>
          </div>
          </div>
        </div>

        <!-- Income (excludes tax rows) -->
        <div class="w-full overflow-hidden rounded-lg border border-primary bg-transparent">
          <div class="border-b border-primary pl-2.5 pr-1.5 py-4">
            <h2 class="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 text-lg font-semibold">
              <div class="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
                <span class="shrink-0 text-success">Income</span>
                <span v-if="!loading" class="text-xs font-normal text-base-content">
                  Total Income: ${{ formatAmount(totalIncome.monthly) }}/mo
                </span>
                <span v-if="!loading" class="text-xs font-normal text-base-content">
                  Net Income: ${{ formatAmount(netIncome.monthly) }}/mo
                </span>
              </div>
              <button
                type="button"
                class="btn btn-ghost btn-sm h-auto min-h-0 shrink-0 gap-2 py-1.5 pl-1 pr-2 font-medium normal-case text-base-content hover:bg-base-200"
                @click="openAddBudgetModal('income')"
              >
                <span class="flex size-[1.05rem] shrink-0 items-center justify-center rounded-full bg-primary text-primary-content">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="size-[0.525rem] shrink-0" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </span>
                Add Income
              </button>
            </h2>
          </div>
          <div class="pl-2.5 pr-1.5 py-4 pb-6">
          <div v-if="loading" class="text-sm text-base-content/70">Loading...</div>
          <template v-else>
            <div v-if="incomeGroupedByCategory.length" class="space-y-8">
              <div
                v-for="group in incomeGroupedByCategory"
                :key="`income-cat-${group.category}`"
              >
                <ul
                  role="list"
                  class="divide-y divide-gray-100 rounded-md bg-white shadow-sm ring-1 ring-gray-900/5 dark:divide-white/5 dark:bg-gray-900/50 dark:shadow-none dark:ring-white/10"
                >
                  <li
                    v-for="item in group.items"
                    :key="`income-${item.id}`"
                    class="flex items-center justify-between gap-x-6 pl-2 pr-1 py-5 sm:pl-2.5 sm:pr-1.5"
                  >
                    <div class="min-w-0">
                      <div class="flex flex-wrap items-start gap-x-3 gap-y-1">
                        <p class="text-sm/6 font-semibold text-gray-900 dark:text-white">
                          {{ item.sub_category || "—" }}
                        </p>
                        <p
                          class="mt-0.5 shrink-0 rounded-md bg-gray-50 px-1.5 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20"
                        >
                          {{ group.category }}
                        </p>
                      </div>
                      <div class="mt-1 flex items-center gap-x-2 text-xs/5 text-gray-500 dark:text-gray-400">
                        <p
                          class="whitespace-nowrap font-medium"
                          :class="item.income_type === 'deduction' ? 'text-gray-700 dark:text-gray-300' : 'text-primary dark:text-blue-400'"
                        >
                          {{ item.income_type === "deduction" ? "-" : "" }}${{ formatAmount(item.monthly_amount) }}/mo
                        </p>
                        <svg viewBox="0 0 2 2" class="size-0.5 shrink-0 fill-current" aria-hidden="true">
                          <circle cx="1" cy="1" r="1" />
                        </svg>
                        <p class="truncate">{{ item.description?.trim() || "—" }}</p>
                      </div>
                    </div>
                    <div class="flex flex-none items-center gap-x-4">
                      <HeadlessMenu as="div" class="relative flex-none">
                        <HeadlessMenuButton
                          class="budget-row-menu__trigger relative block rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
                        >
                          <span class="sr-only">Open options</span>
                          <EllipsisVerticalIcon class="size-5" aria-hidden="true" />
                        </HeadlessMenuButton>
                        <transition
                          enter-active-class="transition ease-out duration-100"
                          enter-from-class="transform scale-95 opacity-0"
                          enter-to-class="transform scale-100 opacity-100"
                          leave-active-class="transition ease-in duration-75"
                          leave-from-class="transform scale-100 opacity-100"
                          leave-to-class="transform scale-95 opacity-0"
                        >
                          <HeadlessMenuItems
                            class="budget-row-menu absolute right-0 z-10 mt-2 w-44 origin-top-right focus:outline-none"
                          >
                            <div class="budget-row-menu__list">
                            <HeadlessMenuItem v-slot="{ active }" class="w-full">
                              <button
                                type="button"
                                class="budget-row-menu__item"
                                :class="{ 'budget-row-menu__item--active': active }"
                                @click="openEdit(item, 'income')"
                              >
                                Edit<span class="sr-only">, {{ item.sub_category || item.category }}</span>
                              </button>
                            </HeadlessMenuItem>
                            <HeadlessMenuItem v-slot="{ active }" class="w-full">
                              <button
                                type="button"
                                class="budget-row-menu__item budget-row-menu__item--danger"
                                :class="{ 'budget-row-menu__item--active': active }"
                                @click="confirmDelete(item, 'income')"
                              >
                                Delete<span class="sr-only">, {{ item.sub_category || item.category }}</span>
                              </button>
                            </HeadlessMenuItem>
                          </div>

                          </HeadlessMenuItems>
                        </transition>
                      </HeadlessMenu>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
            <p v-else class="text-sm text-base-content/50 italic">No income items yet. Use Add Income above.</p>
          </template>
          </div>
        </div>

        <!-- Investments -->
        <div class="w-full overflow-hidden rounded-lg border border-primary bg-transparent">
          <div class="border-b border-primary pl-2.5 pr-1.5 py-4">
            <h2 class="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 text-lg font-semibold">
              <div class="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
                <span class="shrink-0 text-accent">Investments</span>
                <span v-if="!loading" class="text-xs font-normal text-base-content">
                  Total: ${{ formatAmount(investmentsBudgetTotals.monthly) }}/mo
                </span>
              </div>
              <button
                type="button"
                class="btn btn-ghost btn-sm h-auto min-h-0 shrink-0 gap-2 py-1.5 pl-1 pr-2 font-medium normal-case text-base-content hover:bg-base-200"
                @click="openAddBudgetModal('investment')"
              >
                <span class="flex size-[1.05rem] shrink-0 items-center justify-center rounded-full bg-primary text-primary-content">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="size-[0.525rem] shrink-0" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </span>
                Add Investments
              </button>
            </h2>
          </div>
          <div class="pl-2.5 pr-1.5 py-4 pb-6">
            <div v-if="loading" class="text-sm text-base-content/70">Loading...</div>
            <template v-else>
              <div v-if="investmentsGroupedByCategory.length" class="space-y-8">
                <div
                  v-for="group in investmentsGroupedByCategory"
                  :key="`inv-cat-${group.category}`"
                >
                  <ul
                    role="list"
                    class="divide-y divide-gray-100 rounded-md bg-white shadow-sm ring-1 ring-gray-900/5 dark:divide-white/5 dark:bg-gray-900/50 dark:shadow-none dark:ring-white/10"
                  >
                    <li
                      v-for="item in group.items"
                      :key="`inv-${item.id}`"
                      class="flex items-center justify-between gap-x-6 pl-2 pr-1 py-5 sm:pl-2.5 sm:pr-1.5"
                    >
                      <div class="min-w-0">
                        <div class="flex flex-wrap items-start gap-x-3 gap-y-1">
                          <p class="text-sm/6 font-semibold text-gray-900 dark:text-white">
                            {{ item.sub_category || "—" }}
                          </p>
                          <p
                            class="mt-0.5 shrink-0 rounded-md bg-gray-50 px-1.5 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20"
                          >
                            {{ group.category }}
                          </p>
                        </div>
                        <div class="mt-1 flex items-center gap-x-2 text-xs/5 text-gray-500 dark:text-gray-400">
                          <p class="whitespace-nowrap text-secondary">
                            ${{ formatAmount(item.monthly_amount) }}/mo
                          </p>
                          <svg viewBox="0 0 2 2" class="size-0.5 shrink-0 fill-current" aria-hidden="true">
                            <circle cx="1" cy="1" r="1" />
                          </svg>
                          <p class="truncate">{{ item.description?.trim() || "—" }}</p>
                        </div>
                      </div>
                      <div class="flex flex-none items-center gap-x-4">
                        <HeadlessMenu as="div" class="relative flex-none">
                          <HeadlessMenuButton
                            class="budget-row-menu__trigger relative block rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
                          >
                            <span class="sr-only">Open options</span>
                            <EllipsisVerticalIcon class="size-5" aria-hidden="true" />
                          </HeadlessMenuButton>
                          <transition
                            enter-active-class="transition ease-out duration-100"
                            enter-from-class="transform scale-95 opacity-0"
                            enter-to-class="transform scale-100 opacity-100"
                            leave-active-class="transition ease-in duration-75"
                            leave-from-class="transform scale-100 opacity-100"
                            leave-to-class="transform scale-95 opacity-0"
                          >
                            <HeadlessMenuItems
                              class="budget-row-menu absolute right-0 z-10 mt-2 w-44 origin-top-right focus:outline-none"
                            >
                              <div class="budget-row-menu__list">
                              <HeadlessMenuItem v-slot="{ active }" class="w-full">
                                <button
                                  type="button"
                                  class="budget-row-menu__item" :class="{ 'budget-row-menu__item--active': active }"
                                  @click="openEdit(item, 'expense')"
                                >
                                  Edit<span class="sr-only">, {{ item.sub_category || item.category }}</span>
                                </button>
                              </HeadlessMenuItem>
                              <HeadlessMenuItem v-slot="{ active }" class="w-full">
                                <button
                                  type="button"
                                  class="budget-row-menu__item budget-row-menu__item--danger" :class="{ 'budget-row-menu__item--active': active }" @click="confirmDelete(item, 'expense')"
                                >
                                  Delete<span class="sr-only">, {{ item.sub_category || item.category }}</span>
                                </button>
                              </HeadlessMenuItem>
                            </div>

                            </HeadlessMenuItems>
                          </transition>
                        </HeadlessMenu>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
              <p v-else class="text-sm text-base-content/50 italic">No investment items yet. Use Add Investments above.</p>
            </template>
          </div>
        </div>

        <!-- Savings -->
        <div class="w-full overflow-hidden rounded-lg border border-primary bg-transparent">
          <div class="border-b border-primary pl-2.5 pr-1.5 py-4">
            <h2 class="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 text-lg font-semibold">
              <div class="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
                <span class="shrink-0 text-info">Savings</span>
                <span v-if="!loading" class="text-xs font-normal text-base-content">
                  Total: ${{ formatAmount(savingsBudgetTotals.monthly) }}/mo
                </span>
              </div>
              <button
                type="button"
                class="btn btn-ghost btn-sm h-auto min-h-0 shrink-0 gap-2 py-1.5 pl-1 pr-2 font-medium normal-case text-base-content hover:bg-base-200"
                @click="openAddBudgetModal('savings')"
              >
                <span class="flex size-[1.05rem] shrink-0 items-center justify-center rounded-full bg-primary text-primary-content">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="size-[0.525rem] shrink-0" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </span>
                Add Savings
              </button>
            </h2>
          </div>
          <div class="pl-2.5 pr-1.5 py-4 pb-6">
            <div v-if="loading" class="text-sm text-base-content/70">Loading...</div>
            <template v-else>
              <div v-if="savingsGroupedByCategory.length" class="space-y-8">
                <div
                  v-for="group in savingsGroupedByCategory"
                  :key="`savings-cat-${group.category}`"
                >
                  <ul
                    role="list"
                    class="divide-y divide-gray-100 rounded-md bg-white shadow-sm ring-1 ring-gray-900/5 dark:divide-white/5 dark:bg-gray-900/50 dark:shadow-none dark:ring-white/10"
                  >
                    <li
                      v-for="item in group.items"
                      :key="`savings-${item.id}`"
                      class="flex items-center justify-between gap-x-6 pl-2 pr-1 py-5 sm:pl-2.5 sm:pr-1.5"
                    >
                      <div class="min-w-0">
                        <div class="flex flex-wrap items-start gap-x-3 gap-y-1">
                          <p class="text-sm/6 font-semibold text-gray-900 dark:text-white">
                            {{ item.sub_category || "—" }}
                          </p>
                          <p
                            class="mt-0.5 shrink-0 rounded-md bg-gray-50 px-1.5 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20"
                          >
                            {{ group.category }}
                          </p>
                        </div>
                        <div class="mt-1 flex items-center gap-x-2 text-xs/5 text-gray-500 dark:text-gray-400">
                          <p class="whitespace-nowrap text-secondary">
                            ${{ formatAmount(item.monthly_amount) }}/mo
                          </p>
                          <svg viewBox="0 0 2 2" class="size-0.5 shrink-0 fill-current" aria-hidden="true">
                            <circle cx="1" cy="1" r="1" />
                          </svg>
                          <p class="truncate">{{ item.description?.trim() || "—" }}</p>
                        </div>
                      </div>
                      <div class="flex flex-none items-center gap-x-4">
                        <HeadlessMenu as="div" class="relative flex-none">
                          <HeadlessMenuButton
                            class="budget-row-menu__trigger relative block rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
                          >
                            <span class="sr-only">Open options</span>
                            <EllipsisVerticalIcon class="size-5" aria-hidden="true" />
                          </HeadlessMenuButton>
                          <transition
                            enter-active-class="transition ease-out duration-100"
                            enter-from-class="transform scale-95 opacity-0"
                            enter-to-class="transform scale-100 opacity-100"
                            leave-active-class="transition ease-in duration-75"
                            leave-from-class="transform scale-100 opacity-100"
                            leave-to-class="transform scale-95 opacity-0"
                          >
                            <HeadlessMenuItems
                              class="budget-row-menu absolute right-0 z-10 mt-2 w-44 origin-top-right focus:outline-none"
                            >
                              <div class="budget-row-menu__list">
                              <HeadlessMenuItem v-slot="{ active }" class="w-full">
                                <button
                                  type="button"
                                  class="budget-row-menu__item" :class="{ 'budget-row-menu__item--active': active }"
                                  @click="openEdit(item, 'expense')"
                                >
                                  Edit<span class="sr-only">, {{ item.sub_category || item.category }}</span>
                                </button>
                              </HeadlessMenuItem>
                              <HeadlessMenuItem v-slot="{ active }" class="w-full">
                                <button
                                  type="button"
                                  class="budget-row-menu__item budget-row-menu__item--danger" :class="{ 'budget-row-menu__item--active': active }" @click="confirmDelete(item, 'expense')"
                                >
                                  Delete<span class="sr-only">, {{ item.sub_category || item.category }}</span>
                                </button>
                              </HeadlessMenuItem>
                            </div>

                            </HeadlessMenuItems>
                          </transition>
                        </HeadlessMenu>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
              <p v-else class="text-sm text-base-content/50 italic">No savings items yet. Use Add Savings above.</p>
            </template>
          </div>
        </div>

        <!-- Tax -->
        <div class="w-full overflow-hidden rounded-lg border border-primary bg-transparent">
          <div class="border-b border-primary pl-2.5 pr-1.5 py-4">
            <h2 class="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 text-lg font-semibold">
              <div class="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
                <span class="shrink-0 text-warning">Tax</span>
                <span v-if="!loading" class="text-xs font-normal text-base-content">
                  Total: ${{ formatAmount(totals.tax.monthly) }}/mo
                </span>
              </div>
              <button
                type="button"
                class="btn btn-ghost btn-sm h-auto min-h-0 shrink-0 gap-2 py-1.5 pl-1 pr-2 font-medium normal-case text-base-content hover:bg-base-200"
                @click="openAddBudgetModal('tax')"
              >
                <span class="flex size-[1.05rem] shrink-0 items-center justify-center rounded-full bg-primary text-primary-content">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="size-[0.525rem] shrink-0" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </span>
                Add Tax
              </button>
            </h2>
          </div>
          <div class="pl-2.5 pr-1.5 py-4 pb-6">
            <div v-if="loading" class="text-sm text-base-content/70">Loading...</div>
            <template v-else>
              <div v-if="taxGroupedByCategory.length" class="space-y-8">
                <div
                  v-for="group in taxGroupedByCategory"
                  :key="`tax-cat-${group.category}`"
                >
                  <ul
                    role="list"
                    class="divide-y divide-gray-100 rounded-md bg-white shadow-sm ring-1 ring-gray-900/5 dark:divide-white/5 dark:bg-gray-900/50 dark:shadow-none dark:ring-white/10"
                  >
                    <li
                      v-for="item in group.items"
                      :key="`tax-${item.id}`"
                      class="flex items-center justify-between gap-x-6 pl-2 pr-1 py-5 sm:pl-2.5 sm:pr-1.5"
                    >
                      <div class="min-w-0">
                        <div class="flex flex-wrap items-start gap-x-3 gap-y-1">
                          <p class="text-sm/6 font-semibold text-gray-900 dark:text-white">
                            {{ item.sub_category || "—" }}
                          </p>
                          <p
                            class="mt-0.5 shrink-0 rounded-md bg-gray-50 px-1.5 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20"
                          >
                            {{ group.category }}
                          </p>
                        </div>
                        <div class="mt-1 flex items-center gap-x-2 text-xs/5 text-gray-500 dark:text-gray-400">
                          <p class="whitespace-nowrap text-secondary">-${{ formatAmount(item.monthly_amount) }}/mo</p>
                          <svg viewBox="0 0 2 2" class="size-0.5 shrink-0 fill-current" aria-hidden="true">
                            <circle cx="1" cy="1" r="1" />
                          </svg>
                          <p class="truncate">{{ item.description?.trim() || "—" }}</p>
                        </div>
                      </div>
                      <div class="flex flex-none items-center gap-x-4">
                        <HeadlessMenu as="div" class="relative flex-none">
                          <HeadlessMenuButton
                            class="budget-row-menu__trigger relative block rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
                          >
                            <span class="sr-only">Open options</span>
                            <EllipsisVerticalIcon class="size-5" aria-hidden="true" />
                          </HeadlessMenuButton>
                          <transition
                            enter-active-class="transition ease-out duration-100"
                            enter-from-class="transform scale-95 opacity-0"
                            enter-to-class="transform scale-100 opacity-100"
                            leave-active-class="transition ease-in duration-75"
                            leave-from-class="transform scale-100 opacity-100"
                            leave-to-class="transform scale-95 opacity-0"
                          >
                            <HeadlessMenuItems
                              class="budget-row-menu absolute right-0 z-10 mt-2 w-44 origin-top-right focus:outline-none"
                            >
                              <div class="budget-row-menu__list">
                              <HeadlessMenuItem v-slot="{ active }" class="w-full">
                                <button
                                  type="button"
                                  class="budget-row-menu__item" :class="{ 'budget-row-menu__item--active': active }"
                                  @click="openEdit(item, 'income')"
                                >
                                  Edit<span class="sr-only">, {{ item.sub_category || item.category }}</span>
                                </button>
                              </HeadlessMenuItem>
                              <HeadlessMenuItem v-slot="{ active }" class="w-full">
                                <button
                                  type="button"
                                  class="budget-row-menu__item budget-row-menu__item--danger" :class="{ 'budget-row-menu__item--active': active }" @click="confirmDelete(item, 'income')"
                                >
                                  Delete<span class="sr-only">, {{ item.sub_category || item.category }}</span>
                                </button>
                              </HeadlessMenuItem>
                            </div>

                            </HeadlessMenuItems>
                          </transition>
                        </HeadlessMenu>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
              <p v-else class="text-sm text-base-content/50 italic">No tax items yet. Use Add Tax above.</p>
            </template>
          </div>
        </div>

        <!-- Insurance (income_type deduction) -->
        <div class="w-full overflow-hidden rounded-lg border border-primary bg-transparent">
          <div class="border-b border-primary pl-2.5 pr-1.5 py-4">
            <h2 class="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 text-lg font-semibold">
              <div class="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
                <span class="shrink-0">Insurance</span>
                <span v-if="!loading" class="text-xs font-normal text-base-content">
                  Total: ${{ formatAmount(totals.deduction.monthly) }}/mo
                </span>
              </div>
              <button
                type="button"
                class="btn btn-ghost btn-sm h-auto min-h-0 shrink-0 gap-2 py-1.5 pl-1 pr-2 font-medium normal-case text-base-content hover:bg-base-200"
                @click="openAddBudgetModal('insurance')"
              >
                <span class="flex size-[1.05rem] shrink-0 items-center justify-center rounded-full bg-primary text-primary-content">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="size-[0.525rem] shrink-0" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </span>
                Add Insurance
              </button>
            </h2>
          </div>
          <div class="pl-2.5 pr-1.5 py-4 pb-6">
            <div v-if="loading" class="text-sm text-base-content/70">Loading...</div>
            <template v-else>
              <div v-if="insuranceGroupedByCategory.length" class="space-y-8">
                <div
                  v-for="group in insuranceGroupedByCategory"
                  :key="`ins-cat-${group.category}`"
                >
                  <ul
                    role="list"
                    class="divide-y divide-gray-100 rounded-md bg-white shadow-sm ring-1 ring-gray-900/5 dark:divide-white/5 dark:bg-gray-900/50 dark:shadow-none dark:ring-white/10"
                  >
                    <li
                      v-for="item in group.items"
                      :key="`ins-${item.id}`"
                      class="flex items-center justify-between gap-x-6 pl-2 pr-1 py-5 sm:pl-2.5 sm:pr-1.5"
                    >
                      <div class="min-w-0">
                        <div class="flex flex-wrap items-start gap-x-3 gap-y-1">
                          <p class="text-sm/6 font-semibold text-gray-900 dark:text-white">
                            {{ item.sub_category || "—" }}
                          </p>
                          <p
                            class="mt-0.5 shrink-0 rounded-md bg-gray-50 px-1.5 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20"
                          >
                            {{ group.category }}
                          </p>
                        </div>
                        <div class="mt-1 flex items-center gap-x-2 text-xs/5 text-gray-500 dark:text-gray-400">
                          <p class="whitespace-nowrap text-secondary">-${{ formatAmount(item.monthly_amount) }}/mo</p>
                          <svg viewBox="0 0 2 2" class="size-0.5 shrink-0 fill-current" aria-hidden="true">
                            <circle cx="1" cy="1" r="1" />
                          </svg>
                          <p class="truncate">{{ item.description?.trim() || "—" }}</p>
                        </div>
                      </div>
                      <div class="flex flex-none items-center gap-x-4">
                        <HeadlessMenu as="div" class="relative flex-none">
                          <HeadlessMenuButton
                            class="budget-row-menu__trigger relative block rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
                          >
                            <span class="sr-only">Open options</span>
                            <EllipsisVerticalIcon class="size-5" aria-hidden="true" />
                          </HeadlessMenuButton>
                          <transition
                            enter-active-class="transition ease-out duration-100"
                            enter-from-class="transform scale-95 opacity-0"
                            enter-to-class="transform scale-100 opacity-100"
                            leave-active-class="transition ease-in duration-75"
                            leave-from-class="transform scale-100 opacity-100"
                            leave-to-class="transform scale-95 opacity-0"
                          >
                            <HeadlessMenuItems
                              class="budget-row-menu absolute right-0 z-10 mt-2 w-44 origin-top-right focus:outline-none"
                            >
                              <div class="budget-row-menu__list">
                              <HeadlessMenuItem v-slot="{ active }" class="w-full">
                                <button
                                  type="button"
                                  class="budget-row-menu__item" :class="{ 'budget-row-menu__item--active': active }"
                                  @click="openEdit(item, 'income')"
                                >
                                  Edit<span class="sr-only">, {{ item.sub_category || item.category }}</span>
                                </button>
                              </HeadlessMenuItem>
                              <HeadlessMenuItem v-slot="{ active }" class="w-full">
                                <button
                                  type="button"
                                  class="budget-row-menu__item budget-row-menu__item--danger" :class="{ 'budget-row-menu__item--active': active }" @click="confirmDelete(item, 'income')"
                                >
                                  Delete<span class="sr-only">, {{ item.sub_category || item.category }}</span>
                                </button>
                              </HeadlessMenuItem>
                            </div>

                            </HeadlessMenuItems>
                          </transition>
                        </HeadlessMenu>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
              <p v-else class="text-sm text-base-content/50 italic">No insurance items yet. Use Add Insurance above.</p>
            </template>
          </div>
        </div>
      </div>

      <!-- Edit Modal -->
      <dialog ref="editDialogRef" class="modal">
        <div class="modal-box max-h-[90vh] max-w-lg overflow-y-auto">
          <h3 class="font-semibold text-lg mb-5">Edit Budget Item</h3>
          <form v-if="editingItem" @submit.prevent="saveEdit" class="space-y-5">
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label v-if="editingItem._type === 'income'" class="form-control w-full">
                <span class="label-text text-sm">Type</span>
                <select v-model="editForm.income_type" class="select select-bordered w-full">
                  <option value="gross">Income</option>
                  <option value="deduction">Insurance</option>
                  <option value="tax">Tax</option>
                  <option value="interest">Interest</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label v-else-if="editingItem._type === 'expense'" class="form-control w-full">
                <span class="label-text text-sm">Type</span>
                <select v-model="editForm.expense_type" class="select select-bordered w-full">
                  <option value="expense">Expense</option>
                  <option value="savings">Savings</option>
                  <option value="investment">Investments</option>
                </select>
              </label>
              <label class="form-control w-full">
                <span class="label-text text-sm">Category</span>
                <input
                  v-model.trim="editForm.category"
                  class="input input-bordered w-full"
                  type="text"
                  required
                />
              </label>
            </div>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label class="form-control w-full">
                <span class="label-text text-sm">Sub-category</span>
                <input
                  v-model.trim="editForm.sub_category"
                  class="input input-bordered w-full"
                  type="text"
                />
              </label>
              <label v-if="editingItem._type !== 'expense' || (editForm.expense_type !== 'savings' && editForm.expense_type !== 'investment')" class="form-control w-full">
                <span class="label-text text-sm">Description</span>
                <input
                  v-model.trim="editForm.description"
                  class="input input-bordered w-full"
                  type="text"
                />
              </label>
              <label
                v-if="editingItem._type === 'expense' && editForm.expense_type === 'expense'"
                class="form-control w-full md:col-span-2"
              >
                <span class="label-text text-sm">
                  Estate Management debt
                  <span v-if="editNeedsDebtLink" class="text-error">*</span>
                </span>
                <select
                  v-model="editForm.debt_id"
                  class="select select-bordered w-full"
                  :required="editNeedsDebtLink"
                >
                  <option value="">
                    {{ debtRecords.length ? "Select debt record…" : "No debt records — add in Estate Management" }}
                  </option>
                  <option v-for="row in debtRecords" :key="`edit-debt-${row.dbt_id}`" :value="String(row.dbt_id)">
                    {{ formatDebtRecordLabel(row) }}
                  </option>
                </select>
              </label>
              <template v-else>
                <label class="form-control w-full">
                  <span class="label-text text-sm">From Account</span>
                  <select v-model="editForm.from_cash_investment_id" class="select select-bordered w-full">
                    <option value="">None</option>
                    <option v-for="acct in cashAccounts" :key="`edit-from-${acct.ci_id}`" :value="String(acct.ci_id)">
                      {{ [acct.institution, acct.acct_type].filter(Boolean).join(" — ") || `Account #${acct.ci_id}` }}
                    </option>
                  </select>
                </label>
                <label class="form-control w-full">
                  <span class="label-text text-sm">To Account</span>
                  <select v-model="editForm.cash_investment_id" class="select select-bordered w-full">
                    <option value="">None</option>
                    <option v-for="acct in cashAccounts" :key="`edit-to-${acct.ci_id}`" :value="String(acct.ci_id)">
                      {{ [acct.institution, acct.acct_type].filter(Boolean).join(" — ") || `Account #${acct.ci_id}` }}
                    </option>
                  </select>
                </label>
              </template>
            </div>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label class="form-control w-full">
                <span class="label-text text-sm">Monthly Amount</span>
                <input
                  v-model.number="editForm.monthly_amount"
                  class="input input-bordered w-full"
                  type="number"
                  min="0"
                  step="0.01"
                  @input="syncEditAnnualFromMonthly"
                />
              </label>
              <label class="form-control w-full">
                <span class="label-text text-sm">Annual Total</span>
                <input
                  v-model.number="editForm.annual_amount"
                  class="input input-bordered w-full"
                  type="number"
                  min="0"
                  step="0.01"
                  @input="syncEditMonthlyFromAnnual"
                />
              </label>
            </div>
            <div v-if="editError" class="text-sm text-error">{{ editError }}</div>
            <div class="modal-action flex-wrap gap-2 mt-2">
              <button type="button" class="btn btn-ghost" @click="editDialogRef?.close()">Cancel</button>
              <button type="submit" class="btn btn-primary" :disabled="saving">
                {{ saving ? "Saving..." : "Save" }}
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      <!-- Delete Confirm Modal -->
      <dialog ref="deleteDialogRef" class="modal">
        <div class="modal-box">
          <h3 class="font-semibold text-lg mb-2">Delete Budget Item?</h3>
          <p v-if="deletingItem" class="text-sm text-base-content/70 mb-4">
            Remove "{{ deletingItem.category }}{{ deletingItem.sub_category ? ' › ' + deletingItem.sub_category : '' }}"?
          </p>
          <div class="modal-action">
            <button type="button" class="btn btn-ghost" @click="deleteDialogRef?.close()">Cancel</button>
            <button
              type="button"
              class="btn btn-error"
              :disabled="deleting"
              @click="performDelete"
            >
              {{ deleting ? "Deleting..." : "Delete" }}
            </button>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </div>
  </section>
</template>

<script setup>
import { EllipsisVerticalIcon } from "@heroicons/vue/20/solid";
import {
  budgetExpenseNeedsDebtLink,
  formatDebtRecordLabel,
} from "~/utils/budgetDebt";
import { isNetIncomeBudgetLine } from "~/utils/budgetChart";
import {
  buildGrossAllocatableLines,
  computeNetFromGross,
  findNetIncomeBudgetLine,
  getPositiveGrossAllocations,
  grossAllocationKey,
  partitionSavingsInvestmentForGrossAlloc,
  sumGrossAllocationAmounts,
} from "~/utils/grossIncomeAllocation";

const auth = useAuthStore();
const addBudgetDialogRef = ref(null);
const editDialogRef = ref(null);
const deleteDialogRef = ref(null);
const budgets = ref({ income: [], expenses: [] });
const loading = ref(true);
const loadError = ref("");
const submitting = ref(false);
const saving = ref(false);
const deleting = ref(false);
const submitError = ref("");
const editError = ref("");
const editingItem = ref(null);
const deletingItem = ref(null);

const cashAccounts = ref([]);
const debtRecords = ref([]);

const grossAllocationAmounts = ref({});

const form = ref({
  type: "income",
  category: "",
  sub_category: "",
  description: "",
  debt_id: "",
  from_cash_investment_id: "",
  cash_investment_id: "",
  monthly_amount: null,
  annual_amount: null,
});

const editForm = ref({
  income_type: "gross",
  expense_type: "expense",
  category: "",
  sub_category: "",
  description: "",
  debt_id: "",
  from_cash_investment_id: "",
  cash_investment_id: "",
  monthly_amount: null,
  annual_amount: null,
});

const addNeedsDebtLink = computed(() =>
  form.value.type === "expense" &&
  budgetExpenseNeedsDebtLink(form.value.category, form.value.sub_category, form.value.description),
);

const editNeedsDebtLink = computed(() => {
  if (!editingItem.value || editingItem.value._type !== "expense") return false;
  if (editForm.value.expense_type !== "expense") return false;
  return budgetExpenseNeedsDebtLink(
    editForm.value.category,
    editForm.value.sub_category,
    editForm.value.description,
  );
});

function debtLabelForBudgetItem(item) {
  if (!item?.debt_id) return null;
  const row = debtRecords.value.find((r) => String(r.dbt_id) === String(item.debt_id));
  return row ? formatDebtRecordLabel(row) : null;
}

/** Add-form Type dropdown: maps to income (gross/tax/deduction) or expense rows on submit */
const budgetTypeOptions = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "insurance", label: "Insurance" },
  { value: "investment", label: "Investments" },
  { value: "savings", label: "Savings" },
  { value: "tax", label: "Tax" },
];

const addBudgetModalTitle = computed(() => {
  const opt = budgetTypeOptions.find((o) => o.value === form.value.type);
  if (form.value.type === "income") return "Add Gross Income";
  return opt ? `Add ${opt.label}` : "Add Budget Item";
});

function isIncomeBudgetFormType(t) {
  return t === "income" || t === "tax" || t === "insurance";
}

function incomeTypeForBudgetFormType(t) {
  if (t === "income") return "gross";
  if (t === "tax") return "tax";
  if (t === "insurance") return "deduction";
  return undefined;
}

const addCategoryPlaceholder = computed(() => {
  switch (form.value.type) {
    case "tax":
      return "e.g. Federal, State, FICA";
    case "insurance":
      return "e.g. Health, Dental, Life";
    case "expense":
      return "e.g. Housing, Transportation";
    case "savings":
      return "e.g. Emergency Fund, Vacation";
    case "investment":
      return "e.g. Brokerage, IRA";
    default:
      return "e.g. Salary, Wages";
  }
});

const incomeByType = computed(() => {
  const income = budgets.value.income ?? [];
  return {
    gross: income.filter((i) => (i.income_type || "gross") === "gross" && !isNetIncomeBudgetLine(i)),
    interest: income.filter((i) => i.income_type === "interest"),
    other: income.filter((i) => i.income_type === "other"),
    tax: income.filter((i) => i.income_type === "tax"),
    deduction: income.filter((i) => i.income_type === "deduction"),
  };
});

function sumAmounts(items, field) {
  return (items ?? []).reduce((acc, i) => acc + (Number(i[field]) || 0), 0);
}

const totals = computed(() => ({
  gross: {
    monthly: sumAmounts(incomeByType.value.gross, "monthly_amount"),
    annual: sumAmounts(incomeByType.value.gross, "annual_amount"),
  },
  interest: {
    monthly: sumAmounts(incomeByType.value.interest, "monthly_amount"),
    annual: sumAmounts(incomeByType.value.interest, "annual_amount"),
  },
  other: {
    monthly: sumAmounts(incomeByType.value.other, "monthly_amount"),
    annual: sumAmounts(incomeByType.value.other, "annual_amount"),
  },
  tax: {
    monthly: sumAmounts(incomeByType.value.tax, "monthly_amount"),
    annual: sumAmounts(incomeByType.value.tax, "annual_amount"),
  },
  deduction: {
    monthly: sumAmounts(incomeByType.value.deduction, "monthly_amount"),
    annual: sumAmounts(incomeByType.value.deduction, "annual_amount"),
  },
}));

/** Total Income = Gross Income + Interest + Other (excludes tax/deduction) */
const totalIncome = computed(() => ({
  monthly: totals.value.gross.monthly + totals.value.interest.monthly + totals.value.other.monthly,
  annual: totals.value.gross.annual + totals.value.interest.annual + totals.value.other.annual,
}));

/** Match deduction by category/sub_category (case-insensitive) */
function matchDeduction(items, patterns) {
  const match = (text) => {
    const t = (text || "").toLowerCase();
    return patterns.some((p) => t.includes(p));
  };
  return (items ?? []).filter(
    (i) => match(i.category) || match(i.sub_category),
  );
}

/** Net Income = Income + Interest - Family Insurance - Supplemental Life Insurance - Savings - Taxes */
const netIncome = computed(() => {
  const deductions = incomeByType.value.deduction;
  const familyInsurance = matchDeduction(deductions, ["family insurance", "family health", "health insurance"]);
  const supplementalLife = matchDeduction(deductions, ["supplemental life", "supplemental life insurance"]);
  const savingsItems = (budgets.value.expenses ?? []).filter((e) => e.expense_type === "savings");

  const familyInsuranceMonthly = sumAmounts(familyInsurance, "monthly_amount");
  const familyInsuranceAnnual = sumAmounts(familyInsurance, "annual_amount");
  const supplementalLifeMonthly = sumAmounts(supplementalLife, "monthly_amount");
  const supplementalLifeAnnual = sumAmounts(supplementalLife, "annual_amount");
  const savingsMonthly = sumAmounts(savingsItems, "monthly_amount");
  const savingsAnnual = sumAmounts(savingsItems, "annual_amount");

  return {
    monthly:
      totalIncome.value.monthly -
      familyInsuranceMonthly -
      supplementalLifeMonthly -
      savingsMonthly -
      totals.value.tax.monthly,
    annual:
      totalIncome.value.annual -
      familyInsuranceAnnual -
      supplementalLifeAnnual -
      savingsAnnual -
      totals.value.tax.annual,
  };
});

function groupBudgetByCategory(items) {
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

/** Income section: gross, interest, other (not tax or insurance/deduction) */
const incomeGroupedByCategory = computed(() =>
  groupBudgetByCategory(
    (budgets.value.income ?? []).filter(
      (i) => i.income_type !== "tax" && i.income_type !== "deduction",
    ),
  ),
);

const taxGroupedByCategory = computed(() =>
  groupBudgetByCategory((budgets.value.income ?? []).filter((i) => i.income_type === "tax")),
);

/** Insurance budget lines (income_type deduction) */
const insuranceGroupedByCategory = computed(() =>
  groupBudgetByCategory((budgets.value.income ?? []).filter((i) => i.income_type === "deduction")),
);

/** Expenses panel: expense_type expense only */
const expensesGroupedByCategory = computed(() =>
  groupBudgetByCategory(
    (budgets.value.expenses ?? []).filter((e) => (e.expense_type || "expense") === "expense"),
  ),
);

const savingsGroupedByCategory = computed(() =>
  groupBudgetByCategory((budgets.value.expenses ?? []).filter((e) => e.expense_type === "savings")),
);

const investmentsGroupedByCategory = computed(() =>
  groupBudgetByCategory((budgets.value.expenses ?? []).filter((e) => e.expense_type === "investment")),
);

const expenseTypeOnlyTotals = computed(() => {
  const items = (budgets.value.expenses ?? []).filter((e) => (e.expense_type || "expense") === "expense");
  return {
    monthly: sumAmounts(items, "monthly_amount"),
    annual: sumAmounts(items, "annual_amount"),
  };
});

const savingsBudgetTotals = computed(() => {
  const items = (budgets.value.expenses ?? []).filter((e) => e.expense_type === "savings");
  return {
    monthly: sumAmounts(items, "monthly_amount"),
    annual: sumAmounts(items, "annual_amount"),
  };
});

const investmentsBudgetTotals = computed(() => {
  const items = (budgets.value.expenses ?? []).filter((e) => e.expense_type === "investment");
  return {
    monthly: sumAmounts(items, "monthly_amount"),
    annual: sumAmounts(items, "annual_amount"),
  };
});

const grossAllocExpensePartition = computed(() =>
  partitionSavingsInvestmentForGrossAlloc(
    savingsGroupedByCategory.value,
    investmentsGroupedByCategory.value,
  ),
);

const grossIncomeAllocatableLines = computed(() =>
  buildGrossAllocatableLines(
    taxGroupedByCategory.value,
    insuranceGroupedByCategory.value,
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

const grossIncomeNetMonthly = computed(() =>
  computeNetFromGross(form.value.monthly_amount, grossIncomeAllocatedTotal.value),
);

function formatAmount(val) {
  if (val == null || val === "" || isNaN(val)) return "0.00";
  return Number(val).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function syncAnnualFromMonthly() {
  const m = form.value.monthly_amount;
  if (m != null && !isNaN(m)) {
    form.value.annual_amount = Math.round(m * 12 * 100) / 100;
  }
}

function syncMonthlyFromAnnual() {
  const a = form.value.annual_amount;
  if (a != null && !isNaN(a)) {
    form.value.monthly_amount = Math.round((a / 12) * 100) / 100;
  }
}

function syncEditAnnualFromMonthly() {
  const m = editForm.value.monthly_amount;
  if (m != null && !isNaN(m)) {
    editForm.value.annual_amount = Math.round(m * 12 * 100) / 100;
  }
}

function syncEditMonthlyFromAnnual() {
  const a = editForm.value.annual_amount;
  if (a != null && !isNaN(a)) {
    editForm.value.monthly_amount = Math.round((a / 12) * 100) / 100;
  }
}

async function loadBudgets() {
  if (!auth.user) return;
  loading.value = true;
  loadError.value = "";
  try {
    const budgetData = await $fetch("/api/budget/list");
    budgets.value = { income: budgetData.income ?? [], expenses: budgetData.expenses ?? [] };

    const [cashData, debtData] = await Promise.all([
      $fetch("/api/records/cash-and-investments").catch(() => ({ records: [] })),
      $fetch("/api/records/debt").then((d) => d?.records ?? []).catch(() => []),
    ]);
    cashAccounts.value = cashData?.records ?? [];
    debtRecords.value = Array.isArray(debtData) ? debtData : [];
  } catch (err) {
    console.error("Failed to load budgets", err);
    loadError.value = parseFetchError(
      err,
      "Failed to load budget. If you recently updated the app, run: npm run migrate",
    );
    budgets.value = { income: [], expenses: [] };
    cashAccounts.value = [];
    debtRecords.value = [];
  } finally {
    loading.value = false;
  }
}

async function submitBudget() {
  submitError.value = "";
  let monthly = form.value.monthly_amount;
  let annual = form.value.annual_amount;
  if ((monthly == null || isNaN(monthly)) && (annual == null || isNaN(annual))) {
    submitError.value = "Enter a monthly or annual amount.";
    return;
  }
  if (form.value.type === "income") {
    if (grossIncomeNetMonthly.value < 0) {
      submitError.value = "Allocations cannot exceed gross income.";
      return;
    }
  }
  if (
    form.value.type === "expense" &&
    addNeedsDebtLink.value &&
    !form.value.debt_id
  ) {
    submitError.value = "Select the Estate Management debt record for this expense line.";
    return;
  }

  submitting.value = true;
  try {
    if (form.value.type === "income") {
      const allocations = getPositiveGrossAllocations(grossAllocationAmounts.value);
      for (const alloc of allocations) {
        const allocAnnual = Math.round(alloc.amount * 12 * 100) / 100;
        if (alloc.kind === "tax" || alloc.kind === "insurance") {
          await $fetch(`/api/budget/income/${alloc.id}`, {
            method: "PUT",
            body: { monthly_amount: alloc.amount, annual_amount: allocAnnual },
          });
        } else {
          await $fetch(`/api/budget/expenses/${alloc.id}`, {
            method: "PUT",
            body: { monthly_amount: alloc.amount, annual_amount: allocAnnual },
          });
        }
      }
    }

    await $fetch("/api/budget/submit", {
      method: "POST",
      body: {
        type: isIncomeBudgetFormType(form.value.type) ? "income" : "expense",
        income_type: incomeTypeForBudgetFormType(form.value.type),
        expense_type:
          form.value.type === "savings"
            ? "savings"
            : form.value.type === "investment"
              ? "investment"
              : form.value.type === "expense"
                ? "expense"
                : undefined,
        category: form.value.category,
        sub_category: form.value.sub_category || null,
        description: form.value.type === "savings" || form.value.type === "investment" ? null : form.value.description || null,
        cash_investment_id: (form.value.type === "savings" || form.value.type === "investment") && form.value.cash_investment_id ? parseInt(String(form.value.cash_investment_id), 10) : null,
        from_cash_investment_id:
          (form.value.type === "savings" || form.value.type === "investment") && form.value.from_cash_investment_id
            ? parseInt(String(form.value.from_cash_investment_id), 10)
            : null,
        debt_id:
          form.value.type === "expense" && form.value.debt_id
            ? parseInt(String(form.value.debt_id), 10)
            : null,
        monthly_amount: monthly != null && !isNaN(monthly) ? monthly : null,
        annual_amount: annual != null && !isNaN(annual) ? annual : null,
      },
    });

    if (form.value.type === "income") {
      const netMonthly = grossIncomeNetMonthly.value;
      const netLine = findNetIncomeBudgetLine(budgets.value.income, {
        category: form.value.category,
      });
      if (netLine?.id != null && netMonthly >= 0) {
        const netAnnual = Math.round(netMonthly * 12 * 100) / 100;
        await $fetch(`/api/budget/income/${netLine.id}`, {
          method: "PUT",
          body: { monthly_amount: netMonthly, annual_amount: netAnnual },
        });
      }
    }

    grossAllocationAmounts.value = {};
    form.value = {
      type: form.value.type,
      category: "",
      sub_category: "",
      description: "",
      debt_id: "",
      from_cash_investment_id: "",
      cash_investment_id: "",
      monthly_amount: null,
      annual_amount: null,
    };
    await loadBudgets();
    addBudgetDialogRef.value?.close();
  } catch (err) {
    submitError.value = err?.data?.message || err?.message || "Failed to add budget.";
  } finally {
    submitting.value = false;
  }
}

function openAddBudgetModal(type) {
  submitError.value = "";
  grossAllocationAmounts.value = {};
  if (typeof type === "string" && type.length > 0) {
    form.value.type = type;
  }
  nextTick(() => addBudgetDialogRef.value?.showModal());
}

function openEdit(item, type) {
  editingItem.value = { ...item, _type: type };
  editForm.value = {
    income_type: ["gross", "tax", "deduction", "interest", "other"].includes(item.income_type)
      ? item.income_type
      : "gross",
    expense_type: item.expense_type || "expense",
    category: item.category,
    sub_category: item.sub_category || "",
    description: item.description || "",
    debt_id: item.debt_id ? String(item.debt_id) : "",
    from_cash_investment_id: item.from_cash_investment_id ? String(item.from_cash_investment_id) : "",
    cash_investment_id: item.cash_investment_id ? String(item.cash_investment_id) : "",
    monthly_amount: item.monthly_amount,
    annual_amount: item.annual_amount,
  };
  editError.value = "";
  nextTick(() => editDialogRef.value?.showModal());
}

async function saveEdit() {
  editError.value = "";
  const item = editingItem.value;
  if (!item) return;

  const monthly = editForm.value.monthly_amount;
  const annual = editForm.value.annual_amount;
  if ((monthly == null || isNaN(monthly)) && (annual == null || isNaN(annual))) {
    editError.value = "Enter a monthly or annual amount.";
    return;
  }
  if (item._type === "expense" && editNeedsDebtLink.value && !editForm.value.debt_id) {
    editError.value = "Select the Estate Management debt record for this expense line.";
    return;
  }

  saving.value = true;
  try {
    const path = item._type === "income"
      ? `/api/budget/income/${item.id}`
      : `/api/budget/expenses/${item.id}`;
    await $fetch(path, {
      method: "PUT",
      body: {
        income_type: item._type === "income" ? editForm.value.income_type : undefined,
        expense_type: item._type === "expense" ? editForm.value.expense_type : undefined,
        category: editForm.value.category,
        sub_category: editForm.value.sub_category || null,
        description: (item._type !== "expense" || (editForm.value.expense_type !== "savings" && editForm.value.expense_type !== "investment")) ? editForm.value.description || null : null,
        cash_investment_id: item._type === "expense" && (editForm.value.expense_type === "savings" || editForm.value.expense_type === "investment") && editForm.value.cash_investment_id ? parseInt(String(editForm.value.cash_investment_id), 10) : null,
        from_cash_investment_id:
          item._type === "expense" && (editForm.value.expense_type === "savings" || editForm.value.expense_type === "investment")
            ? editForm.value.from_cash_investment_id
              ? parseInt(String(editForm.value.from_cash_investment_id), 10)
              : null
            : null,
        debt_id:
          item._type === "expense"
            ? editForm.value.expense_type === "expense"
              ? editForm.value.debt_id
                ? parseInt(String(editForm.value.debt_id), 10)
                : null
              : null
            : undefined,
        monthly_amount: monthly != null && !isNaN(monthly) ? monthly : null,
        annual_amount: annual != null && !isNaN(annual) ? annual : null,
      },
    });
    editDialogRef.value?.close();
    editingItem.value = null;
    await loadBudgets();
  } catch (err) {
    editError.value = err?.data?.message || err?.message || "Failed to update budget.";
  } finally {
    saving.value = false;
  }
}

function confirmDelete(item, type) {
  deletingItem.value = { ...item, _type: type };
  nextTick(() => deleteDialogRef.value?.showModal());
}

async function performDelete() {
  const item = deletingItem.value;
  if (!item) return;

  deleting.value = true;
  try {
    const path = item._type === "income"
      ? `/api/budget/income/${item.id}`
      : `/api/budget/expenses/${item.id}`;
    await $fetch(path, { method: "DELETE" });
    deleteDialogRef.value?.close();
    deletingItem.value = null;
    await loadBudgets();
  } catch (err) {
    console.error("Failed to delete", err);
  } finally {
    deleting.value = false;
  }
}

onMounted(() => {
  if (!auth.ready) {
    auth.fetchSession();
  }
});

watch(
  () => auth.user,
  (user) => {
    if (user) loadBudgets();
  },
  { immediate: true },
);
</script>
