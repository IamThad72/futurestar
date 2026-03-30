<script setup lang="ts">
const auth = useAuthStore();
const activeTab = ref<'estate' | 'budget'>('estate');

onMounted(() => {
  if (!auth.ready) {
    auth.fetchSession();
  }
});
</script>

<template>
  <!-- Unauthenticated: landing -->
  <section
    v-if="!auth.user"
    class="mx-auto flex min-h-[60vh] max-w-4xl items-center justify-center py-4 sm:py-6 px-2 sm:px-3"
  >
    <div class="rounded-2xl border border-base-200 bg-base-300 p-6 sm:p-10 text-center shadow">
      <h1 class="text-2xl sm:text-4xl font-semibold text-primary">My Estate Plan</h1>
      <p class="mt-3 text-base text-base-content/70">
        Build, organize, and manage your estate details in one place.
      </p>
      <div v-if="!auth.ready" class="mt-6">
        <span class="text-sm text-base-content/70">Loading...</span>
      </div>
      <div v-else class="mt-6 flex flex-wrap justify-center gap-3">
        <NuxtLink class="btn btn-primary min-h-11 min-w-28" to="/register">Get Started</NuxtLink>
        <NuxtLink class="btn btn-outline min-h-11 min-w-28" to="/login">Log In</NuxtLink>
      </div>
    </div>
  </section>

  <!-- Authenticated: dashboard with tabs -->
  <section v-else class="mx-auto w-full max-w-full py-4 sm:py-6 px-2 sm:px-3 overflow-x-hidden">
    <header class="mb-4 sm:mb-6">
      <p class="text-sm text-base-content/70">
        Current snapshot
      </p>
    </header>

    <!-- Tabs: work on desktop and mobile -->
    <div role="tablist" class="tabs tabs-lift tabs-sm mb-0 w-full overflow-x-hidden">
      <button
        role="tab"
        type="button"
        class="tab flex-1 sm:flex-none"
        :class="{ 'tab-active': activeTab === 'estate' }"
        @click="activeTab = 'estate'"
      >
        Estate
      </button>
      <button
        role="tab"
        type="button"
        class="tab flex-1 sm:flex-none"
        :class="{ 'tab-active': activeTab === 'budget' }"
        @click="activeTab = 'budget'"
      >
        Budget
      </button>
    </div>

    <!-- Tab content (blank) -->
    <div class="rounded-b-lg border border-base-200 bg-base-300 overflow-hidden border-t-0 -mt-px min-h-[12rem]">
      <div v-show="activeTab === 'estate'" class="p-6"></div>
      <div v-show="activeTab === 'budget'" class="p-6"></div>
    </div>
  </section>
</template>
