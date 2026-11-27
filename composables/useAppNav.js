import { financialSidebarGroups, financialTabsForPath, isFinancialPath } from "~/utils/financialNav";
import { primaryNavForPath } from "~/utils/primaryNav";
import { isPhysicalPath, physicalSidebarGroups, physicalTabsForPath } from "~/utils/physicalNav";
import { isSpiritualHomePath, isSpiritualPath, spiritualSidebarGroups } from "~/utils/spiritualNav";
import { screenTitleForRoute } from "~/utils/screenTitle";

/** Life-area links, the current screen name, and desktop sidebar groups. */
export function useAppNav() {
  const auth = useAuthStore();
  const route = useRoute();
  const faith = useFaithProfile();

  const isFinancialSection = computed(() => isFinancialPath(route.path));
  const isPhysicalSection = computed(() => isPhysicalPath(route.path));
  const isSpiritualSection = computed(() => isSpiritualPath(route.path));
  const isSpiritualHome = computed(() => isSpiritualHomePath(route.path));

  const links = computed(() => primaryNavForPath(route.path));

  /** Tradition-specific names (e.g. Evening Examen vs Evening Reflection) once the profile has loaded. */
  const faithTradition = computed(() => (faith.loaded.value ? faith.tradition.value : ""));

  watch(
    () => [auth.user?.user_id, isSpiritualSection.value],
    ([userId, inSpiritual]) => {
      if (userId && inSpiritual) void faith.load();
    },
    { immediate: true },
  );

  const screenTitle = computed(() =>
    screenTitleForRoute(route.path, route.query, route.hash, faithTradition.value),
  );

  const sidebarGroups = computed(() => {
    if (isFinancialSection.value) {
      return financialSidebarGroups(financialTabsForPath(route.path, route.query, route.hash));
    }
    if (isSpiritualSection.value) {
      return spiritualSidebarGroups(route.path, faithTradition.value);
    }
    if (isPhysicalSection.value) {
      const tabs = physicalTabsForPath(route.path).filter((tab) => tab.href !== "/physical");
      return physicalSidebarGroups(tabs);
    }
    return [];
  });

  const sectionLabel = computed(() => {
    if (isFinancialSection.value) return "Money";
    if (isPhysicalSection.value) return "Body";
    if (isSpiritualSection.value) return "Faith";
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
