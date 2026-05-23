<template>
  <ion-app
    data-theme="corporate"
    class="app-shell min-h-screen bg-base-100 text-base-content"
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

const guestPaths = new Set(["/", "/login", "/logout"]);

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
