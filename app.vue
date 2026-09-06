<template>
  <ion-app
    data-theme="pocket"
    class="app-shell min-h-screen bg-base-200 text-base-content antialiased"
  >
    <OfflineBanner />
    <div class="app-shell__main">
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </div>
  </ion-app>
</template>

<script setup>
import { IonApp } from "@ionic/vue";
import { useAuthStore } from "~/stores/auth";

const auth = useAuthStore();
const route = useRoute();

const guestPaths = new Set(["/", "/login", "/logout", "/reset-password"]);

watch(
  () => auth.user,
  (user, prevUser) => {
    if (prevUser && !user && !guestPaths.has(route.path)) {
      void navigateTo("/login", { replace: true });
    }
  },
);

onMounted(() => {
  if (!auth.ready) {
    auth.fetchSession();
  }
});
</script>
