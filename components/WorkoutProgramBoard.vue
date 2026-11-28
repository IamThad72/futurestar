<template>
  <div class="space-y-4">
    <p v-if="formError" class="text-sm text-error">{{ formError }}</p>

    <form v-if="creating" class="space-y-3 rounded-lg border border-base-300 bg-base-100 p-4" @submit.prevent="createProgram">
      <h2 class="text-base font-semibold text-base-content">New program</h2>
      <label class="block text-sm font-medium text-base-content">
        Name
        <input v-model="createDraft.name" type="text" maxlength="120" class="input input-bordered mt-1 min-h-11 w-full text-base" />
      </label>
      <label class="block text-sm font-medium text-base-content">
        Description
        <textarea v-model="createDraft.description" maxlength="2000" rows="3" class="textarea textarea-bordered mt-1 w-full text-base" />
      </label>
      <div class="flex flex-wrap gap-2">
        <button type="submit" class="btn btn-primary min-h-11" :disabled="acting">Save program</button>
        <button type="button" class="btn btn-ghost min-h-11" :disabled="acting" @click="emit('cancel-create')">Cancel</button>
      </div>
    </form>

    <template v-if="view === 'home'">
      <ul v-if="programs.length" class="space-y-2">
        <li v-for="(program, index) in programs" :key="program.programId">
          <div class="flex min-h-11 items-stretch gap-1 rounded-lg border border-base-300 bg-base-100">
            <button type="button" class="min-h-11 min-w-0 flex-1 px-4 py-3 text-left" @click="openProgram(program)">
              <span class="block truncate text-sm font-semibold text-base-content">{{ program.name }}</span>
              <span class="text-sm text-base-content/60">
                {{ program.workoutCount }} {{ program.workoutCount === 1 ? "workout" : "workouts" }}
              </span>
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-sm min-h-11 min-w-11"
              :disabled="acting || index === 0"
              aria-label="Move program up"
              @click="moveProgram(index, -1)"
            >
              ↑
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-sm min-h-11 min-w-11"
              :disabled="acting || index === programs.length - 1"
              aria-label="Move program down"
              @click="moveProgram(index, 1)"
            >
              ↓
            </button>
          </div>
        </li>
      </ul>
      <button
        v-if="unassigned.length"
        type="button"
        class="flex min-h-11 w-full items-center gap-3 rounded-lg border border-base-300 bg-base-100 px-4 py-3 text-left"
        @click="openUnassigned"
      >
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-semibold text-base-content">Unassigned</span>
          <span class="text-sm text-base-content/60">
            {{ unassigned.length }} {{ unassigned.length === 1 ? "workout" : "workouts" }}
          </span>
        </span>
        <span class="text-sm text-base-content/60">Open</span>
      </button>
    </template>

    <template v-else>
      <button type="button" class="btn btn-ghost min-h-11" @click="backHome">Programs</button>

      <template v-if="view === 'program' && activeProgram">
        <div class="space-y-2">
          <h2 class="text-lg font-semibold text-base-content">{{ activeProgram.name }}</h2>
          <p v-if="activeProgram.description" class="text-sm text-base-content/70">{{ activeProgram.description }}</p>
        </div>
        <form v-if="editingProgram" class="space-y-3 rounded-lg border border-base-300 bg-base-100 p-4" @submit.prevent="saveProgram">
          <label class="block text-sm font-medium text-base-content">
            Name
            <input v-model="programDraft.name" type="text" maxlength="120" class="input input-bordered mt-1 min-h-11 w-full text-base" />
          </label>
          <label class="block text-sm font-medium text-base-content">
            Description
            <textarea v-model="programDraft.description" maxlength="2000" rows="3" class="textarea textarea-bordered mt-1 w-full text-base" />
          </label>
          <div class="flex flex-wrap gap-2">
            <button type="submit" class="btn btn-primary min-h-11" :disabled="acting">Save program</button>
            <button type="button" class="btn btn-ghost min-h-11" :disabled="acting" @click="editingProgram = false">Cancel</button>
          </div>
        </form>
        <div v-else class="flex flex-wrap gap-2">
          <button type="button" class="btn btn-ghost min-h-11" :disabled="acting" @click="startEdit">Edit program</button>
          <button type="button" class="btn btn-ghost min-h-11 text-error" :disabled="acting" @click="onDelete">Delete program</button>
        </div>
        <EmptyState
          v-if="!activeProgram.workouts.length"
          title="No workouts in this program yet."
          sentence="Create a workout here, or add one from Unassigned."
          level="3"
        />
        <template v-else-if="grouped.grouped">
          <details
            v-for="group in grouped.weekGroups"
            :key="group.week"
            class="rounded-lg border border-base-300 bg-base-100"
            :open="group.week === firstWeek"
          >
            <summary class="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold text-base-content">
              Week {{ group.week }}
              <span class="font-normal text-base-content/60">· {{ group.workouts.length }} {{ group.workouts.length === 1 ? "workout" : "workouts" }}</span>
            </summary>
            <div class="space-y-2 border-t border-base-300 px-3 py-3">
              <WorkoutProgramRow
                v-for="workout in group.workouts"
                :key="workout.workoutId"
                :workout="workout"
                :programs="programs"
                :acting="acting"
                show-reorder
                show-remove
                @open="emit('open-workout', workout)"
                @add="addWorkout(workout, $event)"
                @remove="removeWorkout(workout)"
                @move="moveWorkout(group.workouts, workout.workoutId, $event)"
              />
            </div>
          </details>
          <section v-if="grouped.other.length" class="space-y-2">
            <h3 class="text-sm font-semibold text-base-content">Other workouts</h3>
            <WorkoutProgramRow
              v-for="workout in grouped.other"
              :key="workout.workoutId"
              :workout="workout"
              :programs="programs"
              :acting="acting"
              show-reorder
              show-remove
              @open="emit('open-workout', workout)"
              @add="addWorkout(workout, $event)"
              @remove="removeWorkout(workout)"
              @move="moveWorkout(grouped.other, workout.workoutId, $event)"
            />
          </section>
        </template>
        <div v-else class="space-y-2">
          <WorkoutProgramRow
            v-for="workout in orderedWorkouts"
            :key="workout.workoutId"
            :workout="workout"
            :programs="programs"
            :acting="acting"
            show-reorder
            show-remove
            @open="emit('open-workout', workout)"
            @add="addWorkout(workout, $event)"
            @remove="removeWorkout(workout)"
            @move="moveWorkout(orderedWorkouts, workout.workoutId, $event)"
          />
        </div>
      </template>

      <template v-else-if="view === 'unassigned'">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-lg font-semibold text-base-content">Unassigned</h2>
          <button v-if="programs.length" type="button" class="btn btn-primary min-h-11" @click="toggleBulk">
            {{ bulkOpen ? "Cancel" : "Add to program" }}
          </button>
        </div>
        <p v-if="!programs.length" class="text-sm text-base-content/70">Create a program first, then add these workouts to it.</p>
        <div v-if="bulkOpen" class="space-y-3 rounded-lg border border-base-300 bg-base-100 p-4">
          <button type="button" class="btn btn-ghost min-h-11" :disabled="!dayGroups.length" @click="selectWeekDays">
            Select Week/Day workouts
          </button>
          <label v-if="dayGroups.length > 1" class="block text-sm text-base-content">
            Plan title
            <select v-model="prefix" class="select select-bordered mt-1 min-h-11 w-full text-base">
              <option value="">Choose a title</option>
              <option v-for="group in dayGroups" :key="group.prefix || 'week'" :value="group.prefix">
                {{ group.prefix || "Week/Day workouts" }} · {{ group.count }}
              </option>
            </select>
          </label>
          <p v-if="checked.length" class="text-sm text-base-content/80">
            {{ preview.count }} {{ preview.count === 1 ? "workout" : "workouts" }}
            <template v-if="preview.weekMin != null">
              · {{ preview.weekMin === preview.weekMax ? `Week ${preview.weekMin}` : `Weeks ${preview.weekMin}–${preview.weekMax}` }}
            </template>
            <template v-if="preview.sharedTitle"> · {{ preview.sharedTitle }}</template>
          </p>
          <label class="block text-sm text-base-content">
            Program
            <select v-model="bulkProgramId" class="select select-bordered mt-1 min-h-11 w-full text-base">
              <option value="">Add to program</option>
              <option v-for="program in programs" :key="program.programId" :value="String(program.programId)">
                {{ program.name }}
              </option>
            </select>
          </label>
          <button type="button" class="btn btn-primary min-h-11" :disabled="acting || !checked.length || !bulkProgramId" @click="confirmBulk">
            Add checked workouts
          </button>
        </div>
        <div class="space-y-2">
          <WorkoutProgramRow
            v-for="workout in unassigned"
            :key="workout.workoutId"
            :workout="workout"
            :programs="programs"
            :acting="acting"
            :checkable="bulkOpen"
            :checked="checked.includes(workout.workoutId)"
            @open="emit('open-workout', workout)"
            @add="addWorkout(workout, $event)"
            @toggle="toggleChecked(workout.workoutId, $event)"
          />
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { bundlePreview, groupProgramWorkouts, weekDayGroups } from "~/utils/workoutPrograms";
import { parseFetchError } from "~/utils/parseFetchError";

