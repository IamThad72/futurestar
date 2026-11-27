<template>
  <ion-app
    :data-theme="themeName"
    :data-pillar="pillar || undefined"
    class="app-shell min-h-screen bg-base-200 text-base-content antialiased"
  >
    <a class="skip-link" href="#main-content">Skip to content</a>
    <OfflineBanner />
    <p
      v-if="sessionEndedMessage"
      class="px-4 py-3 text-center text-base text-base-content"
      role="alert"
    >
      {{ sessionEndedMessage }}
    </p>
    <p
      v-else-if="accountDeletedNotice"
      class="px-4 py-3 text-center text-base text-base-content"
      role="status"
    >
      {{ accountDeletedNotice }}
    </p>
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
import { takeAccountDeletedNotice } from "~/utils/accountDeletedNotice";
import { isFinancialPath } from "~/utils/financialNav";
import { isPhysicalPath } from "~/utils/physicalNav";
import { isSpiritualPath } from "~/utils/spiritualNav";

const auth = useAuthStore();
const route = useRoute();
const accountDeletedNotice = ref("");
const sessionEndedMessage = computed(() => {
  if (route.path.startsWith("/login")) return "";
  return auth.sessionEnded && auth.error ? auth.error : "";
});

function pullAccountDeletedNotice() {
  const notice = takeAccountDeletedNotice();
  if (notice) accountDeletedNotice.value = notice;
}

watch(
  () => auth.user,
  (user, previous) => {
    if (previous && !user) pullAccountDeletedNotice();
  },
);
const themeName = ref("sacredledger");

const pillar = computed(() => {
  const path = route.path;
  if (isFinancialPath(path)) return "financial";
  if (isSpiritualPath(path)) return "spiritual";
  if (isPhysicalPath(path)) return "physical";
  return "";
});

function syncTheme() {
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  themeName.value = dark ? "sacredledger-dark" : "sacredledger";
  document.documentElement.setAttribute("data-theme", themeName.value);
}

let themeQuery;

onMounted(() => {
  pullAccountDeletedNotice();
  syncTheme();
  themeQuery = window.matchMedia("(prefers-color-scheme: dark)");
  themeQuery.addEventListener("change", syncTheme);
  if (!auth.ready) {
    auth.fetchSession();
  }
});

onUnmounted(() => {
  themeQuery?.removeEventListener("change", syncTheme);
});
</script>
