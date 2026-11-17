import { financialSidebarGroups, financialTabsForPath, isFinancialPath } from "~/utils/financialNav";
import { primaryNavForPath } from "~/utils/primaryNav";
import { isPhysicalPath, physicalTabsForPath } from "~/utils/physicalNav";
import { isSpiritualHomePath, isSpiritualPath, spiritualTabsForPath } from "~/utils/spiritualNav";
import { screenTitleForRoute } from "~/utils/screenTitle";

/** Life-area links, the current screen name, and desktop sidebar groups. */
export function useAppNav() {
  const auth = useAuthStore();
  const route = useRoute();

  const isFinancialSection = computed(() => isFinancialPath(route.path));
  const isPhysicalSection = computed(() => isPhysicalPath(route.path));
  const isSpiritualSection = computed(() => isSpiritualPath(route.path));
  const isSpiritualHome = computed(() => isSpiritualHomePath(route.path));

  const links = computed(() => {
    if (auth.user) return primaryNavForPath(route.path);
    return [
      {
        name: "Login",
        path: "/login",
        icon: "",
        pillar: "",
        current: route.path.startsWith("/login"),
      },
    ];
  });

  const screenTitle = computed(() => screenTitleForRoute(route.path, route.query, route.hash));

  const sidebarGroups = computed(() => {
    if (!auth.user) return [];
    if (isFinancialSection.value) {
      return financialSidebarGroups(financialTabsForPath(route.path, route.query, route.hash));
    }
    if (isSpiritualSection.value) {
      const tabs = spiritualTabsForPath(route.path).filter((tab) => tab.href !== "/spiritual");
      return tabs.length ? [{ name: "Today", tabs }] : [];
    }
    if (isPhysicalSection.value) {
      const tabs = physicalTabsForPath(route.path).filter((tab) => tab.href !== "/physical");
      return tabs.length ? [{ name: "Training", tabs }] : [];
    }
    return [];
  });

  const sectionLabel = computed(() => {
    if (isFinancialSection.value) return "Financial";
    if (isPhysicalSection.value) return "Physical";
    if (isSpiritualSection.value) return "Spiritual";
    return "Future Star";
  });

  return {
    auth,
    route,
    isFinancialSection,
    isPhysicalSection,
    isSpiritualSection,
    isSpiritualHome,
    links,
    screenTitle,
    sidebarGroups,
    sectionLabel,
  };
}
