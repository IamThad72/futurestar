<template>
  <div class="min-w-0 max-w-full space-y-6">
    <div class="flex flex-wrap items-end gap-3">
      <label class="form-control min-w-0 w-full max-w-xs">
        <span class="label py-1">
          <span class="label-text text-sm text-gray-700">Day</span>
        </span>
        <input v-model="reviewOn" type="date" class="input input-bordered w-full min-w-0 max-w-full" />
      </label>
      <button type="button" class="training-chip btn btn-ghost btn-sm rounded-full" @click="reviewOn = todayIsoDate()">
        Today
      </button>
    </div>

    <section class="app-card min-w-0 max-w-full overflow-hidden px-4 py-4">
      <h2 class="text-sm font-semibold text-gray-900">{{ faith.evening.value }}</h2>
      <p v-if="loadError" class="mt-2 text-sm text-red-600">{{ loadError }}</p>
      <form v-if="auth.user || auth.sessionEnded" class="mt-4 grid min-w-0 gap-3" @submit.prevent="saveExamen">
        <label v-for="(field, index) in examenFields" :key="field.key" class="form-control min-w-0">
          <span class="label h-auto min-h-0 items-start py-1">
            <span class="label-text text-sm whitespace-normal break-words">
              {{ index + 1 }}. {{ field.label }}
            </span>
          </span>
          <textarea
            v-model.trim="form[field.key]"
            rows="2"
            maxlength="2000"
            class="examen-textarea textarea textarea-bordered textarea-sm w-full min-w-0 max-w-full"
          />
          <button
            v-if="followFields.has(field.key)"
            type="button"
            class="training-chip btn btn-ghost btn-xs mt-2 w-fit rounded-full"
            :disabled="followLoading === field.key || !String(form[field.key] || '').trim()"
            @click="askFollowUp(field.key)"
          >
            {{ followLoading === field.key ? "Asking…" : "Ask a follow-up" }}
          </button>
          <p v-if="followQuestions[field.key]" class="mt-2 text-sm text-gray-800">{{ followQuestions[field.key] }}</p>
        </label>
        <p v-if="saveError" class="text-sm text-red-600 dark:text-red-400">{{ saveError }}</p>
        <p v-else-if="saveNotice" class="text-sm text-emerald-700 dark:text-emerald-400">{{ saveNotice }}</p>
        <button type="submit" class="training-chip btn btn-primary btn-sm rounded-full w-fit" :disabled="saving">
          {{ saving ? "Saving…" : `Save ${faith.eveningWord.value}` }}
        </button>
      </form>
    </section>

    <SpiritualPrayerReminders :date="reviewOn" title="Bring before God tonight" />

    <section class="app-card min-w-0 max-w-full px-4 py-4">
      <h2 class="text-sm font-semibold text-gray-900">Closing Prayer</h2>
      <p v-for="line in closingLines" :key="line" class="mt-2 text-sm leading-6 text-gray-900">
        {{ line }}
      </p>
    </section>
  </div>
</template>

<script setup>
import { parseFetchError } from "~/utils/parseFetchError";
import { todayIsoDate } from "~/utils/liturgicalCalendar";
import { CLOSING_PRAYER_LINES, EXAMEN_FIELDS, emptySpiritualReview } from "~/utils/spiritualReview";

const faith = useFaithProfile();
const auth = useAuthStore();
const examenFields = EXAMEN_FIELDS;
const followFields = new Set(["grateful", "troubled", "shortfall"]);
const closingLines = CLOSING_PRAYER_LINES;

const reviewOn = ref(todayIsoDate());
const form = ref(emptySpiritualReview());
const loading = ref(false);
const loadError = ref("");
const saving = ref(false);
const saveError = ref("");
const saveNotice = ref("");
const followLoading = ref("");
const followQuestions = ref({});

watch(reviewOn, () => {
  void loadDay();
});

onMounted(() => {
  void faith.load();
  void loadDay();
});

async function loadDay() {
  loading.value = true;
  loadError.value = "";
  saveError.value = "";
  saveNotice.value = "";
  try {
    const data = await $fetch("/api/spiritual/review", { query: { date: reviewOn.value } });
    followQuestions.value = {};
    form.value = { ...emptySpiritualReview(), ...(data?.review || {}) };
  } catch (error) {
    const failure = settleLoadError(error, `Failed to load this day’s ${faith.eveningWord.value}.`);
    loadError.value = failure.message;
    if (failure.auth) form.value = emptySpiritualReview();
  } finally {
    loading.value = false;
  }
}

async function askFollowUp(field) {
  const answer = String(form.value[field] || "").trim();
  if (answer.length < 2 || followLoading.value) return;
  followLoading.value = field;
  saveError.value = "";
  try {
    const data = await $fetch("/api/spiritual/assist", {
      method: "POST",
      body: { action: "followup", field, answer },
    });
    followQuestions.value = { ...followQuestions.value, [field]: String(data?.text || "").trim() };
  } catch (error) {
    saveError.value = parseFetchError(error, "Could not ask a follow-up.");
  } finally {
    followLoading.value = "";
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
    saveNotice.value = faith.eveningWord.value === "examen" ? "Examen saved." : "Reflection saved.";
  } catch (error) {
    saveError.value = parseFetchError(error, `Failed to save ${faith.eveningWord.value}.`);
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.examen-textarea {
  min-width: 0;
  max-width: 100%;
  width: 100%;
  box-sizing: border-box;
  field-sizing: fixed;
}
</style>
