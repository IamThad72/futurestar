import { defineStore } from 'pinia';

export const useTestStore = defineStore('counter', {
  state: () => ({
    count: 0,
  }),
  actions: {
    increment() {
      this.count++;
    },
  },
});

export const useThemeStore = defineStore('theme', {
  state: () => ({
    themes: [
      "myTheme", "light", "dark", "cupcake", "bumblebee", "emerald",
      "corporate", "retro", "cyberpunk", "valentine", "halloween",
      "garden", "forest", "aqua", "lofi", "pastel", "fantasy",
      "wireframe", "black", "luxury", "dracula", "cmyk", "autumn",
      "business", "acid", "lemonade", "night", "coffee", "winter",
      "dim", "nord", "sunset", "silk"
    ],
    selectedTheme: "corporate"
  }),
  actions: {
    setTheme(newTheme) {
      this.selectedTheme = newTheme;
      document.documentElement.setAttribute('data-theme', newTheme); // Apply theme dynamically
    }
  }
});