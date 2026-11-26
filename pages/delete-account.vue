<template>
  <div class="app-page mx-auto min-w-0 max-w-lg pb-[calc(6rem+env(safe-area-inset-bottom,0px))]" data-testid="delete-account-page">
    <h1 class="text-ink">Delete your account</h1>

    <p v-if="!auth.ready" class="mt-4 text-base text-muted">Loading…</p>

    <template v-else-if="auth.user">
      <p class="mt-2 break-words text-base text-muted">Signed in as {{ auth.user.email }}</p>
      <div class="mt-6">
        <DeleteAccountPanel :account-email="auth.user.email || ''" @deleted="onAccountDeleted" />
      </div>
    </template>

    <template v-else>
      <div class="mt-4 space-y-4 text-base text-base-content" data-testid="delete-account-public">
        <p>
          You can delete your Future Star account yourself. Deleting the app does not delete the account.
        </p>
        <div>
          <p class="font-semibold text-ink">How to delete it</p>
          <ol class="mt-2 list-decimal space-y-1 pl-5">
            <li>Open the Future Star app, or sign in on the web.</li>
            <li>Go to You.</li>
            <li>Open Privacy and data.</li>
            <li>Choose Delete account and confirm.</li>
          </ol>
        </div>
        <p>
          Come back to this page after signing in if you want to finish the deletion here.
        </p>
        <NuxtLink to="/login" class="btn btn-primary min-h-11 w-full" data-testid="delete-account-sign-in">
          Sign in to delete your account
        </NuxtLink>
      </div>
    </template>
  </div>
</template>

<script setup>
import { useAuthStore } from "~/stores/auth";
import { rememberAccountDeleted } from "~/utils/accountDeletedNotice";

useHead({ title: "Delete your account" });

const auth = useAuthStore();
const { signOut } = useSignOut();

async function onAccountDeleted() {
  rememberAccountDeleted();
  await signOut();
}

onMounted(async () => {
  if (!auth.ready) {
    await auth.fetchSession();
  }
});
</script>
