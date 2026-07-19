import { defineStore } from "pinia";
import { Capacitor } from "@capacitor/core";
import { parseFetchError } from "~/utils/parseFetchError";

function isNativeApp() {
  return import.meta.client && Capacitor.isNativePlatform();
}

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null,
    loading: false,
    error: "",
    ready: false,
  }),
  actions: {
    async fetchSession() {
      this.loading = true;
      this.error = "";

      try {
        const response = await $fetch("/api/auth/me", { timeout: 8000 });
        this.user = response?.user ?? null;
      } catch (error) {
        this.error = parseFetchError(error, "Session check failed.");
        this.user = null;
      } finally {
        this.loading = false;
        this.ready = true;
      }
    },
    async login(email, password) {
      this.loading = true;
      this.error = "";

      try {
        const nuxtApp = useNuxtApp();
        const supabase = nuxtApp.$supabase;
        const normalizedEmail = email.trim().toLowerCase();

        // Legacy cookie login only works same-origin (web). Native uses Supabase JWT on /api/.
        if (!isNativeApp()) {
          try {
            const legacyResponse = await $fetch("/api/auth/login", {
              method: "POST",
              body: { email: normalizedEmail, password },
            });
            if (legacyResponse?.user) {
              this.user = legacyResponse.user;
              return this.user;
            }
          } catch (legacyErr) {
            if (!supabase) {
              const msg =
                legacyErr?.data?.statusMessage ||
                legacyErr?.message ||
                "Invalid email or password.";
              const err = new Error(msg);
              err.data = { statusMessage: msg };
              throw err;
            }
          }
        }

        // Try Supabase Auth (new users, or when legacy had no user)
        if (!supabase) {
          const err = new Error("Invalid email or password.");
          err.data = { statusMessage: "Invalid email or password." };
          throw err;
        }
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (authError) {
          const err = new Error(authError.message || "Invalid email or password.");
          err.data = { statusMessage: authError.message || "Invalid email or password." };
          throw err;
        }

        const token = data?.session?.access_token;
        if (!token) {
          const err = new Error("No session.");
          err.data = { statusMessage: "No session." };
          throw err;
        }

        const response = await $fetch("/api/auth/supabase-link", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        this.user = response?.user ?? null;
        return this.user;
      } catch (error) {
        this.error =
          error?.data?.statusMessage || error?.message || "Login failed.";
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async register(payload) {
      this.loading = true;
      this.error = "";

      try {
        const nuxtApp = useNuxtApp();
        const supabase = nuxtApp.$supabase;
        if (!supabase) {
          // Fallback to legacy register when Supabase not configured
          const response = await $fetch("/api/auth/register", {
            method: "POST",
            body: payload,
          });
          this.user = response?.user ?? null;
          return this.user;
        }
        const { data, error: authError } = await supabase.auth.signUp({
          email: payload.email.trim().toLowerCase(),
          password: payload.password,
          options: {
            data: { display_name: payload.display_name || null },
          },
        });

        if (authError) {
          const err = new Error(authError.message || "Registration failed.");
          err.data = { statusMessage: authError.message || "Registration failed." };
          throw err;
        }

        const token = data?.session?.access_token;
        if (!token) {
          // Email confirmation may be required
          const err = new Error("Check your email to confirm your account before signing in.");
          err.data = { statusMessage: "Check your email to confirm your account before signing in." };
          throw err;
        }

        const response = await $fetch("/api/auth/supabase-link", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        this.user = response?.user ?? null;
        return this.user;
      } catch (error) {
        this.error =
          error?.data?.statusMessage || error?.message || "Registration failed.";
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async requestPasswordReset(email) {
      this.loading = true;
      this.error = "";

      try {
        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail) {
          const err = new Error("Email is required.");
          err.data = { statusMessage: "Email is required." };
          throw err;
        }

        const response = await $fetch("/api/auth/request-password-reset", {
          method: "POST",
          body: { email: normalizedEmail },
        });
        return { message: response?.message || "Check your email for a reset link." };
      } catch (error) {
        this.error =
          error?.data?.statusMessage || error?.message || "Password reset request failed.";
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async completePasswordReset(newPassword) {
      this.loading = true;
      this.error = "";

      try {
        if (!newPassword || newPassword.length < 8) {
          const err = new Error("Password must be at least 8 characters.");
          err.data = { statusMessage: "Password must be at least 8 characters." };
          throw err;
        }

        const supabase = useNuxtApp().$supabase;
        if (!supabase) {
          const err = new Error("Password reset is not available.");
          err.data = { statusMessage: "Password reset is not available." };
          throw err;
        }

        const { error: updateError } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (updateError) {
          const err = new Error(updateError.message || "Could not update password.");
          err.data = { statusMessage: updateError.message || "Could not update password." };
          throw err;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (token) {
          await $fetch("/api/auth/sync-password-after-reset", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: { newPassword },
          }).catch(() => undefined);
        }

        await supabase.auth.signOut();
        return { success: true };
      } catch (error) {
        this.error =
          error?.data?.statusMessage || error?.message || "Password reset failed.";
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async logout() {
      this.loading = true;
      this.error = "";

      try {
        const supabase = useNuxtApp().$supabase;
        if (supabase) {
          await supabase.auth.signOut();
        }
        await $fetch("/api/auth/logout", { method: "POST" });
      } catch (error) {
        this.error =
          error?.data?.statusMessage || error?.message || "Logout failed.";
      } finally {
        this.user = null;
        this.loading = false;
      }
    },
  },
});
