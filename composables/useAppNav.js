import { financialTabsForPath, isFinancialPath } from "~/utils/financialNav";
import { isPhysicalPath, physicalTabsForPath } from "~/utils/physicalNav";
import { isSpiritualHomePath, isSpiritualPath, spiritualTabsForPath } from "~/utils/spiritualNav";

/** Life-area links and in-section tabs for the desktop drawer and Ionic menu. */
export function useAppNav() {
  const auth = useAuthStore();
  const route = useRoute();

  const isFinancialSection = computed(() => isFinancialPath(route.path));
  const isPhysicalSection = computed(() => isPhysicalPath(route.path));
  const isSpiritualSection = computed(() => isSpiritualPath(route.path));
  const isSpiritualHome = computed(() => isSpiritualHomePath(route.path));

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
          current: isSpiritualPath(route.path),
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
    if (isSpiritualSection.value) {
      return spiritualTabsForPath(route.path);
    }
    return [];
  });

  const sectionLabel = computed(() => {
    if (isFinancialSection.value) return "Financial";
    if (isPhysicalSection.value) return "Physical";
    if (isSpiritualSection.value) return "Spiritual";
    return "";
  });

  return {
    auth,
    route,
    isFinancialSection,
    isPhysicalSection,
    isSpiritualSection,
    isSpiritualHome,
    links,
    sectionTabs,
    sectionLabel,
  };
}
