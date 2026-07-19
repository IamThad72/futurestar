<template>
  <div class="flex min-h-0 flex-1 flex-col" :class="{ 'mobile-shell': isNarrowViewport }">
     <!-- Navbar (Tailwind Plus disclosure layout; bg-primary) -->
    <HeadlessDisclosure
      as="nav"
      class="app-navbar relative bg-primary dark:bg-primary/95 dark:after:pointer-events-none dark:after:absolute dark:after:inset-x-0 dark:after:bottom-0 dark:after:h-px dark:after:bg-white/10"
      v-slot="{ open, close }"
    >
      <div class="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8">
        <div class="relative flex h-16 items-center justify-between">
          <div v-if="links.length" class="absolute inset-y-0 left-0 flex items-center sm:hidden">
            <HeadlessDisclosureButton
              class="relative inline-flex items-center justify-center rounded-md p-2 text-white/70 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-secondary"
            >
              <span class="absolute -inset-0.5"></span>
              <span class="sr-only">Open main menu</span>
              <Bars3Icon v-if="!open" class="block size-6" aria-hidden="true" />
              <XMarkIcon v-else class="block size-6" aria-hidden="true" />
            </HeadlessDisclosureButton>
          </div>

          <div class="flex flex-1 items-center justify-center sm:items-stretch sm:justify-start">
            <div class="flex shrink-0 items-center">
              <NuxtLink
                to="/"
                class="flex shrink-0 items-center gap-2 font-bold text-lg text-white sm:text-sm hover:text-white/90"
              >
                Future Star
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="inline-block size-6 shrink-0">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                </svg>
              </NuxtLink>
            </div>
            <div class="hidden sm:ml-6 sm:block">
              <div class="flex space-x-1">
                <NuxtLink
                  v-for="link in links"
                  :key="link.name"
                  :to="link.path"
                  :class="getNavLinkClass(link.path)"
                  :aria-current="isNavLinkActive(link.path) ? 'page' : undefined"
                >
                  {{ link.name }}
                </NuxtLink>
              </div>
            </div>
          </div>

          <div class="absolute inset-y-0 right-0 flex items-center pr-2 sm:static sm:inset-auto sm:ml-6 sm:pr-0">
            <HeadlessMenu
              v-if="auth.user"
              v-slot="{ close }"
              as="div"
              class="relative ml-3"
            >
              <HeadlessMenuButton
                class="relative flex rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
              >
                <span class="absolute -inset-1.5"></span>
                <span class="sr-only">Open user menu</span>
                <img
                  v-if="auth.user?.profile_photo"
                  :src="auth.user.profile_photo"
                  alt="Profile"
                  class="size-[2.4rem] rounded-full bg-primary object-cover ring-2 ring-white"
                />
                <span
                  v-else
                  class="flex size-[2.4rem] items-center justify-center rounded-full bg-secondary text-white ring-2 ring-white"
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
        </div>
      </div>

      <HeadlessDisclosurePanel class="sm:hidden">
        <div class="space-y-1 px-2 pb-3 pt-2">
          <AppLink
            v-for="link in links"
            :key="link.name"
            :to="link.path"
            :class="getMobileNavClass(link.path)"
            :aria-current="isNavLinkActive(link.path) ? 'page' : undefined"
            @click="close()"
          >
            {{ link.name }}
          </AppLink>
        </div>
      </HeadlessDisclosurePanel>
    </HeadlessDisclosure>
    <!--Unathenticated Navbar-->
    <!--Athenticated Navbar-->
    <!--Athenticated Navbar-->

    
    
    
    
    <!-- SCROLLABLE MAIN CONTENT -->
    <div class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
      <main class="layout-main bg-ghost py-4 sm:py-6 px-0.5 pr-0 sm:px-2 sm:pr-1.5">
        <slot />
      </main>
    </div>



    <AccountManagementModal v-model="showAccountManagement" />
    <LinkedAccountsModal v-model="showLinkedAccounts" />
    <!-- //FOOTER -->
    <!--UnAuthenticated Footer-->
        <footer class="bg-neutral pb-safe">
          <div class="mx-auto max-w-7xl px-4 py-1 sm:px-6 lg:px-8">
            <p class="text-center text-[11px] font-medium text-neutral-content sm:text-xs">
              &copy; 2026 Marcelli Enterprises LLC. All rights reserved.
            </p>
          </div>
        </footer>
      <!--UnAuthenticated Footer-->
      <!--Authenticated Footer-->
      <!--pla-->

</div><!--end of format-->
  


</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router';
import { useAuthStore } from '~/stores/auth';
import LinkedAccountsModal from '~/components/LinkedAccountsModal.vue';
import AccountManagementModal from '~/components/AccountManagementModal.vue';

import { Bars3Icon, XMarkIcon } from '@heroicons/vue/24/outline'

const auth = useAuthStore();
const { isNarrow } = useMobileShell();
const isNarrowViewport = computed(() => isNarrow.value);
const showAccountManagement = ref(false);
const showLinkedAccounts = ref(false);
const links = computed(() => {
  if (auth.user) {
    return [
      { name: 'Estate Management', path: '/estate_mgmt' },
      { name: 'Budget Setup', path: '/cash_flow_mgmt' },
      { name: 'Budget Tracker', path: '/cash_flow_tracker' },
    ];
  }
  return [{ name: 'Login', path: '/login' }];
});
const route = useRoute();

async function logoutFromMenu(close) {
  close?.();
  const { signOut } = useSignOut();
  await signOut();
}

function openAccountManagement(close) {
  close?.();
  showAccountManagement.value = true;
}

function openLinkedAccounts(close) {
  close?.();
  showLinkedAccounts.value = true;
}

onMounted(() => {
  if (!auth.ready) {
    auth.fetchSession();
  }
});
/** Desktop nav pills (Tailwind Plus–style), themed for bg-primary */
function isNavLinkActive(path) {
  return route.path === path || route.path.startsWith(`${path}/`);
}

const getNavLinkClass = (path) => {
  const current = isNavLinkActive(path);
  return [
    current
      ? 'bg-black/25 text-white'
      : 'text-white/70 hover:bg-white/10 hover:text-white',
    'rounded-md px-3 py-2 text-sm font-medium no-underline',
  ];
};

/** Mobile disclosure panel links */
const getMobileNavClass = (path) => {
  const current = isNavLinkActive(path);
  return [
    current
      ? 'bg-black/25 text-white'
      : 'text-white/70 hover:bg-white/10 hover:text-white',
    'block rounded-md px-3 py-2 text-base font-medium no-underline',
  ];
};
</script>
<style>

</style>
   