<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end gap-3">
      <label class="form-control w-full max-w-xs">
        <span class="label py-1">
          <span class="label-text text-sm text-gray-600 dark:text-gray-300">Day</span>
        </span>
        <input v-model="reviewOn" type="date" class="input input-bordered w-full" />
      </label>
      <button type="button" class="training-chip btn btn-ghost btn-sm rounded-full" @click="reviewOn = todayIsoDate()">
        Today
      </button>
    </div>

    <section class="app-card px-4 py-4">
      <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Evening Examen</h2>
      <p v-if="loadError" class="mt-2 text-sm text-red-600 dark:text-red-400">{{ loadError }}</p>
      <form class="mt-4 grid gap-3" @submit.prevent="saveExamen">
        <label v-for="(field, index) in examenFields" :key="field.key" class="form-control">
          <span class="label py-1">
            <span class="label-text text-sm">{{ index + 1 }}. {{ field.label }}</span>
          </span>
          <textarea
            v-model.trim="form[field.key]"
            rows="3"
            maxlength="2000"
            class="textarea textarea-bordered w-full"
          />
        </label>
        <p v-if="saveError" class="text-sm text-red-600 dark:text-red-400">{{ saveError }}</p>
        <p v-else-if="saveNotice" class="text-sm text-emerald-700 dark:text-emerald-400">{{ saveNotice }}</p>
        <button type="submit" class="training-chip btn btn-primary btn-sm rounded-full w-fit" :disabled="saving">
          {{ saving ? "Saving…" : "Save examen" }}
        </button>
      </form>
    </section>

    <section class="app-card px-4 py-4">
      <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Closing Prayer</h2>
      <p v-for="line in closingLines" :key="line" class="mt-2 text-sm leading-6 text-gray-800 dark:text-gray-100">
        {{ line }}
      </p>
    </section>
  </div>
</template>

<script setup>
import { parseFetchError } from "~/utils/parseFetchError";
import { todayIsoDate } from "~/utils/liturgicalCalendar";
import { CLOSING_PRAYER_LINES, EXAMEN_FIELDS, emptySpiritualReview } from "~/utils/spiritualReview";

const examenFields = EXAMEN_FIELDS;
const closingLines = CLOSING_PRAYER_LINES;

const reviewOn = ref(todayIsoDate());
const form = ref(emptySpiritualReview());
const loading = ref(false);
const loadError = ref("");
const saving = ref(false);
const saveError = ref("");
const saveNotice = ref("");

watch(reviewOn, () => {
  void loadDay();
});

onMounted(() => {
  void loadDay();
});

async function loadDay() {
  loading.value = true;
  loadError.value = "";
  saveError.value = "";
  saveNotice.value = "";
  try {
    const data = await $fetch("/api/spiritual/review", { query: { date: reviewOn.value } });
    form.value = { ...emptySpiritualReview(), ...(data?.review || {}) };
  } catch (error) {
    loadError.value = parseFetchError(error, "Failed to load this day’s examen.");
  } finally {
    loading.value = false;
  }
}

async function saveExamen() {
  saving.value = true;
  saveError.value = "";
  saveNotice.value = "";
  try {
    const data = await $fetch("/api/spiritual/review", {
      method: "PUT",
      body: {
        date: reviewOn.value,
        grateful: form.value.grateful,
        presence: form.value.presence,
        troubled: form.value.troubled,
        integrity: form.value.integrity,
        shortfall: form.value.shortfall,
        amends: form.value.amends,
        tomorrow: form.value.tomorrow,
      },
    });
    form.value = { ...form.value, ...(data?.review || {}) };
    saveNotice.value = "Examen saved.";
  } catch (error) {
    saveError.value = parseFetchError(error, "Failed to save examen.");
  } finally {
    saving.value = false;
  }
}
</script>
