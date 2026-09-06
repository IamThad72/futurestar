<template>
  <div class="space-y-6">
    <p class="text-sm text-gray-500 dark:text-gray-400">{{ introText }}</p>

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
  AEROBIC_EQUIPMENT,
  CARDIO_EQUIPMENT,
  ENDURANCE_EQUIPMENT,
  ENDURANCE_EXERCISES,
  featuredEnduranceCatalogId,
  gifUrlForFeaturedEndurance,
} from "~/utils/enduranceExercises";
import { parseFetchError } from "~/utils/parseFetchError";

const props = defineProps({
  kind: { type: String, default: "all" },
});

const equipmentFilter = ref("all");
const searchInput = ref("");
const searchQuery = ref("");
const loading = ref(false);
const loadingMore = ref(false);
const loadError = ref("");
const warning = ref("");
function matchesListKind(exercise) {
  if (props.kind === "cardio") return CARDIO_EQUIPMENT.some((item) => item.key === exercise.equipment);
  if (props.kind === "aerobic") return AEROBIC_EQUIPMENT.some((item) => item.key === exercise.equipment);
  return true;
}

const featured = ref(ENDURANCE_EXERCISES.filter(matchesListKind).map(toLocalFeatured));
const catalog = ref([]);
const hasMore = ref(false);
const catalogOffset = ref(0);
const attribution = ref({
  required: true,
  text: "Exercise names, instructions, and GIFs from ExerciseDB by AscendAPI.",
  url: "https://ascendapi.com",
});

const equipmentGroups = computed(() => {
  if (props.kind === "cardio") return CARDIO_EQUIPMENT;
  if (props.kind === "aerobic") return AEROBIC_EQUIPMENT;
  return ENDURANCE_EQUIPMENT;
});
const filterOptions = computed(() => [{ key: "all", label: "All" }, ...equipmentGroups.value]);
const introText = computed(() => {
  if (props.kind === "cardio") {
    return "Hold a pace you can sustain. Outdoor is for runs, walks, rides, hikes, and swims. Machines cover bikes, ellipticals, and similar trainers.";
  }
  if (props.kind === "aerobic") {
    return "Short, higher-pulse work: jumps, climbers, ropes, and swings. Land quietly and rest between bouts.";
  }
  return "Hold a pace you can sustain. This list is ExerciseDB cardio plus other aerobic work already in the cache (jumps, sprints, kettlebell swings). Outdoor is for runs, walks, rides, hikes, and swims.";
});
const searchPlaceholder = computed(() => {
  if (props.kind === "cardio") return "Search outdoor and machine cardio";
  if (props.kind === "aerobic") return "Search aerobic exercises";
  return "Search exercises";
});
const pageSize = 48;

function withFeaturedGif(exercise) {
  return {
    ...exercise,
    exerciseId: featuredEnduranceCatalogId(exercise),
    gifUrl: exercise.gifUrl || gifUrlForFeaturedEndurance(exercise.id) || null,
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
  return equipmentGroups.value.map((group) => ({
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
  const data = await $fetch("/api/physical/endurance", {
    query: {
      equipment: equipmentFilter.value,
      kind: props.kind !== "all" ? props.kind : undefined,
      q: searchQuery.value || undefined,
      offset,
      limit: pageSize,
    },
  });
  featured.value = (data.featured?.length ? data.featured : ENDURANCE_EXERCISES.filter(matchesListKind)).map(
    withFeaturedGif,
  );
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
    featured.value = ENDURANCE_EXERCISES.filter((exercise) => {
      if (!matchesListKind(exercise)) return false;
      if (equipmentFilter.value !== "all" && exercise.equipment !== equipmentFilter.value) return false;
      if (!searchQuery.value) return true;
      return exercise.name.toLowerCase().includes(searchQuery.value.toLowerCase());
    }).map(toLocalFeatured);
    catalog.value = [];
    hasMore.value = false;
    loadError.value = parseFetchError(error, "Could not load the cardio catalog.");
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
