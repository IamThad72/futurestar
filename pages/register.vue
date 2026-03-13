<template>
  <div class="mx-auto w-full max-w-md rounded-lg bg-base-100 p-6 shadow">
    <h1 class="text-2xl font-semibold text-primary-content">Create Account</h1>
    <p class="mt-1 text-sm text-primary-content/80">
      Register with your email and password.
    </p>

    <form class="mt-6 space-y-4" @submit.prevent="submit">
      <label class="form-control w-full">
        <span class="label-text text-sm text-primary-content">Display Name</span>
        <input
          v-model.trim="form.displayName"
          type="text"
          class="input input-bordered w-full"
          placeholder="Jane Doe"
          autocomplete="name"
        />
      </label>

      <label class="form-control w-full">
        <span class="label-text text-sm text-primary-content">Email</span>
        <input
          v-model.trim="form.email"
          type="email"
          class="input input-bordered w-full"
          placeholder="jane@example.com"
          autocomplete="email"
          required
          @blur="checkEmail"
        />
        <span v-if="emailStatus" class="mt-1 text-xs" :class="emailStatusClass">
          {{ emailStatus }}
        </span>
      </label>

      <label class="form-control w-full">
        <span class="label-text text-sm text-primary-content">Password</span>
        <input
          v-model="form.password"
          type="password"
          class="input input-bordered w-full"
          placeholder="At least 8 characters"
          autocomplete="new-password"
          required
        />
      </label>

      <button class="btn btn-primary w-full" :disabled="loading || emailAvailable === false">
        {{ loading ? "Creating..." : "Create account" }}
      </button>
    </form>

    <p v-if="error" class="mt-4 text-sm text-error">{{ error }}</p>
    <p v-if="success" class="mt-4 text-sm text-success">{{ success }}</p>

    <p class="mt-6 text-sm text-primary-content/80">
      Already have an account?
      <NuxtLink class="link link-primary" to="/login">Log in</NuxtLink>
    </p>
  </div>
</template>

<script setup>
const router = useRouter();
const auth = useAuthStore();
const loading = computed(() => auth.loading);
const error = ref("");
const success = ref("");
const emailAvailable = ref(null);
const emailStatus = ref("");
const emailStatusClass = computed(() =>
  emailAvailable.value === false
    ? "text-error"
    : "text-success",
);
const form = reactive({
  displayName: "",
  email: "",
  password: "",
});

const checkEmail = async () => {
  const email = form.email.trim();
  emailStatus.value = "";
  emailAvailable.value = null;

  if (!email) {
    return;
  }

  try {
    const response = await $fetch("/api/auth/check-email", {
      params: { email },
    });
    emailAvailable.value = response.available;
    emailStatus.value = response.available
      ? "Email is available."
      : "Email is already in use.";
  } catch (err) {
    emailAvailable.value = null;
    emailStatus.value = "Unable to verify email right now.";
  }
};

const submit = async () => {
  error.value = "";
  success.value = "";

  try {
    if (emailAvailable.value === false) {
      error.value = "That email is already registered.";
      return;
    }

    await auth.register({
      display_name: form.displayName,
      email: form.email,
      password: form.password,
    });
    success.value = "Account created.";
    form.password = "";
    await router.push("/");
  } catch (err) {
    error.value =
      err?.data?.statusMessage || err?.message || "Registration failed.";
  }
};
</script>
