import { financialTabsForPath, isFinancialPath } from "~/utils/financialNav";
import { isPhysicalPath, physicalTabsForPath } from "~/utils/physicalNav";

/** Life-area links and in-section tabs for the desktop drawer and Ionic menu. */
export function useAppNav() {
  const auth = useAuthStore();
  const route = useRoute();

  const isFinancialSection = computed(() => isFinancialPath(route.path));
  const isPhysicalSection = computed(() => isPhysicalPath(route.path));
  const isSpiritualSection = computed(() => route.path.startsWith("/spiritual"));

  const links = computed(() => {
    if (auth.user) {
      return [
        {
          name: "Financial",
          path: "/financial",
          current: isFinancialPath(route.path),
        },
        {
          name: "Spiritual",
          path: "/spiritual",
          current: route.path.startsWith("/spiritual"),
        },
        {
          name: "Physical",
          path: "/physical",
          current: route.path.startsWith("/physical"),
        },
      ];
    }
    return [
      {
        name: "Login",
        path: "/login",
        current: route.path.startsWith("/login"),
      },
    ];
  });

  const sectionTabs = computed(() => {
    if (isFinancialSection.value) {
      return financialTabsForPath(route.path, route.query, route.hash).filter(
        (tab) => !tab.hideOnMobile,
      );
    }
    if (isPhysicalSection.value) {
      return physicalTabsForPath(route.path);
    }
    return [];
  });

  const sectionLabel = computed(() => {
    if (isFinancialSection.value) return "Financial";
    if (isPhysicalSection.value) return "Physical";
    return "";
  });

  return {
    auth,
    route,
    isFinancialSection,
    isPhysicalSection,
    isSpiritualSection,
    links,
    sectionTabs,
    sectionLabel,
  };
}