const props = defineProps({
  creating: { type: Boolean, default: false },
});
const emit = defineEmits(["open-workout", "view-change", "cancel-create"]);

const { confirm: askUser } = useConfirm();
const auth = useAuthStore();
const { programList, loadList } = useWorkoutDraft();

const view = ref("home");
const activeProgramId = ref(null);
const acting = ref(false);
const editingProgram = ref(false);
const programDraft = ref({ name: "", description: "" });
const createDraft = ref({ name: "", description: "" });
const bulkOpen = ref(false);
const checked = ref([]);
const bulkProgramId = ref("");
const prefix = ref("");
const formError = ref("");

const programs = computed(() => programList.value.programs || []);
const unassigned = computed(() => programList.value.unassigned?.workouts || []);
const activeProgram = computed(() => programs.value.find((item) => item.programId === activeProgramId.value) || null);
const orderedWorkouts = computed(() =>
  [...(activeProgram.value?.workouts || [])].sort((left, right) => left.sortOrder - right.sortOrder || left.workoutId - right.workoutId),
);
const grouped = computed(() => groupProgramWorkouts(activeProgram.value?.workouts || []));
const firstWeek = computed(() => grouped.value.weekGroups[0]?.week ?? null);
const dayGroups = computed(() => weekDayGroups(unassigned.value));
const preview = computed(() => bundlePreview(unassigned.value, checked.value));

