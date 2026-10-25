<template>
  <dialog ref="dialogEl" class="modal" @close="onDialogClose">
    <div class="modal-box flex max-h-[90vh] w-[calc(100%-2rem)] max-w-lg flex-col overflow-hidden p-4">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-base font-semibold text-base-content">Add exercise</h3>
        <button type="button" class="training-chip btn btn-primary btn-sm rounded-full" @click="close">Done</button>
      </div>

      <input
        ref="searchEl"
        v-model="searchInput"
        type="search"
        class="input input-bordered mt-3 w-full rounded-full"
        placeholder="Search exercises"
        autocomplete="off"
        aria-label="Search exercises"
      />

      <div class="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <ul v-if="showingTypes" class="space-y-2">
          <li v-for="type in typeList" :key="type.slug">
            <button
              type="button"
              class="flex w-full flex-col items-start rounded-lg border border-base-300 px-4 py-3 text-left"
              @click="openType(type.slug)"
            >
              <span class="text-sm font-semibold text-base-content">{{ type.name }}</span>
              <span class="mt-0.5 text-xs text-base-content/60">{{ type.description }}</span>
            </button>
          </li>
        </ul>
        <template v-else>
        <button type="button" class="training-chip btn btn-ghost btn-sm rounded-full" @click="backToTypes">
          Back
        </button>
        <p class="mt-3 text-sm font-semibold text-base-content">{{ resultTitle }}</p>
        <p v-if="loadError" class="mt-2 text-sm text-error">{{ loadError }}</p>
        <p v-else-if="loading && !rows.length" class="mt-2 text-sm text-base-content/60">Loading exercises…</p>
        <p v-else-if="!loading && !rows.length" class="mt-2 text-sm text-base-content/60">
          {{ searchQuery ? "No exercises matched that search." : "No exercises in this list." }}
        </p>
        <ul v-else class="space-y-2">
          <li v-for="row in rows" :key="row.key" class="rounded-lg border border-base-300 px-3 py-3">
            <div class="flex items-start gap-3">
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold text-base-content">{{ row.name }}</p>
                <p v-if="row.meta" class="mt-0.5 truncate text-xs text-base-content/60">{{ row.meta }}</p>
              </div>
              <button
                type="button"
                class="training-chip btn btn-primary btn-sm shrink-0 rounded-full"
                :disabled="!row.canAdd"
                @click="onAdd(row)"
              >
                {{ addedLabel(row) }}
              </button>
            </div>
            <button
              v-if="row.instructions.length || row.gifUrl || row.description"
              type="button"
              class="mt-2 text-sm font-medium text-primary"
              @click="toggleDetails(row.key)"
            >
              {{ openKey === row.key ? "Hide details" : "Details" }}
            </button>
            <div v-if="openKey === row.key" class="mt-2 space-y-2">
              <img
                v-if="row.gifUrl"
                :src="row.gifUrl"
                alt=""
                class="h-36 w-full rounded-md bg-base-200 object-contain"
                loading="lazy"
              />
              <p v-if="row.description" class="text-sm text-base-content/80">{{ row.description }}</p>
              <ol v-if="row.instructions.length" class="list-decimal space-y-1 pl-4 text-sm text-base-content/80">
                <li v-for="(step, index) in row.instructions" :key="index">{{ step }}</li>
              </ol>
            </div>
          </li>
        </ul>
        <button
          v-if="hasMore && category !== 'all'"
          type="button"
          class="training-chip btn btn-ghost btn-sm mt-3 rounded-full bg-base-200"
          :disabled="loading"
          @click="loadMore"
        >
          {{ loading ? "Loading…" : "Load more" }}
        </button>
        <p v-if="rows.length" class="mt-4 text-xs text-base-content/50">
          Exercise names, instructions, and GIFs from ExerciseDB by AscendAPI.
        </p>
        </template>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button type="submit">close</button>
    </form>
  </dialog>
</template>

<script setup>
import { PHYSICAL_CATEGORIES } from "~/utils/physicalNav";
import { catalogExerciseId } from "~/utils/workoutDraft";
import { parseFetchError } from "~/utils/parseFetchError";

const SOURCES = {
  "strength-training": { url: "/api/physical/exercises", query: {} },
  "cardio-training": { url: "/api/physical/endurance", query: { kind: "cardio" } },
  "aerobic-training": { url: "/api/physical/endurance", query: { kind: "aerobic" } },
  stretching: { url: "/api/physical/flexibility", query: { kind: "stretch" } },
  "yoga-training": { url: "/api/physical/flexibility", query: { kind: "yoga" } },
  "plyometrics-training": { url: "/api/physical/flexibility", query: { kind: "plyo" } },
};

const props = defineProps({
  open: { type: Boolean, default: false },
  addedIds: { type: Array, default: () => [] },
});

const emit = defineEmits(["update:open", "add"]);

const dialogEl = ref(null);
const searchEl = ref(null);
const searchInput = ref("");
const searchQuery = ref("");
const category = ref("all");
const rows = ref([]);
const loading = ref(false);
const loadError = ref("");
const hasMore = ref(false);
const catalogOffset = ref(0);
const openKey = ref("");
const justAddedKey = ref("");
let searchTimer;
let requestSeq = 0;
let justAddedTimer;

const typeList = PHYSICAL_CATEGORIES.map((item) => ({
  slug: item.slug,
  name: item.name.replace(" Training", ""),
  description: item.description,
}));

const showingTypes = computed(() => category.value === "all" && !searchQuery.value);
const selectedType = computed(() => typeList.find((item) => item.slug === category.value) || null);
const resultTitle = computed(() => selectedType.value?.name || "Search");

