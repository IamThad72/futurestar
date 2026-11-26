<template>
  <section class="rounded-lg border border-base-300 bg-base-100 p-4">
    <h2 class="text-sm font-semibold text-base-content">Plan assistant</h2>
    <p class="mt-1 text-sm text-base-content/60">
      Describe the plan. The assistant matches exercises already in Future Star, lists every training day, and highlights anything that still needs to be added.
    </p>

    <form class="mt-4 space-y-3" @submit.prevent="onGenerate">
      <label class="block text-sm">
        <span class="text-base-content/70">Describe the plan</span>
        <textarea
          v-model="form.description"
          rows="4"
          required
          minlength="12"
          class="textarea textarea-bordered mt-1 w-full"
          placeholder="16 weeks, 5 days a week. Upper, lower, and a conditioning day. Add a little weight every four weeks."
        />
      </label>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label class="block text-sm">
          <span class="text-base-content/70">Goal</span>
          <select v-model="form.goal" class="select select-bordered mt-1 w-full">
            <option v-for="goal in PLAN_GOALS" :key="goal.key" :value="goal.key">{{ goal.label }}</option>
          </select>
        </label>
        <label class="block text-sm">
          <span class="text-base-content/70">Plan length</span>
          <span class="mt-1 flex gap-2">
            <input
              v-model.number="form.durationCount"
              type="number" inputmode="numeric"
              min="1"
              :max="form.durationUnit === 'months' ? 6 : 16"
              class="input input-bordered w-20"
            />
            <select v-model="form.durationUnit" class="select select-bordered min-w-0 flex-1">
              <option value="weeks">Weeks</option>
              <option value="months">Months</option>
            </select>
          </span>
        </label>
        <label class="block text-sm">
          <span class="text-base-content/70">Days each week</span>
          <input v-model.number="form.daysPerWeek" type="number" inputmode="numeric" min="1" max="5" class="input input-bordered mt-1 w-full" />
        </label>
        <label class="block text-sm">
          <span class="text-base-content/70">Minutes each session</span>
          <input v-model.number="form.minutes" type="number" inputmode="numeric" min="15" max="90" class="input input-bordered mt-1 w-full" />
        </label>
      </div>

      <fieldset>
        <legend class="text-sm text-base-content/70">Equipment</legend>
        <div class="mt-2 flex flex-wrap gap-2">
          <label v-for="item in PLAN_EQUIPMENT" :key="item.key" class="flex items-center gap-2 text-sm">
            <input v-model="form.equipment" type="checkbox" class="checkbox checkbox-sm" :value="item.key" />
            {{ item.label }}
          </label>
        </div>
      </fieldset>

      <label class="block text-sm">
        <span class="text-base-content/70">Leave out</span>
        <input v-model="form.avoid" type="text" class="input input-bordered mt-1 w-full" placeholder="Movements or equipment to skip" />
      </label>

      <p class="text-sm text-base-content/70">This plan will list {{ scheduleDays }} training days.</p>
      <button type="submit" class="btn btn-primary btn-sm rounded-full" :disabled="generating || form.description.trim().length < 12">
        {{ generating ? "Drafting…" : "Draft a plan" }}
      </button>
      <p v-if="error" class="text-sm text-error">{{ error }}</p>
    </form>

    <div v-if="plan" class="mt-5 space-y-4 border-t border-base-300 pt-4">
      <p class="text-sm font-medium text-base-content">{{ plan.name }} · {{ plan.days.length }} training days</p>
      <p v-if="plan.summary" class="text-sm text-base-content">{{ plan.summary }}</p>
      <p v-if="plan.overTime" class="text-sm text-warning">
        One or more days still run past {{ plan.minutes }} minutes. You can save it and trim a day in the editor.
      </p>

      <div v-if="plan.additions.length" class="space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-3">
        <h3 class="text-sm font-semibold text-base-content">Not in the catalog yet</h3>
        <p class="text-sm text-base-content/70">
          These stay on the days that use them. Checked ones are added to the catalog when you save.
        </p>
        <label v-for="item in plan.additions" :key="item.name" class="flex items-start gap-2 text-sm">
          <input v-model="item.include" type="checkbox" class="checkbox checkbox-sm mt-0.5" />
          <span>
            <span class="font-medium text-base-content">{{ item.name }}</span>
            <span v-if="item.description || item.reason" class="block text-base-content/60">{{ item.description || item.reason }}</span>
          </span>
        </label>
      </div>

      <details
        v-for="group in weekGroups"
        :key="group.week"
        class="rounded-lg border border-base-300 bg-base-100"
        :open="group.week === 1"
      >
        <summary class="cursor-pointer px-3 py-2 text-sm font-semibold text-base-content">
          Week {{ group.week }}
          <span class="font-normal text-base-content/60">· {{ group.days.length }} days</span>
        </summary>
        <div class="space-y-3 border-t border-base-300 px-3 py-3">
          <p v-if="group.progression" class="text-sm text-base-content/70">{{ group.progression }}</p>
          <article v-for="day in group.days" :key="`${day.week}-${day.dayIndex}`" class="space-y-1">
            <h3 class="text-sm font-semibold text-base-content">
              {{ day.name }}
              <span class="font-normal text-base-content/60">· about {{ Math.max(1, Math.round(day.seconds / 60)) }} min</span>
            </h3>
            <ul class="space-y-1">
              <li
                v-for="(item, index) in day.exercises"
                :key="`${day.week}-${day.dayIndex}-${item.exerciseId || item.name}-${index}`"
                class="text-sm text-base-content/80"
                :class="item.matched ? '' : 'rounded bg-warning/15 px-2 py-1'"
              >
                {{ item.name }}
                · {{ item.sets }} × {{ item.durationSeconds ? `${item.durationSeconds}s` : item.reps }}
                <span v-if="item.restSeconds"> · {{ item.restSeconds }}s rest</span>
                <span v-if="!item.matched" class="ml-1 text-xs font-medium text-warning">Add to catalog</span>
                <span v-if="item.notes" class="block text-base-content/60">{{ item.notes }}</span>
              </li>
            </ul>
          </article>
        </div>
      </details>

      <button type="button" class="btn btn-primary btn-sm rounded-full" :disabled="saving" @click="onSave">
        {{ saving ? "Saving…" : "Save this plan" }}
      </button>
      <p v-if="savedCount" class="text-sm text-success">Saved {{ savedCount }} training days.</p>
    </div>
  </section>
