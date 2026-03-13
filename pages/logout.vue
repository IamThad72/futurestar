<template>
  <div class="mx-auto w-full max-w-md rounded-lg bg-base-100 p-6 shadow">
    <h1 class="text-2xl font-semibold text-primary-content">Signing Out</h1>
    <p class="mt-2 text-sm text-primary-content/80">
      Please wait while we log you out.
    </p>
  </div>
</template>

<script setup>
const router = useRouter();
const auth = useAuthStore();

onMounted(async () => {
  try {
    await auth.logout();
  } finally {
    await router.push("/login");
  }
});
</script>
