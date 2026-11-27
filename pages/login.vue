<template>
 
  <div
    class="-mt-4 min-h-[calc(100dvh-8.5rem)] bg-base-200 px-4 py-12 pb-safe sm:mt-0 sm:px-6 sm:py-16 lg:px-8"
  >
    <div class="sm:mx-auto sm:w-full sm:max-w-sm">
      <NuxtLink
        to="/"
        class="flex items-center justify-center gap-2 text-lg font-semibold tracking-tight text-gray-900"
      >
        Future Star
        <AppIcon name="sparkles" :size="24" class="text-primary" />
      </NuxtLink>
      <h1 class="mt-8 text-center text-2xl font-medium tracking-tight text-gray-900">
        {{ forgotMode ? "Reset your password" : "Sign in to your account" }}
      </h1>
      <p class="mt-3 text-center text-base text-gray-600">
        {{
          forgotMode
            ? "Enter your email and we will send you a link to choose a new password."
            : "Enter your email and password to continue."
        }}
      </p>
    </div>

    <div class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm sm:rounded-5xl sm:bg-white sm:p-10 sm:shadow-2xl sm:shadow-gray-900/10">
      <form class="auth-form space-y-6" @submit.prevent="submit">
        <div>
          <label for="login-email" class="mb-2 block text-sm font-semibold text-gray-900">Email address</label>
          <div class="mt-2">
            <input
              id="login-email"
              v-model.trim="form.email"
              type="email"
              name="email"
              autocomplete="email"
              autocapitalize="off"
              spellcheck="false"
              :enterkeyhint="forgotMode ? 'send' : 'next'"
              required
              placeholder="you@example.com"
              class="input input-bordered w-full bg-base-100 text-base-content"
            />
          </div>
        </div>

        <div v-if="!forgotMode">
          <div class="flex items-center justify-between">
            <label for="login-password" class="block text-sm font-semibold text-gray-900">Password</label>
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
              enterkeyhint="go"
              required
              placeholder="••••••••"
              class="input input-bordered w-full bg-base-100 text-base-content"
            />
          </div>
        </div>

        <div>
          <button
            type="submit"
            class="btn btn-primary w-full min-h-11 rounded-lg"
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

        <p v-if="forgotMode" class="text-center text-sm text-base-content/70">
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
        class="mt-6 rounded-md bg-error/10 px-3 py-2 text-sm text-error ring-1 ring-error/20 ring-inset"
        role="alert"
      >
        {{ error }}
      </div>
      <div
        v-if="success"
        class="mt-6 rounded-md bg-success/10 px-3 py-2 text-sm text-success ring-1 ring-success/20 ring-inset"
        role="status"
      >
        {{ success }}
      </div>

    </div>
  </div>
 
</template>

<script setup>
import { takeAccountDeletedNotice } from "~/utils/accountDeletedNotice";
import { safeDeleteAccountNext } from "~/utils/deletionGuards";
import { isPasswordRecoveryRedirect, parseSupabaseAuthParams } from "~/utils/supabaseAuthHash";

useHead({ title: "Sign in" });

const { go } = useAppNavigate();
const route = useRoute();
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
  const deletedNotice = takeAccountDeletedNotice();
  if (deletedNotice) success.value = deletedNotice;

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
    await go(safeDeleteAccountNext(route.query.next) || "/today");
  } catch (err) {
    error.value = err?.data?.statusMessage || err?.message || "Login failed.";
  }
};
</script>
