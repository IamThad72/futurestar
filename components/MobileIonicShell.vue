<template>
  <div
    class="mobile-ionic-shell"
    :class="{ 'mobile-ionic-shell--editing': textFieldFocused }"
  >
    <ion-menu
      menu-id="app-nav"
      content-id="main-content"
      type="overlay"
    >
      <ion-header>
        <ion-toolbar>
          <ion-title>Future Star</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content>
        <ion-list>
          <ion-item
            v-for="link in links"
            :key="`menu-${link.name}`"
            button
            :detail="false"
            :class="{ 'app-menu-item--current': link.current }"
            @click="goAndClose(link.path)"
          >
            <ion-label>{{ link.name }}</ion-label>
          </ion-item>
        </ion-list>
        <template v-if="sectionTabs.length">
          <ion-list>
            <ion-list-header>{{ sectionLabel }}</ion-list-header>
            <ion-item
              v-for="tab in sectionTabs"
              :key="tab.href"
              button
              :detail="false"
              :class="{ 'app-menu-item--current': tab.current }"
              @click="goAndClose(tab.href)"
            >
              <ion-label>{{ tab.name }}</ion-label>
            </ion-item>
          </ion-list>
        </template>
      </ion-content>
    </ion-menu>

    <div id="main-content" class="ion-page">
      <ion-header>
        <ion-toolbar>
          <ion-buttons slot="start">
            <button
              v-if="links.length"
              type="button"
              class="mobile-menu-btn"
              aria-label="Open main menu"
              @click="toggleMenu"
            >
              <ion-icon :icon="menuOutline" aria-hidden="true" />
            </button>
          </ion-buttons>
          <ion-title>
            <button
              type="button"
              class="mobile-brand"
              @click="go('/')"
            >
              <span>Future Star</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="mobile-brand__icon"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
                />
              </svg>
            </button>
          </ion-title>
          <ion-buttons slot="end">
            <button
              v-if="!auth.user"
              type="button"
              class="mobile-login-btn"
              @click="go('/login')"
            >
              Login
            </button>
            <button
              v-else
              type="button"
              class="mobile-user-btn"
              aria-label="Open user menu"
              aria-haspopup="menu"
              :aria-expanded="userMenuOpen"
              @click="userMenuOpen = !userMenuOpen"
            >
              <img
                v-if="auth.user?.profile_photo"
                :src="auth.user.profile_photo"
                alt="Profile"
                class="mobile-user-btn__photo"
              />
              <span
                v-else
                class="mobile-user-btn__fallback"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
              </span>
            </button>
          </ion-buttons>
        </ion-toolbar>
        <ion-toolbar
          v-if="auth.user && (isFinancialSection || isPhysicalSection || isSpiritualSection)"
          class="mobile-section-toolbar"
        >
          <div class="mobile-section-toolbar__inner">
            <FinancialSectionNav v-if="isFinancialSection" embedded />
            <PhysicalSectionNav v-if="isPhysicalSection" embedded />
            <SpiritualSectionNav v-if="isSpiritualSection" embedded />
          </div>
        </ion-toolbar>
      </ion-header>

      <ion-content ref="contentRef" class="mobile-ionic-content">
        <div
          class="mobile-ionic-main"
          :class="{ 'mobile-ionic-main--flush-end': isSpiritualHome }"
        >
          <slot />
        </div>
      </ion-content>

      <ion-footer
        v-show="!textFieldFocused"
        class="mobile-ionic-footer"
      >
        <p class="mobile-ionic-footer__copy">
          &copy; 2026 Marcelli Enterprises LLC. All rights reserved.
        </p>
      </ion-footer>
    </div>

    <button
      v-if="userMenuOpen"
      type="button"
      class="mobile-user-menu-backdrop"
      aria-label="Close user menu"
      @click="userMenuOpen = false"
    />
    <div
      v-if="auth.user && userMenuOpen"
      class="app-user-menu mobile-user-menu-panel"
      role="menu"
    >
      <button
        type="button"
        class="app-user-menu__item"
        role="menuitem"
        @click="onOpenAccount"
      >
        Account Management
      </button>
      <button
        type="button"
        class="app-user-menu__item"
        role="menuitem"
        @click="onOpenLinked"
      >
        Linked Accounts
      </button>
      <button
        type="button"
        class="app-user-menu__item"
        role="menuitem"
        @click="logout"
      >
        Logout
      </button>
    </div>
  </div>
