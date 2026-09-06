<template>
  <div class="space-y-6">
    <p class="text-sm text-gray-500 dark:text-gray-400">
      Choose a load you can control for every pulling rep. Stop a set if form breaks or you feel sharp pain.
      Rest {{ defaultRest }} between working sets unless the exercise says otherwise.
    </p>

    <div class="flex flex-wrap gap-2">
      <button
        v-for="option in filterOptions"
        :key="option.key"
        type="button"
        class="training-chip btn btn-sm rounded-full"
        :class="
          equipmentFilter === option.key
            ? 'btn-primary'
            : 'btn-ghost bg-base-200'
        "
        @click="equipmentFilter = option.key"
      >
        {{ option.label }}
      </button>
    </div>

    <input
      v-model.trim="searchInput"
      type="search"
      class="input input-bordered w-full max-w-md rounded-full"
      placeholder="Search exercises or muscles"
      autocomplete="off"
    />

    <p v-if="loadError" class="text-sm text-red-600 dark:text-red-400">{{ loadError }}</p>
    <p v-else-if="warning" class="text-sm text-amber-700 dark:text-amber-400">{{ warning }}</p>
    <p v-else-if="loading && !featured.length" class="text-sm text-gray-500 dark:text-gray-400">Loading exercises…</p>

    <section v-for="group in groupedExercises" :key="group.key" class="space-y-3">
      <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ group.label }}</h2>
      <ul class="space-y-4">
        <li v-for="exercise in group.exercises" :key="exercise.id">
          <ExerciseCard :exercise="exercise" />
        </li>
      </ul>
    </section>

    <button
      v-if="hasMore"
      type="button"
      class="training-chip btn btn-ghost btn-sm rounded-full bg-base-200"
      :disabled="loadingMore"
      @click="loadMore"
    >
      {{ loadingMore ? "Loading…" : "Load more" }}
    </button>

    <p v-else-if="!loading && searchInput && !groupedExercises.length" class="text-sm text-gray-500 dark:text-gray-400">
      No exercises matched that search.
    </p>

    <p v-if="attribution" class="text-xs text-gray-500 dark:text-gray-400">
      Exercise names, instructions, and GIFs from ExerciseDB by
      <a :href="attribution.url" target="_blank" rel="noopener noreferrer" class="underline">AscendAPI</a>.
    </p>
  </div>
</template>

<script setup>
import { FEATURED_EXERCISE_DB_IDS, STRENGTH_EQUIPMENT, STRENGTH_EXERCISES, gifUrlForFeatured } from "~/utils/strengthExercises";
import { parseFetchError } from "~/utils/parseFetchError";

const equipmentFilter = ref("all");
const searchInput = ref("");
const searchQuery = ref("");
const defaultRest = "60–90 seconds";
const loading = ref(false);
const loadingMore = ref(false);
const loadError = ref("");
const warning = ref("");
const featured = ref(STRENGTH_EXERCISES.map(toLocalFeatured));
const catalog = ref([]);
const hasMore = ref(false);
const catalogOffset = ref(0);
const attribution = ref({
  required: true,
  text: "Exercise names, instructions, and GIFs from ExerciseDB by AscendAPI.",
  url: "https://ascendapi.com",
});

const filterOptions = [{ key: "all", label: "All" }, ...STRENGTH_EQUIPMENT];
const pageSize = 48;

function withFeaturedGif(exercise) {
  const knownId = FEATURED_EXERCISE_DB_IDS[exercise.id] || exercise.exerciseId || null;
  return {
    ...exercise,
    exerciseId: knownId,
    gifUrl:
      exercise.gifUrl ||
      gifUrlForFeatured(exercise.id) ||
      (knownId ? `https://static.exercisedb.dev/media/${knownId}.gif` : null),
  };
}

function toLocalFeatured(exercise) {
  return withFeaturedGif({
    ...exercise,
    featured: true,
    targetMuscles: [],
    bodyParts: [],
    secondaryMuscles: [],
  });
}

function groupByEquipment(exercises) {
  return STRENGTH_EQUIPMENT.map((group) => ({
    ...group,
    exercises: exercises.filter((exercise) => {
      if (equipmentFilter.value !== "all" && exercise.equipment !== equipmentFilter.value) {
        return false;
      }
      return exercise.equipment === group.key;
    }),
  })).filter((group) => group.exercises.length);
}

const groupedExercises = computed(() => {
  const seen = new Set();
  const merged = [...featured.value, ...catalog.value].filter((exercise) => {
    const key = exercise.exerciseId || exercise.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return groupByEquipment(merged);
});

async function fetchPage({ append = false } = {}) {
  const offset = append ? catalogOffset.value : 0;
  const data = await $fetch("/api/physical/exercises", {
    query: {
      equipment: equipmentFilter.value,
      q: searchQuery.value || undefined,
      offset,
      limit: pageSize,
    },
  });
  featured.value = (data.featured?.length ? data.featured : STRENGTH_EXERCISES).map(withFeaturedGif);
  catalog.value = append ? [...catalog.value, ...(data.catalog?.items || [])] : data.catalog?.items || [];
  catalogOffset.value = (data.catalog?.offset || 0) + (data.catalog?.items?.length || 0);
  hasMore.value = Boolean(data.catalog?.hasMore);
  warning.value = data.warning || "";
  if (data.attribution) attribution.value = data.attribution;
}

async function loadExercises() {
  loading.value = true;
  loadError.value = "";
  catalogOffset.value = 0;
  try {
    await fetchPage({ append: false });
  } catch (error) {
    featured.value = STRENGTH_EXERCISES.filter((exercise) => {
      if (equipmentFilter.value !== "all" && exercise.equipment !== equipmentFilter.value) return false;
      if (!searchQuery.value) return true;
      return exercise.name.toLowerCase().includes(searchQuery.value.toLowerCase());
    }).map(toLocalFeatured);
    catalog.value = [];
    hasMore.value = false;
    loadError.value = parseFetchError(error, "Could not load the exercise catalog.");
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  loadingMore.value = true;
  try {
    await fetchPage({ append: true });
  } catch (error) {
    loadError.value = parseFetchError(error, "Could not load more exercises.");
  } finally {
    loadingMore.value = false;
  }
}

let searchTimer;
watch(searchInput, (value) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchQuery.value = value;
  }, 300);
});

watch([equipmentFilter, searchQuery], () => {
  void loadExercises();
});

onMounted(() => {
  void loadExercises();
});

onBeforeUnmount(() => {
  clearTimeout(searchTimer);
});
</script>
