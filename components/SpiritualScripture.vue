<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end gap-3">
      <label class="form-control w-full max-w-xs">
        <span class="label py-1">
          <span class="label-text text-sm text-gray-700">Day</span>
        </span>
        <input v-model="reviewOn" type="date" class="input input-bordered w-full" />
      </label>
      <button type="button" class="training-chip btn btn-ghost btn-sm rounded-full" @click="reviewOn = todayIsoDate()">
        Today
      </button>
    </div>

    <p v-if="loadError" class="text-sm text-red-600">{{ loadError }}</p>
    <p v-else-if="loading" class="text-sm text-gray-700">Loading Scripture…</p>
    <p v-else-if="catalogMessage" class="text-sm text-amber-700 dark:text-amber-400">{{ catalogMessage }}</p>
    <p v-if="catalogNotice" class="text-xs text-gray-700">{{ catalogNotice }}</p>

    <section v-if="weekly" class="app-card px-4 py-4">
      <h2 class="text-sm font-semibold text-gray-900">Scripture for This Week</h2>
      <div class="mt-3">
        <SpiritualPassageCard :passage="weekly" :attribution="translation" />
      </div>
    </section>

    <section class="app-card px-4 py-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold text-gray-900">Scripture for This Day</h2>
          <p class="mt-1 text-xs text-gray-700">
            One reading from the Old Testament and one from the New Testament.
          </p>
        </div>
        <button
          type="button"
          class="training-chip btn btn-ghost btn-sm rounded-full"
          :disabled="loading"
          @click="drawAnother"
        >
          {{ loading ? "Loading…" : "Another pair" }}
        </button>
      </div>
      <div class="mt-4 grid gap-4 md:grid-cols-2">
        <article v-if="oldTestament" class="rounded-md bg-gray-50 px-3 py-3">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-700">
            Old Testament
          </h3>
          <div class="mt-2">
            <SpiritualPassageCard :passage="oldTestament" />
          </div>
        </article>
        <article v-if="newTestament" class="rounded-md bg-gray-50 px-3 py-3">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-700">
            New Testament
          </h3>
          <div class="mt-2">
            <SpiritualPassageCard :passage="newTestament" />
          </div>
        </article>
      </div>
      <div class="mt-4">
        <button
          type="button"
          class="training-chip btn btn-ghost btn-sm rounded-full"
          :disabled="questionsLoading || (!oldTestament && !newTestament)"
          @click="askQuestions"
        >
          {{ questionsLoading ? "Asking…" : "Reflection questions" }}
        </button>
        <p v-if="questionsError" class="mt-2 text-sm text-red-600">{{ questionsError }}</p>
        <ul v-else-if="questions.length" class="mt-3 space-y-2">
          <li v-for="question in questions" :key="question" class="text-sm text-gray-800">{{ question }}</li>
        </ul>
      </div>
    </section>
  </div>
</template>

<script setup>
import { parseFetchError } from "~/utils/parseFetchError";
import { todayIsoDate } from "~/utils/liturgicalCalendar";

const reviewOn = ref(todayIsoDate());
const loading = ref(false);
const loadError = ref("");
const catalogMessage = ref("");
const catalogNotice = ref("");
const translation = ref("");
const weekly = ref(null);
const oldTestament = ref(null);
const newTestament = ref(null);
const refresh = ref(0);
const questions = ref([]);
const questionsLoading = ref(false);
const questionsError = ref("");

watch(reviewOn, () => {
  refresh.value = 0;
  void loadDay();
});

onMounted(() => {
  void loadDay();
});

async function loadDay() {
  loading.value = true;
  loadError.value = "";
  catalogMessage.value = "";
  try {
    const data = await $fetch("/api/spiritual/verses/daily", {
      query: { date: reviewOn.value, refresh: refresh.value || undefined },
    });
    weekly.value = data?.weekly || null;
    oldTestament.value = data?.old_testament || null;
    newTestament.value = data?.new_testament || null;
    catalogMessage.value = data?.catalog?.message || "";
    catalogNotice.value = data?.catalog?.notice || "";
    translation.value = data?.catalog?.seeded ? data?.catalog?.translation || "" : "";
    questions.value = [];
    questionsError.value = "";
  } catch (error) {
    loadError.value = parseFetchError(error, "Failed to load Scripture.");
  } finally {
    loading.value = false;
  }
}

function drawAnother() {
  refresh.value += 1;
  void loadDay();
}

async function askQuestions() {
  const passages = [oldTestament.value, newTestament.value]
    .filter((passage) => passage?.citation && passage?.text)
    .map((passage) => ({ citation: passage.citation, text: passage.text }));
  if (!passages.length || questionsLoading.value) return;
  questionsLoading.value = true;
  questionsError.value = "";
  try {
    const data = await $fetch("/api/spiritual/assist", {
      method: "POST",
      body: { action: "questions", passages },
    });
    questions.value = Array.isArray(data?.questions) ? data.questions : [];
  } catch (error) {
    questionsError.value = parseFetchError(error, "Could not write reflection questions.");
  } finally {
    questionsLoading.value = false;
  }
}
</script>
