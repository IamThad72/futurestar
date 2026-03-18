<template>
  <div class="h-screen flex flex-col">
     <!-- FIXED NAVBAR -->
     <!--Unathenticated Navbar-->
     <HeadlessDisclosure  as="nav" class="bg-primary shadow" v-slot="{ open, close }">
      <div class="mx-auto max-w-full px-4 sm:px-6 lg:px-8">
        <div class="flex min-h-12 items-center justify-between">
          <div class="flex items-center">
            <!-- <div class="flex shrink-0 items-center">
              <img class="h-8 w-auto" src="/images/3SLogo3.png" alt="Your Company" />
            </div> -->
            <NuxtLink to="/" class="flex shrink-0 items-center text-white font-bold text-lg hover:text-primary-content/80">
              Future Star
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="inline-block size-6 ml-2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
              </svg>
            </NuxtLink>
            <div class="hidden md:ml-6 md:flex md:space-x-8">
              <NuxtLink
                v-for="link in links"
                :key="link.name"
                :to="link.path"
                :class="getLinkClass(link.path)"
                class="inline-flex items-center px-1 pt-1 font-medium"
              >
                {{ link.name }}
              </NuxtLink>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <div v-if="links.length" class="-mr-2 flex items-center md:hidden">
              <!-- Mobile menu button -->
              <HeadlessDisclosureButton class="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-md p-2 text-primary-content hover:bg-secondary hover:text-primary-content focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-content">
                <span class="absolute -inset-0.5"></span>
                <span class="sr-only">Open main menu</span>
                <Bars3Icon v-if="!open" class="block size-6" aria-hidden="true" />
                <XMarkIcon v-else class="block size-6" aria-hidden="true" />
              </HeadlessDisclosureButton>
            </div>
            <div v-if="auth.user" class="flex">
              <HeadlessMenu v-slot="{ close }" as="div" class="relative" @focusout="(e) => { if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget)) close(); }">
                <HeadlessMenuButton class="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-primary-content hover:bg-primary-focus">
                  <div class="avatar placeholder">
                    <div class="w-8 rounded-full bg-secondary text-secondary-content flex items-center justify-center overflow-hidden">
                      <img
                        v-if="auth.user?.profile_photo"
                        :src="auth.user.profile_photo"
                        alt="Profile"
                        class="w-full h-full object-cover"
                      />
                      <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                      </svg>
                    </div>
                  </div>
                  <span class="hidden md:inline text-sm font-medium">{{ userEmail }}</span>
                  <svg class="hidden md:block size-4" fill="none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
                </HeadlessMenuButton>
                <HeadlessMenuItems
                  class="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-primary overflow-hidden shadow-lg border border-blue-900 focus:outline-none"
                >
                  <div class="flex justify-between items-center bg-white px-2 py-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6 text-blue-600 shrink-0">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                    </svg>
                    <button
                      type="button"
                      class="p-1 rounded text-blue-600 hover:bg-blue-50 focus:outline-none"
                      aria-label="Close menu"
                      @click="close"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div class="py-1 px-1">
                  <HeadlessMenuItem v-slot="{ active }">
                    <button
                      type="button"
                      :class="[active ? 'bg-secondary border-l-2 border-l-primary-content' : 'border-l-2 border-l-transparent', 'block w-full px-4 py-2 text-left text-sm font-medium text-primary-content hover:bg-secondary hover:text-primary-content hover:border-l-primary-content']"
                      @click="showAccountManagement = true"
                    >
                      Account Management
                    </button>
                  </HeadlessMenuItem>
                  <HeadlessMenuItem v-slot="{ active }">
                    <button
                      type="button"
                      :class="[active ? 'bg-secondary border-l-2 border-l-primary-content' : 'border-l-2 border-l-transparent', 'block w-full px-4 py-2 text-left text-sm font-medium text-primary-content hover:bg-secondary hover:text-primary-content hover:border-l-primary-content']"
                      @click="showLinkedAccounts = true"
                    >
                      Linked Accounts
                    </button>
                  </HeadlessMenuItem>
                  <HeadlessMenuItem v-slot="{ active }">
                    <NuxtLink
                      to="/logout"
                      :class="[active ? 'bg-secondary border-l-2 border-l-primary-content' : 'border-l-2 border-l-transparent', 'block w-full px-4 py-2 text-left text-sm font-medium text-primary-content hover:bg-secondary hover:text-primary-content hover:border-l-primary-content']"
                    >
                      Logout
                    </NuxtLink>
                  </HeadlessMenuItem>
                  </div>
                </HeadlessMenuItems>
              </HeadlessMenu>
            </div>
          </div>
        </div>
      </div>
    
      <HeadlessDisclosurePanel class="md:hidden">
        <div class="space-y-1 pb-3 pt-2">
          <NuxtLink
            v-for="link in links"
            :key="link.name"
            :to="link.path"
            :class="getButtonClass(link.path)"
            as="a"
            class="block min-h-11 py-3 pl-4 pr-4 font-medium"
            @click="close()"
          >
            {{ link.name }}
          </NuxtLink>
        </div>
      </HeadlessDisclosurePanel>
      </HeadlessDisclosure>
    <!--Unathenticated Navbar-->
    <!--Athenticated Navbar-->
    <!--Athenticated Navbar-->

    
    
    
    
    <!-- SCROLLABLE MAIN CONTENT -->
    <div class="grow overflow-y-auto overflow-x-hidden">
      <main class="bg-ghost py-4 sm:py-6 px-2 sm:px-3">
        <NuxtPage />
      </main>
    </div>



    <AccountManagementModal v-model="showAccountManagement" />
    <LinkedAccountsModal v-model="showLinkedAccounts" />
    <!-- //FOOTER -->
    <!--UnAuthenticated Footer-->
        <footer class="bg-neutral pb-safe">
          <div class="mx-auto max-w-7xl px-4 py-2 md:flex md:items-center md:justify-between lg:px-4">
            <div class="flex justify-center gap-x-6 md:order-2">
              <a v-for="item in navigation" :key="item.name" :href="item.href" class="text-neutral-content hover:text-neutral-content/70">
                <span class="sr-only">{{ item.name }}</span>
                <component :is="item.icon" class="size-6" aria-hidden="true" />
              </a>
            </div>
            <p class="mt-0.5 text-center text-xs font-semibold text-neutral-content md:order-1 md:mt-0">&copy; 2024 Stock Star Sports, LLC. All rights reserved.</p>
          </div>
        </footer>
      <!--UnAuthenticated Footer-->
      <!--Authenticated Footer-->
      <!--pla-->

