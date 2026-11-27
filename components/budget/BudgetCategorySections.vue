<template>
        <div class="budget-tracker-lists space-y-4 md:space-y-6">
        <template v-for="section in budgetTrackerDisplaySections" :key="section.key">
          <EstateSection :title="section.title" :show-add="false" compact>
            <template #total>
              <span>${{ formatAmount(sectionActualTotal(section)) }}</span>
              <span class="text-base-content/50"> / </span>
              <span class="budget-tracker-budgeted">${{ formatAmount(sectionBudgetedTotal(section)) }}</span>
            </template>
            <EstateRecordList
              :items="budgetTrackerListItems(section)"
              item-key="_listKey"
              :map-row="mapBudgetTrackerRow(section)"
              @edit="onBudgetTrackerRowSelect(section, $event)"
            />
          </EstateSection>
        </template>

          <EstateSection
            v-if="previousCategorySection.rows.length"
            title="Previous categories"
            :show-add="false"
            compact
          >
            <template #total>
              <span>${{ formatAmount(sectionActualTotal(previousCategorySection)) }}</span>
            </template>
            <p class="mb-2 text-xs text-base-content/60">
              Categories from other budgets, or ones you changed earlier this year. New transactions can still use them.
            </p>
            <EstateRecordList
              :items="budgetTrackerListItems(previousCategorySection)"
              item-key="_listKey"
              :map-row="mapBudgetTrackerRow(previousCategorySection)"
              @edit="onBudgetTrackerRowSelect(previousCategorySection, $event)"
            />
          </EstateSection>
        </div>

        <EmptyState
          v-if="!loadError && !budgetTrackerDisplaySections.length && !previousCategorySection.rows.length"
          title="No budget lines yet."
          sentence="Add a line in Budget Setup, then record spending against it here."
          :action="canWrite ? 'Add a budget line' : ''"
          :to="canWrite ? '/cash_flow_mgmt' : ''"
        />
</template>

<script setup>
const tracker = inject("budgetTracker");
const {
  auth,
  canWrite,
  loadError,
  budgetTrackerDisplaySections,
  previousCategorySection,
  sectionActualTotal,
  sectionBudgetedTotal,
  formatAmount,
  budgetTrackerListItems,
  mapBudgetTrackerRow,
  onBudgetTrackerRowSelect,
} = tracker;
</script>

<style scoped>
.budget-tracker-budgeted {
  color: var(--color-pillar, var(--color-primary, #1F3A5F));
}

.budget-tracker-lists :deep(.estate-record-list__item) {
  --background: var(--color-base-200, #fbf8f3);
}
</style>
