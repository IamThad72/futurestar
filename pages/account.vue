<template>
  <div class="app-page mx-auto max-w-lg pb-safe-content">
    <h1 class="text-ink">You</h1>
    <p v-if="auth.user?.email" class="mt-2 text-base text-muted">{{ auth.user.email }}</p>

    <div class="mt-6 flex flex-col gap-2">
      <button type="button" class="btn btn-primary justify-start gap-2" @click="showAccountManagement = true">
        <AppIcon name="person" :size="18" />
        Account Management
      </button>
      <button type="button" class="btn btn-outline justify-start gap-2" @click="showLinkedAccounts = true">
        <AppIcon name="people" :size="18" />
        Linked Accounts
      </button>
      <button type="button" class="btn btn-ghost justify-start gap-2 text-error" @click="handleLogout">
        <AppIcon name="log-out" :size="18" />
        Logout
      </button>
    </div>

    <FaithSettings v-if="auth.user" class="mt-6" />

    <LazyAccountManagementModal v-if="showAccountManagement" v-model="showAccountManagement" />
    <LazyLinkedAccountsModal v-if="showLinkedAccounts" v-model="showLinkedAccounts" />
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useAuthStore } from "~/stores/auth";

const auth = useAuthStore();
const router = useRouter();
const { signOut } = useSignOut();
const showAccountManagement = ref(false);
const showLinkedAccounts = ref(false);

async function handleLogout() {
  await signOut();
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
