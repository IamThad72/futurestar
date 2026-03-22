<template>
  <section class="mx-auto w-full max-w-screen-2xl space-y-4 sm:space-y-6 p-4 sm:p-6 overflow-x-hidden min-w-0">
    <header>
      <h1 class="text-xl sm:text-2xl font-semibold">Cash Flow Tracker</h1>
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

    <div v-else class="space-y-6">
      <!-- Month selector & Add Transaction -->
      <div class="flex flex-wrap items-center gap-4">
        <div class="flex items-center gap-2">
          <label class="label-text text-sm">Month</label>
          <select v-model="selectedMonth" class="select select-bordered select-sm w-28">
            <option v-for="m in 12" :key="m" :value="m">{{ monthNames[m - 1] }}</option>
          </select>
        </div>
        <div class="flex items-center gap-2">
          <label class="label-text text-sm">Year</label>
          <select v-model="selectedYear" class="select select-bordered select-sm w-24">
            <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
          </select>
        </div>
        <button type="button" class="btn btn-neutral btn-sm flex items-center gap-2 px-2 py-1 min-h-0 text-xs" @click="showAddTransaction = true">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
            <path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 9a.75.75 0 0 0-1.5 0v2.25H9a.75.75 0 0 0 0 1.5h2.25V15a.75.75 0 0 0 1.5 0v-2.25H15a.75.75 0 0 0 0-1.5h-2.25V9Z" clip-rule="evenodd" />
          </svg>
          Add Entry
        </button>
        <input
          ref="csvFileInputRef"
          type="file"
          accept=".csv"
          class="hidden"
          @change="onCsvFileSelected"
        />
        <button type="button" class="btn btn-warning btn-sm flex items-center gap-2 text-warning-content px-2 py-1 min-h-0 text-xs" @click="csvFileInputRef?.click()">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-[1.275rem]">
            <path fill-rule="evenodd" d="M11.47 2.47a.75.75 0 0 1 1.06 0l4.5 4.5a.75.75 0 0 1-1.06 1.06l-3.22-3.22V16.5a.75.75 0 0 1-1.5 0V4.81L8.03 8.03a.75.75 0 0 1-1.06-1.06l4.5-4.5ZM3 15.75a.75.75 0 0 1 .75.75v2.25a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5V16.5a.75.75 0 0 1 1.5 0v2.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V16.5a.75.75 0 0 1 .75-.75Z" clip-rule="evenodd" />
          </svg>
          CSV
        </button>
      </div>

      <!-- Budget vs Actual List -->
      <div class="collapse collapse-arrow rounded-lg border border-base-100 bg-base-100 -mx-2 sm:-mx-4">
        <input type="checkbox" checked />
        <div class="collapse-title font-semibold text-lg min-h-0 py-2 px-4 text-base-content">
          Budget Details - {{ String(selectedMonth).padStart(2, '0') }}-{{ String(selectedYear).slice(-2) }}
        </div>
        <div class="collapse-content px-2 pt-2 pb-4">
          <div v-if="loading" class="p-8 text-center text-neutral/70">Loading...</div>
          <div v-else class="space-y-3">
            <!-- Income lists -->
            <template v-for="group in incomeGroupedByCategory" :key="`inc-${group.category}`">
              <ul class="list bg-base-100 rounded-box border border-base-100 text-base-content text-xs">
                <li class="bg-info text-primary-content px-3 py-2 text-sm font-medium">{{ group.category }}</li>
                <li class="bg-base-100 grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-1.5 text-[10px] font-medium text-base-content uppercase tracking-wide">
                  <span></span>
                  <span class="text-right text-base-content">Budget</span>
                  <span class="text-right text-base-content">Actual</span>
                </li>
                <li
                  v-for="item in group.items"
                  :key="`inc-${item.id}`"
                  class="bg-base-100 grid grid-cols-[1fr_auto_auto] gap-2 items-center px-3 py-2 cursor-pointer rounded font-bold text-base-content"
                  @click="openSubCategoryModal(item, 'income', group)"
                >
                  <span class="text-base-content">
                    {{ item.sub_category || "—" }}
                    <span :class="getVarianceClass(item.id, 'income', item.monthly_amount)">({{ formatVariance(item.id, 'income', item.monthly_amount) }})</span>
                  </span>
                  <span class="text-right text-success font-bold">${{ formatAmount(item.monthly_amount) }}</span>
                  <span class="text-right text-secondary font-bold">${{ formatAmount(getActualForItem(item.id, 'income')) }}</span>
                </li>
              </ul>
            </template>
            <!-- Expense lists -->
            <template v-for="group in expensesGroupedByCategory" :key="`exp-${group.category}`">
              <ul class="list bg-base-100 rounded-box border border-base-100 text-base-content text-xs">
                <li class="bg-info text-primary-content px-3 py-2 text-sm font-medium">{{ group.category }}</li>
                <li class="bg-base-100 grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-1.5 text-[10px] font-medium text-base-content uppercase tracking-wide">
                  <span></span>
                  <span class="text-right text-base-content">Budget</span>
                  <span class="text-right text-base-content">Actual</span>
                </li>
                <li
                  v-for="item in group.items"
                  :key="`exp-${item.id}`"
                  class="bg-base-100 grid grid-cols-[1fr_auto_auto] gap-2 items-center px-3 py-2 cursor-pointer rounded font-bold text-base-content"
                  @click="openSubCategoryModal(item, 'expense', group)"
                >
                  <span class="text-base-content">
                    {{ item.sub_category || "—" }}
                    <span :class="getVarianceClass(item.id, 'expense', item.monthly_amount)">({{ formatVariance(item.id, 'expense', item.monthly_amount) }})</span>
                  </span>
                  <span class="text-right text-success font-bold">${{ formatAmount(item.monthly_amount) }}</span>
                  <span class="text-right text-secondary font-bold">${{ formatAmount(getActualForItem(item.id, 'expense')) }}</span>
                </li>
              </ul>
            </template>
            <p v-if="!incomeGroupedByCategory.length && !expensesGroupedByCategory.length" class="text-center text-neutral/50 py-8">
              No budget items yet. Add budget items in Cash Flow Management first.
            </p>
          </div>
        </div>
      </div>

      <!-- Add Transaction Modal -->
      <dialog ref="addDialogRef" class="modal">
        <div class="modal-box">
          <h3 class="font-semibold text-lg mb-4">Add Transaction</h3>
          <form @submit.prevent="submitTransaction" class="space-y-4">
            <div class="flex flex-wrap gap-4">
              <label class="flex items-center gap-2 cursor-pointer">
                <input v-model="txForm.type" type="radio" value="income" class="radio radio-primary" />
                <span>Income</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input v-model="txForm.type" type="radio" value="expense" class="radio radio-primary" />
                <span>Expense</span>
              </label>
            </div>
            <label class="form-control w-full">
              <span class="label-text text-sm">Budget Item <span class="text-error">*</span></span>
              <select v-model="txForm.budgetItemId" class="select select-bordered w-full" required>
                <option value="">Select...</option>
                <template v-if="txForm.type === 'income'">
                  <optgroup v-for="group in incomeGroupedByCategory" :key="`opt-inc-${group.category}`" :label="group.category">
                    <option v-for="item in group.items" :key="item.id" :value="item.id">
                      {{ item.sub_category || group.category }} — ${{ formatAmount(item.monthly_amount) }}/mo
                    </option>
                  </optgroup>
                </template>
                <template v-else>
                  <optgroup v-for="group in expensesGroupedByCategory" :key="`opt-exp-${group.category}`" :label="group.category">
                    <option v-for="item in group.items" :key="item.id" :value="item.id">
                      {{ item.sub_category || group.category }} — ${{ formatAmount(item.monthly_amount) }}/mo
                    </option>
                  </optgroup>
                </template>
              </select>
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
                <span class="label-text text-sm">Amount <span class="text-error">*</span></span>
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
            <label class="form-control w-full">
              <span class="label-text text-sm">Description</span>
              <input v-model.trim="txForm.description" class="input input-bordered w-full" type="text" placeholder="Optional" />
            </label>
            <label v-if="showDestinationAccountSelector" class="form-control w-full">
              <span class="label-text text-sm">Destination Account</span>
              <select v-model="txForm.cashInvestmentId" class="select select-bordered w-full">
                <option value="">None</option>
                <option v-for="acct in cashAccounts" :key="acct.ci_id" :value="String(acct.ci_id)">
                  {{ [acct.institution, acct.acct_type].filter(Boolean).join(" — ") || `Account #${acct.ci_id}` }}
                </option>
              </select>
              <span class="label-text-alt text-base-content/60">Savings account, 401k, or other cash account</span>
            </label>
            <div v-if="txError" class="text-sm text-error">{{ txError }}</div>
            <div class="modal-action">
              <button type="button" class="btn btn-ghost" @click="addDialogRef?.close()">Cancel</button>
              <button type="submit" class="btn btn-primary" :disabled="txSubmitting">
                {{ txSubmitting ? "Adding..." : "Add Transaction" }}
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
            <div v-else class="space-y-3">
              <div
                v-for="tx in transactionsForModal"
                :key="tx.id"
                class="border border-base-200 rounded-lg p-3"
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
                    <label v-if="(editTxForm.type === 'expense' && (selectedBudgetItem?.expense_type === 'savings' || selectedBudgetItem?.expense_type === 'investment')) || (editTxForm.type === 'income' && selectedBudgetItem?.income_type === 'gross')" class="form-control">
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
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span class="font-medium">{{ formatDate(tx.date) }}</span>
                      <span class="ml-2 font-bold" :class="tx.type === 'income' ? 'text-primary' : 'text-error'">
                        {{ tx.type === 'income' ? '' : '-' }}${{ formatAmount(tx.amount) }}
                      </span>
                      <div v-if="tx.description" class="text-sm text-base-content/60 mt-0.5">{{ tx.description }}</div>
                      <div v-if="tx.destination_institution || tx.destination_acct_type" class="text-xs text-base-content/50 mt-0.5">
                        → {{ [tx.destination_institution, tx.destination_acct_type].filter(Boolean).join(" — ") }}
                      </div>
                    </div>
                    <div class="flex gap-1">
                      <button type="button" class="btn btn-ghost btn-sm btn-square" aria-label="Edit" @click="startEditTx(tx)">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" /></svg>
                      </button>
                      <button type="button" class="btn btn-ghost btn-sm btn-square text-error" aria-label="Delete" @click="confirmDeleteFromModal(tx)">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                      </button>
                    </div>
                  </div>
                </template>
              </div>
            </div>
            <div class="mt-4 pt-4 border-t border-base-200">
              <template v-if="showAddFormInSubCategory && isSubCategorySavingsOrInvestment">
                <form @submit.prevent="submitSubCategoryAdd" class="space-y-3 p-3 rounded-lg bg-base-200/50">
                  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label class="form-control">
                      <span class="label-text text-sm">Date <span class="text-error">*</span></span>
                      <input v-model="subCategoryAddForm.date" class="input input-bordered input-sm w-full" type="date" required />
                    </label>
                    <label class="form-control">
                      <span class="label-text text-sm">Amount <span class="text-error">*</span></span>
                      <input v-model.number="subCategoryAddForm.amount" class="input input-bordered input-sm w-full" type="number" min="0" step="0.01" required />
                    </label>
                  </div>
                  <label class="form-control">
                    <span class="label-text text-sm">Description</span>
                    <input v-model.trim="subCategoryAddForm.description" class="input input-bordered input-sm w-full" type="text" placeholder="Optional" />
                  </label>
                  <label class="form-control">
                    <span class="label-text text-sm">Destination Account <span class="text-error">*</span></span>
                    <select v-model="subCategoryAddForm.cashInvestmentId" class="select select-bordered select-sm w-full" required>
                      <option value="">Select account...</option>
                      <option v-for="acct in cashAccounts" :key="acct.ci_id" :value="String(acct.ci_id)">
                        {{ [acct.institution, acct.acct_type].filter(Boolean).join(" — ") || `Account #${acct.ci_id}` }}
                      </option>
                    </select>
                    <span class="label-text-alt text-base-content/60">Account to add the savings amount to</span>
                  </label>
                  <div v-if="subCategoryAddError" class="text-sm text-error">{{ subCategoryAddError }}</div>
                  <div class="flex gap-2">
                    <button type="submit" class="btn btn-primary btn-sm" :disabled="subCategoryAddSaving">
                      {{ subCategoryAddSaving ? "Adding..." : "Add" }}
                    </button>
                    <button type="button" class="btn btn-ghost btn-sm" @click="cancelSubCategoryAdd">Cancel</button>
                  </div>
                </form>
              </template>
              <button v-else type="button" class="btn btn-primary btn-sm" @click="addTxFromSubCategory">
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
          <h3 class="font-semibold text-lg mb-4">Import Transactions from CSV</h3>
          <p class="text-sm text-base-content/60 mb-4">
            Assign a transaction type and budget item to each row. CSV should have Transaction Date (or Date), Amount, and Description columns.
          </p>
          <div v-if="csvError" class="alert alert-error mb-4">
            <span>{{ csvError }}</span>
          </div>
          <div v-if="csvRows.length" class="flex-1 overflow-y-auto min-h-0 border border-base-200 rounded-lg">
            <table class="table table-pin-rows table-xs">
              <thead>
                <tr>
                  <th class="w-16">Ignore</th>
                  <th>Date</th>
                  <th class="text-right">Amount</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th>Budget Item</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, idx) in csvRows" :key="idx" :class="{ 'bg-error/10': !row.ignored && (!row.type || !row.budgetItemId), 'opacity-50 bg-base-200/50': row.ignored }">
                  <td>
                    <label class="label cursor-pointer justify-start gap-1">
                      <input v-model="row.ignored" type="checkbox" class="checkbox checkbox-sm" />
                      <span class="label-text text-xs">Ignore</span>
                    </label>
                  </td>
                  <td class="whitespace-nowrap">{{ row.date }}</td>
                  <td class="text-right font-mono">{{ formatAmount(row.amount) }}</td>
                  <td class="max-w-48 truncate" :title="row.description">{{ row.description || "—" }}</td>
                  <td>
                    <select v-model="row.type" class="select select-bordered select-sm w-28" :disabled="row.ignored" @change="row.budgetItemId = ''">
                      <option value="">Select...</option>
                      <option value="income">Income</option>
                      <option value="expense">Expense</option>
                    </select>
                  </td>
                  <td>
                    <select v-model="row.budgetItemId" class="select select-bordered select-sm w-44" :disabled="row.ignored">
                      <option value="">Select...</option>
                      <template v-if="row.type === 'income'">
                        <optgroup v-for="group in incomeGroupedByCategory" :key="`csv-inc-${group.category}`" :label="group.category">
                          <option v-for="item in group.items" :key="item.id" :value="String(item.id)">
                            {{ item.sub_category || group.category }}
                          </option>
                        </optgroup>
                      </template>
                      <template v-else-if="row.type === 'expense'">
                        <optgroup v-for="group in expensesGroupedByCategory" :key="`csv-exp-${group.category}`" :label="group.category">
                          <option v-for="item in group.items" :key="item.id" :value="String(item.id)">
                            {{ item.sub_category || group.category }}
                          </option>
                        </optgroup>
                      </template>
                    </select>
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
              :disabled="!allCsvRowsHaveType || csvSaving"
              @click="saveCsvTransactions"
            >
              {{ csvSaving ? "Saving..." : `Save ${csvRowsToImport.length} Transaction${csvRowsToImport.length !== 1 ? "s" : ""}` }}
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
const auth = useAuthStore();
const addDialogRef = ref(null);
const deleteDialogRef = ref(null);
const subCategoryModalRef = ref(null);
const csvFileInputRef = ref(null);
const csvUploadModalRef = ref(null);
const selectedBudgetItem = ref(null);
const editingTxId = ref(null);
const editTxForm = ref({ date: "", amount: null, description: "", budgetItemId: "", type: "income", cashInvestmentId: "" });
const editTxError = ref("");
const editTxSaving = ref(false);
const budgets = ref({ income: [], expenses: [] });
const transactions = ref([]);
const cashAccounts = ref([]);
const loading = ref(true);
const showAddTransaction = ref(false);
const txSubmitting = ref(false);
const deleting = ref(false);
const txError = ref("");
const deletingTx = ref(null);
const csvRows = ref([]);
const csvError = ref("");
const csvSaving = ref(false);
const showAddFormInSubCategory = ref(false);
const subCategoryAddForm = ref({
  date: "",
  amount: null,
  description: "",
  cashInvestmentId: "",
});
const subCategoryAddError = ref("");
const subCategoryAddSaving = ref(false);

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

