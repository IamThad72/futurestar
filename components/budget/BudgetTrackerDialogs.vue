<template>
      <!-- Add Transaction Modal -->
      <dialog ref="addDialogRef" class="modal">
        <div class="modal-box" :class="{ 'max-w-2xl max-h-[90vh] overflow-y-auto': isGrossIncomePaycheckMode }">
          <h3 class="font-semibold text-lg mb-4 leading-snug">{{ addTransactionModalTitle }}</h3>
          <form @submit.prevent="submitTransaction" class="space-y-4">
            <label v-if="txForm.type === 'expense'" class="form-control w-full">
              <span class="label-text text-sm">Budget category <span class="text-error">*</span></span>
              <select v-model="txForm.budgetItemId" class="select select-bordered w-full" required>
                <option value="">Select a category…</option>
                <optgroup v-for="group in csvExpenseGroups" :key="`add-cat-${group.category}`" :label="group.category">
                  <option v-for="item in group.items" :key="categoryOptionValue(item)" :value="categoryOptionValue(item)">
                    {{ item.sub_category || group.category }}<template v-if="item.off_plan"> (previous)</template>
                  </option>
                </optgroup>
              </select>
            </label>
            <div v-if="txForm.type === 'income' || txForm.type === 'tax' || txForm.type === 'insurance'" class="space-y-2">
              <label class="form-control w-full">
                <span class="label-text text-sm">From</span>
                <select
                  v-if="incomeSources.length"
                  v-model="txForm.incomeSourceId"
                  class="select select-bordered w-full"
                  aria-label="Source"
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
                  <input v-model.trim="txForm.incomeSourceName" class="input input-bordered w-full" type="text" aria-label="Source" placeholder="Income source" />
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
                  aria-label="Source"
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
                  <input v-model.trim="txForm.investmentSourceName" class="input input-bordered w-full" type="text" aria-label="Source" placeholder="Investment source" />
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
                  aria-label="Source"
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
                  <input v-model.trim="txForm.savingsSourceName" class="input input-bordered w-full" type="text" aria-label="Source" placeholder="Savings source" />
                </label>
                <div class="flex flex-wrap gap-2">
                  <button type="button" class="btn btn-primary btn-sm" @click="addSavingsSourceFromForm">Add</button>
                  <button type="button" class="btn btn-ghost btn-sm" @click="cancelNewSavingsFrom">Cancel</button>
                </div>
              </div>
            </div>
            <label v-if="txForm.type !== 'tax' && txForm.type !== 'insurance' && txForm.type !== 'savings'" class="form-control w-full">
              <span class="label-text text-sm">Payee</span>
              <input v-model.trim="txForm.payee" class="input input-bordered w-full" type="text" aria-label="Payee" placeholder="Who you paid or received from" />
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
                  type="number" inputmode="decimal"
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
                      type="number" inputmode="decimal"
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
                      type="number" inputmode="decimal"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div v-if="grossAllocRetirementLines.length" class="space-y-2">
                  <h4 class="text-sm font-semibold text-primary">Retirement</h4>
                  <div
                    v-for="line in grossAllocRetirementLines"
                    :key="line.key"
                    class="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_7rem] sm:items-center"
                  >
                    <span class="text-sm">{{ line.category }}{{ line.sub_category ? ` › ${line.sub_category}` : "" }}</span>
                    <input
                      v-model.number="grossAllocationAmounts[line.key]"
                      class="input input-bordered input-sm w-full"
                      type="number" inputmode="decimal"
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
                      type="number" inputmode="decimal"
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
              <span class="label-text text-sm">
                To Account
                <span v-if="useDebtInstitutionsForAddModal" class="text-error">*</span>
              </span>
              <template v-if="useDebtInstitutionsForAddModal">
                <select v-model="txForm.debtId" class="select select-bordered w-full" required>
                  <option value="" disabled>Select debt institution…</option>
                  <option v-for="row in debtRecords" :key="row.dbt_id" :value="String(row.dbt_id)">
                    {{ formatDebtRecordLabel(row) }}
                  </option>
                </select>
                <p v-if="selectedDebtForPayment && !inferIsRevolvingDebt(selectedDebtForPayment)" class="label-text-alt text-base-content/70 mt-1">
                  Installment loan{{ selectedDebtForPayment.interest_rate_annual ? ` · ${selectedDebtForPayment.interest_rate_annual}% APR` : "" }}{{ selectedDebtForPayment.term_months ? ` · ${selectedDebtForPayment.term_months} mo remaining` : "" }}
                </p>
                <p v-if="debtPaymentPreview && !debtPaymentPreview.isRevolving" class="text-xs text-base-content/80 mt-1">
                  Payment ${{ formatAmount(txForm.amount) }} → principal ${{ formatAmount(debtPaymentPreview.principal) }}, interest ${{ formatAmount(debtPaymentPreview.interest) }}
                </p>
              </template>
              <template v-else>
                <select v-model="txForm.cashInvestmentId" class="select select-bordered w-full">
                  <option value="">None</option>
                  <option v-for="acct in cashAccounts" :key="acct.ci_id" :value="String(acct.ci_id)">
                    {{ [acct.institution, acct.acct_type].filter(Boolean).join(" — ") || `Account #${acct.ci_id}` }}
                  </option>
                </select>
                <span class="label-text-alt text-base-content/60">Leave this blank for a purchase such as groceries. Choose an account only when the money moves into that account.</span>
              </template>
            </label>
            <label class="form-control w-full">
              <span class="label-text text-sm">Description</span>
              <input v-model.trim="txForm.description" class="input input-bordered w-full" type="text" placeholder="Optional notes" />
            </label>
            <div v-if="txError" class="text-sm text-error" role="alert">{{ txError }}</div>
            <div class="modal-action">
              <button type="button" class="btn btn-ghost" @click="addDialogRef?.close()">Cancel</button>
              <button type="submit" class="btn btn-primary" :disabled="txSubmitting">
                {{ txSubmitting ? "Adding…" : isGrossIncomePaycheckMode ? "Save paycheck" : "Add Transaction" }}
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
            <ion-list v-else lines="full" class="budget-tx-list">
              <template v-for="tx in transactionsForModal" :key="tx.id">
                <div v-if="editingTxId === tx.id" class="budget-tx-list__edit">
                  <form @submit.prevent="saveEditTransaction" class="space-y-3">
                    <label class="form-control w-full">
                      <span class="label-text text-sm">Category / Sub-category</span>
                      <select v-model="editTxForm.budgetItemId" class="select select-bordered select-sm w-full" required>
                        <option value="">Select…</option>
                        <template v-if="editTxForm.type === 'income'">
                          <optgroup v-for="group in incomeGroupedByCategory" :key="`edit-inc-${group.category}`" :label="group.category">
                            <option v-for="item in group.items" :key="categoryOptionValue(item)" :value="categoryOptionValue(item)">
                              {{ item.sub_category || group.category }}<template v-if="item.off_plan"> (previous)</template><template v-else> — ${{ formatAmount(item.monthly_amount) }}/mo</template>
                            </option>
                          </optgroup>
                        </template>
                        <template v-else>
                          <optgroup v-for="group in expensesGroupedByCategory" :key="`edit-exp-${group.category}`" :label="group.category">
                            <option v-for="item in group.items" :key="categoryOptionValue(item)" :value="categoryOptionValue(item)">
                              {{ item.sub_category || group.category }}<template v-if="item.off_plan"> (previous)</template><template v-else> — ${{ formatAmount(item.monthly_amount) }}/mo</template>
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
                        <input v-model.number="editTxForm.amount" class="input input-bordered input-sm w-full" type="number" inputmode="decimal" min="0" step="0.01" required />
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
                    <div v-if="editTxError" class="text-sm text-error" role="alert">{{ editTxError }}</div>
                    <div class="flex gap-2">
                      <button type="submit" class="btn btn-primary btn-sm" :disabled="editTxSaving">Save</button>
                      <button type="button" class="btn btn-ghost btn-sm" @click="cancelEdit">Cancel</button>
                    </div>
                  </form>
                </div>
                <ion-item v-else class="budget-tx-list__item">
                  <ion-label>
                    <h2 class="budget-tx-list__date">{{ formatDate(tx.date) }}</h2>
                    <p v-if="tx.description" class="budget-tx-list__desc">{{ tx.description }}</p>
                    <p v-if="tx.destination_institution || tx.destination_acct_type" class="budget-tx-list__meta">
                      → {{ [tx.destination_institution, tx.destination_acct_type].filter(Boolean).join(" — ") }}
                    </p>
                    <p v-if="tx.principal_applied != null && Number(tx.principal_applied) > 0" class="budget-tx-list__meta">
                      Principal ${{ formatAmount(tx.principal_applied) }}<template v-if="tx.interest_applied != null && Number(tx.interest_applied) > 0"> · interest ${{ formatAmount(tx.interest_applied) }}</template>
                    </p>
                  </ion-label>
                  <div slot="end" class="budget-tx-list__end">
                    <span
                      class="budget-tx-list__amount"
                      :class="tx.type === 'income' ? 'budget-tx-list__amount--income' : 'budget-tx-list__amount--expense'"
                    >
                      {{ tx.type === "income" ? "" : "-" }}${{ formatAmount(tx.amount) }}
                    </span>
                    <div class="budget-tx-list__actions">
                      <button type="button" class="btn btn-ghost btn-xs btn-square md:btn-sm" aria-label="Edit" @click="startEditTx(tx)">
                        <AppIcon name="create" :size="18" />
                      </button>
                      <button type="button" class="btn btn-ghost btn-xs btn-square text-error md:btn-sm" aria-label="Delete" @click="confirmDeleteFromModal(tx)">
                        <AppIcon name="trash" :size="18" />
                      </button>
                    </div>
                  </div>
                </ion-item>
              </template>
            </ion-list>
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
          <p v-if="deletingTx" class="text-sm text-base-content/70" :class="isDeletingGrossPaycheck ? 'mb-2' : 'mb-4'">
            Remove {{ deletingTx.category }}{{ deletingTx.sub_category ? ' › ' + deletingTx.sub_category : '' }} — ${{ formatAmount(deletingTx.amount) }}?
          </p>
          <p v-if="isDeletingGrossPaycheck" class="text-sm text-base-content/70 mb-4">
            Net income, tax, and other allocations from this paycheck are removed as well, and those amounts come off the tax page.
          </p>
          <div class="modal-action">
            <button type="button" class="btn btn-ghost" @click="deleteDialogRef?.close()">Cancel</button>
            <button type="button" class="btn btn-error" :disabled="deleting" @click="performDelete">
              {{ deleting ? "Deleting…" : "Delete" }}
            </button>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      <!-- CSV Upload Modal -->
      <dialog ref="csvUploadModalRef" class="modal" @close="closeCsvModal">
        <div class="modal-box max-w-5xl max-h-[90vh] flex flex-col">
          <h3 class="font-semibold text-lg mb-4">
            {{ csvUploadKind === "credit" ? "Upload Credit Card Expenses" : "Upload Checking Expenses" }}
          </h3>
          <p class="text-sm text-base-content/60 mb-4">
            Expense items are filled from your history and the description. Confirm the
            {{ csvUploadKind === "credit" ? "credit card" : "checking account" }},
            ignore anything that is not spending, then save. CSV should have Transaction Date (or Date), Amount, and Description columns.
          </p>
          <label v-if="csvRows.length && csvPaymentSourceOptions.length" class="form-control w-full max-w-md mb-4">
            <span class="label-text text-sm">
              Apply {{ csvUploadKind === "credit" ? "credit card" : "checking account" }} to all rows
            </span>
            <select
              class="select select-bordered select-sm"
              :value="csvBulkPaymentSourceId"
              @change="applyBulkPaymentSource($event)"
            >
              <option value="">Select for all…</option>
              <option
                v-for="opt in csvPaymentSourceOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </option>
            </select>
          </label>
          <div v-if="csvError" class="alert alert-error mb-4">
            <span>{{ csvError }}</span>
          </div>
          <div v-if="csvImportBanner" class="alert alert-info mb-4">
            <span>{{ csvImportBanner }}</span>
          </div>
          <div v-if="!csvPaymentSourceOptions.length" class="alert alert-warning mb-4">
            <span>
              No {{ csvUploadKind === "credit" ? "credit card" : "checking" }} accounts found in Estate Management.
              Add one there, then try again.
            </span>
          </div>
          <div v-if="csvRows.length" class="flex-1 overflow-y-auto min-h-0 border border-base-200 rounded-lg">
            <table class="table table-pin-rows table-xs">
              <thead>
                <tr>
                  <th class="w-16">Ignore</th>
                  <th>Date</th>
                  <th class="text-right">Amount</th>
                  <th>Description</th>
                  <th>{{ csvUploadKind === "credit" ? "Credit Card" : "Checking Account" }}</th>
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
                      v-model="row.paymentSourceId"
                      class="select select-bordered select-sm w-48"
                      :disabled="row.ignored || row.csvImported"
                    >
                      <option value="">Select…</option>
                      <option
                        v-for="opt in csvPaymentSourceOptions"
                        :key="opt.value"
                        :value="opt.value"
                      >
                        {{ opt.label }}
                      </option>
                    </select>
                  </td>
                  <td>
                    <select
                      v-model="row.budgetItemId"
                      class="select select-bordered select-sm w-44"
                      :disabled="row.ignored || row.csvImported"
                      @change="onCsvExpenseItemChange"
                    >
                      <option value="">Select…</option>
                      <optgroup v-for="group in csvExpenseGroups" :key="`csv-exp-${group.category}`" :label="group.category">
                        <option v-for="item in group.items" :key="csvKeyForBudgetItem(item, 'expense')" :value="csvKeyForBudgetItem(item, 'expense')">
                          {{ item.sub_category || group.category }}<template v-if="item.off_plan"> (previous)</template>
                        </option>
                      </optgroup>
                      <optgroup v-for="group in csvInsuranceGroups" :key="`csv-ins-${group.category}`" :label="`Insurance — ${group.category}`">
                        <option v-for="item in group.items" :key="csvKeyForBudgetItem(item, 'insurance')" :value="csvKeyForBudgetItem(item, 'insurance')">
                          {{ item.sub_category || group.category }}<template v-if="item.off_plan"> (previous)</template>
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
                    <span
                      v-else-if="!row.ignored && row.budgetItemId && (row.paymentSourceId || parseCsvBudgetItemKey(row.budgetItemId)?.kind === 'insurance')"
                      class="text-xs text-base-content/50"
                    >{{ row.csvAiSuggested ? "Suggested" : "Ready" }}</span>
                    <span v-else class="text-base-content/30">—</span>
                  </td>
                  <td>
                    <button
                      v-if="row.csvDuplicateSkipped && !row.ignored"
                      type="button"
                      class="btn btn-outline btn-xs whitespace-nowrap"
                      :disabled="row.csvForceAdding || !row.budgetItemId || (!row.paymentSourceId && parseCsvBudgetItemKey(row.budgetItemId)?.kind !== 'insurance')"
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
                  ? "Saving…"
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

