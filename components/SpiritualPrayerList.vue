<template>
  <div class="min-w-0 max-w-full space-y-6">
    <div
      v-if="unavailableMessage"
      class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
    >
      {{ unavailableMessage }}
    </div>

    <template v-else>
      <section class="app-card min-w-0 max-w-full overflow-hidden px-4 py-4">
        <h2 class="text-sm font-semibold text-gray-900">{{ editingId ? "Edit request" : "Add a request" }}</h2>
        <form class="mt-3 grid min-w-0 gap-3 sm:grid-cols-2" @submit.prevent="saveRequest">
          <label class="form-control min-w-0 sm:col-span-2">
            <span class="label py-1"><span class="label-text text-sm">What are you praying for?</span></span>
            <input v-model="form.title" type="text" maxlength="200" required class="prayer-field input input-bordered" placeholder="For example: healing after surgery" />
          </label>
          <label class="form-control min-w-0">
            <span class="label py-1"><span class="label-text text-sm">For whom (optional)</span></span>
            <input v-model="form.person" type="text" maxlength="120" class="prayer-field input input-bordered" />
          </label>
          <label class="form-control min-w-0">
            <span class="label py-1"><span class="label-text text-sm">Category (optional)</span></span>
            <select v-model="form.category" class="prayer-field select select-bordered">
              <option value="">None</option>
              <option v-for="category in categories" :key="category" :value="category">{{ category }}</option>
            </select>
          </label>
          <label class="form-control min-w-0 sm:col-span-2">
            <span class="label py-1"><span class="label-text text-sm">Notes (optional)</span></span>
            <textarea v-model="form.notes" maxlength="2000" rows="2" class="prayer-field textarea textarea-bordered" />
          </label>
          <div class="flex flex-wrap items-center gap-2 sm:col-span-2">
            <button type="submit" class="training-chip btn btn-primary btn-sm rounded-full" :disabled="saving || !form.title.trim()">
              {{ saving ? "Saving…" : editingId ? "Save changes" : "Add to my list" }}
            </button>
            <button v-if="editingId" type="button" class="training-chip btn btn-ghost btn-sm rounded-full" @click="resetForm">Cancel</button>
            <span class="text-xs text-gray-700">Private to your account.</span>
          </div>
        </form>
        <p v-if="formError" class="mt-2 text-sm text-red-600">{{ formError }}</p>
      </section>

      <section class="min-w-0 space-y-3">
        <div class="flex flex-wrap gap-2" role="tablist" aria-label="Prayer list views">
          <button
            v-for="item in views"
            :key="item.key"
            type="button"
            role="tab"
            class="training-chip btn btn-sm rounded-full"
            :class="view === item.key ? 'btn-primary' : 'btn-ghost'"
            :aria-selected="view === item.key"
            @click="view = item.key"
          >
            {{ item.label }}<span v-if="counts[item.key]" class="ml-1 opacity-70">{{ counts[item.key] }}</span>
          </button>
        </div>

        <p v-if="loadError" class="text-sm text-red-600">{{ loadError }}</p>
        <div v-else-if="loading" class="app-card px-4 py-6 text-sm text-gray-700">Loading…</div>
        <div v-else-if="!prayers.length" class="app-card px-4 py-6 text-base leading-6 text-muted">
          {{ emptyText }}
        </div>
        <ul v-else class="space-y-3">
          <li v-for="prayer in prayers" :key="prayer.prayer_id" class="app-card min-w-0 px-4 py-4">
            <div class="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
              <h3 class="min-w-0 break-words text-base font-semibold text-gray-900">{{ prayer.title }}</h3>
              <span class="sl-caption">{{ metaLine(prayer) }}</span>
            </div>
            <p v-if="prayer.person || prayer.category" class="mt-1 text-sm text-muted">
              {{ [prayer.person, prayer.category].filter(Boolean).join(" · ") }}
            </p>
            <p v-if="prayer.notes" class="mt-2 whitespace-pre-line break-words text-sm text-gray-800">{{ prayer.notes }}</p>
            <div v-if="prayer.answered_on" class="mt-3 rounded-md bg-gray-50 px-3 py-2">
              <p class="inline-flex items-center gap-1 text-xs font-semibold text-gray-900">
                <AppIcon name="heart" :size="18" filled />
                Answered {{ formatDate(prayer.answered_on) }}
              </p>
              <p v-if="prayer.answer_note" class="sl-scripture mt-1 whitespace-pre-line break-words">{{ prayer.answer_note }}</p>
            </div>

            <form v-if="answeringId === prayer.prayer_id" class="mt-3 grid min-w-0 gap-2" @submit.prevent="answer(prayer)">
              <label class="form-control min-w-0 max-w-xs">
                <span class="label py-1"><span class="label-text text-sm">Answered on</span></span>
                <input v-model="answerForm.answered_on" type="date" class="prayer-field input input-bordered input-sm" />
              </label>
              <label class="form-control min-w-0">
                <span class="label py-1"><span class="label-text text-sm">How was it answered? (optional)</span></span>
                <textarea v-model="answerForm.answer_note" rows="2" maxlength="2000" class="prayer-field textarea textarea-bordered" />
              </label>
              <div class="flex flex-wrap gap-2">
                <button type="submit" class="training-chip btn btn-primary btn-xs rounded-full" :disabled="busyId === prayer.prayer_id">Save answer</button>
                <button type="button" class="training-chip btn btn-ghost btn-xs rounded-full" @click="answeringId = 0">Cancel</button>
              </div>
            </form>

            <div v-else class="mt-3 flex flex-wrap gap-2">
              <template v-if="view === 'active'">
                <button type="button" class="training-chip btn btn-ghost btn-xs rounded-full" @click="startAnswer(prayer)">Answered</button>
                <button type="button" class="training-chip btn btn-ghost btn-xs rounded-full" @click="startEdit(prayer)">Edit</button>
                <button type="button" class="training-chip btn btn-ghost btn-xs rounded-full" :disabled="busyId === prayer.prayer_id" @click="act(prayer, 'archive')">Archive</button>
              </template>
              <template v-else-if="view === 'answered'">
                <button type="button" class="training-chip btn btn-ghost btn-xs rounded-full" @click="startAnswer(prayer)">Edit answer</button>
                <button type="button" class="training-chip btn btn-ghost btn-xs rounded-full" :disabled="busyId === prayer.prayer_id" @click="act(prayer, 'unanswer')">Still praying</button>
                <button type="button" class="training-chip btn btn-ghost btn-xs rounded-full" :disabled="busyId === prayer.prayer_id" @click="act(prayer, 'archive')">Archive</button>
              </template>
              <template v-else>
                <button type="button" class="training-chip btn btn-ghost btn-xs rounded-full" :disabled="busyId === prayer.prayer_id" @click="act(prayer, 'unarchive')">Restore</button>
                <button type="button" class="training-chip btn btn-ghost btn-xs rounded-full text-red-700" :disabled="busyId === prayer.prayer_id" @click="remove(prayer)">Delete</button>
              </template>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<script setup>
