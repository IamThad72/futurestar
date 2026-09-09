<template>
  <section class="spiritual-page">
    <div class="spiritual-page__intro">
      <header class="mb-4 sm:mb-6">
        <h1 class="text-lg font-semibold text-base-content sm:text-xl">
          Spiritual Health
        </h1>
        <p class="mt-1 text-sm text-base-content/80">
          A daily review: be still, remember, hear Scripture, and close the day with examen.
          Anything you write stays private to your account.
        </p>
      </header>

      <ul class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <li v-for="item in homeLinks" :key="item.href">
          <AppLink :to="item.href" class="app-card-link">
            <h2 class="text-sm font-semibold text-base-content">{{ item.name }}</h2>
            <p class="mt-2 flex-1 text-sm leading-6 text-base-content/80">
              {{ item.description }}
            </p>
          </AppLink>
        </li>
      </ul>
    </div>

    <div class="spiritual-page__dock">
      <div
        v-if="!auth.ready"
        class="app-card px-4 py-6 text-sm text-base-content/60"
      >
        Loading session...
      </div>
      <div
        v-else-if="!auth.user"
        class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
      >
        You must be logged in to view the liturgical calendar.
      </div>
      <LiturgicalCalendarFrame v-else />
    </div>
  </section>
</template>

<script setup>
import { SPIRITUAL_HOME_LINKS } from "~/utils/spiritualNav";

useHead({ title: "Spiritual" });

const auth = useAuthStore();
const homeLinks = SPIRITUAL_HOME_LINKS;

onMounted(() => {
  if (!auth.ready) {
    auth.fetchSession();
  }
});
</script>

<style scoped>
.spiritual-page {
  width: 100%;
  max-width: none;
  margin-left: 0;
  margin-right: 0;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.spiritual-page__intro,
.spiritual-page__dock {
  padding-left: 1rem;
  padding-right: 1rem;
}

@media (min-width: 640px) {
  .spiritual-page__intro,
  .spiritual-page__dock {
    padding-left: 1.5rem;
    padding-right: 1.5rem;
  }
}

@media (min-width: 1024px) {
  .spiritual-page {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: 2rem;
  }

  .spiritual-page__intro {
    min-width: 0;
    padding-left: 2rem;
    padding-right: 0;
  }

  .spiritual-page__dock {
    position: sticky;
    top: 1rem;
    padding: 0;
    margin-right: 0;
    justify-self: end;
  }
}
</style>
