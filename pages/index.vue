<template>
  <section class="app-page overflow-x-hidden">
    <header class="mb-8 max-w-3xl">
      <h1 class="text-lg font-semibold text-base-content sm:text-2xl">
        Future Star
      </h1>
      <p class="mt-2 text-sm leading-6 text-base-content/70 sm:text-base">
        Health is more than one number. Future Star is organized around three areas of life
        that support each other: how you steward resources, how you stay grounded, and how
        you care for your body.
      </p>
    </header>

    <ul class="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <li v-for="area in healthAreas" :key="area.href">
        <AppLink :to="area.href" class="app-card-link">
          <h2 class="text-base font-semibold text-base-content">{{ area.name }}</h2>
          <p class="mt-2 flex-1 text-sm leading-6 text-base-content/60">
            {{ area.description }}
          </p>
          <p class="mt-4 text-sm font-semibold text-primary">
            Open {{ area.name }} →
          </p>
        </AppLink>
      </li>
    </ul>

    <p v-if="!auth.user" class="mt-8 text-center text-sm text-base-content/60">
      <AppLink to="/login" class="font-medium text-primary hover:text-primary/80">
        Log in
      </AppLink>
      to use your tools in each area.
    </p>
  </section>
</template>

<script setup>
const auth = useAuthStore();

useHead({ title: "Future Star" });

const healthAreas = [
  {
    name: "Financial",
    href: "/financial",
    description:
      "Steward what you have. Track estate, accounts, budgets, and taxes so you can see where you stand and plan with a clear picture of cash flow and net worth.",
  },
  {
    name: "Spiritual",
    href: "/spiritual",
    description:
      "Stay grounded in faith, purpose, and inner life. This area is for practices, community, and growth that keep the rest of life aligned.",
  },
  {
    name: "Physical",
    href: "/physical",
    description:
      "Care for the body that carries everything else. This area is for movement, rest, and wellness so energy and health support your work and relationships.",
  },
];
</script>
