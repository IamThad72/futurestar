<template>
  <section
    class="app-page-wide space-y-4 sm:space-y-6"
  >
    <header class="flex flex-wrap items-center gap-4 sm:gap-6">
      <div class="min-w-0">
        <h1 class="text-lg sm:text-xl font-semibold text-base-content">Budget Setup</h1>
        <p v-if="activeBudgetName" class="mt-0.5 text-xs text-base-content/60">
          Active budget:
          <span class="font-medium text-base-content/80">{{ activeBudgetName }}</span>
          <span class="hidden lg:inline">
            ·
            <NuxtLink to="/account_map" class="link link-hover">Manage on Account Map</NuxtLink>
          </span>
        </p>
      </div>
      <button
        v-if="auth.user && auth.ready && !loadError"
        type="button"
        class="estate-action-btn ml-auto"
        @click="openAddBudget()"
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
      <LazyAddBudgetItemModal
        v-if="modalsMounted.addBudget"
        ref="addBudgetModalRef"
        @saved="loadBudgets"
      />

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
                @click="openAddBudget('expense')"
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
                class="divide-y divide-base-200 rounded-md bg-base-100 shadow-sm ring-1 ring-base-300"
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
                @click="openAddBudget('income')"
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
                  class="divide-y divide-base-200 rounded-md bg-base-100 shadow-sm ring-1 ring-base-300"
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
                @click="openAddBudget('investment')"
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
                    class="divide-y divide-base-200 rounded-md bg-base-100 shadow-sm ring-1 ring-base-300"
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
                @click="openAddBudget('savings')"
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
                    class="divide-y divide-base-200 rounded-md bg-base-100 shadow-sm ring-1 ring-base-300"
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
                  Budgeted: ${{ formatAmount(totals.tax.monthly) }}/mo
                  <span v-if="setupTaxAnnualGrandTotal != null" class="text-base-content/70">
                    · {{ setupTaxYear }} YTD ${{ formatAmount(setupTaxAnnualGrandTotal) }}
                  </span>
                </span>
              </div>
              <button
                type="button"
                class="btn btn-ghost btn-sm h-auto min-h-0 shrink-0 gap-2 py-1.5 pl-1 pr-2 font-medium normal-case text-base-content hover:bg-base-200"
                @click="openAddBudget('tax')"
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
                  v-if="setupTaxAnnualTotals.length"
                  class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 rounded-lg border border-base-200 bg-base-200/30 p-3"
                >
                  <div v-for="t in setupTaxAnnualTotals" :key="t.tax_kind" class="rounded-md bg-base-100 px-2 py-1.5">
                    <div class="text-[0.65rem] font-medium uppercase tracking-wide text-base-content/55">{{ t.label }}</div>
                    <div class="text-sm font-semibold tabular-nums">${{ formatAmount(t.total_amount) }}</div>
                  </div>
                </div>
                <div
                  v-for="group in taxGroupedByCategory"
                  :key="`tax-cat-${group.category}`"
                >
                  <ul
                    role="list"
                    class="divide-y divide-base-200 rounded-md bg-base-100 shadow-sm ring-1 ring-base-300"
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
                @click="openAddBudget('insurance')"
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
                    class="divide-y divide-base-200 rounded-md bg-base-100 shadow-sm ring-1 ring-base-300"
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

      <!-- Edit Budget Item modal -->
      <LazyEditBudgetItemModal
        v-if="modalsMounted.editBudget"
        ref="editBudgetModalRef"
        @saved="loadBudgets"
      />

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
import { formatDebtRecordLabel } from "~/utils/budgetDebt";
import { isNetIncomeBudgetLine } from "~/utils/budgetChart";

const auth = useAuthStore();
const addBudgetModalRef = ref(null);
const editBudgetModalRef = ref(null);
const deleteDialogRef = ref(null);
const modalsMounted = reactive({ addBudget: false, editBudget: false });

async function ensureModal(key) {
  if (!modalsMounted[key]) {
    modalsMounted[key] = true;
    await nextTick();
  }
}

async function openAddBudget(type) {
  await ensureModal("addBudget");
  addBudgetModalRef.value?.open(type);
}

async function openEdit(item, type) {
  await ensureModal("editBudget");
  editBudgetModalRef.value?.open(item, type);
}
const budgets = ref({ income: [], expenses: [] });
const activeBudgetName = ref("");
const setupTaxYear = ref(new Date().getFullYear());
const setupTaxAnnualGrandTotal = ref(null);
const setupTaxAnnualTotals = ref([]);
const loading = ref(true);
const loadError = ref("");
const deleting = ref(false);
const deletingItem = ref(null);

const debtRecords = ref([]);

function debtLabelForBudgetItem(item) {
  if (!item?.debt_id) return null;
  const row = debtRecords.value.find((r) => String(r.dbt_id) === String(item.debt_id));
  return row ? formatDebtRecordLabel(row) : null;
}

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

function formatAmount(val) {
  if (val == null || val === "" || isNaN(val)) return "0.00";
  return Number(val).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function loadBudgets() {
  if (!auth.user) return;
  loading.value = true;
  loadError.value = "";
  try {
    const budgetData = await $fetch("/api/budget/list");
    budgets.value = { income: budgetData.income ?? [], expenses: budgetData.expenses ?? [] };
    activeBudgetName.value = budgetData.budget?.name || "";
    try {
      const taxTotals = await $fetch("/api/budget/tax-annual-totals", {
        query: { year: setupTaxYear.value },
      });
      setupTaxAnnualTotals.value = taxTotals?.totals ?? [];
      setupTaxAnnualGrandTotal.value = Number(taxTotals?.grand_total) || 0;
    } catch {
      setupTaxAnnualTotals.value = [];
      setupTaxAnnualGrandTotal.value = null;
    }

    const debtData = await $fetch("/api/records/debt").then((d) => d?.records ?? []).catch(() => []);
    debtRecords.value = Array.isArray(debtData) ? debtData : [];
  } catch (err) {
    console.error("Failed to load budgets", err);
    loadError.value = parseFetchError(
      err,
      "Failed to load budget. If you recently updated the app, run: npm run migrate",
    );
    budgets.value = { income: [], expenses: [] };
    debtRecords.value = [];
  } finally {
    loading.value = false;
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
