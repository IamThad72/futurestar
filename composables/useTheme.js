import { ref, onMounted } from 'vue';

export function useTheme() {
  const theme = ref('light'); // Default theme

  // Function to set the theme
  const setTheme = (newTheme) => {
    theme.value = newTheme;
    document.documentElement.setAttribute('data-theme', newTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', newTheme);
    }
  };

  // Load theme on the client side
  onMounted(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) {
        theme.value = savedTheme;
        document.documentElement.setAttribute('data-theme', savedTheme);
      }
    }
  });


  return { theme, setTheme };
}