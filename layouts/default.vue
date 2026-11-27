<template>
  <div
    class="app-layout-root"
    :class="useMobileChrome ? 'mobile-shell' : 'app-drawer'"
  >
    <MobileIonicShell v-if="useMobileChrome">
      <slot />
    </MobileIonicShell>

    <template v-else>
      <div class="drawer-content">
        <nav class="app-navbar navbar sticky top-0 z-40 min-h-16 bg-base-200/90 px-2 pt-safe text-base-content sm:px-6 lg:px-8">
          <div class="navbar-start gap-1 sm:gap-4">
            <NuxtLink
              :to="homePath"
              class="brand-lockup flex shrink-0 items-center gap-2 font-serif text-lg font-semibold text-ink no-underline"
            >
              <span>Future Star</span>
              <AppIcon name="star" :size="24" :stroke-width="1.75" class="brand-star" />
            </NuxtLink>
          </div>

          <div class="navbar-end">
            <NuxtLink
              v-if="!auth.user"
              to="/login"
              class="hidden sm:inline-flex"
              :class="getNavLinkClass(route.path.startsWith('/login'))"
              :aria-current="route.path.startsWith('/login') ? 'page' : undefined"
            >
              Login
            </NuxtLink>
            <HeadlessMenu
              v-if="auth.user"
              v-slot="{ close }"
              as="div"
              class="relative"
            >
              <HeadlessMenuButton
                class="relative flex rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <span class="sr-only">Open user menu</span>
                <img
                  v-if="showHeaderAvatar"
                  :src="headerAvatarUrl"
                  alt="Profile"
                  class="size-10 rounded-full bg-primary object-cover ring-2 ring-white"
                />
                <span
                  v-else
                  class="flex size-10 items-center justify-center rounded-full bg-gray-800 text-white ring-2 ring-white"
                >
                  <AppIcon name="person" :size="24" />
                </span>
              </HeadlessMenuButton>

              <transition
                enter-active-class="transition ease-out duration-100"
                enter-from-class="transform opacity-0 scale-95"
                enter-to-class="transform opacity-100 scale-100"
                leave-active-class="transition ease-in duration-75"
                leave-from-class="transform opacity-100 scale-100"
                leave-to-class="transform opacity-0 scale-95"
              >
                <HeadlessMenuItems
                  class="app-user-menu absolute right-0 z-50 mt-2 w-48 origin-top-right focus:outline-none"
                >
                  <HeadlessMenuItem v-slot="{ active }" class="w-full">
                    <button
                      type="button"
                      class="app-user-menu__item"
                      :class="{ 'app-user-menu__item--active': active }"
                      @click="openAccountManagement(close)"
                    >
                      Account Management
                    </button>
                  </HeadlessMenuItem>
                  <HeadlessMenuItem v-slot="{ active }" class="w-full">
                    <button
                      type="button"
                      class="app-user-menu__item"
                      :class="{ 'app-user-menu__item--active': active }"
                      @click="openLinkedAccounts(close)"
                    >
                      Linked Accounts
                    </button>
                  </HeadlessMenuItem>
                  <HeadlessMenuItem v-slot="{ active }" class="w-full">
                    <button
                      type="button"
                      class="app-user-menu__item"
                      :class="{ 'app-user-menu__item--active': active }"
                      :disabled="signingOut"
                      :aria-busy="signingOut"
                      @click="logoutFromMenu(close)"
                    >
                      Logout
                    </button>
                  </HeadlessMenuItem>
                </HeadlessMenuItems>
              </transition>
            </HeadlessMenu>
          </div>
        </nav>

        <div class="app-shell-body">
          <aside class="app-nav-column" aria-label="Primary">
            <AppPrimaryNav :links="links" />
            <AppSidebar
              v-if="sidebarGroups.length"
              embedded
              :label="sectionLabel"
              :groups="sidebarGroups"
            />
          </aside>
          <div class="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-base-200">
            <main
              id="main-content"
              tabindex="-1"
              class="layout-main flex-1"
              :class="{ 'layout-main--flush-end': isSpiritualHome }"
            >
              <slot />
            </main>
          </div>
        </div>

        <footer class="border-t border-gray-200 bg-base-200 pb-safe">
          <div class="mx-auto max-w-7xl px-1 py-1 sm:px-6 lg:px-8">
            <p class="text-center text-xs font-medium text-muted">
              &copy; 2026 Marcelli Enterprises LLC. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </template>

    <LazyAccountManagementModal v-if="showAccountManagement" v-model="showAccountManagement" />
    <LazyLinkedAccountsModal v-if="showLinkedAccounts" v-model="showLinkedAccounts" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { homePathForUser } from '~/utils/primaryNav'
import { profilePhotoUrl, showProfileAvatar } from '~/utils/profileAvatar'
import { runGuardedSignOut } from '~/utils/signOutGuard'

const {
  auth,
  route,
  isSpiritualHome,
  links,
  sidebarGroups,
  sectionLabel,
} = useAppNav();
const homePath = computed(() => homePathForUser(auth.user));
const headerAvatarUrl = computed(() => profilePhotoUrl(auth.user));
const showHeaderAvatar = computed(() => showProfileAvatar(auth.user));
const { useMobileChrome } = useMobileShell();
const showAccountManagement = ref(false);
const showLinkedAccounts = ref(false);
const signingOut = ref(false);
const { signOut } = useSignOut();

async function logoutFromMenu(close) {
  if (signingOut.value) return;
  close?.();
  try {
    await runGuardedSignOut(signingOut, signOut);
  } catch {
    // runGuardedSignOut re-enables the menu item.
  }
}

function openAccountManagement(close) {
  if (typeof close === "function") close();
  showAccountManagement.value = true;
}

function openLinkedAccounts(close) {
  if (typeof close === "function") close();
  showLinkedAccounts.value = true;
}

onMounted(() => {
  if (!auth.ready) {
    auth.fetchSession();
  }
});

const getNavLinkClass = (current) => {
  return [
    current
      ? 'bg-gray-100 text-gray-900 font-semibold'
      : 'text-gray-700 font-medium hover:bg-gray-100 hover:text-gray-900',
    'rounded-lg px-3 py-2 text-sm no-underline',
  ];
};
</script>
<style>
@media (min-width: 1024px) {
  main.layout-main.layout-main--flush-end {
    padding-right: 0 !important;
  }
}
</style>
