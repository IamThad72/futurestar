<template>
  <section v-if="visible" class="app-card today-reading min-w-0 max-w-full px-4 py-4">
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-sm font-semibold text-gray-900">Today's reading</h2>
      <AppLink to="/spiritual/plans" class="text-xs font-medium text-primary underline-offset-2 hover:underline">
        {{ plans.length ? "All plans" : "Browse plans" }}
      </AppLink>
    </div>
    <p v-if="error" class="mt-3 text-sm text-red-600">{{ error }}</p>
    <p v-else-if="loading" class="mt-3 text-sm text-gray-700">Loading…</p>
    <p v-else-if="!plans.length" class="mt-3 text-base leading-6 text-muted">
      Choose a reading plan, such as the Gospels in 30 days, and today's passage will appear here.
    </p>
    <ul v-else class="mt-3 space-y-4">
      <li
        v-for="plan in shown"
        :key="plan.user_plan_id"
        class="border-t border-gray-200 pt-4 first:border-t-0 first:pt-0"
      >
        <p class="sl-caption">{{ plan.name }} · {{ dayLine(plan) }}</p>
        <p v-if="plan.focus_citation" class="sl-scripture mt-1">{{ plan.focus_citation }}</p>
        <p v-else class="mt-1 text-base text-ink">Plan complete. Well done.</p>
        <p v-if="plan.progress.behind" class="mt-1 text-sm text-muted">
          {{ plan.progress.behind }} earlier {{ plan.progress.behind === 1 ? "day is" : "days are" }} unread. You can catch up, skip, or shift your dates.
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          <AppLink
            :to="`/spiritual/plans?plan=${plan.user_plan_id}${plan.focus_day ? `&day=${plan.focus_day}` : ''}`"
            class="training-chip btn btn-primary btn-sm rounded-full"
          >
            Read
          </AppLink>
          <button
            v-if="plan.focus_day && !plan.progress.notStarted"
            type="button"
            class="training-chip btn btn-ghost btn-sm rounded-full"
            :disabled="savingId === plan.user_plan_id"
            @click="markDone(plan)"
          >
            {{ savingId === plan.user_plan_id ? "Saving…" : "Mark read" }}
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { parseFetchError } from "~/utils/parseFetchError";
import { todayIsoDate } from "~/utils/liturgicalCalendar";

const props = defineProps({
  /** Hide the card when no plan is running (Today screen). */
  hideWhenEmpty: { type: Boolean, default: false },
  max: { type: Number, default: 2 },
});

const plans = ref([]);
const loading = ref(true);
const error = ref("");
const unavailable = ref(false);
const savingId = ref(0);

const shown = computed(() => plans.value.slice(0, props.max));
const visible = computed(() => {
  if (unavailable.value) return false;
  if (props.hideWhenEmpty) return !loading.value && plans.value.length > 0;
  return true;
});

function formatDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function dayLine(plan) {
  if (plan.progress.finished) return `${plan.length} of ${plan.length} days`;
  if (plan.progress.notStarted) return `Starts ${formatDate(plan.start_on)}`;
  if (plan.progress.todayDone) return `Today is read · next is day ${plan.focus_day}`;
  return `Day ${plan.focus_day} of ${plan.length}`;
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const data = await $fetch("/api/spiritual/plans", { query: { active: 1, date: todayIsoDate() } });
    unavailable.value = Boolean(data?.unavailable);
    plans.value = data?.plans || [];
  } catch (err) {
    const failure = settleLoadError(err, "Could not load your reading plan.");
    error.value = failure.message;
    if (failure.auth) plans.value = [];
  } finally {
    loading.value = false;
  }
}

async function markDone(plan) {
  if (!plan.focus_day) return;
  savingId.value = plan.user_plan_id;
  error.value = "";
  try {
    await $fetch(`/api/spiritual/plans/${plan.user_plan_id}/days/${plan.focus_day}`, {
      method: "PUT",
      body: { status: "done", date: todayIsoDate() },
    });
    await load();
  } catch (err) {
    error.value = parseFetchError(err, "Could not save that reading.");
  } finally {
    savingId.value = 0;
  }
}

onMounted(load);
</script>