<script setup>
import { IonItem, IonLabel, IonList } from "@ionic/vue";
import { formatDebtRecordLabel } from "~/utils/budgetDebt";
import { parseCsvBudgetItemKey } from "~/utils/csvExpenseImport";
import { inferIsRevolvingDebt } from "~/utils/debtPayment";
import { categoryOptionValue } from "~/utils/recordingCategory";

const tracker = inject("budgetTracker");
const {
  auth,
  addDialogRef,
  deleteDialogRef,
  subCategoryModalRef,
  csvFileInputRef,
  csvUploadModalRef,
  csvUploadKind,
  csvBulkPaymentSourceId,
  selectedBudgetItem,
  editingTxId,
  editTxForm,
  editSourceDebtId,
  editTxError,
  editTxSaving,
  budgets,
  budgetOptions,
  periodBudgetId,
  periodBudgetName,
  periodIsOverride,
  periodIsInferred,
  budgetAssignBusy,
  transactions,
  orphans,
  recordingCategories,
  cashAccounts,
  debtRecords,
  incomeSources,
  investmentSources,
  savingsSources,
  annualTotals,
  showNewIncomeFromInput,
  showNewInvestmentFromInput,
  showNewSavingsFromInput,
  loading,
  loadError,
  txSubmitting,
  deleting,
  txError,
  deletingTx,
  isDeletingGrossPaycheck,
  csvRows,
  csvError,
  csvImportBanner,
  csvPageNotice,
  sentenceText,
  sentenceBusy,
  sentenceError,
  sentenceNotice,
  pendingDraft,
  pendingKey,
  sentenceCategories,
  csvSaving,
  now,
  currentYear,
  route,
  queryMonth,
  queryYear,
  selectedMonth,
  selectedYear,
  monthNames,
  yearOptions,
  grossAllocationAmounts,
  txForm,
  mapRecordingCategory,
  expenseBudgetItemById,
  incomeBudgetItemById,
  csvKeyForBudgetItem,
  txRecordingKey,
  recordedTransactions,
  incomeLinesForPaycheck,
  categorySelectionFields,
  groupBudgetItemsByCategory,
  recordingIncomeItems,
  recordingExpenseItems,
  incomeGroupedByCategory,
  expensesGroupedByCategory,
  addModalBudgetTypeOptions,
  incomeBudgetGroups,
  taxBudgetGroups,
  expenseBudgetGroups,
  csvExpenseGroups,
  csvInsuranceGroups,
  validCsvBudgetItemKeys,
  savingsBudgetGroups,
  investmentBudgetGroups,
  insuranceBudgetGroups,
  budgetGroupsForTxType,
  firstBudgetItemIdForType,
  addModalBudgetLineMeta,
  selectedGrossIncomeBudgetItem,
  isGrossIncomePaycheckMode,
  pairedNetIncomeBudgetLine,
  grossAllocExpensePartition,
  grossIncomeAllocatableLines,
  grossAllocTaxLines,
  grossAllocInsuranceLines,
  grossAllocRetirementLines,
  grossAllocInvestmentLines,
  grossIncomeAllocatedTotal,
  grossIncomeNetAmount,
  addTransactionModalTitle,
  budgetTrackerDisplaySections,
  previousCategorySection,
  recordingTypeLabel,
  sectionBudgetedTotal,
  actualForTrackerRow,
  sectionActualTotal,
  budgetTrackerListItems,
  mapBudgetTrackerRow,
  indexAnnualTotals,
  storedYearAmount,
  onBudgetTrackerRowSelect,
  isIncomeSideBudgetType,
  showAppliedAccountSelector,
  addModalExpenseForAppliedAccount,
  selectedDebtForPayment,
  debtPaymentPreview,
  editSelectedDebtForPayment,
  editDebtPaymentPreview,
  useDebtInstitutionsForAddModal,
  editModalExpenseItem,
  editShowsDebtDestination,
  editShowsCashDestination,
  txCalendarParts,
  actualByItem,
  offPlanActualByKey,
  transactionsForModal,
  getActualForItem,
  getBudgetNoteClass,
  budgetDifferenceAmount,
  formatBudgetDifference,
  getBudgetDifferenceClass,
  formatAmount,
  CATEGORY_SUBCATEGORY_DISPLAY_MAX,
  truncateCategoryLabel,
  formatDate,
  loadData,
  onPeriodBudgetChange,
  clearPeriodBudgetOverride,
  pinInferredPeriodBudget,
  cancelNewIncomeFrom,
  cancelNewInvestmentFrom,
  cancelNewSavingsFrom,
  addSavingsSourceFromForm,
  addInvestmentSourceFromForm,
  addIncomeSourceFromForm,
  csvRowsToImport,
  cashAccountLabel,
  cashAccountSearchText,
  isCheckingLikeAccount,
  isCreditLikeAccount,
  isCreditLikeDebt,
  csvPaymentSourceOptions,
  allCsvRowsHaveType,
  csvRowsPendingImport,
  csvPendingImportCount,
  csvHasPendingImportRows,
  parseCsv,
  parseCsvLine,
  parseAmount,
  toISODateString,
  buildExistingExpenseCsvDedupeKeySet,
  csvRowClass,
  parsePaymentSourceId,
  csvRowSubmitBody,
  applyBulkPaymentSource,
  startCsvUpload,
  csvCategoryCatalog,
  suggestCsvCategories,
  onCsvExpenseItemChange,
  csvImportSummary,
  onCsvFileSelected,
  closeCsvModal,
  forceAddCsvExpenseRow,
  saveCsvTransactions,
  buildAddTxDescription,
  submitTransaction,
  resolveIncomeTxContext,
  doSubmitGrossIncomePaycheck,
  doSubmitTransaction,
  openSubCategoryModal,
  startEditTx,
  cancelEdit,
  saveEditTransaction,
  confirmDeleteFromModal,
  addModalBudgetTypeFromItem,
  draftTransactionSentence,
  draftTransaction,
  openPendingDraft,
  addTxFromSubCategory,
  confirmDelete,
  performDelete,
  monthControlValue,
  monthControlOptions,
  onMonthControlChange,
  showPlanControl,
} = tracker;
</script>

