<template>
  <section class="app-page today-page">
    <div v-if="!auth.ready" class="app-card px-5 py-6 text-base text-muted">
      Loading session...
    </div>

    <template v-else>
      <header class="today-page__greeting">
        <p class="sl-caption">{{ dateLabel }}</p>
        <h1 class="sl-display">{{ greeting }}</h1>
        <p v-if="liturgicalLabel" class="sl-scripture mt-3">{{ liturgicalLabel }}</p>
        <p v-else-if="liturgicalPending" class="mt-3 text-base text-muted">Looking up the liturgical day…</p>
      </header>

      <AppLink to="/spiritual/morning" class="app-card-link today-prayer">
        <span class="today-prayer__icon" aria-hidden="true">
          <AppIcon name="church" :size="24" :stroke-width="1.75" />
        </span>
        <span>
          <h2>Morning Prayer</h2>
          <p class="mt-1 text-base leading-6 text-muted">
            Be still, pray from Scripture, and set an intention for the day.
          </p>
        </span>
      </AppLink>

      <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <AppLink to="/financial" class="app-card-link today-summary today-summary--financial">
          <span class="today-summary__icon is-financial" aria-hidden="true">
            <AppIcon name="landmark" :size="24" :stroke-width="1.75" />
          </span>
          <h2>Money</h2>
          <p v-if="estateLoading" class="mt-2 text-base text-muted">Loading snapshot…</p>
          <p v-else-if="estateError" class="mt-2 text-base text-error">{{ estateError }}</p>
          <template v-else>
            <p class="sl-money mt-2 text-2xl text-ink">{{ netWealth }}</p>
            <p class="mt-1 text-sm leading-5 text-muted">Net wealth</p>
          </template>
        </AppLink>

        <AppLink to="/physical" class="app-card-link today-summary today-summary--physical">
          <span class="today-summary__icon is-physical" aria-hidden="true">
            <AppIcon name="activity" :size="24" :stroke-width="1.75" />
          </span>
          <h2>Body</h2>
          <p v-if="physicalLoading" class="mt-2 text-base text-muted">Loading today…</p>
          <p v-else-if="physicalError" class="mt-2 text-base text-error">{{ physicalError }}</p>
          <template v-else>
            <p class="mt-2 text-base leading-6 text-ink">{{ physicalText }}</p>
            <p v-if="physicalDetail" class="sl-money mt-2 text-sm leading-5 text-muted">{{ physicalDetail }}</p>
          </template>
        </AppLink>
      </div>
    </template>
  </section>
</template>

<script setup>
import { displayCelebrationTitle, seasonLabel, todayIsoDate } from "~/utils/liturgicalCalendar";

useHead({ title: "Today" });

const auth = useAuthStore();
const { loading: estateLoading, loadError: estateError, estateStats, loadSummary } = useEstateSummary();

const liturgicalLabel = ref("");
const liturgicalPending = ref(false);
const physicalText = ref("");
const physicalDetail = ref("");
const physicalError = ref("");
const physicalLoading = ref(true);

const dateLabel = computed(() =>
  new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }),
);

const greeting = computed(() => {
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const named = greetingName(auth.user);
  return named ? `${hello}, ${named}` : hello;
});

const netWealth = computed(() => {
  const stat = estateStats.value.find((item) => item.name === "Net Wealth");
  return stat?.value || "—";
});

function greetingName(user) {
  const display = String(user?.display_name || "").trim();
  if (display) return display.split(/\s+/)[0];
  const email = String(user?.email || "").trim();
  if (!email) return "";
  return email.split("@")[0];
}

async function loadLiturgicalDay() {
  liturgicalPending.value = true;
  liturgicalLabel.value = "";
  try {
    const now = new Date();
    const data = await $fetch("/api/spiritual/calendar", {
      query: { year: now.getFullYear(), month: now.getMonth() + 1 },
    });
    const iso = todayIsoDate(now);
    const day = (data?.days || []).find((item) => item.date === iso);
    if (!day) return;
    const celebration = day.celebrations?.[0];
    const title = celebration ? displayCelebrationTitle(celebration, day) : "";
    const season = seasonLabel(day.season);
    liturgicalLabel.value = title && title !== season ? `${title} · ${season}` : title || season;
  } catch {
    liturgicalLabel.value = "";
  } finally {
    liturgicalPending.value = false;
  }
}

async function loadPhysical() {
  physicalLoading.value = true;
  physicalError.value = "";
  try {
    const data = await $fetch("/api/physical/today");
    physicalText.value = String(data?.text || "No session is logged today.");
    const bits = [];
    if (data?.kcalConsumed != null && data?.kcalRemaining != null) {
      bits.push(`${data.kcalConsumed} kcal eaten, ${data.kcalRemaining} kcal left`);
    }
    if (data?.proteinConsumed != null && data?.proteinRemaining != null) {
      bits.push(`${data.proteinConsumed} g protein eaten, ${data.proteinRemaining} g left`);
    }
    physicalDetail.value = bits.join(" · ");
  } catch (error) {
    physicalText.value = "";
    physicalDetail.value = "";
    const status = error?.statusCode || error?.status;
    if (status === 401) return;
    physicalError.value = error?.data?.statusMessage || error?.statusMessage || "Could not load today.";
  } finally {
    physicalLoading.value = false;
  }
}

function loadToday() {
  void loadSummary();
  void loadLiturgicalDay();
  void loadPhysical();
}

onMounted(() => {
  if (!auth.ready) auth.fetchSession();
});

watch(
  () => [auth.ready, auth.user],
  ([ready, user]) => {
    if (!ready) return;
    if (!user) {
      void navigateTo("/login", { replace: true });
      return;
    }
    loadToday();
  },
  { immediate: true },
);
</script>