import { parseFetchError } from "~/utils/parseFetchError";
import { todayIsoDate } from "~/utils/liturgicalCalendar";
import { PRAYER_CATEGORIES } from "~/utils/prayerList";

const { light } = useHaptics();
const categories = PRAYER_CATEGORIES;
const views = [
  { key: "active", label: "Active" },
  { key: "answered", label: "Answered" },
  { key: "archived", label: "Archived" },
];

const view = ref("active");
const prayers = ref([]);
const counts = ref({ active: 0, answered: 0, archived: 0 });
const loading = ref(true);
const loadError = ref("");
const unavailableMessage = ref("");
const form = ref(emptyForm());
const editingId = ref(0);
const saving = ref(false);
const formError = ref("");
const answeringId = ref(0);
const answerForm = ref({ answered_on: "", answer_note: "" });
const busyId = ref(0);

const emptyText = computed(() => {
  if (view.value === "answered") return "When God answers a prayer, mark it answered and it will be remembered here.";
  if (view.value === "archived") return "Nothing archived.";
  return "Add the people and needs you want to carry in prayer.";
});

function emptyForm() {
  return { title: "", person: "", category: "", notes: "" };
}

function formatDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: y === new Date().getFullYear() ? undefined : "numeric",
  });
}

function metaLine(prayer) {
  return `Since ${formatDate(prayer.created_on)}`;
}

async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    const data = await $fetch("/api/spiritual/prayers", { query: { view: view.value } });
    unavailableMessage.value = data?.unavailable ? data.message : "";
    prayers.value = data?.prayers || [];
    counts.value = data?.counts || counts.value;
  } catch (error) {
    loadError.value = parseFetchError(error, "Failed to load the prayer list.");
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  form.value = emptyForm();
  editingId.value = 0;
  formError.value = "";
}

function startEdit(prayer) {
  editingId.value = prayer.prayer_id;
  form.value = { title: prayer.title, person: prayer.person, category: prayer.category, notes: prayer.notes };
  formError.value = "";
  if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
}

async function saveRequest() {
  saving.value = true;
  formError.value = "";
  try {
    if (editingId.value) {
      await $fetch(`/api/spiritual/prayers/${editingId.value}`, { method: "PUT", body: { action: "edit", ...form.value } });
    } else {
      await $fetch("/api/spiritual/prayers", { method: "POST", body: { ...form.value, date: todayIsoDate() } });
      view.value = "active";
    }
    resetForm();
    await load();
  } catch (error) {
    formError.value = parseFetchError(error, "Could not save the request.");
  } finally {
    saving.value = false;
  }
}

function startAnswer(prayer) {
  answeringId.value = prayer.prayer_id;
  answerForm.value = { answered_on: prayer.answered_on || todayIsoDate(), answer_note: prayer.answer_note || "" };
}

async function answer(prayer) {
  busyId.value = prayer.prayer_id;
  loadError.value = "";
  try {
    await $fetch(`/api/spiritual/prayers/${prayer.prayer_id}`, {
      method: "PUT",
      body: { action: "answer", ...answerForm.value, date: todayIsoDate() },
    });
    answeringId.value = 0;
    light();
    await load();
  } catch (error) {
    loadError.value = parseFetchError(error, "Could not save the answer.");
  } finally {
    busyId.value = 0;
  }
}

async function act(prayer, action) {
  busyId.value = prayer.prayer_id;
  loadError.value = "";
  try {
    await $fetch(`/api/spiritual/prayers/${prayer.prayer_id}`, { method: "PUT", body: { action } });
    await load();
  } catch (error) {
    loadError.value = parseFetchError(error, "Could not update the request.");
  } finally {
    busyId.value = 0;
  }
}

async function remove(prayer) {
  if (!window.confirm(`Delete "${prayer.title}" for good?`)) return;
  busyId.value = prayer.prayer_id;
  try {
    await $fetch(`/api/spiritual/prayers/${prayer.prayer_id}`, { method: "DELETE" });
    await load();
  } catch (error) {
    loadError.value = parseFetchError(error, "Could not delete the request.");
  } finally {
    busyId.value = 0;
  }
}

watch(view, () => {
  answeringId.value = 0;
  void load();
});

onMounted(load);
</script>

<style scoped>
.prayer-field {
  min-width: 0;
  max-width: 100%;
  width: 100%;
  box-sizing: border-box;
}
</style>
