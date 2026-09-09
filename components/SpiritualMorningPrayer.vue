<template>
  <div class="min-w-0 max-w-full space-y-6">
    <div class="flex min-w-0 flex-wrap items-end gap-3">
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

    <section class="app-card px-4 py-4">
      <h2 class="text-sm font-semibold text-gray-900">Be Still</h2>
      <p v-for="line in beStillLines" :key="line" class="mt-2 text-sm leading-6 text-gray-900">
        {{ line }}
      </p>
      <p v-for="prompt in beStillPrompts" :key="prompt" class="mt-3 text-sm text-gray-800">
        {{ prompt }}
      </p>
    </section>

    <section class="app-card px-4 py-4">
      <h2 class="text-sm font-semibold text-gray-900">Prayers from Scripture</h2>
      <p class="mt-1 text-xs text-gray-700">
        Morning prayers drawn from the Catholic Public Domain Version.
      </p>
      <p v-if="prayerError" class="mt-3 text-sm text-red-600">{{ prayerError }}</p>
      <p v-else-if="prayerLoading" class="mt-3 text-sm text-gray-700">Loading prayers…</p>
      <p v-else-if="catalogMessage" class="mt-3 text-sm text-amber-700 dark:text-amber-400">{{ catalogMessage }}</p>
      <ul v-else class="mt-4 space-y-4">
        <li v-for="passage in prayers" :key="passage.citation" class="border-t border-gray-200 pt-4 first:border-t-0 first:pt-0">
          <SpiritualPassageCard :passage="passage" />
        </li>
      </ul>
    </section>

    <section class="app-card min-w-0 max-w-full overflow-hidden px-4 py-4">
      <h2 class="text-sm font-semibold text-gray-900">Morning Intention</h2>
      <form class="mt-4 grid min-w-0 gap-3" @submit.prevent="saveIntention">
        <label class="form-control min-w-0">
          <span class="label h-auto min-h-0 items-start py-1">
            <span class="label-text text-sm whitespace-normal break-words">The person I most need to love well today</span>
          </span>
          <input v-model.trim="form.love_person" type="text" maxlength="2000" class="intention-field input input-bordered w-full min-w-0 max-w-full" />
        </label>
        <label class="form-control min-w-0">
          <span class="label h-auto min-h-0 items-start py-1">
            <span class="label-text text-sm whitespace-normal break-words">The virtue I will practice today</span>
          </span>
          <select v-model="form.virtue" class="intention-field select select-bordered w-full min-w-0 max-w-full">
            <option value="">Choose a virtue</option>
            <option v-if="customVirtue" :value="customVirtue">{{ customVirtue }}</option>
            <optgroup v-for="group in virtueGroups" :key="group.name" :label="group.name">
              <option v-for="virtue in group.virtues" :key="virtue" :value="virtue">{{ virtue }}</option>
            </optgroup>
          </select>
        </label>
        <label v-for="field in intentionFields" :key="field.key" class="form-control min-w-0">
          <span class="label h-auto min-h-0 items-start py-1">
            <span class="label-text text-sm whitespace-normal break-words">{{ field.label }}</span>
          </span>
          <input v-model.trim="form[field.key]" type="text" maxlength="2000" class="intention-field input input-bordered w-full min-w-0 max-w-full" />
        </label>
        <p v-if="saveError" class="text-sm text-red-600 dark:text-red-400">{{ saveError }}</p>
        <p v-else-if="saveNotice" class="text-sm text-emerald-700 dark:text-emerald-400">{{ saveNotice }}</p>
        <button type="submit" class="training-chip btn btn-primary btn-sm rounded-full w-fit" :disabled="saving">
          {{ saving ? "Saving…" : "Save intention" }}
        </button>
      </form>
    </section>
  </div>
</template>

<script setup>
import { parseFetchError } from "~/utils/parseFetchError";
import { todayIsoDate } from "~/utils/liturgicalCalendar";
import {
  BE_STILL_LINES,
  BE_STILL_PROMPTS,
  MORNING_INTENTION_FIELDS,
  VIRTUES,
  VIRTUE_GROUPS,
  emptySpiritualReview,
} from "~/utils/spiritualReview";

const beStillLines = BE_STILL_LINES;
const beStillPrompts = BE_STILL_PROMPTS;
const intentionFields = MORNING_INTENTION_FIELDS;
const virtueGroups = VIRTUE_GROUPS;

function matchListedVirtue(value) {
  const needle = String(value || "").trim().toLowerCase();
  if (!needle) return "";
  return VIRTUES.find((virtue) => virtue.toLowerCase() === needle) || "";
}

const customVirtue = computed(() => {
  const value = String(form.value.virtue || "").trim();
  if (!value || matchListedVirtue(value)) return "";
  return value;
});

const reviewOn = ref(todayIsoDate());
const prayers = ref([]);
const prayerLoading = ref(false);
const prayerError = ref("");
const catalogMessage = ref("");
const form = ref(emptySpiritualReview());
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
  prayerLoading.value = true;
  prayerError.value = "";
  catalogMessage.value = "";
  saveError.value = "";
  saveNotice.value = "";
  try {
    const [verseData, reviewData] = await Promise.all([
      $fetch("/api/spiritual/verses/prayers", { query: { date: reviewOn.value } }),
      $fetch("/api/spiritual/review", { query: { date: reviewOn.value } }),
    ]);
    prayers.value = verseData?.prayers || [];
    catalogMessage.value = verseData?.catalog?.message || "";
    form.value = { ...emptySpiritualReview(), ...(reviewData?.review || {}) };
    form.value.virtue = matchListedVirtue(form.value.virtue) || form.value.virtue || "";
  } catch (error) {
    prayerError.value = parseFetchError(error, "Failed to load morning prayer.");
  } finally {
    prayerLoading.value = false;
  }
}

async function saveIntention() {
  saving.value = true;
  saveError.value = "";
  saveNotice.value = "";
  try {
    const data = await $fetch("/api/spiritual/review", {
      method: "PUT",
      body: {
        date: reviewOn.value,
        love_person: form.value.love_person,
        virtue: form.value.virtue,
        faithful_act: form.value.faithful_act,
        surrender: form.value.surrender,
      },
    });
    form.value = { ...form.value, ...(data?.review || {}) };
    saveNotice.value = "Intention saved.";
  } catch (error) {
    saveError.value = parseFetchError(error, "Failed to save intention.");
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.intention-field {
  min-width: 0;
  max-width: 100%;
  width: 100%;
  box-sizing: border-box;
}
</style>
