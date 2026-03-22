<template>
  <div class="mx-auto w-full max-w-md rounded-lg bg-base-300 p-4 sm:p-6 shadow">
    <h1 class="text-2xl font-semibold text-primary-content">Log In</h1>
    <p class="mt-1 text-sm text-primary-content/80">
      Enter your credentials to continue.
    </p>

    <form class="mt-6 space-y-4" @submit.prevent="submit">
      <label class="form-control w-full">
        <span class="label-text text-sm text-primary-content">Email</span>
        <input
          v-model.trim="form.email"
          type="email"
          class="input input-bordered w-full"
          placeholder="jane@example.com"
          autocomplete="email"
          required
        />
      </label>

      <label class="form-control w-full">
        <span class="label-text text-sm text-primary-content">Password</span>
        <input
          v-model="form.password"
          type="password"
          class="input input-bordered w-full"
          placeholder="Your password"
          autocomplete="current-password"
          required
        />
      </label>

      <button class="btn btn-primary w-full" :disabled="loading">
        {{ loading ? "Signing in..." : "Log in" }}
      </button>
    </form>

    <p v-if="error" class="mt-4 text-sm text-error">{{ error }}</p>
    <p v-if="success" class="mt-4 text-sm text-success">{{ success }}</p>

    <p class="mt-6 text-sm text-primary-content/80">
      Need an account?
      <NuxtLink class="link link-primary" to="/register">Register</NuxtLink>
    </p>
  </div>
</template>

<script setup>
const router = useRouter();
const auth = useAuthStore();
const loading = computed(() => auth.loading);
const error = ref("");
const success = ref("");
const form = reactive({
  email: "",
  password: "",
});

const submit = async () => {
  error.value = "";
  success.value = "";
  loading.value = true;

  try {
    const user = await auth.login(form.email, form.password);
    success.value = `Welcome back${user?.display_name ? `, ${user.display_name}` : ""}!`;
    form.password = "";
    await router.push("/");
  } catch (err) {
    error.value = err?.data?.statusMessage || err?.message || "Login failed.";
  }
};
</script>
