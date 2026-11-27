<template>
  <div class="app-card mx-auto w-full max-w-md p-6">
    <h1 class="text-ink">Signing Out</h1>
    <p class="mt-2 text-base text-muted">
      Please wait while we log you out.
    </p>
  </div>
</template>

<script setup>
useHead({ title: "Signing out" });

const { signOut } = useSignOut();

onMounted(async () => {
  await signOut();
});
</script>
