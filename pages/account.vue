<template>
  <div class="mx-auto max-w-lg px-4 py-6 pb-safe-content">
    <h1 class="text-xl font-bold text-base-content">Account</h1>
    <p v-if="auth.user?.email" class="mt-1 text-sm text-base-content/70">{{ auth.user.email }}</p>

    <div class="mt-6 flex flex-col gap-2">
      <button type="button" class="btn btn-primary justify-start" @click="showAccountManagement = true">
        Account Management
      </button>
      <button type="button" class="btn btn-outline justify-start" @click="showLinkedAccounts = true">
        Linked Accounts
      </button>
      <button type="button" class="btn btn-ghost justify-start text-error" @click="handleLogout">
        Logout
      </button>
    </div>

    <AccountManagementModal v-model="showAccountManagement" />
    <LinkedAccountsModal v-model="showLinkedAccounts" />
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useAuthStore } from "~/stores/auth";
import AccountManagementModal from "~/components/AccountManagementModal.vue";
import LinkedAccountsModal from "~/components/LinkedAccountsModal.vue";

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