watch(
  () => props.creating,
  (open) => {
    if (!open) return;
    createDraft.value = { name: "", description: "" };
    formError.value = "";
    view.value = "home";
  },
);

watch([view, activeProgramId], () => {
  emit("view-change", {
    view: view.value,
    programId: view.value === "program" ? activeProgramId.value : null,
  });
});

watch(
  () => auth.user?.user_id,
  () => {
    backHome();
  },
);

watch(programs, (list) => {
  if (view.value === "program" && activeProgramId.value && !list.some((item) => item.programId === activeProgramId.value)) {
    backHome();
  }
});

function openProgram(program) {
  activeProgramId.value = program.programId;
  view.value = "program";
  editingProgram.value = false;
  bulkOpen.value = false;
  formError.value = "";
}

function openUnassigned() {
  view.value = "unassigned";
  bulkOpen.value = false;
  checked.value = [];
  prefix.value = "";
  bulkProgramId.value = "";
  formError.value = "";
}

function backHome() {
  view.value = "home";
  editingProgram.value = false;
  bulkOpen.value = false;
  formError.value = "";
}

function startEdit() {
  if (!activeProgram.value) return;
  programDraft.value = {
    name: activeProgram.value.name,
    description: activeProgram.value.description || "",
  };
  editingProgram.value = true;
}

async function createProgram() {
  acting.value = true;
  formError.value = "";
  try {
    await $fetch("/api/physical/programs", {
      method: "POST",
      body: { name: createDraft.value.name, description: createDraft.value.description },
    });
    await loadList();
    emit("cancel-create");
  } catch (error) {
    formError.value = parseFetchError(error, "Could not save this program.");
  } finally {
    acting.value = false;
  }
}

async function saveProgram() {
  if (!activeProgram.value) return;
  acting.value = true;
  formError.value = "";
  try {
    await $fetch(`/api/physical/programs/${activeProgram.value.programId}`, {
      method: "PUT",
      body: {
        name: programDraft.value.name,
        description: programDraft.value.description,
        sortOrder: activeProgram.value.sortOrder,
      },
    });
    editingProgram.value = false;
    await loadList();
  } catch (error) {
    formError.value = parseFetchError(error, "Could not save this program.");
  } finally {
    acting.value = false;
  }
}

async function onDelete() {
  if (!activeProgram.value || acting.value) return;
  const remove = await askUser({
    header: "Delete this program?",
    message: "Delete this program? Its workouts stay in your list, and they remain in any other programs they belong to.",
    confirmText: "Delete",
    destructive: true,
  });
  if (!remove) return;
  acting.value = true;
  formError.value = "";
  try {
    await $fetch(`/api/physical/programs/${activeProgram.value.programId}`, { method: "DELETE" });
    await loadList();
    backHome();
  } catch (error) {
    formError.value = parseFetchError(error, "Could not delete this program.");
  } finally {
    acting.value = false;
  }
}

