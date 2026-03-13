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
        const response = await $fetch("/api/auth/login", {
          method: "POST",
          body: { email, password },
        });
        this.user = response?.user ?? null;
        return this.user;
      } catch (error) {
        this.error = error?.data?.statusMessage || error?.message || "Login failed.";
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async register(payload) {
      this.loading = true;
      this.error = "";

      try {
        const response = await $fetch("/api/auth/register", {
          method: "POST",
          body: payload,
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