</template>

<script setup>
import {
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonMenu,
  IonTitle,
  IonToolbar,
} from "@ionic/vue";
import { menuOutline } from "ionicons/icons";

const emit = defineEmits(["open-account", "open-linked"]);

const {
  auth,
  route,
  isFinancialSection,
  isPhysicalSection,
  isSpiritualSection,
  isSpiritualHome,
  links,
  sectionTabs,
  sectionLabel,
} = useAppNav();
const { go } = useAppNavigate();
const contentRef = ref(null);
const userMenuOpen = ref(false);
const textFieldFocused = ref(false);
let blurHideTimer = 0;

const MENU_ID = "app-nav";

const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "radio",
  "file",
  "submit",
  "reset",
  "hidden",
  "range",
  "color",
  "image",
]);

function deepActiveElement() {
  let el = document.activeElement;
  while (el?.shadowRoot?.activeElement) {
    el = el.shadowRoot.activeElement;
  }
  return el;
}

function isTextEntryEl(el) {
  if (!el || el.nodeType !== 1) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (
    tag === "ION-INPUT" ||
    tag === "ION-TEXTAREA" ||
    tag === "ION-SEARCHBAR" ||
    tag === "ION-SELECT"
  ) {
    return true;
  }
  if (tag === "INPUT") {
    const type = (el.getAttribute("type") || "text").toLowerCase();
    return !NON_TEXT_INPUT_TYPES.has(type);
  }
  return Boolean(el.isContentEditable);
}

function onFocusIn(event) {
  if (!isTextEntryEl(event.target)) return;
  window.clearTimeout(blurHideTimer);
  textFieldFocused.value = true;
}

function onFocusOut() {
  window.clearTimeout(blurHideTimer);
  blurHideTimer = window.setTimeout(() => {
    textFieldFocused.value = isTextEntryEl(deepActiveElement());
  }, 50);
}

function menuEl() {
  return document.querySelector(`ion-menu[menu-id="${MENU_ID}"]`);
}

async function closeMenu() {
  try {
    const menu = menuEl();
    if (menu && (await menu.isOpen())) {
      await menu.close();
    }
  } catch {
    // Menu may not be registered yet (first paint / HMR).
  }
}

async function toggleMenu() {
  try {
    const menu = menuEl();
    if (!menu) return;
    if (await menu.isOpen()) {
      await menu.close();
    } else {
      await menu.open();
    }
  } catch {
    // Menu may not be registered yet (first paint / HMR).
  }
}

async function goAndClose(path) {
  userMenuOpen.value = false;
  await closeMenu();
  await go(path);
}

function onOpenAccount() {
  userMenuOpen.value = false;
  emit("open-account");
}

function onOpenLinked() {
  userMenuOpen.value = false;
  emit("open-linked");
}

async function logout() {
  userMenuOpen.value = false;
  await closeMenu();
  const { signOut } = useSignOut();
  await signOut();
}

watch(
  () => route.fullPath,
  async () => {
    userMenuOpen.value = false;
    textFieldFocused.value = false;
    await closeMenu();
    const el = contentRef.value?.$el;
    if (el && typeof el.scrollToTop === "function") {
      el.scrollToTop(0);
    }
  },
);

onMounted(() => {
  document.addEventListener("focusin", onFocusIn, true);
  document.addEventListener("focusout", onFocusOut, true);
});

onBeforeUnmount(() => {
  document.removeEventListener("focusin", onFocusIn, true);
  document.removeEventListener("focusout", onFocusOut, true);
  window.clearTimeout(blurHideTimer);
  void closeMenu();
});
</script>
