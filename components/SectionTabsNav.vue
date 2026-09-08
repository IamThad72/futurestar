<template>
  <div
    :class="
      embedded
        ? 'w-full'
        : 'sticky top-0 z-20 border-b border-gray-200 bg-base-200 px-4 py-3 sm:px-6 lg:px-8'
    "
  >
    <div :class="embedded ? 'w-full' : 'mx-auto max-w-7xl'">
      <div :class="embedded ? 'grid grid-cols-1' : 'grid grid-cols-1 sm:hidden'">
        <select
          :aria-label="`Select a ${ariaLabel} tab`"
          class="select select-bordered w-full bg-base-100 text-base text-base-content"
          :class="embedded ? 'min-h-10' : 'min-h-11'"
          :value="currentHref"
          @change="onSelectTab"
        >
          <option v-for="tab in mobileTabs" :key="tab.name" :value="tab.href">{{ tab.name }}</option>
        </select>
      </div>
      <nav
        v-if="!embedded"
        class="hidden overflow-x-auto sm:block"
        :aria-label="ariaLabel"
      >
        <ul role="tablist" class="flex min-w-full flex-none gap-x-6 text-sm font-semibold text-base-content/50">
          <li v-for="tab in desktopTabs" :key="tab.name">
            <AppLink
              :to="tab.href"
              role="tab"
              class="inline-block whitespace-nowrap border-b-2 py-3 no-underline"
              :class="
                tab.current
                  ? 'border-primary text-primary'
                  : 'border-transparent hover:border-base-300 hover:text-base-content'
              "
              :aria-current="tab.current ? 'page' : undefined"
              :aria-selected="tab.current ? 'true' : 'false'"
            >
              {{ tab.name }}
            </AppLink>
          </li>
        </ul>
      </nav>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  tabs: { type: Array, required: true },
  fallbackHref: { type: String, required: true },
  ariaLabel: { type: String, required: true },
  /** Compact select for Ionic header toolbars (no sticky page chrome). */
  embedded: { type: Boolean, default: false },
});

const { go } = useAppNavigate();
const { isStacked } = useMobileShell();

const mobileTabs = computed(() => props.tabs.filter((tab) => !tab.hideOnMobile));
const desktopTabs = computed(() =>
  isStacked.value ? mobileTabs.value : props.tabs,
);

const currentHref = computed(
  () => mobileTabs.value.find((tab) => tab.current)?.href ?? props.fallbackHref,
);

function onSelectTab(event) {
  const href = event.target?.value;
  if (href) void go(href);
}
</script>
