<template>
  <div
    class="-mx-1 -mt-4 min-h-[calc(100dvh-8.5rem)] bg-zinc-50 px-4 py-12 pb-safe sm:-mx-3 sm:mt-0 sm:px-6 sm:py-16 lg:px-8"
  >
    <div class="sm:mx-auto sm:w-full sm:max-w-sm">
      <NuxtLink
        to="/"
        class="flex items-center justify-center gap-2 text-lg font-semibold tracking-tight text-zinc-900"
      >
        Future Star
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="size-7 text-primary"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
          />
        </svg>
      </NuxtLink>
      <h1 class="mt-8 text-center text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl sm:tracking-tight">
        {{ forgotMode ? "Reset your password" : "Sign in to your account" }}
      </h1>
      <p class="mt-2 text-center text-sm text-zinc-600">
        {{
          forgotMode
            ? "Enter your email and we will send you a link to choose a new password."
            : "Enter your email and password to continue."
        }}
      </p>
    </div>

    <div class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
      <form class="auth-form space-y-6" @submit.prevent="submit">
        <div>
          <label for="login-email" class="block text-sm/6 font-medium text-zinc-900">Email address</label>
          <div class="mt-2">
            <input
              id="login-email"
              v-model.trim="form.email"
              type="email"
              name="email"
              autocomplete="email"
              required
              placeholder="you@example.com"
              class="block w-full rounded-md border-0 bg-white px-3 py-1.5 text-base text-zinc-900 shadow-sm ring-1 ring-zinc-300 ring-inset placeholder:text-zinc-400 focus:ring-2 focus:ring-primary sm:text-sm sm:leading-6"
            />
          </div>
        </div>

        <div v-if="!forgotMode">
          <div class="flex items-center justify-between">
            <label for="login-password" class="block text-sm/6 font-medium text-zinc-900">Password</label>
            <button
              type="button"
              class="text-sm font-semibold text-primary hover:text-primary/80"
              @click="switchToForgot"
            >
              Forgot password?
            </button>
          </div>
          <div class="mt-2">
            <input
              id="login-password"
              v-model="form.password"
              type="password"
              name="password"
              autocomplete="current-password"
              required
              placeholder="••••••••"
              class="block w-full rounded-md border-0 bg-white px-3 py-1.5 text-base text-zinc-900 shadow-sm ring-1 ring-zinc-300 ring-inset placeholder:text-zinc-400 focus:ring-2 focus:ring-primary sm:text-sm sm:leading-6"
            />
          </div>
        </div>

        <div>
          <button
            type="submit"
            class="btn btn-primary w-full min-h-11 rounded-full"
            :disabled="loading"
          >
            {{
              loading
                ? forgotMode
                  ? "Sending…"
                  : "Signing in…"
                : forgotMode
                  ? "Send reset link"
                  : "Sign in"
            }}
          </button>
        </div>

        <p v-if="forgotMode" class="text-center text-sm text-zinc-600">
          <button
            type="button"
            class="font-semibold text-primary hover:text-primary/80"
            @click="switchToSignIn"
          >
            Back to sign in
          </button>
        </p>
      </form>

      <div
        v-if="error"
        class="mt-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200 ring-inset"
        role="alert"
      >
        {{ error }}
      </div>
      <div
        v-if="success"
        class="mt-6 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200 ring-inset"
        role="status"
      >
        {{ success }}
      </div>

    </div>
  </div>
</template>

<script setup>
import { isPasswordRecoveryRedirect, parseSupabaseAuthParams } from "~/utils/supabaseAuthHash";

const { go } = useAppNavigate();
const router = useRouter();
const auth = useAuthStore();
const loading = computed(() => auth.loading);
const error = ref("");
const success = ref("");
const forgotMode = ref(false);
const form = reactive({
  email: "",
  password: "",
});

function switchToForgot() {
  forgotMode.value = true;
  error.value = "";
  success.value = "";
  form.password = "";
}

function switchToSignIn() {
  forgotMode.value = false;
  error.value = "";
  success.value = "";
}

onMounted(() => {
  if (import.meta.client && sessionStorage.getItem("loginForgotPassword") === "1") {
    sessionStorage.removeItem("loginForgotPassword");
    switchToForgot();
  }

  const authParams = parseSupabaseAuthParams();
  if (
    authParams.type === "recovery" ||
    authParams.hasAccessToken ||
    authParams.errorCode === "otp_expired" ||
    authParams.error
  ) {
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    void router.replace({ path: "/reset-password", hash, query: Object.fromEntries(new URLSearchParams(search)) });
  } else if (isPasswordRecoveryRedirect()) {
    void router.replace({ path: "/reset-password", hash: window.location.hash });
  }
});

const submit = async () => {
  error.value = "";
  success.value = "";

  try {
    if (forgotMode.value) {
      const result = await auth.requestPasswordReset(form.email);
      success.value = result?.message || "Check your email for a reset link.";
      return;
    }

    const user = await auth.login(form.email, form.password);
    success.value = `Welcome back${user?.display_name ? `, ${user.display_name}` : ""}!`;
    form.password = "";
    await go("/");
  } catch (err) {
    error.value = err?.data?.statusMessage || err?.message || "Login failed.";
  }
};
</script>
