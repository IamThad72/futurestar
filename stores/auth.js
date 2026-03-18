import { defineStore } from "pinia";

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
        // Plugin adds Supabase JWT to /api/ requests; server supports JWT + legacy session cookie
        const response = await $fetch("/api/auth/me");
        this.user = response?.user ?? null;
      } catch (error) {
        this.error =
          error?.data?.statusMessage || error?.message || "Session check failed.";
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

        // Try legacy login first (existing app_users) - avoids Supabase 400 for users not in Auth
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
          // Legacy failed - try Supabase if configured
          if (!supabase) {
            const msg = legacyErr?.data?.statusMessage || legacyErr?.message || "Invalid email or password.";
            const err = new Error(msg);
            err.data = { statusMessage: msg };
            throw err;
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
        throw error;
      } finally {
        this.user = null;
        this.loading = false;
      }
    },
  },
});
