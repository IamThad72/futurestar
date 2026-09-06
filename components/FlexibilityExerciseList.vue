<template>
  <div class="space-y-6">
    <p class="text-sm text-gray-500 dark:text-gray-400">{{ introText }}</p>

    <div v-if="filterOptions.length" class="flex flex-wrap gap-2">
      <button
        v-for="option in filterOptions"
        :key="option.key"
        type="button"
        class="training-chip btn btn-sm rounded-full"
        :class="
          regionFilter === option.key
            ? 'btn-primary'
            : 'btn-ghost bg-base-200'
        "
        @click="regionFilter = option.key"
      >
        {{ option.label }}
      </button>
    </div>

    <input
      v-model.trim="searchInput"
      type="search"
      class="input input-bordered w-full max-w-md rounded-full"
      :placeholder="searchPlaceholder"
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
import {
  FEATURED_FLEXIBILITY_DB_IDS,
  FLEXIBILITY_BODY_REGIONS,
  FLEXIBILITY_EXERCISES,
  FLEXIBILITY_FILTERS,
  FLEXIBILITY_REGIONS,
  gifUrlForFeaturedFlexibility,
  isPlyometricExercise,
  isStretchExercise,
  isYogaExercise,
} from "~/utils/flexibilityExercises";
import { parseFetchError } from "~/utils/parseFetchError";

const props = defineProps({
  kind: { type: String, default: "all" },
});

const regionFilter = ref("all");
const searchInput = ref("");
const searchQuery = ref("");
const loading = ref(false);
const loadingMore = ref(false);
const loadError = ref("");
const warning = ref("");
function matchesListKind(exercise) {
  if (props.kind === "yoga") return isYogaExercise(exercise.name);
  if (props.kind === "plyo") return isPlyometricExercise(exercise.name);
  if (props.kind === "stretch") return isStretchExercise(exercise.name);
  return true;
}

const featured = ref(FLEXIBILITY_EXERCISES.filter(matchesListKind).map(toLocalFeatured));
const catalog = ref([]);
const hasMore = ref(false);
const catalogOffset = ref(0);
const attribution = ref({
  required: true,
  text: "Exercise names, instructions, and GIFs from ExerciseDB by AscendAPI.",
  url: "https://ascendapi.com",
});

const filterOptions = computed(() => {
  if (props.kind === "plyo") return [];
  if (props.kind === "stretch" || props.kind === "yoga") {
    return [{ key: "all", label: "All" }, ...FLEXIBILITY_BODY_REGIONS];
  }
  return FLEXIBILITY_FILTERS;
});
const regionGroups = computed(() => {
  if (props.kind === "plyo") return [{ key: "plyo", label: "Plyometrics" }];
  if (props.kind === "stretch" || props.kind === "yoga") return FLEXIBILITY_BODY_REGIONS;
  return FLEXIBILITY_REGIONS;
});
const introText = computed(() => {
  if (props.kind === "stretch") return "Hold a comfortable stretch, not pain. Ease off if you feel sharp pain.";
  if (props.kind === "yoga") return "Move slowly and breathe through each pose. Ease off if you feel sharp pain.";
  if (props.kind === "plyo") {
    return "Land quietly and stop if joints feel sharp pain. These are explosive jumps and plyo push-ups from the catalog.";
  }
  return "Hold a comfortable stretch, not pain. Stretches and yoga are name-matched; plyometrics are the jump and plyo moves in the local catalog.";
});
const searchPlaceholder = computed(() => {
  if (props.kind === "stretch") return "Search stretches";
  if (props.kind === "yoga") return "Search yoga poses";
  if (props.kind === "plyo") return "Search plyometrics";
  return "Search stretches, yoga, and plyometrics";
});
const pageSize = 48;

function withFeaturedGif(exercise) {
  const knownId = FEATURED_FLEXIBILITY_DB_IDS[exercise.id] || exercise.exerciseId || null;
  return {
    ...exercise,
    exerciseId: knownId,
    gifUrl: exercise.gifUrl || gifUrlForFeaturedFlexibility(exercise.id),
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

function matchesRegionFilter(exercise) {
  if (!matchesListKind(exercise)) return false;
  if (regionFilter.value === "yoga") return isYogaExercise(exercise.name);
  if (regionFilter.value === "plyo") return isPlyometricExercise(exercise.name);
  if (regionFilter.value !== "all" && exercise.region !== regionFilter.value) return false;
  return true;
}

function groupByRegion(exercises) {
  return regionGroups.value.map((group) => ({
    ...group,
    exercises: exercises.filter((exercise) => {
      if (!matchesRegionFilter(exercise)) return false;
      return exercise.region === group.key;
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
  return groupByRegion(merged);
});

async function fetchPage({ append = false } = {}) {
  const offset = append ? catalogOffset.value : 0;
  const data = await $fetch("/api/physical/flexibility", {
    query: {
      region: regionFilter.value,
      kind: props.kind !== "all" ? props.kind : undefined,
      q: searchQuery.value || undefined,
      offset,
      limit: pageSize,
    },
  });
  featured.value = (
    Array.isArray(data.featured) ? data.featured : FLEXIBILITY_EXERCISES.filter(matchesListKind)
  ).map(withFeaturedGif);
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
    featured.value = FLEXIBILITY_EXERCISES.filter((exercise) => {
      if (!matchesRegionFilter(exercise)) return false;
      if (!searchQuery.value) return true;
      return exercise.name.toLowerCase().includes(searchQuery.value.toLowerCase());
    }).map(toLocalFeatured);
    catalog.value = [];
    hasMore.value = false;
    loadError.value = parseFetchError(error, "Could not load the flexibility catalog.");
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

watch([regionFilter, searchQuery], () => {
  void loadExercises();
});

onMounted(() => {
  void loadExercises();
});

onBeforeUnmount(() => {
  clearTimeout(searchTimer);
});
</script>