const txForm = ref({
  type: "expense",
  budgetItemId: "",
  date: "",
  amount: null,
  description: "",
  cashInvestmentId: "",
});

/** Group income by category */
const incomeGroupedByCategory = computed(() => {
  const items = budgets.value.income ?? [];
  const byCategory = {};
  for (const item of items) {
    const cat = item.category || "Uncategorized";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(item);
  }
  for (const cat of Object.keys(byCategory)) {
    byCategory[cat].sort((a, b) => ((a.sub_category || "").toLowerCase()).localeCompare((b.sub_category || "").toLowerCase()));
  }
  return Object.entries(byCategory)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, items]) => ({ category, items }));
});

/** Group expenses by category */
const expensesGroupedByCategory = computed(() => {
  const items = budgets.value.expenses ?? [];
  const byCategory = {};
  for (const item of items) {
    const cat = item.category || "Uncategorized";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(item);
  }
  for (const cat of Object.keys(byCategory)) {
    byCategory[cat].sort((a, b) => ((a.sub_category || "").toLowerCase()).localeCompare((b.sub_category || "").toLowerCase()));
  }
  return Object.entries(byCategory)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, items]) => ({ category, items }));
});

/** Selected expense budget item (when type is expense) */
const selectedExpenseItem = computed(() => {
  if (txForm.value.type !== "expense" || !txForm.value.budgetItemId) return null;
  const id = parseInt(txForm.value.budgetItemId, 10);
  const items = budgets.value.expenses ?? [];
  return items.find((i) => i.id === id) ?? null;
});

