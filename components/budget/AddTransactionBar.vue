<template>
  <form class="grid gap-2" @submit.prevent="draftTransaction">
    <div class="flex items-center gap-2">
      <label class="min-w-0 flex-1">
        <span class="sr-only">Add a transaction</span>
        <input
          v-model.trim="sentenceText"
          type="text"
          maxlength="240"
          class="input input-bordered w-full"
          placeholder="Kroger 64.18 yesterday"
          aria-describedby="add-transaction-help"
        />
      </label>
      <button type="submit" class="btn btn-primary shrink-0" :disabled="sentenceBusy || sentenceText.length < 2">
        {{ sentenceBusy ? "Adding…" : "Add" }}
      </button>
    </div>
    <p id="add-transaction-help" class="text-sm text-muted">
      Type a store, amount, and day. You'll review it before it's saved.
    </p>
    <p v-if="sentenceError" class="text-sm text-error">{{ sentenceError }}</p>
    <p v-else-if="sentenceNotice" class="text-sm text-base-content/70">{{ sentenceNotice }}</p>
    <div v-if="pendingDraft" class="flex flex-wrap items-end gap-2">
      <label class="form-control min-w-0 flex-1">
        <span class="label py-1"><span class="label-text text-sm">Category</span></span>
        <select v-model="pendingKey" class="select select-bordered w-full">
          <option value="">Pick a category</option>
          <option v-for="cat in sentenceCategories" :key="cat.key" :value="cat.key">{{ cat.label }}</option>
        </select>
      </label>
      <button type="button" class="btn btn-primary btn-sm" :disabled="!pendingKey" @click="openPendingDraft">
        Continue
      </button>
    </div>
  </form>
</template>

<script setup>
const tracker = inject("budgetTracker");
const {
  sentenceText,
  sentenceBusy,
  sentenceError,
  sentenceNotice,
  pendingDraft,
  pendingKey,
  sentenceCategories,
  draftTransaction,
  openPendingDraft,
} = tracker;
</script>
