<template>
  <div
    class="-mx-1 -mt-4 min-h-[calc(100dvh-8.5rem)] bg-base-200 px-1 py-12 pb-safe sm:-mx-0 sm:mt-0 sm:px-6 sm:py-16 lg:px-8"
  >
    <div class="sm:mx-auto sm:w-full sm:max-w-sm">
      <NuxtLink
        to="/"
        class="flex items-center justify-center gap-2 text-lg font-semibold tracking-tight text-base-content"
      >
        Future Star
        <AppIcon name="sparkles" :size="24" class="text-primary" />
      </NuxtLink>
      <h1 class="mt-8 text-center text-2xl font-medium tracking-tight text-gray-900">
        Set a new password
      </h1>
      <p class="mt-2 text-center text-sm text-zinc-600">
        Choose a new password for your account.
      </p>
    </div>

    <div class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm sm:rounded-5xl sm:bg-white sm:p-10 sm:shadow-2xl sm:shadow-gray-900/10">
      <p v-if="!ready" class="text-center text-sm text-zinc-600">Verifying reset link…</p>

      <p
        v-else-if="linkError"
        class="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200 ring-inset"
        role="alert"
      >
        {{ linkError }}
      </p>

      <form v-else-if="canReset" class="auth-form space-y-6" @submit.prevent="submit">
        <div>
          <label for="reset-password" class="block text-sm/6 font-medium text-zinc-900">New password</label>
          <div class="mt-2">
            <input
              id="reset-password"
              v-model="form.password"
              type="password"
              name="password"
              autocomplete="new-password"
              required
              minlength="8"
              placeholder="At least 8 characters"
              class="block w-full rounded-md border-0 bg-white px-3 py-1.5 text-base text-zinc-900 shadow-sm ring-1 ring-zinc-300 ring-inset placeholder:text-zinc-400 focus:ring-2 focus:ring-primary sm:text-sm sm:leading-6"
            />
          </div>
        </div>

        <div>
          <label for="reset-password-confirm" class="block text-sm/6 font-medium text-zinc-900">
            Confirm new password
          </label>
          <div class="mt-2">
            <input
              id="reset-password-confirm"
              v-model="form.confirmPassword"
              type="password"
              name="confirmPassword"
              autocomplete="new-password"
              required
              minlength="8"
              placeholder="••••••••"
              class="block w-full rounded-md border-0 bg-white px-3 py-1.5 text-base text-zinc-900 shadow-sm ring-1 ring-zinc-300 ring-inset placeholder:text-zinc-400 focus:ring-2 focus:ring-primary sm:text-sm sm:leading-6"
            />
          </div>
        </div>

        <div>
          <button
            type="submit"
            class="btn btn-primary w-full min-h-11 rounded-lg"
            :disabled="loading"
          >
            {{ loading ? "Updating…" : "Update password" }}
          </button>
        </div>
      </form>

      <p
        v-else
        class="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200 ring-inset"
        role="alert"
      >
        This reset link is invalid or has expired. Use Login in the header to request a new link.
      </p>

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

      <p class="mt-8 text-center text-sm text-zinc-600">
        Login stays in the header.
        <button
          v-if="linkError"
          type="button"
          class="font-semibold text-primary hover:text-primary/80"
          @click="openForgotOnLogin"
        >
          Request a new reset link
        </button>
      </p>
      <p v-if="resetLinkReady" class="mt-2 text-center text-sm text-zinc-600">
        Use Login in the header. The reset form will be open.
      </p>
    </div>
  </div>
</template>

<script setup>
import {
  formatSupabaseAuthError,
  isPasswordRecoveryRedirect,
  parseSupabaseAuthParams,
} from "~/utils/supabaseAuthHash";

useHead({ title: "Reset password" });

const auth = useAuthStore();
const router = useRouter();
const loading = ref(false);
const ready = ref(false);
const canReset = ref(false);
const resetLinkReady = ref(false);
const linkError = ref("");
const error = ref("");
const success = ref("");
const form = reactive({
  password: "",
  confirmPassword: "",
});

function openForgotOnLogin() {
  if (import.meta.client) {
    sessionStorage.setItem("loginForgotPassword", "1");
  }
  resetLinkReady.value = true;
}

function clearAuthHashFromUrl() {
  if (!import.meta.client) return;
  const path = router.currentRoute.value.path;
  window.history.replaceState(null, "", path);
}

onMounted(async () => {
  const supabase = useNuxtApp().$supabase;
  const authParams = parseSupabaseAuthParams();

  if (authParams.error) {
    linkError.value = formatSupabaseAuthError(
      authParams.errorCode,
      authParams.errorDescription,
    );
    ready.value = true;
    return;
  }

  if (!supabase) {
    linkError.value = "Password reset is not configured.";
    ready.value = true;
    return;
  }

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY" && session) {
      canReset.value = true;
      linkError.value = "";
      clearAuthHashFromUrl();
    }
  });

  onUnmounted(() => subscription.unsubscribe());

  if (isPasswordRecoveryRedirect()) {
    await new Promise((r) => setTimeout(r, 100));
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      canReset.value = true;
      clearAuthHashFromUrl();
    }
  }

  const code = new URLSearchParams(window.location.search).get("code");
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      linkError.value = exchangeError.message;
    } else {
      canReset.value = true;
      clearAuthHashFromUrl();
    }
  }

  ready.value = true;
});

const submit = async () => {
  error.value = "";
  success.value = "";

  if (form.password.length < 8) {
    error.value = "Password must be at least 8 characters.";
    return;
  }
  if (form.password !== form.confirmPassword) {
    error.value = "Passwords do not match.";
    return;
  }

  loading.value = true;
  try {
    await auth.completePasswordReset(form.password);
    success.value = "Your password has been updated. You can sign in from the header.";
    form.password = "";
    form.confirmPassword = "";
  } catch (err) {
    error.value = err?.data?.statusMessage || err?.message || "Could not update password.";
  } finally {
    loading.value = false;
  }
};
</script>
