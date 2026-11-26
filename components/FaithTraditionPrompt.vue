<template>
  <section v-if="visible" class="app-card mb-4 px-4 py-4" aria-labelledby="faith-prompt-title">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 id="faith-prompt-title" class="text-sm font-semibold text-gray-900">Which tradition fits you best?</h2>
        <p class="mt-1 text-xs leading-5 text-gray-700">
          This sets your Bible translation, church calendar and evening review. You can change it any time under You.
        </p>
      </div>
      <button type="button" class="btn btn-ghost btn-xs" aria-label="Not now" @click="dismiss">Not now</button>
    </div>
    <div class="mt-3 flex flex-wrap gap-2">
      <button
        v-for="option in traditions"
        :key="option.value"
        type="button"
        class="training-chip btn btn-ghost btn-sm rounded-full"
        :disabled="saving"
        :title="option.description"
        @click="choose(option.value)"
      >
        {{ option.label }}
      </button>
    </div>
    <p v-if="error" class="mt-2 text-sm text-red-600 dark:text-red-400">{{ error }}</p>
  </section>
</template>

<script setup>
import { parseFetchError } from "~/utils/parseFetchError";
import { FAITH_TRADITIONS } from "~/utils/faithProfile";

const DISMISS_KEY = "futurestar.faithPromptDismissed";

const faith = useFaithProfile();
const traditions = FAITH_TRADITIONS;
const saving = ref(false);
const error = ref("");
const dismissed = ref(false);

const visible = computed(() => faith.needsChoice.value && !dismissed.value);

function dismiss() {
  dismissed.value = true;
  try {
    window.localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // storage unavailable
  }
}

async function choose(tradition) {
  saving.value = true;
  error.value = "";
  try {
    await faith.save({ tradition });
  } catch (err) {
    error.value = parseFetchError(err, "Could not save your tradition.");
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  try {
    dismissed.value = window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    dismissed.value = false;
  }
  void faith.load();
});
</script>
