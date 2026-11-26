<template>
  <div class="app-page mx-auto min-w-0 max-w-lg pb-[calc(6rem+env(safe-area-inset-bottom,0px))]" data-testid="delete-account-page">
    <h1 class="text-ink">Delete your account</h1>

    <div class="mt-4 space-y-4 text-base text-base-content" data-testid="delete-account-public">
      <p>
        You can delete your Future Star account yourself. Deleting the app does not delete the account.
        This cannot be undone.
      </p>
      <div>
        <p class="font-semibold text-ink">Erased</p>
        <ul class="mt-2 list-disc space-y-1 pl-5">
          <li v-for="item in erased" :key="item">{{ item }}</li>
        </ul>
      </div>
      <div>
        <p class="font-semibold text-ink">Stays with the household</p>
        <p class="mt-1">{{ kept }}</p>
      </div>
      <div>
        <p class="font-semibold text-ink">What is kept afterwards</p>
        <p class="mt-1">{{ retention }}</p>
      </div>
      <template v-if="!auth.user">
        <div>
          <p class="font-semibold text-ink">How to delete it</p>
          <ol class="mt-2 list-decimal space-y-1 pl-5">
            <li>Open the Future Star app, or sign in on the web.</li>
            <li>Go to You.</li>
            <li>Open Privacy and data.</li>
            <li>Choose Delete account, type your email, and enter your password.</li>
          </ol>
        </div>
        <p>After you sign in, you return to this page to finish.</p>
        <NuxtLink
          to="/login?next=/delete-account"
          class="btn btn-primary min-h-11 w-full"
          data-testid="delete-account-sign-in"
        >
          Sign in to delete your account
        </NuxtLink>
      </template>
    </div>

    <div v-if="auth.user" class="mt-6">
      <p class="break-words text-base text-muted">Signed in as {{ auth.user.email }}</p>
      <div class="mt-4">
        <DeleteAccountPanel :account-email="auth.user.email || ''" @deleted="onAccountDeleted" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { useAuthStore } from "~/stores/auth";
import { ERASED_ON_DELETE, KEPT_ON_DELETE, RETENTION_ON_DELETE } from "~/utils/accountDeletionCopy";
import { rememberAccountDeleted } from "~/utils/accountDeletedNotice";

useHead({ title: "Delete your account" });

const auth = useAuthStore();
const { signOut } = useSignOut();
const erased = ERASED_ON_DELETE;
const kept = KEPT_ON_DELETE;
const retention = RETENTION_ON_DELETE;

async function onAccountDeleted(payload) {
  rememberAccountDeleted(Boolean(payload?.authRemovalPending));
  await signOut();
}

onMounted(async () => {
  document.getElementById("delete-account-static")?.remove();
  if (!auth.ready) {
    await auth.fetchSession();
  }
});
</script>
