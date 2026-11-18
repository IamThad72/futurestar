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
      <p v-for="line in beStillLines" :key="line" class="sl-scripture mt-3">
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
      <div v-if="carriedIntention" class="mt-3 rounded-md bg-gray-50 px-3 py-3">
        <p class="text-sm text-gray-800">Last night you intended {{ carriedIntention }}</p>
        <div class="mt-2 flex flex-wrap gap-2">
          <button type="button" class="training-chip btn btn-ghost btn-xs rounded-full" @click="useCarriedIntention">
            Use
          </button>
          <button type="button" class="training-chip btn btn-ghost btn-xs rounded-full" :disabled="shortening" @click="shortenCarriedIntention">
            {{ shortening ? "Shortening…" : "Shorten" }}
          </button>
        </div>
        <p v-if="shortenedIntention" class="mt-2 text-sm text-gray-800">{{ shortenedIntention }}</p>
      </div>
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
              <option v-for="virtue in group.virtues" :key="virtue.name" :value="virtue.name">
                {{ virtue.name }} — {{ virtue.definition }}
              </option>
            </optgroup>
          </select>
        </label>
        <div>
          <button
            type="button"
            class="training-chip btn btn-ghost btn-xs w-fit rounded-full"
            :disabled="!form.virtue || practicing"
            @click="offerPractice"
          >
            {{ practicing ? "Writing…" : "Offer a practice" }}
          </button>
          <p v-if="practiceText" class="mt-2 text-sm text-gray-800">{{ practiceText }}</p>
          <button
            v-if="practiceText"
            type="button"
            class="training-chip btn btn-ghost btn-xs mt-2 w-fit rounded-full"
            @click="form.faithful_act = practiceText"
          >
            Use in the faithful act
          </button>
        </div>
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
import { addDaysIso, todayIsoDate } from "~/utils/liturgicalCalendar";
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
const carriedIntention = ref("");
const shortenedIntention = ref("");
const shortening = ref(false);
const practiceText = ref("");
const practicing = ref(false);
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
    const [verseData, reviewData, previousData] = await Promise.all([
      $fetch("/api/spiritual/verses/prayers", { query: { date: reviewOn.value } }),
      $fetch("/api/spiritual/review", { query: { date: reviewOn.value } }),
      $fetch("/api/spiritual/review", { query: { date: addDaysIso(reviewOn.value, -1) } }),
    ]);
    prayers.value = verseData?.prayers || [];
    catalogMessage.value = verseData?.catalog?.message || "";
    form.value = { ...emptySpiritualReview(), ...(reviewData?.review || {}) };
    form.value.virtue = matchListedVirtue(form.value.virtue) || form.value.virtue || "";
    carriedIntention.value = String(previousData?.review?.tomorrow || "").trim();
    shortenedIntention.value = "";
    practiceText.value = "";
  } catch (error) {
    prayerError.value = parseFetchError(error, "Failed to load morning prayer.");
  } finally {
    prayerLoading.value = false;
  }
}

async function useCarriedIntention() {
  form.value.faithful_act = shortenedIntention.value || carriedIntention.value;
}

async function shortenCarriedIntention() {
  const text = carriedIntention.value;
  if (!text || shortening.value) return;
  shortening.value = true;
  try {
    const data = await $fetch("/api/spiritual/assist", {
      method: "POST",
      body: { action: "shorten", answer: text },
    });
    shortenedIntention.value = String(data?.text || "").trim();
  } catch (error) {
    saveError.value = parseFetchError(error, "Could not shorten that intention.");
  } finally {
    shortening.value = false;
  }
}

async function offerPractice() {
  if (!form.value.virtue || practicing.value) return;
  practicing.value = true;
  saveError.value = "";
  try {
    const data = await $fetch("/api/spiritual/assist", {
      method: "POST",
      body: { action: "virtue", virtue: form.value.virtue },
    });
    practiceText.value = String(data?.text || "").trim();
  } catch (error) {
    saveError.value = parseFetchError(error, "Could not offer a practice.");
  } finally {
    practicing.value = false;
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