<style scoped>
.budget-tx-list {
  margin: 0;
  padding-inline: 8px;
  background: transparent;
}

.budget-tx-list__item {
  --background: var(--color-base-100, #ffffff);
  --color: var(--color-base-content, #151616);
  --border-color: color-mix(in srgb, var(--color-base-content, #151616) 10%, transparent);
  --inner-padding-end: 0.5rem;
}

.budget-tx-list__edit {
  padding: 0.75rem 0;
  border-bottom: 1px solid color-mix(in srgb, var(--color-base-content, #151616) 10%, transparent);
}

.budget-tx-list__date {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
}

.budget-tx-list__desc {
  margin: 0.125rem 0 0;
  font-size: 0.8125rem;
  color: color-mix(in srgb, var(--color-base-content, #151616) 65%, transparent);
}

.budget-tx-list__meta {
  margin: 0.125rem 0 0;
  font-size: 0.75rem;
  color: color-mix(in srgb, var(--color-base-content, #151616) 52%, transparent);
}

.budget-tx-list__end {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
  align-self: center;
  margin-inline-start: 0.5rem;
}

.budget-tx-list__amount {
  font-size: 0.875rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.budget-tx-list__amount--income {
  color: var(--color-pillar, var(--color-primary, #1F3A5F));
}

.budget-tx-list__amount--expense {
  color: #f87171;
}

.budget-tx-list__actions {
  display: flex;
  align-items: center;
  gap: 0.125rem;
}</style>
