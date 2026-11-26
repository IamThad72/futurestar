<template>
  <section class="app-page overflow-x-hidden">
    <header class="mb-8 max-w-3xl">
      <h1 class="text-ink">
        Future Star
      </h1>
      <p class="mt-3 text-base leading-6 text-muted">
        Health is more than one number. Future Star is organized around three areas of life
        that support each other: how you steward resources, how you stay grounded, and how
        you care for your body.
      </p>
    </header>

    <ul class="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <li v-for="area in healthAreas" :key="area.href">
        <AppLink :to="area.href" class="app-card-link" :class="`app-card-link--${area.pillar}`">
          <h2 class="text-ink">{{ area.name }}</h2>
          <p class="mt-2 flex-1 text-base leading-6 text-muted">
            {{ area.description }}
          </p>
          <p class="mt-4 text-base font-semibold text-navy">
            Open {{ area.name }} →
          </p>
        </AppLink>
      </li>
    </ul>

    <p v-if="auth.ready && !auth.user" class="mt-8 text-center text-base text-muted">
      <AppLink to="/login" class="font-semibold text-navy">
        Log in
      </AppLink>
      to use your tools in each area.
    </p>
  </section>
</template>

<script setup>
const auth = useAuthStore();

useHead({ title: "Future Star" });

watch(
  () => [auth.ready, auth.user],
  ([ready, user]) => {
    if (ready && user) void navigateTo("/today", { replace: true });
  },
  { immediate: true },
);

onMounted(() => {
  if (!auth.ready) auth.fetchSession();
});

const healthAreas = [
  {
    name: "Financial",
    href: "/financial",
    pillar: "financial",
    description:
      "Steward what you have. Track estate, accounts, budgets, and taxes so you can see where you stand and plan with a clear picture of cash flow and net worth.",
  },
  {
    name: "Spiritual",
    href: "/spiritual",
    pillar: "spiritual",
    description:
      "Stay grounded in faith, purpose, and inner life. Begin with morning prayer, remember what is true, read Scripture, and close the day in reflection.",
  },
  {
    name: "Physical",
    href: "/physical",
    pillar: "physical",
    description:
      "Care for the body that carries everything else. This area is for movement, rest, and wellness so energy and health support your work and relationships.",
  },
];
</script>