const addedSet = computed(() => new Set((props.addedIds || []).map((id) => String(id))));

function exerciseKey(exercise) {
  return String(catalogExerciseId(exercise) || exercise?.id || exercise?.name || "");
}

function equipmentLabel(value) {
  const raw = String(value || "").replace(/[-_]/g, " ").trim();
  if (!raw || raw === "all") return "";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function toRow(exercise, categoryName) {
  const muscles = Array.isArray(exercise?.targetMuscles) ? exercise.targetMuscles : [];
  const meta = [categoryName, equipmentLabel(exercise?.equipment), muscles[0]].filter(Boolean).join(" · ");
  return {
    key: `${categoryName}:${exerciseKey(exercise)}`,
    exercise,
    name: String(exercise?.name || "Exercise"),
    meta,
    gifUrl: exercise?.gifUrl || "",
    description: String(exercise?.description || ""),
    instructions: Array.isArray(exercise?.instructions) ? exercise.instructions : [],
    canAdd: Boolean(catalogExerciseId(exercise)),
    exerciseId: catalogExerciseId(exercise),
  };
}

function dedupe(list) {
  const seen = new Set();
  return list.filter((row) => {
    const id = row.exerciseId || row.key;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function addedLabel(row) {
  if (justAddedKey.value && justAddedKey.value === row.exerciseId) return "Added";
  if (row.exerciseId && addedSet.value.has(row.exerciseId)) return "Added";
  return row.canAdd ? "Add" : "Unavailable";
}

function toggleDetails(key) {
  openKey.value = openKey.value === key ? "" : key;
}

async function fetchSource(slug, { append = false, seq }) {
  const source = SOURCES[slug];
  const categoryName = PHYSICAL_CATEGORIES.find((item) => item.slug === slug)?.name?.replace(" Training", "") || "";
  const offset = append ? catalogOffset.value : 0;
  const data = await $fetch(source.url, {
    query: {
      ...source.query,
      q: searchQuery.value || undefined,
      offset,
      limit: 40,
    },
  });
  if (seq !== requestSeq) return;
  const featured = append ? [] : data.featured || [];
  const items = data.catalog?.items || [];
  const mapped = [...featured, ...items].map((exercise) => toRow(exercise, categoryName));
  rows.value = dedupe(append ? [...rows.value, ...mapped] : mapped);
  catalogOffset.value = offset + items.length;
  hasMore.value = Boolean(data.catalog?.hasMore);
}

async function fetchAll(seq) {
  const settled = await Promise.allSettled(
    Object.keys(SOURCES).map(async (slug) => {
      const source = SOURCES[slug];
      const categoryName = PHYSICAL_CATEGORIES.find((item) => item.slug === slug)?.name?.replace(" Training", "") || "";
      const data = await $fetch(source.url, {
        query: {
          ...source.query,
          q: searchQuery.value,
          offset: 0,
          limit: 15,
        },
      });
      return [...(data.featured || []), ...(data.catalog?.items || [])].map((exercise) => toRow(exercise, categoryName));
    }),
  );
  if (seq !== requestSeq) return;
  const merged = [];
  let failures = 0;
  for (const result of settled) {
    if (result.status === "fulfilled") merged.push(...result.value);
    else failures += 1;
  }
  rows.value = dedupe(merged);
  hasMore.value = false;
  catalogOffset.value = 0;
  if (failures && !merged.length) {
    throw new Error("Could not search exercises.");
  }
  if (failures) loadError.value = "Some training lists could not be searched.";
}

async function load({ append = false } = {}) {
  const seq = ++requestSeq;
  if (category.value === "all" && !searchQuery.value) {
    rows.value = [];
    hasMore.value = false;
    loadError.value = "";
    loading.value = false;
    return;
  }
  loading.value = true;
  if (!append) loadError.value = "";
  try {
    if (category.value === "all") await fetchAll(seq);
    else await fetchSource(category.value, { append, seq });
  } catch (error) {
    if (seq !== requestSeq) return;
    if (!append) rows.value = [];
    hasMore.value = false;
    loadError.value = parseFetchError(error, "Could not load exercises.");
  } finally {
    if (seq === requestSeq) loading.value = false;
  }
}

function loadMore() {
  if (category.value === "all" || loading.value || !hasMore.value) return;
  void load({ append: true });
}

function openType(slug) {
  category.value = slug;
}

function backToTypes() {
  clearTimeout(searchTimer);
  searchInput.value = "";
  searchQuery.value = "";
  category.value = "all";
  openKey.value = "";
}

function onAdd(row) {
  if (!row.canAdd) return;
  emit("add", row.exercise);
  justAddedKey.value = row.exerciseId;
  clearTimeout(justAddedTimer);
  justAddedTimer = setTimeout(() => {
    justAddedKey.value = "";
  }, 1200);
}

function close() {
  emit("update:open", false);
  if (dialogEl.value?.open) dialogEl.value.close();
}

function onDialogClose() {
  if (props.open) emit("update:open", false);
}

watch(searchInput, (value) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchQuery.value = value.trim();
  }, 300);
});

watch([category, searchQuery], () => {
  openKey.value = "";
  if (!props.open) return;
  void load();
});

watch(
  () => props.open,
  (isOpen) => {
    nextTick(() => {
      const dialog = dialogEl.value;
      if (!dialog) return;
      if (isOpen && !dialog.open) {
        backToTypes();
        dialog.showModal();
        void load();
        searchEl.value?.focus();
      } else if (!isOpen && dialog.open) {
        dialog.close();
      }
    });
  },
);

onBeforeUnmount(() => {
  clearTimeout(searchTimer);
  clearTimeout(justAddedTimer);
});
</script>
