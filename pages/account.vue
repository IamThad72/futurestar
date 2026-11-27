<template>
  <div class="app-page you-page mx-auto max-w-lg">
    <h1 class="text-ink">You</h1>

    <section class="you-profile app-card" aria-label="Profile">
      <img
        v-if="showAvatar"
        :src="avatarUrl"
        alt=""
        class="you-profile__photo"
        @error="avatarFailed = true"
      />
      <span v-else class="you-profile__fallback" aria-hidden="true">
        <AppIcon name="person" :size="28" />
      </span>
      <div class="you-profile__text">
        <p class="you-profile__name">{{ identity.name }}</p>
        <p v-if="identity.email" class="you-profile__email">{{ identity.email }}</p>
      </div>
    </section>

    <div class="you-menu app-card">
      <ion-list lines="none" class="you-menu__list">
        <ion-item button detail class="you-menu__item" @click="showAccountManagement = true">
          <ion-icon slot="start" :icon="personOutline" aria-hidden="true" />
          <ion-label>Account Management</ion-label>
        </ion-item>
        <ion-item button detail class="you-menu__item" @click="showLinkedAccounts = true">
          <ion-icon slot="start" :icon="peopleOutline" aria-hidden="true" />
          <ion-label>Linked Accounts</ion-label>
        </ion-item>
      </ion-list>
    </div>

    <FaithSettings v-if="auth.user" class="mt-4" />

    <div class="you-page__logout">
      <button
        type="button"
        class="btn btn-error w-full gap-2"
        :disabled="signingOut"
        :aria-busy="signingOut"
        @click="handleLogout"
      >
        <AppIcon name="log-out" :size="18" />
        Logout
      </button>
    </div>

    <LazyAccountManagementModal v-if="showAccountManagement" v-model="showAccountManagement" />
    <LazyLinkedAccountsModal v-if="showLinkedAccounts" v-model="showLinkedAccounts" />
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { IonIcon, IonItem, IonLabel, IonList } from "@ionic/vue";
import { peopleOutline, personOutline } from "ionicons/icons";
import { useAuthStore } from "~/stores/auth";
import { profileIdentity, profilePhotoUrl, showProfileAvatar } from "~/utils/profileAvatar";
import { runGuardedSignOut } from "~/utils/signOutGuard";

const auth = useAuthStore();
const router = useRouter();
const { signOut } = useSignOut();
const showAccountManagement = ref(false);
const showLinkedAccounts = ref(false);
const avatarFailed = ref(false);
const signingOut = ref(false);

const identity = computed(() => profileIdentity(auth.user));
const showAvatar = computed(() => showProfileAvatar(auth.user, avatarFailed.value));
const avatarUrl = computed(() => (showAvatar.value ? profilePhotoUrl(auth.user) : ""));

watch(
  () => auth.user?.profile_photo,
  () => {
    avatarFailed.value = false;
  },
);

async function handleLogout() {
  try {
    await runGuardedSignOut(signingOut, signOut);
  } catch {
    // runGuardedSignOut re-enables the button. Stay on this page.
  }
}

onMounted(async () => {
  if (!auth.ready) {
    await auth.fetchSession();
  }
  if (!auth.user) {
    await router.replace("/login");
  }
});
</script>
