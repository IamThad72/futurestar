<template>
  <section id="faith" class="app-card px-4 py-4">
    <h2 class="text-sm font-semibold text-gray-900">Faith settings</h2>
    <p class="mt-1 text-xs text-gray-700">
      Your tradition sets the Bible translation, the church calendar and the name of the evening review.
      Only you can see this.
    </p>

    <p v-if="!faith.loaded.value" class="mt-3 text-sm text-gray-700">Loading faith settings…</p>

    <template v-else>
      <p
        v-if="faith.state.value.unavailable"
        class="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
      >
        Faith settings are not set up yet, so the original Catholic setup is in use.
      </p>

      <form class="mt-4 grid min-w-0 gap-4" @submit.prevent="saveSettings">
        <fieldset class="min-w-0">
          <legend class="text-sm font-medium text-gray-900">Tradition</legend>
          <div class="mt-2 grid gap-2">
            <label
              v-for="option in traditions"
              :key="option.value"
              class="flex cursor-pointer items-start gap-3 rounded-md border border-base-300 px-3 py-2"
              :class="form.tradition === option.value ? 'border-primary bg-base-200/60' : ''"
            >
              <input
                v-model="form.tradition"
                type="radio"
                name="faith-tradition"
                class="radio radio-sm mt-0.5"
                :value="option.value"
                :disabled="disabled"
                @change="onTraditionChange"
              />
              <span class="min-w-0">
                <span class="block text-sm font-medium text-gray-900">{{ option.label }}</span>
                <span class="block text-xs leading-5 text-gray-700">{{ option.description }}</span>
              </span>
            </label>
          </div>
        </fieldset>

        <label class="form-control min-w-0">
          <span class="label py-1">
            <span class="label-text text-sm text-gray-900">Bible translation</span>
          </span>
          <select
            v-model="form.translation"
            class="select select-bordered w-full min-w-0 max-w-full"
            :disabled="disabled"
            @change="translationTouched = true"
          >
            <option v-for="option in translations" :key="option.code" :value="option.code">
              {{ option.name }} ({{ option.code }})
            </option>
          </select>
          <span class="label py-1">
            <span class="label-text-alt whitespace-normal text-xs text-gray-700">
              {{ selectedTranslation?.description }} {{ selectedTranslation?.license }}.
            </span>
          </span>
        </label>

        <label class="flex cursor-pointer items-start gap-3">
          <input
            v-model="form.show_calendar"
            type="checkbox"
            class="toggle toggle-sm mt-0.5"
            :disabled="disabled"
          />
          <span class="min-w-0">
            <span class="block text-sm font-medium text-gray-900">Show the church calendar</span>
            <span class="block text-xs leading-5 text-gray-700">{{ calendarHint }}</span>
          </span>
        </label>

        <p v-if="saveError" class="text-sm text-red-600 dark:text-red-400">{{ saveError }}</p>
        <p v-else-if="saveNotice" class="text-sm text-emerald-700 dark:text-emerald-400">{{ saveNotice }}</p>

        <button type="submit" class="training-chip btn btn-primary btn-sm w-fit rounded-full" :disabled="disabled || saving">
          {{ saving ? "Saving…" : "Save faith settings" }}
        </button>
      </form>
    </template>
  </section>
</template>

<script setup>
import { parseFetchError } from "~/utils/parseFetchError";
import { BIBLE_TRANSLATIONS } from "~/utils/bibleTranslations";
import { FAITH_TRADITIONS, defaultTranslationForTradition } from "~/utils/faithProfile";

const faith = useFaithProfile();
const traditions = FAITH_TRADITIONS;
const translations = BIBLE_TRANSLATIONS;

const form = ref({ ...faith.profile.value });
const translationTouched = ref(false);
const saving = ref(false);
const saveError = ref("");
const saveNotice = ref("");

const disabled = computed(() => faith.state.value.unavailable);
const selectedTranslation = computed(() => translations.find((item) => item.code === form.value.translation) || null);
const calendarHint = computed(() =>
  form.value.tradition === "catholic"
    ? "The General Roman Calendar: seasons, solemnities, feasts and saints' days."
    : form.value.tradition === "orthodox"
      ? "The church year dated from Orthodox Pascha: Great Lent, Holy Week, Pascha, Pentecost and the Nativity Fast."
      : "The church year: Advent, Christmas, Epiphany, Lent, Holy Week, Easter and Pentecost.",
);

watch(
  () => faith.profile.value,
  (value) => {
    form.value = { ...value };
    translationTouched.value = false;
  },
);

function onTraditionChange() {
  if (!translationTouched.value) {
    form.value.translation = defaultTranslationForTradition(form.value.tradition);
  }
}

async function saveSettings() {
  saving.value = true;
  saveError.value = "";
  saveNotice.value = "";
  try {
    await faith.save({ ...form.value });
    saveNotice.value = "Faith settings saved.";
  } catch (error) {
    saveError.value = parseFetchError(error, "Failed to save faith settings.");
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  void faith.load();
});
</script>