</template>

<script setup>
import { applyDescriptionSchedule, parsePlanRequest, PLAN_EQUIPMENT, PLAN_GOALS, scheduleFromDescription } from "~/utils/workoutPlan";
import { parseFetchError } from "~/utils/parseFetchError";

const emit = defineEmits(["saved"]);

const form = reactive({
  description: "",
  goal: "mixed",
  durationCount: 8,
  durationUnit: "weeks",
  daysPerWeek: 3,
  minutes: 45,
  equipment: ["body", "dumbbell"],
  avoid: "",
});

const scheduleDays = computed(() => applyDescriptionSchedule(parsePlanRequest(form)).scheduleDays);

watch(
  () => form.description,
  (description) => {
    const parsed = scheduleFromDescription(description);
    if (parsed.goal) form.goal = parsed.goal;
    if (parsed.minutes) form.minutes = parsed.minutes;
    if (parsed.daysPerWeek) form.daysPerWeek = parsed.daysPerWeek;
    if (parsed.durationWeeks) {
      form.durationUnit = "weeks";
      form.durationCount = parsed.durationWeeks;
    }
  },
);

watch(
  () => form.durationUnit,
  (unit) => {
    const max = unit === "months" ? 6 : 16;
    if (form.durationCount > max) form.durationCount = max;
    if (form.durationCount < 1) form.durationCount = 1;
  },
);

const generating = ref(false);
const saving = ref(false);
const error = ref("");
const plan = ref(null);
const savedCount = ref(0);

const weekGroups = computed(() => {
  const groups = [];
  for (const day of plan.value?.days || []) {
    let group = groups.find((item) => item.week === day.week);
    if (!group) {
      group = { week: day.week, progression: day.progression, days: [] };
      groups.push(group);
    }
    group.days.push(day);
  }
  return groups;
});

async function onGenerate() {
  generating.value = true;
  error.value = "";
  savedCount.value = 0;
  try {
    const data = await $fetch("/api/physical/workouts/plan", {
      method: "POST",
      body: { ...form },
    });
    plan.value = {
      ...data,
      additions: (data.additions || []).map((item) => ({ ...item, include: true })),
    };
  } catch (err) {
    plan.value = null;
    error.value = parseFetchError(err, "Could not draft a plan.");
  } finally {
    generating.value = false;
  }
}

async function onSave() {
  if (!plan.value) return;
  saving.value = true;
  error.value = "";
  try {
    const data = await $fetch("/api/physical/workouts/plan-save", {
      method: "POST",
      body: {
        name: plan.value.name,
        description: plan.value.description,
        goal: plan.value.goal,
        minutes: plan.value.minutes,
        durationCount: plan.value.durationCount,
        durationUnit: plan.value.durationUnit,
        days: plan.value.days,
        additions: plan.value.additions,
      },
    });
    savedCount.value = (data.workouts || []).length;
    emit("saved");
  } catch (err) {
    error.value = parseFetchError(err, "Could not save the plan.");
  } finally {
    saving.value = false;
  }
}
</script>