</div><!--end of format-->
  


</template>

<script setup>
import { defineComponent, computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router';
import { useAuthStore } from '~/stores/auth';
import LinkedAccountsModal from '~/components/LinkedAccountsModal.vue';
import AccountManagementModal from '~/components/AccountManagementModal.vue';

//import { Disclosure, DisclosureButton, DisclosurePanel} from '@headlessui/vue'
import { MagnifyingGlassIcon, AcademicCapIcon } from '@heroicons/vue/20/solid'
import { Bars3Icon, XMarkIcon } from '@heroicons/vue/24/outline'

const auth = useAuthStore();
const showAccountManagement = ref(false);
const showLinkedAccounts = ref(false);
const links = computed(() => {
  if (auth.user) {
    return [
      { name: 'Estate Management', path: '/estate_mgmt' },
      { name: 'Estate Summary', path: '/summary' },
      { name: 'Cash Flow Mgmt', path: '/cash_flow_mgmt' },
      { name: 'Cash Flow Tracker', path: '/cash_flow_tracker' },
    ];
  }
  return [
    { name: 'Register', path: '/register' },
    { name: 'Login', path: '/login' },
  ];
});
const userEmail = computed(() => auth.user?.email ?? "");

const route = useRoute();
onMounted(() => {
  if (!auth.ready) {
    auth.fetchSession();
  }
});
const getLinkClass = (path) => {
  return computed(() =>
    route.path === path
      ? 'border-b-2 border-primary-content text-primary-content'
      : 'border-b-2 border-transparent text-primary-content hover:border-primary-content/80 hover:text-primary-content/70'
  ).value;
};

const getButtonClass = (path) => {
  return route.path === path
    ? 'border-l-4 border-r-4 border-secondary-content bg-secondary text-secondary-content'
    : 'border-l-4 border-primary text-secondary-content hover:border-secondary-content hover:bg-secondary hover:text-secondary-content/70';
};
const navigation = [
  {
    name: 'Facebook',
    href: '#',
    icon: defineComponent({
      render: () =>
        h('svg', { fill: 'currentColor', viewBox: '0 0 24 24' }, [
          h('path', {
            'fill-rule': 'evenodd',
            d: 'M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z',
            'clip-rule': 'evenodd',
          }),
        ]),
    }),
  },
  {
    name: 'Instagram',
    href: '#',
    icon: defineComponent({
      render: () =>
        h('svg', { fill: 'currentColor', viewBox: '0 0 24 24' }, [
          h('path', {
            'fill-rule': 'evenodd',
            d: 'M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z',
            'clip-rule': 'evenodd',
          }),
        ]),
    }),
  },
  {
    name: 'X',
    href: '#',
    icon: defineComponent({
      render: () =>
        h('svg', { fill: 'currentColor', viewBox: '0 0 24 24' }, [
          h('path', {
            d: 'M13.6823 10.6218L20.2391 3H18.6854L12.9921 9.61788L8.44486 3H3.2002L10.0765 13.0074L3.2002 21H4.75404L10.7663 14.0113L15.5685 21H20.8131L13.6819 10.6218H13.6823ZM11.5541 13.0956L10.8574 12.0991L5.31391 4.16971H7.70053L12.1742 10.5689L12.8709 11.5655L18.6861 19.8835H16.2995L11.5541 13.096V13.0956Z',
          }),
        ]),
    }),
  },
  {
    name: 'GitHub',
    href: '#',
    icon: defineComponent({
      render: () =>
        h('svg', { fill: 'currentColor', viewBox: '0 0 24 24' }, [
          h('path', {
            'fill-rule': 'evenodd',
            d: 'M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z',
            'clip-rule': 'evenodd',
          }),
        ]),
    }),
  },
  {
    name: 'YouTube',
    href: '#',
    icon: defineComponent({
      render: () =>
        h('svg', { fill: 'currentColor', viewBox: '0 0 24 24' }, [
          h('path', {
            'fill-rule': 'evenodd',
            d: 'M19.812 5.418c.861.23 1.538.907 1.768 1.768C21.998 8.746 22 12 22 12s0 3.255-.418 4.814a2.504 2.504 0 0 1-1.768 1.768c-1.56.419-7.814.419-7.814.419s-6.255 0-7.814-.419a2.505 2.505 0 0 1-1.768-1.768C2 15.255 2 12 2 12s0-3.255.417-4.814a2.507 2.507 0 0 1 1.768-1.768C5.744 5 11.998 5 11.998 5s6.255 0 7.814.418ZM15.194 12 10 15V9l5.194 3Z',
            'clip-rule': 'evenodd',
          }),
        ]),
    }),
  },
]
</script>
<style>

</style>
   