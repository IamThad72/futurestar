<template>
  <section class="app-page">
    <p v-if="!auth.ready" class="text-sm text-muted">Loading…</p>

    <template v-else>
      <BudgetTrackerHeader />

      <div v-if="canWrite" class="app-sticky-action">
        <AddTransactionBar />
      </div>
      <p v-else class="mb-4 text-sm text-base-content/70">{{ signInMessage }}</p>

      <p v-if="loading" class="py-8 text-sm text-muted">Loading…</p>

      <LoadErrorPanel v-else-if="loadError" :message="loadError" @retry="loadData" />

      <div v-else class="py-4 md:py-6">
        <BudgetCategorySections />
      </div>

      <BudgetTrackerDialogs />
    </template>
  </section>
</template>

<script setup>
import AddTransactionBar from "~/components/budget/AddTransactionBar.vue";

const tracker = useBudgetTracker();
provide("budgetTracker", tracker);

const { auth, loading, loadError, loadData, canWrite } = tracker;
const signInMessage = SIGN_IN_MESSAGE;
</script>