/** Show destination account selector for income transactions */
const showDestinationAccountSelector = computed(() => txForm.value.type === "income");

/** Whether selected budget item in sub-category modal is savings or investment */
const isSubCategorySavingsOrInvestment = computed(() => {
  const item = selectedBudgetItem.value;
  return item && item.type === "expense" && (item.expense_type === "savings" || item.expense_type === "investment");
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
  if (Math.abs(variance) < 0.01) return "text-base-content/60";
  // More than budgeted (over) = error; under = secondary
  const isOver = type === "income" ? variance > 0 : variance < 0;
  return isOver ? "text-error" : "text-secondary";
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

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

async function loadData() {
  if (!auth.user) return;
  loading.value = true;
  try {
    const [budgetData, txData, cashData] = await Promise.all([
      $fetch("/api/budget/list"),
      $fetch("/api/budget/transactions/list"),
      $fetch("/api/records/cash-and-investments"),
    ]);
    budgets.value = { income: budgetData.income ?? [], expenses: budgetData.expenses ?? [] };
    transactions.value = txData.transactions ?? [];
    cashAccounts.value = cashData.records ?? [];
  } catch (err) {
    console.error("Failed to load", err);
    budgets.value = { income: [], expenses: [] };
    transactions.value = [];
    cashAccounts.value = [];
  } finally {
    loading.value = false;
  }
}

watch(showAddTransaction, (v) => {
  if (v) {
    const pad = (n) => String(n).padStart(2, "0");
    txForm.value = {
      type: "expense",
      budgetItemId: "",
      date: `${selectedYear.value}-${pad(selectedMonth.value)}-01`,
      amount: null,
      description: "",
      cashInvestmentId: "",
    };
    txError.value = "";
    nextTick(() => addDialogRef.value?.showModal());
    showAddTransaction.value = false;
  }
});

watch(() => txForm.value.type, () => {
  txForm.value.budgetItemId = "";
});

/** Non-ignored CSV rows that will be imported */
const csvRowsToImport = computed(() => csvRows.value.filter((r) => !r.ignored));

/** All non-ignored rows have type and budget item selected */
const allCsvRowsHaveType = computed(() => {
  const toImport = csvRowsToImport.value;
  if (!toImport.length) return false;
  return toImport.every((r) => r.type && r.budgetItemId);
});

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
      type: "",
      budgetItemId: "",
      ignored: false,
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

function onCsvFileSelected(ev) {
  const file = ev?.target?.files?.[0];
  ev.target.value = "";
  if (!file) return;
  csvError.value = "";
  const reader = new FileReader();
  reader.onload = (e) => {
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
        csvRows.value = rows;
        csvError.value = "";
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
}

async function saveCsvTransactions() {
  if (!allCsvRowsHaveType.value || csvSaving.value) return;
  csvError.value = "";
  csvSaving.value = true;
  try {
    for (const row of csvRowsToImport.value) {
      const dateStr = toISODateString(row.date);
      if (!dateStr) {
        csvError.value = `Invalid date for row: ${row.description || row.amount}`;
        return;
      }
      const body =
        row.type === "income"
          ? { type: "income", income_id: parseInt(row.budgetItemId, 10), transaction_date: dateStr, amount: row.amount, description: row.description || null }
          : { type: "expense", expense_id: parseInt(row.budgetItemId, 10), transaction_date: dateStr, amount: row.amount, description: row.description || null };
      await $fetch("/api/budget/transactions/submit", { method: "POST", body });
    }
    closeCsvModal();
    await loadData();
  } catch (err) {
    csvError.value = err?.data?.message || err?.message || "Failed to save transactions.";
  } finally {
    csvSaving.value = false;
  }
}

async function submitTransaction() {
  txError.value = "";
  const id = txForm.value.budgetItemId;
  const amount = txForm.value.amount;
  if (!id || amount == null || isNaN(amount)) {
    txError.value = "Please select a budget item and enter an amount.";
    return;
  }

  await doSubmitTransaction();
}

async function doSubmitTransaction() {
  const id = txForm.value.budgetItemId;
  const amount = txForm.value.amount;
  const description = txForm.value.description || null;
  const cashInvestmentId = txForm.value.cashInvestmentId ? parseInt(String(txForm.value.cashInvestmentId), 10) : null;
  const effectiveCiId = cashInvestmentId && !isNaN(cashInvestmentId) && cashInvestmentId > 0 ? cashInvestmentId : null;

  txSubmitting.value = true;
  try {
    const body =
      txForm.value.type === "income"
        ? { type: "income", income_id: parseInt(id, 10), transaction_date: txForm.value.date, amount, description, cash_investment_id: effectiveCiId }
        : { type: "expense", expense_id: parseInt(id, 10), transaction_date: txForm.value.date, amount, description, cash_investment_id: effectiveCiId };
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
  showAddFormInSubCategory.value = false;
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
  };
  editTxError.value = "";
}

function cancelEdit() {
  editingTxId.value = null;
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
  editTxSaving.value = true;
  try {
    const cashInvestmentId = editTxForm.value.cashInvestmentId
      ? parseInt(String(editTxForm.value.cashInvestmentId), 10)
      : null;
    const effectiveCiId = cashInvestmentId && !isNaN(cashInvestmentId) && cashInvestmentId > 0 ? cashInvestmentId : null;
    const body = {
      transaction_date: editTxForm.value.date,
      amount,
      description: editTxForm.value.description || null,
      cash_investment_id: effectiveCiId,
    };
    if (editTxForm.value.type === "income") {
      body.income_id = parseInt(budgetItemId, 10);
    } else {
      body.expense_id = parseInt(budgetItemId, 10);
    }
    await $fetch(`/api/budget/transactions/${editingTxId.value}`, {
      method: "PUT",
      body,
    });
    editingTxId.value = null;
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

function addTxFromSubCategory() {
  const item = selectedBudgetItem.value;
  if (!item) return;
  if (item.type === "expense" && (item.expense_type === "savings" || item.expense_type === "investment")) {
    const pad = (n) => String(n).padStart(2, "0");
    subCategoryAddForm.value = {
      date: `${selectedYear.value}-${pad(selectedMonth.value)}-01`,
      amount: null,
      description: "",
      cashInvestmentId: "",
    };
    subCategoryAddError.value = "";
    showAddFormInSubCategory.value = true;
  } else {
    subCategoryModalRef.value?.close();
    const pad = (n) => String(n).padStart(2, "0");
    txForm.value = {
      type: item.type,
      budgetItemId: String(item.id),
      date: `${selectedYear.value}-${pad(selectedMonth.value)}-01`,
      amount: null,
      description: "",
      cashInvestmentId: "",
    };
    txError.value = "";
    nextTick(() => addDialogRef.value?.showModal());
  }
}

function cancelSubCategoryAdd() {
  showAddFormInSubCategory.value = false;
  subCategoryAddError.value = "";
}

async function submitSubCategoryAdd() {
  const item = selectedBudgetItem.value;
  if (!item || item.type !== "expense") return;
  subCategoryAddError.value = "";
  const amount = subCategoryAddForm.value.amount;
  const cashInvestmentId = subCategoryAddForm.value.cashInvestmentId
    ? parseInt(String(subCategoryAddForm.value.cashInvestmentId), 10)
    : null;
  if (amount == null || isNaN(amount)) {
    subCategoryAddError.value = "Enter a valid amount.";
    return;
  }
  if (!cashInvestmentId || isNaN(cashInvestmentId) || cashInvestmentId <= 0) {
    subCategoryAddError.value = "Select a destination account.";
    return;
  }
  subCategoryAddSaving.value = true;
  try {
    await $fetch("/api/budget/transactions/submit", {
      method: "POST",
      body: {
        type: "expense",
        expense_id: item.id,
        transaction_date: subCategoryAddForm.value.date,
        amount,
        description: subCategoryAddForm.value.description || null,
        cash_investment_id: cashInvestmentId,
      },
    });
    showAddFormInSubCategory.value = false;
    subCategoryAddForm.value = { date: "", amount: null, description: "", cashInvestmentId: "" };
    await loadData();
  } catch (err) {
    subCategoryAddError.value = err?.data?.message || err?.message || "Failed to add transaction.";
  } finally {
    subCategoryAddSaving.value = false;
  }
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