async function moveProgram(index, direction) {
  const next = index + direction;
  if (next < 0 || next >= programs.value.length) return;
  const list = [...programs.value];
  const [moved] = list.splice(index, 1);
  list.splice(next, 0, moved);
  acting.value = true;
  formError.value = "";
  try {
    await Promise.all(
      list.map((program, sortOrder) =>
        $fetch(`/api/physical/programs/${program.programId}`, {
          method: "PUT",
          body: { name: program.name, description: program.description, sortOrder },
        }),
      ),
    );
    await loadList();
  } catch (error) {
    formError.value = parseFetchError(error, "Could not reorder programs.");
  } finally {
    acting.value = false;
  }
}

async function addWorkout(workout, programId) {
  const id = Number(programId);
  if (!id) return;
  acting.value = true;
  formError.value = "";
  try {
    await $fetch(`/api/physical/programs/${id}/items`, {
      method: "PUT",
      body: { workoutIds: [workout.workoutId] },
    });
    await loadList();
    if (view.value === "unassigned" && !unassigned.value.length) backHome();
  } catch (error) {
    formError.value = parseFetchError(error, "Could not add this workout to that program.");
  } finally {
    acting.value = false;
  }
}

async function removeWorkout(workout) {
  if (!activeProgram.value) return;
  acting.value = true;
  formError.value = "";
  try {
    await $fetch(`/api/physical/programs/${activeProgram.value.programId}/items/${workout.workoutId}`, {
      method: "DELETE",
    });
    await loadList();
  } catch (error) {
    formError.value = parseFetchError(error, "Could not remove this workout from the program.");
  } finally {
    acting.value = false;
  }
}

async function moveWorkout(list, workoutId, direction) {
  if (!activeProgram.value) return;
  const index = list.findIndex((item) => item.workoutId === workoutId);
  const neighbor = list[index + direction];
  if (!neighbor) return;
  const ordered = [...orderedWorkouts.value];
  const from = ordered.findIndex((item) => item.workoutId === workoutId);
  const to = ordered.findIndex((item) => item.workoutId === neighbor.workoutId);
  if (from < 0 || to < 0) return;
  const [moved] = ordered.splice(from, 1);
  ordered.splice(to, 0, moved);
  acting.value = true;
  formError.value = "";
  try {
    await $fetch(`/api/physical/programs/${activeProgram.value.programId}/reorder`, {
      method: "PUT",
      body: { workoutIds: ordered.map((item) => item.workoutId) },
    });
    await loadList();
  } catch (error) {
    formError.value = parseFetchError(error, "Could not reorder workouts.");
  } finally {
    acting.value = false;
  }
}

function toggleBulk() {
  bulkOpen.value = !bulkOpen.value;
  checked.value = [];
  prefix.value = "";
  bulkProgramId.value = "";
  formError.value = "";
}

function selectWeekDays() {
  const groups = dayGroups.value;
  if (!groups.length) return;
  if (groups.length > 1 && !prefix.value) {
    formError.value = "Choose a plan title first.";
    return;
  }
  const chosen = groups.length === 1 ? groups[0] : groups.find((item) => item.prefix === prefix.value);
  if (!chosen) return;
  formError.value = "";
  checked.value = [...chosen.workoutIds];
}

function toggleChecked(workoutId, on) {
  const next = new Set(checked.value);
  if (on) next.add(workoutId);
  else next.delete(workoutId);
  checked.value = [...next];
}

async function confirmBulk() {
  const program = programs.value.find((item) => item.programId === Number(bulkProgramId.value));
  if (!program || !checked.value.length) return;
  const summary = preview.value;
  const range =
    summary.weekMin == null
      ? ""
      : summary.weekMin === summary.weekMax
        ? ` Week ${summary.weekMin}.`
        : ` Weeks ${summary.weekMin}–${summary.weekMax}.`;
  const title = summary.sharedTitle ? ` ${summary.sharedTitle}.` : "";
  const add = await askUser({
    header: "Add to program?",
    message: `Add ${summary.count} ${summary.count === 1 ? "workout" : "workouts"} to ${program.name}?${range}${title} They stay in any other programs they already belong to.`,
    confirmText: "Add to program",
  });
  if (!add) return;
  acting.value = true;
  formError.value = "";
  try {
    await $fetch(`/api/physical/programs/${program.programId}/items`, {
      method: "PUT",
      body: { workoutIds: checked.value },
    });
    await loadList();
    bulkOpen.value = false;
    checked.value = [];
    if (!unassigned.value.length) backHome();
  } catch (error) {
    formError.value = parseFetchError(error, "Could not add those workouts to the program.");
  } finally {
    acting.value = false;
  }
}
</script>
