<template>
  <div
    class="mobile-ionic-shell"
    :class="{ 'mobile-ionic-shell--editing': textFieldFocused }"
  >
    <div id="main-content" class="ion-page">
      <ion-header>
        <ion-toolbar>
          <ion-buttons slot="start">
            <button
              type="button"
              class="mobile-brand"
              aria-label="Home"
              @click="go('/')"
            >
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
          </ion-buttons>
          <ion-title>{{ screenTitle }}</ion-title>
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
        v-if="auth.user"
        v-show="!textFieldFocused"
        class="mobile-area-bar"
      >
        <nav class="mobile-area-bar__nav" aria-label="Areas of life">
          <button
            v-for="link in links"
            :key="link.path"
            type="button"
            class="mobile-area-bar__item"
            :aria-current="link.current ? 'page' : undefined"
            @click="go(link.path)"
          >
            {{ link.name }}
          </button>
        </nav>
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
  IonTitle,
  IonToolbar,
} from "@ionic/vue";

const emit = defineEmits(["open-account", "open-linked"]);

const {
  auth,
  route,
  isSpiritualHome,
  links,
  screenTitle,
} = useAppNav();
const { go } = useAppNavigate();
const contentRef = ref(null);
const userMenuOpen = ref(false);
const textFieldFocused = ref(false);
let blurHideTimer = 0;

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
  const { signOut } = useSignOut();
  await signOut();
}

watch(
  () => route.fullPath,
  () => {
    userMenuOpen.value = false;
    textFieldFocused.value = false;
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
});
</script>
