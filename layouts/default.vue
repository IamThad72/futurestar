<template>
  <div
    class="app-layout-root"
    :class="useMobileChrome ? 'mobile-shell' : 'app-drawer'"
  >
    <MobileIonicShell
      v-if="useMobileChrome"
      @open-account="openAccountManagement"
      @open-linked="openLinkedAccounts"
    >
      <slot />
    </MobileIonicShell>

    <template v-else>
      <div class="drawer-content">
        <nav class="app-navbar navbar sticky top-0 z-40 min-h-16 bg-base-200/90 px-2 pt-safe text-base-content sm:px-6 lg:px-8">
          <div class="navbar-start gap-1 sm:gap-4">
            <NuxtLink
              to="/"
              class="flex shrink-0 items-center gap-2 font-semibold text-gray-900 no-underline hover:text-gray-700"
            >
              <span class="text-lg sm:text-base">Future Star</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="inline-block size-6 shrink-0 text-primary">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
              </svg>
            </NuxtLink>

            <div v-if="auth.user" class="flex items-center gap-1">
              <NuxtLink
                v-for="link in links"
                :key="link.name"
                :to="link.path"
                :class="getNavLinkClass(link.current)"
                :aria-current="link.current ? 'page' : undefined"
              >
                {{ link.name }}
              </NuxtLink>
            </div>
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
                  v-if="auth.user?.profile_photo"
                  :src="auth.user.profile_photo"
                  alt="Profile"
                  class="size-10 rounded-full bg-primary object-cover ring-2 ring-white"
                />
                <span
                  v-else
                  class="flex size-10 items-center justify-center rounded-full bg-gray-800 text-white ring-2 ring-white"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
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
          <AppSidebar
            v-if="sidebarGroups.length"
            :label="sectionLabel"
            :groups="sidebarGroups"
          />
          <div class="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-base-200">
            <main
              class="layout-main flex-1"
              :class="{ 'layout-main--flush-end': isSpiritualHome }"
            >
              <slot />
            </main>
          </div>
        </div>

        <footer class="border-t border-gray-200 bg-base-200 pb-safe">
          <div class="mx-auto max-w-7xl px-1 py-1 sm:px-6 lg:px-8">
            <p class="text-center text-[11px] font-medium text-gray-500 sm:text-xs">
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
import { onMounted, ref } from 'vue'

const {
  auth,
  route,
  isSpiritualHome,
  links,
  sidebarGroups,
  sectionLabel,
} = useAppNav();
const { useMobileChrome } = useMobileShell();
const showAccountManagement = ref(false);
const showLinkedAccounts = ref(false);

async function logoutFromMenu(close) {
  close?.();
  const { signOut } = useSignOut();
  await signOut();
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
